import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const convId = searchParams.get("id");
  if (!convId) return NextResponse.json({ error: "no id" });

  const supabase = getServiceSupabase();
  const log: any[] = [];

  const { data: conv, error } = await supabase
    .from("conversations")
    .select("id, session_id, bot_id, bots(company_name, handoff_email, analysis_model, analysis_prompt, enable_analysis, telegram_enabled, telegram_chat_id)")
    .eq("id", convId)
    .single();

  if (error) return NextResponse.json({ error: error.message });
  log.push({ step: "conv", bot: conv?.bots });

  const bot = Array.isArray(conv.bots) ? conv.bots[0] : conv.bots as any;
  log.push({ step: "bot", enable_analysis: bot?.enable_analysis, analysis_model: bot?.analysis_model });

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });

  log.push({ step: "messages", count: messages?.length });

  const dialog = messages?.map((m: any) => `${m.role === "user" ? "Клиент" : "Бот"}: ${m.content}`).join("\n");

  const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "AI Widget"
    },
    body: JSON.stringify({
      model: bot?.analysis_model || "openai/gpt-4o-mini",
      temperature: 0,
      max_tokens: 400,
      messages: [
        { role: "system", content: 'Извлеки имя, телефон, email, суть. Верни JSON: {"name":"...","phone":"...","email":"...","note":"...","has_contact":true/false}. ТОЛЬКО JSON.' },
        { role: "user", content: `Диалог:\n${dialog}` }
      ]
    })
  });

  const llmData: any = await llmRes.json();
  const raw = llmData.choices?.[0]?.message?.content?.trim();
  log.push({ step: "llm", status: llmRes.status, raw });

  let parsed: any;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch(e) {
    log.push({ step: "parse_error", raw });
    return NextResponse.json({ log });
  }

  log.push({ step: "parsed", parsed });
  return NextResponse.json({ log });
}
