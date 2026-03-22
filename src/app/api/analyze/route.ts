import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getServiceSupabase } from "@/lib/supabase";

const DEFAULT_ANALYSIS_PROMPT =
  'Extract from the conversation: client name, phone, email (if present), messenger contact (Telegram / WhatsApp / Instagram if mentioned), and the reason for inquiry. Return ONLY valid JSON in one line: {"name":"...","phone":"...","email":"...","messenger":"...","note":"...","has_contact":true/false}. Set has_contact=true only if there is a real contact method for follow-up: phone, email, or messenger. No markdown, no explanations.';

type BotRelation =
  | {
      company_name: string;
      handoff_email: string | null;
      analysis_model?: string | null;
      analysis_prompt?: string | null;
      enable_analysis?: boolean | null;
      telegram_enabled?: boolean | null;
      telegram_chat_id?: string | null;
    }
  | {
      company_name: string;
      handoff_email: string | null;
      analysis_model?: string | null;
      analysis_prompt?: string | null;
      enable_analysis?: boolean | null;
      telegram_enabled?: boolean | null;
      telegram_chat_id?: string | null;
    }[];

type ParsedLead = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  messenger?: string | null;
  note?: string | null;
  has_contact?: boolean | null;
};

function splitModels(value: string | null | undefined) {
  return (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v : null;
}

function stripCodeFences(raw: string) {
  return raw.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function extractJsonCandidate(raw: string) {
  const cleaned = stripCodeFences(raw);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.slice(start, end + 1);
  }
  return cleaned;
}

function tryParseLead(raw: string): ParsedLead | null {
  const candidates = [
    extractJsonCandidate(raw),
    extractJsonCandidate(raw).replace(/,\s*([}\]])/g, "$1"),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as ParsedLead;
      return {
        name: cleanText(parsed.name),
        phone: cleanText(parsed.phone),
        email: cleanText(parsed.email),
        messenger: cleanText(parsed.messenger),
        note: cleanText(parsed.note),
        has_contact: Boolean(parsed.has_contact),
      };
    } catch {
      // continue
    }
  }

  return null;
}

function extractPhone(dialog: string) {
  const match = dialog.match(
    /(?:\+?\d[\d\s().-]{6,}\d)/g
  );
  if (!match?.length) return null;

  for (const item of match) {
    const digits = item.replace(/\D/g, "");
    if (digits.length >= 7) return item.trim();
  }

  return null;
}

function extractEmail(dialog: string) {
  const match = dialog.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || null;
}

function extractMessenger(dialog: string) {
  const tg = dialog.match(/@([a-zA-Z0-9_]{5,32})/);
  if (tg) return `Telegram: @${tg[1]}`;

  const wa = dialog.match(/whatsapp[:\s]+([+\d][\d\s().-]{6,}\d)/i);
  if (wa) return `WhatsApp: ${wa[1].trim()}`;

  const ig = dialog.match(/instagram[:\s]+@?([a-zA-Z0-9._]{2,30})/i);
  if (ig) return `Instagram: @${ig[1]}`;

  return null;
}

function getLastUserMessage(
  messages: Array<{ role: string; content: string | null }>
) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user" && m.content);
  return lastUser?.content?.trim() || null;
}

function buildDialog(messages: Array<{ role: string; content: string | null }>) {
  return messages
    .filter((m) => m.content)
    .map((m) => `${m.role === "user" ? "Visitor" : "Bot"}: ${m.content}`)
    .join("\n");
}

function buildLeadMessage(params: {
  companyName: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  messenger: string | null;
  note: string | null;
}) {
  const lines = [
    `🔔 New Lead — ${params.companyName}`,
    `👤 Name: ${params.name || "-"}`,
    `📞 Phone: ${params.phone || "-"}`,
  ];

  if (params.email) lines.push(`✉️ Email: ${params.email}`);
  if (params.messenger) lines.push(`💬 Messenger: ${params.messenger}`);
  if (params.note) lines.push(`📝 Note: ${params.note}`);

  return lines.join("\n");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function markAnalyzed(id: string) {
  const supabase = getServiceSupabase();
  await supabase
    .from("conversations")
    .update({
      analyzed: true,
      analyzed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function sendLeadEmail(to: string, subject: string, text: string) {
  if (!env.RESEND_API_KEY) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Selvanto <hello@mg.selvanto.com>",
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed: ${res.status} ${body}`);
  }
}

async function sendTelegramMessage(chatId: string, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN) return;

  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram failed: ${res.status} ${body}`);
  }
}

async function callAnalysisModel(model: string, prompt: string, dialog: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "AI Widget",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `${prompt}\n\nImportant: return ONLY valid one-line JSON.`,
        },
        {
          role: "user",
          content: `Conversation:\n${dialog}`,
        },
      ],
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${text}`);
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`OpenRouter non-JSON response: ${text}`);
  }

  const raw = data?.choices?.[0]?.message?.content?.trim();

  if (!raw) {
    throw new Error(`Empty model reply: ${text}`);
  }

  return raw;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const cutoff = Date.now() - 5 * 60 * 1000;

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      "id, session_id, bot_id, created_at, last_message_at, analyzed, bots(company_name, handoff_email, analysis_model, analysis_prompt, enable_analysis, telegram_enabled, telegram_chat_id)"
    )
    .or("analyzed.eq.false,analyzed.is.null")
    .order("created_at", { ascending: true })
    .limit(30);

  if (error) {
    console.error("[Analyze] conversations query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let scanned = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const conv of conversations || []) {
    scanned += 1;

    const convId = conv.id as string;
    const sessionId = conv.session_id as string;
    const botId = conv.bot_id as string;
    const lastMessageAt = conv.last_message_at
      ? new Date(String(conv.last_message_at)).getTime()
      : 0;

    if (lastMessageAt && lastMessageAt > cutoff) {
      continue;
    }

    const bot = Array.isArray(conv.bots)
      ? (conv.bots[0] as BotRelation extends any[] ? never : any)
      : (conv.bots as BotRelation);

    if (!bot) {
      console.warn(`[Analyze] conv ${convId}: bot relation missing`);
      await markAnalyzed(convId);
      skipped += 1;
      continue;
    }

    if (bot.enable_analysis === false) {
      await markAnalyzed(convId);
      skipped += 1;
      continue;
    }

    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("bot_id", botId)
      .eq("session_id", sessionId)
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      await markAnalyzed(convId);
      skipped += 1;
      continue;
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error(`[Analyze] conv ${convId}: messages query error`, messagesError);
      failed += 1;
      continue;
    }

    if (!messages?.length) {
      console.warn(`[Analyze] conv ${convId}: no messages`);
      await markAnalyzed(convId);
      skipped += 1;
      continue;
    }

    const dialog = buildDialog(messages as Array<{ role: string; content: string | null }>);
    const fallbackPhone = extractPhone(dialog);
    const fallbackEmail = extractEmail(dialog);
    const fallbackMessenger = extractMessenger(dialog);
    const fallbackNote = getLastUserMessage(messages as Array<{ role: string; content: string | null }>);

    const models = splitModels(bot.analysis_model).length
      ? splitModels(bot.analysis_model)
      : ["openai/gpt-4o-mini"];

    const prompt = (bot.analysis_prompt || DEFAULT_ANALYSIS_PROMPT).trim();

    let parsed: ParsedLead | null = null;
    let usedModel: string | null = null;

    for (const model of models) {
      let success = false;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const raw = await callAnalysisModel(model, prompt, dialog);
          const parsedRaw = tryParseLead(raw);

          if (!parsedRaw) {
            console.warn(
              `[Analyze] conv ${convId}: JSON parse failed on ${model} attempt ${attempt}, raw was: ${raw}`
            );
            if (attempt < 2) {
              await sleep(1500);
              continue;
            }
            break;
          }

          parsed = parsedRaw;
          usedModel = model;
          success = true;
          break;
        } catch (err) {
          console.warn(
            `[Analyze] conv ${convId}: model ${model} attempt ${attempt} failed:`,
            err
          );
          if (attempt < 2) {
            await sleep(1500);
          }
        }
      }

      if (success) break;
    }

    if (!parsed) {
      console.error(
        `[Analyze] conv ${convId}: all analysis models failed, leaving analyzed=false for retry`
      );
      failed += 1;
      continue;
    }

    const name = cleanText(parsed.name);
    const phone = cleanText(parsed.phone) || fallbackPhone;
    const email = cleanText(parsed.email) || fallbackEmail;
    const messenger = cleanText(parsed.messenger) || fallbackMessenger;

    let note = cleanText(parsed.note) || fallbackNote;
    if (messenger && note && !note.includes(messenger)) {
      note = `${note} | ${messenger}`;
    } else if (messenger && !note) {
      note = messenger;
    }

    const hasRealContact = Boolean(phone || email || messenger);

    if (!hasRealContact) {
      console.log(
        `[Analyze] conv ${convId}: parsed successfully with ${usedModel}, but no real contact found`
      );
      await markAnalyzed(convId);
      skipped += 1;
      continue;
    }

    const { error: insertError } = await supabase.from("leads").insert({
      bot_id: botId,
      session_id: sessionId,
      name,
      phone,
      email,
      note,
      status: "new",
    });

    if (insertError) {
      console.error(`[Analyze] conv ${convId}: lead insert error`, insertError);
      failed += 1;
      continue;
    }

    const notificationText = buildLeadMessage({
      companyName: bot.company_name || "Clinic",
      name,
      phone,
      email,
      messenger,
      note,
    });

    if (bot.handoff_email) {
      try {
        await sendLeadEmail(
          bot.handoff_email,
          `New Lead — ${bot.company_name || "Clinic"}`,
          notificationText
        );
      } catch (err) {
        console.error(`[Analyze] conv ${convId}: email send error`, err);
      }
    }

    if (bot.telegram_enabled && bot.telegram_chat_id) {
      try {
        await sendTelegramMessage(bot.telegram_chat_id, notificationText);
      } catch (err) {
        console.error(`[Analyze] conv ${convId}: telegram send error`, err);
      }
    }

    await markAnalyzed(convId);
    created += 1;

    console.log(
      `[Analyze] conv ${convId}: lead created successfully with ${usedModel}`
    );
  }

  return NextResponse.json({
    ok: true,
    scanned,
    created,
    skipped,
    failed,
  });
}
