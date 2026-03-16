import { getServiceSupabase } from "@/lib/supabase";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function deleteConversation(formData: FormData) {
  "use server";

  const supabase = getServiceSupabase();
  const conversationId = String(formData.get("conversation_id") || "");
  const bot = String(formData.get("bot") || "");
  const page = String(formData.get("page") || "1");

  if (!conversationId) return;

  await supabase.from("conversations").delete().eq("id", conversationId);

  revalidatePath("/admin/conversations");
  redirect(`/admin/conversations?${bot ? `bot=${encodeURIComponent(bot)}&` : ""}page=${page}`);
}

async function clearBotConversations(formData: FormData) {
  "use server";

  const supabase = getServiceSupabase();
  const botId = String(formData.get("bot_id") || "");
  const bot = String(formData.get("bot") || "");

  if (!botId) return;

  await supabase.from("conversations").delete().eq("bot_id", botId);

  revalidatePath("/admin/conversations");
  redirect(`/admin/conversations${bot ? `?bot=${encodeURIComponent(bot)}` : ""}`);
}

export default async function ConversationsPage({
  searchParams
}: {
  searchParams: { bot?: string; page?: string; id?: string }
}) {
  const supabase = getServiceSupabase();
  const page = Number(searchParams.page || 1);
  const perPage = 10;
  const from = (page - 1) * perPage;

  const { data: bots } = await supabase
    .from("bots")
    .select("id, public_bot_id, company_name")
    .order("company_name", { ascending: true });

  const selectedBot = bots?.find((b) => b.public_bot_id === searchParams.bot) || null;

  let query = supabase
    .from("conversations")
    .select(
      "id, bot_id, session_id, last_message_at, analyzed, bots(company_name, public_bot_id), messages(id)",
      { count: "exact" }
    )
    .order("last_message_at", { ascending: false })
    .range(from, from + perPage - 1);

  if (selectedBot) {
    query = query.eq("bot_id", selectedBot.id);
  }

  const { data: conversations, count } = await query;
  const totalPages = Math.ceil((count || 0) / perPage);

  let selectedMessages: any[] = [];
  let selectedConversation: any = null;

  if (searchParams.id) {
    const selected = conversations?.find((c) => c.id === searchParams.id);
    selectedConversation = selected || null;

    const { data } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", searchParams.id)
      .order("created_at", { ascending: true });

    selectedMessages = data || [];
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-slate-800">Admin</span>
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-800">Боты</Link>
        <Link href="/admin/leads" className="text-sm text-slate-500 hover:text-slate-800">Лиды</Link>
        <Link href="/admin/conversations" className="text-sm font-medium text-blue-600">Разговоры</Link>
        <Link href="/admin/stats" className="text-sm text-slate-500 hover:text-slate-800">Статистика</Link>
        <form action="/api/admin/logout" method="post" className="ml-auto">
          <button className="text-sm text-slate-400 hover:text-slate-600">Выйти</button>
        </form>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">
            Разговоры <span className="text-slate-400 font-normal text-base">({count ?? 0})</span>
          </h1>

          <div className="flex items-center gap-2">
            <form method="get" className="flex items-center gap-2">
              <select
                name="bot"
                className="rounded-md border px-3 py-1.5 text-sm bg-white"
                defaultValue={searchParams.bot || ""}
              >
                <option value="">Все боты</option>
                {bots?.map((b) => (
                  <option key={b.id} value={b.public_bot_id}>
                    {b.company_name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-3 py-1.5 text-sm rounded-md bg-slate-100 hover:bg-slate-200"
              >
                Фильтр
              </button>
            </form>

            {selectedBot && (
              <form action={clearBotConversations}>
                <input type="hidden" name="bot_id" value={selectedBot.id} />
                <input type="hidden" name="bot" value={selectedBot.public_bot_id} />
                <button className="px-3 py-1.5 text-sm rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                  Очистить у бота
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">Бот</th>
                  <th className="text-left px-4 py-2">Сообщений</th>
                  <th className="text-left px-4 py-2">Дата</th>
                  <th className="text-left px-4 py-2">Действия</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {conversations?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      Разговоров пока нет
                    </td>
                  </tr>
                )}

                {conversations?.map((conv) => (
                  <tr
                    key={conv.id}
                    className={`hover:bg-slate-50 ${searchParams.id === conv.id ? "bg-blue-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{(conv.bots as any)?.company_name}</p>
                      <p className="text-slate-400 text-xs truncate max-w-[140px]">{conv.session_id}</p>
                    </td>

                    <td className="px-4 py-3 text-slate-500">
                      {(conv.messages as any[])?.length ?? 0}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(conv.last_message_at).toLocaleDateString("ru-RU")}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/conversations?${searchParams.bot ? `bot=${searchParams.bot}&` : ""}page=${page}&id=${conv.id}`}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          Открыть
                        </Link>

                        <form action={deleteConversation}>
                          <input type="hidden" name="conversation_id" value={conv.id} />
                          <input type="hidden" name="bot" value={searchParams.bot || ""} />
                          <input type="hidden" name="page" value={String(page)} />
                          <button className="text-xs text-red-500 hover:underline">
                            Удалить
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-3 border-t">
                {page > 1 && (
                  <Link
                    href={`/admin/conversations?${searchParams.bot ? `bot=${searchParams.bot}&` : ""}page=${page - 1}`}
                    className="px-3 py-1 text-xs rounded border bg-white hover:bg-slate-50"
                  >
                    ← Назад
                  </Link>
                )}

                <span className="text-xs text-slate-500">{page} / {totalPages}</span>

                {page < totalPages && (
                  <Link
                    href={`/admin/conversations?${searchParams.bot ? `bot=${searchParams.bot}&` : ""}page=${page + 1}`}
                    className="px-3 py-1 text-xs rounded border bg-white hover:bg-slate-50"
                  >
                    Вперёд →
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border p-4">
            {!searchParams.id ? (
              <p className="text-slate-400 text-sm text-center mt-8">
                Выберите разговор слева для просмотра
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedConversation ? (selectedConversation.bots as any)?.company_name : "Разговор"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {selectedConversation?.session_id || ""}
                    </p>
                  </div>

                  <form action={deleteConversation}>
                    <input type="hidden" name="conversation_id" value={searchParams.id} />
                    <input type="hidden" name="bot" value={searchParams.bot || ""} />
                    <input type="hidden" name="page" value={String(page)} />
                    <button className="px-3 py-1.5 text-xs rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                      Удалить разговор
                    </button>
                  </form>
                </div>

                <div className="space-y-3 text-sm max-h-[600px] overflow-y-auto">
                  {selectedMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-slate-100 text-slate-800 rounded-tl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {selectedMessages.length === 0 && (
                    <p className="text-slate-400 text-sm">Сообщений нет</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
