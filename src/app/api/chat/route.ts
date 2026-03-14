import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { estimateCost, fallbackMessage, isOriginAllowed } from "@/lib/chat";
import { env } from "@/lib/env";
import { getServiceSupabase } from "@/lib/supabase";

const schema = z.object({
  botId: z.string().min(2),
  message: z.string().min(1).max(4000),
  sessionId: z.string().min(8),
  pageUrl: z.string().url().optional()
});

// Keep only last N messages to prevent context overflow
const HISTORY_WINDOW = 20;

// Fallback message when all models are down
const ALL_MODELS_FAILED =
  "I'm having technical difficulties right now. Please leave your phone number or email and we'll get back to you shortly!";

async function callOpenRouter(
  model: string,
  messages: any[],
  temperature: number,
  maxTokens: number
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
        "X-Title": "AI Widget"
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages
      })
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[Chat] Model ${model} failed: ${res.status} ${txt}`);
      return { ok: false, error: txt };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    console.error(`[Chat] Model ${model} exception:`, e);
    return { ok: false, error: String(e) };
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = schema.parse(await req.json());
    const supabase = getServiceSupabase();

    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .eq("public_bot_id", payload.botId)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    if (!bot.is_active) {
      return NextResponse.json({ error: "Bot inactive" }, { status: 403 });
    }

    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const appHost = new URL(env.NEXT_PUBLIC_APP_URL).hostname;
    const fromOwnApp = [origin, referer].some((v) =>
      v ? new URL(v).hostname === appHost : false
    );

    if (!fromOwnApp && !isOriginAllowed(bot.allowed_domain, origin, referer)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    // Monthly limit check
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data: usageRows } = await supabase
      .from("usage_daily")
      .select("total_tokens, total_cost")
      .eq("bot_id", bot.id)
      .gte("usage_date", monthStart.toISOString().slice(0, 10));

    const usedTokens = usageRows?.reduce((s, r) => s + r.total_tokens, 0) ?? 0;
    const usedCost = usageRows?.reduce((s, r) => s + Number(r.total_cost), 0) ?? 0;
    const hitLimit =
      usedTokens >= bot.monthly_token_limit ||
      usedCost >= Number(bot.monthly_cost_limit);

    // Upsert conversation
    const { data: conversation } = await supabase
      .from("conversations")
      .upsert(
        {
          bot_id: bot.id,
          session_id: payload.sessionId,
          source_page: payload.pageUrl || null,
          last_message_at: new Date().toISOString()
        },
        { onConflict: "bot_id,session_id" }
      )
      .select("id")
      .single();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation error" }, { status: 500 });
    }

    // Save user message
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: payload.message,
      token_count: 0,
      cost: 0
    });

    if (hitLimit) {
      const fallback = fallbackMessage();
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: fallback,
        token_count: 0,
        cost: 0
      });
      return NextResponse.json({ reply: fallback, limited: true });
    }

    // Get last N messages only (sliding window)
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_WINDOW);

    // Reverse to chronological order
    const messages = (history || []).reverse();

    // Current date for the bot to know today's date
    const today = new Date().toLocaleDateString("ru-RU", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const systemPrompt = `Сегодня ${today}.\n\n${bot.system_prompt}`;

    const openrouterMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ];

    // Parse models — поддерживаем несколько через запятую
    const models = (bot.model as string)
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    // Пробуем каждую модель по очереди
    let llmData: any = null;
    let usedModel = models[0];

    for (const model of models) {
      console.log(`[Chat] Trying model: ${model}`);
      const result = await callOpenRouter(
        model,
        openrouterMessages,
        bot.temperature,
        bot.max_completion_tokens
      );

      if (result.ok && result.data) {
        llmData = result.data;
        usedModel = model;
        console.log(`[Chat] Model ${model} succeeded`);
        break;
      }

      console.warn(`[Chat] Model ${model} failed, trying next...`);
    }

    // Все модели упали — отвечаем вежливым сообщением с просьбой оставить контакт
    if (!llmData) {
      console.error(`[Chat] All models failed for bot ${bot.id}`);
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: ALL_MODELS_FAILED,
        token_count: 0,
        cost: 0
      });
      return NextResponse.json({ reply: ALL_MODELS_FAILED, limited: false });
    }

    const reply =
      llmData.choices?.[0]?.message?.content?.trim() ||
      llmData.choices?.[0]?.text?.trim() ||
      "Sorry, I couldn't generate a response.";

    const promptTokens = llmData.usage?.prompt_tokens ?? 0;
    const completionTokens = llmData.usage?.completion_tokens ?? 0;
    const totalTokens = llmData.usage?.total_tokens ?? promptTokens + completionTokens;
    const cost = estimateCost(totalTokens, usedModel);

    // Save assistant message
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: reply,
      token_count: totalTokens,
      cost
    });

    // Update daily usage
    const todayDate = new Date().toISOString().slice(0, 10);
    await supabase.rpc("upsert_usage_daily", {
      p_bot_id: bot.id,
      p_usage_date: todayDate,
      p_prompt_tokens: promptTokens,
      p_completion_tokens: completionTokens,
      p_total_tokens: totalTokens,
      p_total_cost: cost
    });

    return NextResponse.json({ reply, limited: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}