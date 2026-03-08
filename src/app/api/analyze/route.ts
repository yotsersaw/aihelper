import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { env } from "@/lib/env";

type BotRelation =
  | {
      company_name: string;
      handoff_email: string | null;
      system_prompt?: string | null;
    }
  | {
      company_name: string;
      handoff_email: string | null;
      system_prompt?: string | null;
    }[]
  | null;

type AnalyzeConversation = {
  id: string;
  session_id: string;
  bot_id: string;
  bots: BotRelation;
};

async function sendLeadEmail(
  to: string,
  companyName: string,
  lead: { name?: string; phone?: string; email?: string; summary?: string }
) {
  if (!process.env.RESEND_API_KEY) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "AI Assistant <onboarding@resend.dev>",
      to,
      subject: `Новый лид — ${companyName}`,
      html: `
        <h2>Новый лид с сайта</h2>
        <p><b>Компания:</b> ${companyName}</p>
        ${lead.name ? `<p><b>Имя:</b> ${lead.name}</p>` : ""}
        ${lead.phone ? `<p><b>Телефон:</b> ${lead.phone}</p>` : ""}
        ${lead.email ? `<p><b>Email:</b> ${lead.email}</p>` : ""}
        ${lead.summary ? `<p><b>Суть запроса:</b> ${lead.summary}</p>` : ""}
      `
    })
  });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: conversationsRaw, error: conversationsError } = await supabase
    .from("conversations")
    .select("id, session_id, bot_id, bots(company_name, handoff_email, system_prompt)")
    .eq("analyzed", false)
    .lt("last_message_at", cutoff)
    .limit(10);

  if (conversationsError) {
    return NextResponse.json({ error: conversationsError.message }, { status: 500 });
  }

  const conversations = (conversationsRaw ?? []) as AnalyzeConversation[];

  if (conversations.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;

  for (const conv of conversations) {
    await supabase
      .from("conversations")
      .update({ analyzed: true, analyzed_at: new Date().toISOString() })
      .eq("id", conv.id);

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });

    if (messagesError || !messages || messages.length < 2) {
      continue;
    }

    const dialog = messages
      .map((m) => `${m.role === "user" ? "Клиент" : "Бот"}: ${m.content}`)
      .join("\n");

    const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
        "X-Title": "AI Widget MVP"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              'Ты анализируешь диалог между ботом и клиентом. Извлеки контактные данные если они есть. Отвечай ТОЛЬКО валидным JSON без markdown, без пояснений. Формат: {"name":"...", "phone":"...", "email":"...", "summary":"...", "has_contact":true/false}. Если данных нет — верни has_contact: false и пустые строки.'
          },
          {
            role: "user",
            content: `Проанализируй диалог:\n\n${dialog}`
          }
        ]
      })
    });

    if (!llmRes.ok) {
      continue;
    }

    const llmData: any = await llmRes.json();
    const raw = llmData.choices?.[0]?.message?.content?.trim() || "";

    let parsed: {
      name?: string;
      phone?: string;
      email?: string;
      summary?: string;
      has_contact?: boolean;
    };

    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    if (!parsed.has_contact) {
      continue;
    }

    const bot = Array.isArray(conv.bots) ? conv.bots[0] ?? null : conv.bots;

    await supabase.from("leads").insert({
      bot_id: conv.bot_id,
      session_id: conv.session_id,
      name: parsed.name || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      note: parsed.summary || null
    });

    if (bot?.handoff_email) {
      await sendLeadEmail(bot.handoff_email, bot.company_name, {
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        summary: parsed.summary
      });
    }

    processed++;
  }

  return NextResponse.json({ processed });
}