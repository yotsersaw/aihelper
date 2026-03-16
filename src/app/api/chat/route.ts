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

const HISTORY_WINDOW = 20;

const ALL_MODELS_FAILED =
  "I'm having technical difficulties right now. Please leave your phone number or email and we'll get back to you shortly!";

function extractReply(data: any): string {
  const raw =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    "";

  if (typeof raw === "string") {
    return raw.trim();
  }

  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && typeof part.text === "string") return part.text;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

async function callOpenRouter(
  model: string,
  messages: any[],
  temperature: number,
  maxTokens: number
): Promise<{ ok: boolean; data?: any; reply?: string; error?: string }> {
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

    const rawText = await res.text();

    if (!res.ok) {
      console.error(`[Chat] Model ${model} failed: ${res.status} ${rawText}`);
      return { ok: false, error: rawText };
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error(`[Chat] Model ${model} returned invalid JSON:`, rawText);
      return { ok: false, error: "Invalid JSON from OpenRouter" };
    }

    if (data?.error) {
      console.error(`[Chat] Model ${model} returned API error:`, data.error);
      return {
        ok: false,
        error: typeof data.error === "string" ? data.error : JSON.stringify(data.error)
      };
    }

    const reply = extractReply(data);

    if (!reply) {
      console.error(`[Chat] Model ${model} returned empty reply:`, rawText);
      return { ok: false, error: "Empty reply from model" };
    }

    return { ok: true, data, reply };
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

    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_WINDOW);

    const messages = (history || []).reverse();

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

    const models = String(bot.model || "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    if (models.length === 0) {
      return NextResponse.json({ error: "No chat models configured" }, { status: 500 });
    }

    let llmData: any = null;
    let reply = "";
    let usedModel = models[0];

    for (const model of models) {
      console.log(`[Chat] Trying model: ${model}`);

      const result = await callOpenRouter(
        model,
        openrouterMessages,
        bot.temperature,
        bot.max_completion_tokens
      );

      if (result.ok && result.data && result.reply) {
        llmData = result.data;
        reply = result.reply;
        usedModel = model;
        console.log(`[Chat] Model ${model} succeeded`);
        break;
      }

      console.warn(`[Chat] Model ${model} failed, trying next...`, result.error);
    }

    if (!llmData || !reply) {
      console.error(`[Chat] All models failed for bot ${bot.id}`);
      const fallback = ALL_MODELS_FAILED;

      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: fallback,
        token_count: 0,
        cost: 0
      });

      return NextResponse.json({ reply: fallback, limited: false });
    }

    const promptTokens = llmData.usage?.prompt_tokens ?? 0;
    const completionTokens = llmData.usage?.completion_tokens ?? 0;
    const totalTokens = llmData.usage?.total_tokens ?? promptTokens + completionTokens;
    const cost = estimateCost(totalTokens, usedModel);

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: reply,
      token_count: totalTokens,
      cost
    });

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
