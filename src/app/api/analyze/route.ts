import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { env } from "@/lib/env";

const DEFAULT_ANALYSIS_PROMPT =
  'Извлеки из разговора: имя клиента, телефон, email (если есть), суть обращения. Верни JSON: {"name":"...","phone":"...","email":"...","note":"...","has_contact":true/false}. Если контактных данных нет — has_contact: false.';

async function sendLeadEmail(
  to: string,
  companyName: string,
  lead: { name?: string; phone?: string; email?: string; note?: string }
) {
  if (!process.env.RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
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
        ${lead.note ? `<p><b>Суть запроса:</b> ${lead.note}</p>` : ""}
      `,
    }),
  });
}

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    }
  );
  // Логируем ошибки Telegram чтобы видеть их в Vercel Logs
  if (!res.ok) {
    const err = await res.text();
    console.error("[Telegram] sendMessage failed:", err);
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // ФИХ #1: ищем analyzed=false И analyzed=null (новые строки без дефолта)
  // ФИХ #2: last_message_at=null тоже берём в обработку
  const { data: conversationsRaw, error } = await supabase
    .from("conversations")
    .select(
      "id, session_id, bot_id, bots(company_name, handoff_email, analysis_model, analysis_prompt, enable_analysis, telegram_enabled, telegram_chat_id)"
    )
    .or("analyzed.eq.false,analyzed.is.null")          // ФИХ #1
    .or(`last_message_at.lt.${cutoff},last_message_at.is.null`) // ФИХ #2
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
    // ФИХ #3: НЕ помечаем analyzed=true заранее — только после успешной обработки
    const bot =
      Array.isArray(conv.bots) ? conv.bots[0] ?? null : (conv.bots as any);

    // Если анализ отключён — просто помечаем как обработанный и пропускаем
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
      // Слишком короткий диалог — помечаем чтобы не гонять повторно
      await supabase
        .from("conversations")
        .update({ analyzed: true, analyzed_at: new Date().toISOString() })
        .eq("id", conv.id);
      console.log(`[Analyze] conv ${conv.id}: too short (${messages?.length ?? 0} msgs), skipping`);
      continue;
    }

    const dialog = messages
      .map((m) => `${m.role === "user" ? "Клиент" : "Бот"}: ${m.content}`)
      .join("\n");

    console.log(`[Analyze] conv ${conv.id}: sending to LLM, dialog length=${dialog.length}`);

    const analysisModel = bot.analysis_model || "openai/gpt-4o-mini";
    const analysisPrompt = bot.analysis_prompt || DEFAULT_ANALYSIS_PROMPT;

    const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
        "X-Title": "AI Widget",
      },
      body: JSON.stringify({
        model: analysisModel,
        temperature: 0,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content: `${analysisPrompt}\n\nОтвечай ТОЛЬКО валидным JSON без markdown и пояснений.`,
          },
          {
            role: "user",
            content: `Проанализируй диалог:\n\n${dialog}`,
          },
        ],
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error(`[Analyze] conv ${conv.id}: LLM error ${llmRes.status}:`, errText);
      // Не помечаем analyzed=true — попробуем в следующем cron-цикле
      continue;
    }

    const llmData: any = await llmRes.json();
    const raw = llmData.choices?.[0]?.message?.content?.trim() || "";
    console.log(`[Analyze] conv ${conv.id}: LLM raw response:`, raw);

    let parsed: any;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error(`[Analyze] conv ${conv.id}: JSON parse failed, raw was:`, raw);
      // Помечаем analyzed чтобы не застрять в бесконечном цикле
      await supabase
        .from("conversations")
        .update({ analyzed: true, analyzed_at: new Date().toISOString() })
        .eq("id", conv.id);
      continue;
    }

    console.log(`[Analyze] conv ${conv.id}: parsed=`, parsed);

    // Всегда помечаем как analyzed после успешного LLM-ответа
    await supabase
      .from("conversations")
      .update({ analyzed: true, analyzed_at: new Date().toISOString() })
      .eq("id", conv.id);

    if (!parsed.has_contact) {
      console.log(`[Analyze] conv ${conv.id}: no contact info, lead not created`);
      continue;
    }

    const { error: leadError } = await supabase.from("leads").insert({
      bot_id: conv.bot_id,
      session_id: conv.session_id,
      name: parsed.name || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      note: parsed.note || parsed.summary || null,
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
        parsed.note ? `💬 <b>Note:</b> ${parsed.note}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      await sendTelegramMessage(bot.telegram_chat_id, msg);
      console.log(`[Analyze] conv ${conv.id}: telegram sent to ${bot.telegram_chat_id}`);
    }

    processed++;
  }

  console.log(`[Analyze] Done. processed=${processed}`);
  return NextResponse.json({ processed });
}