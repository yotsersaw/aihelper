import { revalidatePath } from "next/cache";
import { getServiceSupabase } from "@/lib/supabase";
import Link from "next/link";

function normalizePaidUntil(value: FormDataEntryValue | null) {
  const date = String(value || "").trim();
  if (!date) return null;
  return `${date}T23:59:59.000Z`;
}

function formatPaidUntil(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function isExpired(value: string | null | undefined) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function createBot(formData: FormData) {
  "use server";

  const supabase = getServiceSupabase();

  await supabase.from("bots").insert({
    public_bot_id: String(formData.get("public_bot_id") || "").trim(),
    company_name: String(formData.get("company_name") || "").trim(),
    niche: String(formData.get("niche") || "").trim() || null,
    system_prompt: String(formData.get("system_prompt") || "").trim(),
    model: String(formData.get("model") || "minimax/minimax-m2.5"),
    analysis_model: String(formData.get("analysis_model") || "openai/gpt-4o-mini"),
    analysis_prompt: String(formData.get("analysis_prompt") || "").trim() || null,
    bot_name: String(formData.get("bot_name") || "AI Assistant").trim(),
    widget_color: String(formData.get("widget_color") || "#2563eb").trim(),
    temperature: Number(formData.get("temperature") || 0.3),
    max_completion_tokens: Number(formData.get("max_completion_tokens") || 1000),
    allowed_domain: String(formData.get("allowed_domain") || "*"),
    handoff_email: String(formData.get("handoff_email") || "").trim() || null,
    monthly_token_limit: Number(formData.get("monthly_token_limit") || 200000),
    monthly_cost_limit: Number(formData.get("monthly_cost_limit") || 50),
    tariff: String(formData.get("tariff") || "trial").trim(),
    paid_until: normalizePaidUntil(formData.get("paid_until")),
    monthly_conversation_limit: Number(formData.get("monthly_conversation_limit") || 500),
    welcome_message: String(formData.get("welcome_message") || "Hi! How can I help you today?").trim(),
    error_message: String(formData.get("error_message") || "Sorry, something went wrong. Please try again.").trim(),
    auto_open_delay: Number(formData.get("auto_open_delay") ?? 8),
    chat_open_delay: Number(formData.get("chat_open_delay") ?? 5),
    badge_message: String(formData.get("badge_message") || "👋 Hi! Need help? I can answer questions and book appointments.").trim(),
    telegram_enabled: formData.get("telegram_enabled") === "on",
    telegram_chat_id: String(formData.get("telegram_chat_id") || "").trim() || null,
    enable_analysis: formData.get("enable_analysis") === "on",
    is_active: formData.get("is_active") === "on"
  });

  revalidatePath("/admin");
}

async function updateBot(formData: FormData) {
  "use server";

  const supabase = getServiceSupabase();
  const id = String(formData.get("id"));

  await supabase.from("bots").update({
    company_name: String(formData.get("company_name") || "").trim(),
    niche: String(formData.get("niche") || "").trim() || null,
    system_prompt: String(formData.get("system_prompt") || "").trim(),
    model: String(formData.get("model") || "minimax/minimax-m2.5"),
    analysis_model: String(formData.get("analysis_model") || "openai/gpt-4o-mini"),
    analysis_prompt: String(formData.get("analysis_prompt") || "").trim() || null,
    bot_name: String(formData.get("bot_name") || "AI Assistant").trim(),
    widget_color: String(formData.get("widget_color") || "#2563eb").trim(),
    temperature: Number(formData.get("temperature") || 0.3),
    max_completion_tokens: Number(formData.get("max_completion_tokens") || 1000),
    allowed_domain: String(formData.get("allowed_domain") || "*"),
    handoff_email: String(formData.get("handoff_email") || "").trim() || null,
    monthly_token_limit: Number(formData.get("monthly_token_limit") || 200000),
    monthly_cost_limit: Number(formData.get("monthly_cost_limit") || 50),
    tariff: String(formData.get("tariff") || "trial").trim(),
    paid_until: normalizePaidUntil(formData.get("paid_until")),
    monthly_conversation_limit: Number(formData.get("monthly_conversation_limit") || 500),
    welcome_message: String(formData.get("welcome_message") || "Hi! How can I help you today?").trim(),
    error_message: String(formData.get("error_message") || "Sorry, something went wrong. Please try again.").trim(),
    auto_open_delay: Number(formData.get("auto_open_delay") ?? 8),
    chat_open_delay: Number(formData.get("chat_open_delay") ?? 5),
    badge_message: String(formData.get("badge_message") || "👋 Hi! Need help? I can answer questions and book appointments.").trim(),
    telegram_enabled: formData.get("telegram_enabled") === "on",
    telegram_chat_id: String(formData.get("telegram_chat_id") || "").trim() || null,
    enable_analysis: formData.get("enable_analysis") === "on",
    is_active: formData.get("is_active") === "on",
    updated_at: new Date().toISOString()
  }).eq("id", id);

  revalidatePath("/admin");
}

async function deleteBot(formData: FormData) {
  "use server";

  const supabase = getServiceSupabase();
  const id = String(formData.get("id"));

  await supabase.from("bots").delete().eq("id", id);
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const supabase = getServiceSupabase();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    { data: botsData },
    { data: usageData },
    { data: allConversationsData },
    { data: monthlyConversationsData },
    { data: monthlyMessagesData }
  ] = await Promise.all([
    supabase.from("bots").select("*").order("created_at", { ascending: false }),
    supabase
      .from("usage_daily")
      .select("usage_date, total_tokens, total_cost, bot_id")
      .gte("usage_date", monthStart.toISOString().slice(0, 10))
      .order("usage_date", { ascending: false }),
    supabase.from("conversations").select("id, bot_id"),
    supabase.from("conversations").select("bot_id").gte("created_at", monthStart.toISOString()),
    supabase
      .from("messages")
      .select("conversation_id")
      .eq("role", "assistant")
      .gte("created_at", monthStart.toISOString())
  ]);

  const bots = botsData ?? [];
  const usage = usageData ?? [];
  const allConversations = allConversationsData ?? [];
  const monthlyConversations = monthlyConversationsData ?? [];
  const monthlyMessages = monthlyMessagesData ?? [];

  const totalCost = usage.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
  const totalTokens = usage.reduce((sum, row) => sum + Number(row.total_tokens || 0), 0);

  const conversationToBotId = new Map<string, string>();
  for (const conversation of allConversations) {
    conversationToBotId.set(conversation.id, conversation.bot_id);
  }

  const conversationCountByBotId = new Map<string, number>();
  for (const conversation of monthlyConversations) {
    conversationCountByBotId.set(
      conversation.bot_id,
      (conversationCountByBotId.get(conversation.bot_id) || 0) + 1
    );
  }

  const messageCountByBotId = new Map<string, number>();
  for (const message of monthlyMessages) {
    const botId = conversationToBotId.get(message.conversation_id);
    if (!botId) continue;
    messageCountByBotId.set(botId, (messageCountByBotId.get(botId) || 0) + 1);
  }

  const totalMonthlyConversations = Array.from(conversationCountByBotId.values()).reduce((sum, count) => sum + count, 0);
  const totalMonthlyMessages = Array.from(messageCountByBotId.values()).reduce((sum, count) => sum + count, 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-slate-800">Admin</span>
        <Link href="/admin" className="text-sm font-medium text-blue-600">Боты</Link>
        <Link href="/admin/leads" className="text-sm text-slate-500 hover:text-slate-800">Лиды</Link>
        <Link href="/admin/conversations" className="text-sm text-slate-500 hover:text-slate-800">Разговоры</Link>
        <Link href="/admin/stats" className="text-sm text-slate-500 hover:text-slate-800">Статистика</Link>
        <form action="/api/admin/logout" method="post" className="ml-auto">
          <button className="text-sm text-slate-400 hover:text-slate-600">Выйти</button>
        </form>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Всего ботов</p>
            <p className="text-2xl font-bold">{bots.length}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Разговоров за месяц</p>
            <p className="text-2xl font-bold">{totalMonthlyConversations.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Сообщений за месяц</p>
            <p className="text-2xl font-bold">{totalMonthlyMessages.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Токенов за месяц</p>
            <p className="text-2xl font-bold">{totalTokens.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Стоимость за месяц</p>
            <p className="text-2xl font-bold">${totalCost.toFixed(4)}</p>
          </div>
        </div>

        <section className="bg-white rounded-xl border">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold">Боты</h2>

            <details className="relative">
              <summary className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white list-none">
                + Создать бота
              </summary>

              <div className="absolute right-0 top-10 z-50 w-[760px] rounded-xl border bg-white shadow-xl p-5">
                <h3 className="font-semibold mb-3">Новый бот</h3>

                <form action={createBot} className="grid grid-cols-2 gap-2">
                  <input required name="public_bot_id" placeholder="Bot ID (e.g. dental-nyc)" className="rounded-md border p-2 text-sm" />
                  <input required name="company_name" placeholder="Название компании" className="rounded-md border p-2 text-sm" />

                  <input name="niche" placeholder="Ниша" className="rounded-md border p-2 text-sm" />
                  <input name="allowed_domain" placeholder="Домен (* = любой)" defaultValue="*" className="rounded-md border p-2 text-sm" />

                  <div>
                    <label className="text-xs text-slate-500">Chat model</label>
                    <input name="model" defaultValue="minimax/minimax-m2.5" className="w-full rounded-md border p-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Analysis model</label>
                    <input name="analysis_model" defaultValue="openai/gpt-4o-mini" className="w-full rounded-md border p-2 text-sm" />
                  </div>

                  <input name="handoff_email" placeholder="Email для лидов" className="rounded-md border p-2 text-sm" />
                  <input name="tariff" defaultValue="trial" placeholder="Тариф" className="rounded-md border p-2 text-sm" />

                  <div>
                    <label className="text-xs text-slate-500">Оплачен до</label>
                    <input name="paid_until" type="date" className="w-full rounded-md border p-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Лимит разговоров / месяц</label>
                    <input name="monthly_conversation_limit" type="number" defaultValue="500" min="1" className="w-full rounded-md border p-2 text-sm" />
                  </div>

                  <input name="temperature" type="number" step="0.1" min="0" max="1" defaultValue="0.3" placeholder="Temperature" className="rounded-md border p-2 text-sm" />
                  <input name="max_completion_tokens" type="number" defaultValue="1000" placeholder="Max tokens" className="rounded-md border p-2 text-sm" />

                  <input name="monthly_token_limit" type="number" defaultValue="200000" placeholder="Лимит токенов / месяц" className="rounded-md border p-2 text-sm" />
                  <input name="monthly_cost_limit" type="number" step="0.01" defaultValue="50" placeholder="Лимит $ в месяц" className="rounded-md border p-2 text-sm" />

                  <input name="welcome_message" defaultValue="Hi! How can I help you today?" placeholder="Приветствие" className="rounded-md border p-2 text-sm" />
                  <input name="error_message" defaultValue="Sorry, something went wrong. Please try again." placeholder="Текст ошибки" className="rounded-md border p-2 text-sm" />

                  <div>
                    <label className="text-xs text-slate-500">Имя бота в чате</label>
                    <input name="bot_name" defaultValue="AI Assistant" className="w-full rounded-md border p-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Цвет виджета</label>
                    <input name="widget_color" defaultValue="#2563eb" className="w-full rounded-md border p-2 text-sm" />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500">Задержка пузыря (сек, 0 = выкл)</label>
                    <input name="auto_open_delay" type="number" defaultValue="8" min="0" max="60" className="w-full rounded-md border p-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Задержка открытия чата (сек, 0 = выкл)</label>
                    <input name="chat_open_delay" type="number" defaultValue="5" min="0" max="60" className="w-full rounded-md border p-2 text-sm" />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs text-slate-500">Сообщение в пузыре</label>
                    <input
                      name="badge_message"
                      defaultValue="👋 Hi! Need help? I can answer questions and book appointments."
                      className="w-full rounded-md border p-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500">Telegram Chat ID</label>
                    <input name="telegram_chat_id" placeholder="-1001234567890" className="w-full rounded-md border p-2 text-sm" />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input name="telegram_enabled" type="checkbox" />
                      Telegram уведомления
                    </label>
                  </div>

                  <div className="col-span-2 flex gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input name="is_active" type="checkbox" defaultChecked />
                      Активен
                    </label>
                    <label className="flex items-center gap-2">
                      <input name="enable_analysis" type="checkbox" defaultChecked />
                      Анализ лидов
                    </label>
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs text-slate-500">System prompt</label>
                    <textarea required name="system_prompt" rows={4} className="w-full rounded-md border p-2 text-sm" />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs text-slate-500">Analysis prompt (необязательно)</label>
                    <textarea name="analysis_prompt" rows={2} placeholder="Оставь пустым для стандартного промпта" className="w-full rounded-md border p-2 text-sm" />
                  </div>

                  <button className="col-span-2 rounded-md bg-blue-600 py-2 text-sm font-medium text-white">
                    Создать
                  </button>
                </form>
              </div>
            </details>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Статус</th>
                <th className="text-left px-4 py-2">Bot ID</th>
                <th className="text-left px-4 py-2">Компания</th>
                <th className="text-left px-4 py-2">Тариф</th>
                <th className="text-left px-4 py-2">Оплачен до</th>
                <th className="text-left px-4 py-2">Разговоры</th>
                <th className="text-left px-4 py-2">Сообщения</th>
                <th className="text-left px-4 py-2">Модель</th>
                <th className="text-left px-4 py-2">Анализ</th>
                <th className="text-left px-4 py-2">Действия</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {bots.map((bot) => {
                const usedConversations = conversationCountByBotId.get(bot.id) || 0;
                const usedMessages = messageCountByBotId.get(bot.id) || 0;
                const conversationLimit = Number(bot.monthly_conversation_limit || 0);
                const expired = isExpired(bot.paid_until);
                const daysLeft = daysUntil(bot.paid_until);
                const expiringSoon = !expired && daysLeft !== null && daysLeft <= 3;
                const limitReached = conversationLimit > 0 && usedConversations >= conversationLimit;
                const nearLimit =
                  conversationLimit > 0 &&
                  !limitReached &&
                  usedConversations / conversationLimit >= 0.8;

                const rowClass =
                  !bot.is_active || expired || limitReached
                    ? "bg-red-50/60 hover:bg-red-50"
                    : expiringSoon || nearLimit
                      ? "bg-amber-50/60 hover:bg-amber-50"
                      : "hover:bg-slate-50";

                const statusDotClass =
                  !bot.is_active || expired || limitReached
                    ? "bg-red-500"
                    : expiringSoon || nearLimit
                      ? "bg-amber-500"
                      : "bg-emerald-400";

                const statusText =
                  !bot.is_active
                    ? "выкл"
                    : expired
                      ? "просрочен"
                      : limitReached
                        ? "лимит"
                        : expiringSoon
                          ? "скоро"
                          : nearLimit
                            ? "почти"
                            : "ok";

                return (
                  <tr key={bot.id} className={rowClass}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
                        <span className="text-xs text-slate-600">{statusText}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{bot.public_bot_id}</td>

                    <td className="px-4 py-3 font-medium">{bot.company_name}</td>

                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {bot.tariff || "trial"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs ${
                          expired
                            ? "bg-red-100 text-red-700"
                            : expiringSoon
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatPaidUntil(bot.paid_until)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs ${
                          limitReached
                            ? "bg-red-100 text-red-700"
                            : nearLimit
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {usedConversations} / {conversationLimit || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-700">{usedMessages}</span>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[220px] break-words">{bot.model}</td>

                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          bot.enable_analysis ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {bot.enable_analysis ? "вкл" : "выкл"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a href={`/demo/${bot.public_bot_id}`} target="_blank" className="text-xs text-blue-500 hover:underline">
                          Demo
                        </a>

                        <details className="relative">
                          <summary className="cursor-pointer text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded list-none">
                            Edit
                          </summary>

                          <div className="absolute right-0 z-50 w-[760px] rounded-xl border bg-white shadow-xl p-5 mt-1">
                            <h3 className="font-semibold mb-3">Редактировать: {bot.company_name}</h3>

                            <form action={updateBot} className="grid grid-cols-2 gap-2">
                              <input type="hidden" name="id" value={bot.id} />

                              <div>
                                <label className="text-xs text-slate-500">Bot ID (readonly)</label>
                                <input value={bot.public_bot_id} disabled className="w-full rounded-md border bg-slate-100 p-2 text-xs" />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Название компании</label>
                                <input name="company_name" defaultValue={bot.company_name} className="w-full rounded-md border p-2 text-sm" />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Ниша</label>
                                <input name="niche" defaultValue={bot.niche ?? ""} className="w-full rounded-md border p-2 text-sm" />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Домен</label>
                                <input name="allowed_domain" defaultValue={bot.allowed_domain} className="w-full rounded-md border p-2 text-sm" />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Chat model</label>
                                <input name="model" defaultValue={bot.model} className="w-full rounded-md border p-2 text-sm" />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Analysis model</label>
                                <input
                                  name="analysis_model"
                                  defaultValue={bot.analysis_model ?? "openai/gpt-4o-mini"}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Email для лидов</label>
                                <input name="handoff_email" defaultValue={bot.handoff_email ?? ""} className="w-full rounded-md border p-2 text-sm" />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Тариф</label>
                                <input name="tariff" defaultValue={bot.tariff ?? "trial"} className="w-full rounded-md border p-2 text-sm" />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Оплачен до</label>
                                <input
                                  name="paid_until"
                                  type="date"
                                  defaultValue={bot.paid_until ? String(bot.paid_until).slice(0, 10) : ""}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Лимит разговоров / месяц</label>
                                <input
                                  name="monthly_conversation_limit"
                                  type="number"
                                  min="1"
                                  defaultValue={bot.monthly_conversation_limit ?? 500}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Temperature</label>
                                <input
                                  name="temperature"
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="1"
                                  defaultValue={bot.temperature}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Max tokens</label>
                                <input name="max_completion_tokens" type="number" defaultValue={bot.max_completion_tokens} className="w-full rounded-md border p-2 text-sm" />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Лимит токенов / месяц</label>
                                <input
                                  name="monthly_token_limit"
                                  type="number"
                                  defaultValue={bot.monthly_token_limit ?? 200000}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Лимит $ в месяц</label>
                                <input
                                  name="monthly_cost_limit"
                                  type="number"
                                  step="0.01"
                                  defaultValue={bot.monthly_cost_limit}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Приветствие</label>
                                <input
                                  name="welcome_message"
                                  defaultValue={bot.welcome_message ?? "Hi! How can I help you today?"}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Текст ошибки</label>
                                <input
                                  name="error_message"
                                  defaultValue={bot.error_message ?? "Sorry, something went wrong. Please try again."}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Имя бота в чате</label>
                                <input name="bot_name" defaultValue={bot.bot_name ?? "AI Assistant"} className="w-full rounded-md border p-2 text-sm" />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Цвет виджета</label>
                                <input name="widget_color" defaultValue={bot.widget_color ?? "#2563eb"} className="w-full rounded-md border p-2 text-sm" />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Задержка пузыря (сек, 0 = выкл)</label>
                                <input
                                  name="auto_open_delay"
                                  type="number"
                                  min="0"
                                  max="60"
                                  defaultValue={bot.auto_open_delay ?? 8}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Задержка открытия чата (сек, 0 = выкл)</label>
                                <input
                                  name="chat_open_delay"
                                  type="number"
                                  min="0"
                                  max="60"
                                  defaultValue={bot.chat_open_delay ?? 5}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div className="col-span-2">
                                <label className="text-xs text-slate-500">Сообщение в пузыре</label>
                                <input
                                  name="badge_message"
                                  defaultValue={bot.badge_message ?? "👋 Hi! Need help? I can answer questions and book appointments."}
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-500">Telegram Chat ID</label>
                                <input
                                  name="telegram_chat_id"
                                  defaultValue={bot.telegram_chat_id ?? ""}
                                  placeholder="-1001234567890"
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 text-sm">
                                  <input name="telegram_enabled" type="checkbox" defaultChecked={bot.telegram_enabled ?? false} />
                                  Telegram уведомления
                                </label>
                              </div>

                              <div className="col-span-2 flex gap-4 text-sm">
                                <label className="flex items-center gap-2">
                                  <input name="is_active" type="checkbox" defaultChecked={bot.is_active} />
                                  Активен
                                </label>
                                <label className="flex items-center gap-2">
                                  <input name="enable_analysis" type="checkbox" defaultChecked={bot.enable_analysis ?? true} />
                                  Анализ лидов
                                </label>
                              </div>

                              <div className="col-span-2">
                                <label className="text-xs text-slate-500">System prompt</label>
                                <textarea name="system_prompt" defaultValue={bot.system_prompt ?? ""} rows={5} className="w-full rounded-md border p-2 text-sm" />
                              </div>

                              <div className="col-span-2">
                                <label className="text-xs text-slate-500">Analysis prompt (необязательно)</label>
                                <textarea
                                  name="analysis_prompt"
                                  defaultValue={bot.analysis_prompt ?? ""}
                                  rows={2}
                                  placeholder="Оставь пустым для стандартного"
                                  className="w-full rounded-md border p-2 text-sm"
                                />
                              </div>

                              <div className="col-span-2">
                                <label className="text-xs text-slate-500">Embed код</label>
                                <code className="block bg-slate-50 rounded p-2 text-xs break-all">
                                  {`<script src="https://aihelper-mauve.vercel.app/widget.js?botId=${bot.public_bot_id}" data-bot-id="${bot.public_bot_id}"></script>`}
                                </code>
                              </div>

                              <button className="col-span-2 rounded-md bg-slate-900 py-2 text-sm font-medium text-white">
                                Сохранить
                              </button>
                            </form>
                          </div>
                        </details>

                        <form action={deleteBot}>
                          <input type="hidden" name="id" value={bot.id} />
                          <button formAction={deleteBot} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">
                            Del
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
