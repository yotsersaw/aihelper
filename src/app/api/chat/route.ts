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
const HISTORY_WINDOW = 10;

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

    const openrouterMessages = [
      { role: "system", content: bot.system_prompt },
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ];

    // Call OpenRouter
    const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
        "X-Title": "AI Widget"
      },
      body: JSON.stringify({
        model: bot.model,
        temperature: bot.temperature,
        max_tokens: bot.max_completion_tokens,
        messages: openrouterMessages
      })
    });

    if (!llmRes.ok) {
      const txt = await llmRes.text();
      return NextResponse.json({ error: `OpenRouter error: ${txt}` }, { status: 502 });
    }

    const data: any = await llmRes.json();
    const reply =
      data.choices?.[0]?.message?.content?.trim() ||
      data.choices?.[0]?.text?.trim() ||
      "Извините, не получилось сгенерировать ответ.";

    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;
    const cost = estimateCost(totalTokens, bot.model);

    // Save assistant message
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: reply,
      token_count: totalTokens,
      cost
    });

    // Update daily usage
    const today = new Date().toISOString().slice(0, 10);
    await supabase.rpc("upsert_usage_daily", {
      p_bot_id: bot.id,
      p_usage_date: today,
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