import { getServiceSupabase } from "@/lib/supabase";
import Link from "next/link";
import { revalidatePath } from "next/cache";

async function updateLeadStatus(formData: FormData) {
  "use server";
  const supabase = getServiceSupabase();
  await supabase.from("leads")
    .update({ status: String(formData.get("status")) })
    .eq("id", String(formData.get("id")));
  revalidatePath("/admin/leads");
}

export default async function LeadsPage({
  searchParams
}: {
  searchParams: { bot?: string; page?: string }
}) {
  const supabase = getServiceSupabase();
  const page = Number(searchParams.page || 1);
  const perPage = 10;
  const from = (page - 1) * perPage;

  const { data: bots } = await supabase.from("bots").select("id, public_bot_id, company_name");

  let query = supabase
    .from("leads")
    .select("*, bots(company_name, public_bot_id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);

  if (searchParams.bot) {
    const bot = bots?.find(b => b.public_bot_id === searchParams.bot);
    if (bot) query = query.eq("bot_id", bot.id);
  }

  const { data: leads, count } = await query;
  const totalPages = Math.ceil((count || 0) / perPage);

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    contacted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700"
  };

  const statusLabels: Record<string, string> = {
    new: "Новый",
    contacted: "Обработан",
    rejected: "Отклонён"
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-slate-800">Admin</span>
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-800">Боты</Link>
        <Link href="/admin/leads" className="text-sm font-medium text-blue-600">Лиды</Link>
        <Link href="/admin/conversations" className="text-sm text-slate-500 hover:text-slate-800">Разговоры</Link>
        <Link href="/admin/stats" className="text-sm text-slate-500 hover:text-slate-800">Статистика</Link>
        <form action="/api/admin/logout" method="post" className="ml-auto">
          <button className="text-sm text-slate-400 hover:text-slate-600">Выйти</button>
        </form>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Лиды <span className="text-slate-400 font-normal text-base">({count ?? 0})</span></h1>
          <form method="get" className="flex items-center gap-2">
            <select name="bot" className="rounded-md border px-3 py-1.5 text-sm bg-white" defaultValue={searchParams.bot || ""}>
              <option value="">Все боты</option>
              {bots?.map(b => (
                <option key={b.id} value={b.public_bot_id}>{b.company_name}</option>
              ))}
            </select>
            <button type="submit" className="px-3 py-1.5 text-sm rounded-md bg-slate-100 hover:bg-slate-200">Фильтр</button>
          </form>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Статус</th>
                <th className="text-left px-4 py-2">Имя</th>
                <th className="text-left px-4 py-2">Телефон</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Суть</th>
                <th className="text-left px-4 py-2">Бот</th>
                <th className="text-left px-4 py-2">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads?.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Лидов пока нет</td></tr>
              )}
              {leads?.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <form action={updateLeadStatus} className="inline">
                      <input type="hidden" name="id" value={lead.id} />
                      <select name="status" defaultValue={lead.status || "new"} className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${statusColors[lead.status || "new"]}`}>
                        {Object.entries(statusLabels).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      <button type="submit" className="text-xs text-slate-400 hover:text-slate-600 ml-1">✓</button>
                    </form>
                  </td>
                  <td className="px-4 py-3 font-medium">{lead.name || "—"}</td>
                  <td className="px-4 py-3">{lead.phone || "—"}</td>
                  <td className="px-4 py-3 text-xs">{lead.email || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{lead.note || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{(lead.bots as any)?.company_name || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(lead.created_at).toLocaleDateString("ru")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {page > 1 && (
              <Link href={`/admin/leads?${searchParams.bot ? `bot=${searchParams.bot}&` : ""}page=${page - 1}`} className="px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-slate-50">← Назад</Link>
            )}
            <span className="text-sm text-slate-500">{page} / {totalPages}</span>
            {page < totalPages && (
              <Link href={`/admin/leads?${searchParams.bot ? `bot=${searchParams.bot}&` : ""}page=${page + 1}`} className="px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-slate-50">Вперёд →</Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}