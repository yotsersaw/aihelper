import { getServiceSupabase } from "@/lib/supabase";
import Link from "next/link";

export default async function ConversationsPage({
  searchParams
}: {
  searchParams: { bot?: string; page?: string; id?: string }
}) {
  const supabase = getServiceSupabase();
  const page = Number(searchParams.page || 1);
  const perPage = 10;
  const from = (page - 1) * perPage;

  const { data: bots } = await supabase.from("bots").select("id, public_bot_id, company_name");

  let query = supabase
    .from("conversations")
    .select("id, session_id, last_message_at, analyzed, bots(company_name, public_bot_id), messages(id)", { count: "exact" })
    .order("last_message_at", { ascending: false })
    .range(from, from + perPage - 1);

  if (searchParams.bot) {
    const bot = bots?.find(b => b.public_bot_id === searchParams.bot);
    if (bot) query = query.eq("bot_id", bot.id);
  }

  const { data: conversations, count } = await query;
  const totalPages = Math.ceil((count || 0) / perPage);

  // Load messages for selected conversation
  let selectedMessages: any[] = [];
  if (searchParams.id) {
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
          <h1 className="text-xl font-bold">Разговоры <span className="text-slate-400 font-normal text-base">({count ?? 0})</span></h1>
          <select
            className="rounded-md border px-3 py-1.5 text-sm bg-white"
            defaultValue={searchParams.bot || ""}
            onChange={(e) => {
              const url = new URL(window.location.href);
              if (e.target.value) url.searchParams.set("bot", e.target.value);
              else url.searchParams.delete("bot");
              url.searchParams.delete("page");
              url.searchParams.delete("id");
              window.location.href = url.toString();
            }}
          >
            <option value="">Все боты</option>
            {bots?.map(b => (
              <option key={b.id} value={b.public_bot_id}>{b.company_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Conversations list */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">Бот</th>
                  <th className="text-left px-4 py-2">Сообщений</th>
                  <th className="text-left px-4 py-2">Дата</th>
                  <th className="text-left px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conversations?.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Разговоров пока нет</td></tr>
                )}
                {conversations?.map((conv) => (
                  <tr key={conv.id} className={`hover:bg-slate-50 ${searchParams.id === conv.id ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{(conv.bots as any)?.company_name}</p>
                      <p className="text-slate-400 text-xs truncate max-w-[120px]">{conv.session_id}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{(conv.messages as any[])?.length ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(conv.last_message_at).toLocaleDateString("ru")}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/conversations?${searchParams.bot ? `bot=${searchParams.bot}&` : ""}page=${page}&id=${conv.id}`}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-3 border-t">
                {page > 1 && (
                  <Link href={`/admin/conversations?${searchParams.bot ? `bot=${searchParams.bot}&` : ""}page=${page - 1}`} className="px-3 py-1 text-xs rounded border bg-white hover:bg-slate-50">← Назад</Link>
                )}
                <span className="text-xs text-slate-500">{page} / {totalPages}</span>
                {page < totalPages && (
                  <Link href={`/admin/conversations?${searchParams.bot ? `bot=${searchParams.bot}&` : ""}page=${page + 1}`} className="px-3 py-1 text-xs rounded border bg-white hover:bg-slate-50">Вперёд →</Link>
                )}
              </div>
            )}
          </div>

          {/* Dialog viewer */}
          <div className="bg-white rounded-xl border p-4">
            {!searchParams.id ? (
              <p className="text-slate-400 text-sm text-center mt-8">Выберите разговор слева для просмотра</p>
            ) : (
              <div className="space-y-3 text-sm max-h-[600px] overflow-y-auto">
                {selectedMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-slate-100 text-slate-800 rounded-tl-sm"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}