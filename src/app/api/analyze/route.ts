import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { env } from "@/lib/env";

const DEFAULT_ANALYSIS_PROMPT =
  'Extract from the conversation: client name, phone, email, messenger contact (Telegram/Instagram/WhatsApp if mentioned), and the reason for inquiry. Return ONLY valid JSON: {"name":"...","phone":"...","email":"...","messenger":"...","note":"...","has_contact":true/false}. Set has_contact=true if at least one contact detail is present (name, phone, email or messenger).';

// Fallback models if analysis_model not set
const DEFAULT_ANALYSIS_MODELS = ["openai/gpt-4o-mini", "anthropic/claude-3-haiku"];

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
  error_code?: number;
  parameters?: {
    migrate_to_chat_id?: string | number;
  };
};

async function callLLM(
  model: string,
  systemPrompt: string,
  userContent: string
): Promise<{ ok: boolean; raw?: string; error?: string }> {
  try {
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
        max_tokens: 400,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[Analyze] Model ${model} failed: ${res.status} ${txt}`);
      return { ok: false, error: txt };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    return { ok: true, raw };
  } catch (e) {
    console.error(`[Analyze] Model ${model} exception:`, e);
    return { ok: false, error: String(e) };
  }
}

async function sendLeadEmail(
  to: string,
  companyName: string,
  lead: { name?: string; phone?: string; email?: string; messenger?: string; note?: string }
) {
  if (!process.env.RESEND_API_KEY) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Selvanto <hello@mg.selvanto.com>",
      to,
      subject: `New Lead — ${companyName}`,
      html: `
        <h2>New Lead</h2>
        <p><b>Company:</b> ${companyName}</p>
        ${lead.name ? `<p><b>Name:</b> ${lead.name}</p>` : ""}
        ${lead.phone ? `<p><b>Phone:</b> ${lead.phone}</p>` : ""}
        ${lead.email ? `<p><b>Email:</b> ${lead.email}</p>` : ""}
        ${lead.messenger ? `<p><b>Messenger:</b> ${lead.messenger}</p>` : ""}
        ${lead.note ? `<p><b>Note:</b> ${lead.note}</p>` : ""}
      `,
    }),
  });
}

async function sendTelegramMessage(
  supabase: ReturnType<typeof getServiceSupabase>,
  botId: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; chatId: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const initialChatId = String(chatId);

  if (!token) {
    console.error("[Telegram] TELEGRAM_BOT_TOKEN is missing");
    return { ok: false, chatId: initialChatId };
  }

  async function sendOnce(targetChatId: string): Promise<{
    ok: boolean;
    raw: string;
    data: TelegramApiResponse | null;
  }> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          text,
          parse_mode: "HTML",
        }),
      });

      const raw = await res.text();

      let data: TelegramApiResponse | null = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      return {
        ok: res.ok && data?.ok === true,
        raw,
        data,
      };
    } catch (e) {
      return {
        ok: false,
        raw: String(e),
        data: null,
      };
    }
  }

  const firstTry = await sendOnce(initialChatId);

  if (firstTry.ok) {
    return { ok: true, chatId: initialChatId };
  }

  const migratedChatId = firstTry.data?.parameters?.migrate_to_chat_id;

  if (migratedChatId && String(migratedChatId) !== initialChatId) {
    const newChatId = String(migratedChatId);

    console.warn(
      `[Telegram] chat migrated for bot ${botId}: ${initialChatId} -> ${newChatId}`
    );

    const { error: updateError } = await supabase
      .from("bots")
      .update({ telegram_chat_id: newChatId })
      .eq("id", botId)
      .eq("telegram_chat_id", initialChatId);

    if (updateError) {
      console.error("[Telegram] failed to save migrated chat id:", updateError);
      return { ok: false, chatId: initialChatId };
    }

    const secondTry = await sendOnce(newChatId);

    if (secondTry.ok) {
      return { ok: true, chatId: newChatId };
    }

    console.error("[Telegram] retry after migration failed:", secondTry.raw);
    return { ok: false, chatId: newChatId };
  }

  console.error("[Telegram] sendMessage failed:", firstTry.raw);
  return { ok: false, chatId: initialChatId };
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: conversationsRaw, error } = await supabase
    .from("conversations")
    .select(
      "id, session_id, bot_id, bots(company_name, handoff_email, analysis_model, analysis_prompt, enable_analysis, telegram_enabled, telegram_chat_id)"
    )
    .or("analyzed.eq.false,analyzed.is.null")
    .or(`last_message_at.lt.${cutoff},last_message_at.is.null`)
    .limit(10);

  if (error) {
    console.error("[Analyze] Query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const conversations = conversationsRaw ?? [];
  console.log(`[Analyze] Found ${conversations.length} conversations to process`);

  if (conversations.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;

  for (const conv of conversations) {
    const bot = Array.isArray(conv.bots) ? conv.bots[0] ?? null : (conv.bots as any);

    if (!bot || bot.enable_analysis === false) {
      await supabase
        .from("conversations")
        .update({ analyzed: true, analyzed_at: new Date().toISOString() })
        .eq("id", conv.id);

      console.log(`[Analyze] conv ${conv.id}: analysis disabled, skipping`);
      continue;
    }

    const { data: messages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });

    if (!messages || messages.length < 2) {
      await supabase
        .from("conversations")
        .update({ analyzed: true, analyzed_at: new Date().toISOString() })
        .eq("id", conv.id);

      console.log(`[Analyze] conv ${conv.id}: too short (${messages?.length ?? 0} msgs), skipping`);
      continue;
    }

    const dialog = messages
      .map((m) => `${m.role === "user" ? "Client" : "Bot"}: ${m.content}`)
      .join("\n");

    const analysisPrompt = bot.analysis_prompt || DEFAULT_ANALYSIS_PROMPT;
    const systemPrompt = `${analysisPrompt}\n\nReturn ONLY valid JSON, no markdown, no explanation.`;
    const userContent = `Analyze this dialog:\n\n${dialog}`;

    const configuredModels = ((bot.analysis_model as string) || "")
      .split(",")
      .map((m: string) => m.trim())
      .filter(Boolean);

    const models = configuredModels.length > 0 ? configuredModels : DEFAULT_ANALYSIS_MODELS;

    let raw = "";
    let success = false;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const attempts = i === 0 ? 2 : 1;

      for (let attempt = 1; attempt <= attempts; attempt++) {
        if (attempt > 1) {
          console.log(`[Analyze] conv ${conv.id}: retrying model ${model}...`);
          await new Promise((r) => setTimeout(r, 2000));
        }

        console.log(`[Analyze] conv ${conv.id}: trying model ${model} (attempt ${attempt})`);
        const result = await callLLM(model, systemPrompt, userContent);

        if (result.ok && result.raw) {
          raw = result.raw;
          success = true;
          console.log(`[Analyze] conv ${conv.id}: model ${model} succeeded`);
          break;
        }
      }

      if (success) break;
      console.warn(`[Analyze] conv ${conv.id}: model ${model} failed, trying next...`);
    }

    if (!success) {
      console.error(`[Analyze] conv ${conv.id}: all models failed, will retry next cron`);
      continue;
    }

    console.log(`[Analyze] conv ${conv.id}: LLM raw response:`, raw);

    let parsed: any;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error(`[Analyze] conv ${conv.id}: JSON parse failed, raw was:`, raw);
      await supabase
        .from("conversations")
        .update({ analyzed: true, analyzed_at: new Date().toISOString() })
        .eq("id", conv.id);
      continue;
    }

    console.log(`[Analyze] conv ${conv.id}: parsed=`, parsed);

    await supabase
      .from("conversations")
      .update({ analyzed: true, analyzed_at: new Date().toISOString() })
      .eq("id", conv.id);

    const hasContact =
      parsed.has_contact === true ||
      !!parsed.phone ||
      !!parsed.name ||
      !!parsed.email ||
      !!parsed.messenger;

    if (!hasContact) {
      console.log(`[Analyze] conv ${conv.id}: no contact info, lead not created`);
      continue;
    }

    const { error: leadError } = await supabase.from("leads").insert({
      bot_id: conv.bot_id,
      session_id: conv.session_id,
      name: parsed.name || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      note: (parsed.messenger ? `Messenger: ${parsed.messenger}\n` : "") + (parsed.note || parsed.summary || ""),
      status: "new",
    });

    if (leadError) {
      console.error(`[Analyze] conv ${conv.id}: lead insert error:`, leadError);
    } else {
      console.log(`[Analyze] conv ${conv.id}: lead created ✓`);
    }

    if (bot.handoff_email) {
      await sendLeadEmail(bot.handoff_email, bot.company_name, {
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        messenger: parsed.messenger,
        note: parsed.note || parsed.summary,
      });

      console.log(`[Analyze] conv ${conv.id}: email sent to ${bot.handoff_email}`);
    }

    if (bot.telegram_enabled && bot.telegram_chat_id) {
      const msg = [
        `🔔 <b>New Lead — ${bot.company_name}</b>`,
        ``,
        parsed.name ? `👤 <b>Name:</b> ${parsed.name}` : null,
        parsed.phone ? `📞 <b>Phone:</b> ${parsed.phone}` : null,
        parsed.email ? `📧 <b>Email:</b> ${parsed.email}` : null,
        parsed.messenger ? `💬 <b>Messenger:</b> ${parsed.messenger}` : null,
        parsed.note ? `📝 <b>Note:</b> ${parsed.note}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const telegramResult = await sendTelegramMessage(
        supabase,
        conv.bot_id,
        String(bot.telegram_chat_id),
        msg
      );

      if (telegramResult.ok) {
        console.log(`[Analyze] conv ${conv.id}: telegram sent to ${telegramResult.chatId}`);
      }
    }

    processed++;
  }

  console.log(`[Analyze] Done. processed=${processed}`);
  return NextResponse.json({ processed });
}
