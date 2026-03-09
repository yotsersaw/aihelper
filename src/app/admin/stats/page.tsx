import { getServiceSupabase } from "@/lib/supabase";
import Link from "next/link";

export default async function StatsPage() {
  const supabase = getServiceSupabase();

  const [{ data: usage }, { data: leads }, { data: conversations }] = await Promise.all([
    supabase.from("usage_daily").select("usage_date, total_tokens, total_cost, bots(company_name)").order("usage_date", { ascending: false }).limit(30),
    supabase.from("leads").select("id, created_at, status"),
    supabase.from("conversations").select("id, created_at")
  ]);

  const totalCost = usage?.reduce((s, r) => s + Number(r.total_cost), 0) ?? 0;
  const totalTokens = usage?.reduce((s, r) => s + r.total_tokens, 0) ?? 0;
  const newLeads = leads?.filter(l => l.status === "new").length ?? 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-slate-800">Admin</span>
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-800">Боты</Link>
        <Link href="/admin/leads" className="text-sm text-slate-500 hover:text-slate-800">Лиды</Link>
        <Link href="/admin/conversations" className="text-sm text-slate-500 hover:text-slate-800">Разговоры</Link>
        <Link href="/admin/stats" className="text-sm font-medium text-blue-600">Статистика</Link>
        <form action="/api/admin/logout" method="post" className="ml-auto">
          <button className="text-sm text-slate-400 hover:text-slate-600">Выйти</button>
        </form>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        <h1 className="text-xl font-bold">Статистика</h1>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Лидов всего</p>
            <p className="text-2xl font-bold">{leads?.length ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Новых лидов</p>
            <p className="text-2xl font-bold text-blue-600">{newLeads}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Разговоров</p>
            <p className="text-2xl font-bold">{conversations?.length ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Стоимость (30 дней)</p>
            <p className="text-2xl font-bold">${totalCost.toFixed(4)}</p>
          </div>
        </div>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-4">Использование по дням</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 border-b">
              <tr>
                <th className="text-left py-2">Дата</th>
                <th className="text-left py-2">Бот</th>
                <th className="text-right py-2">Токены</th>
                <th className="text-right py-2">Стоимость</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usage?.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2 text-slate-500">{row.usage_date}</td>
                  <td className="py-2">{(row.bots as any)?.company_name}</td>
                  <td className="py-2 text-right">{row.total_tokens.toLocaleString()}</td>
                  <td className="py-2 text-right">${Number(row.total_cost).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t font-medium">
              <tr>
                <td colSpan={2} className="py-2">Итого</td>
                <td className="py-2 text-right">{totalTokens.toLocaleString()}</td>
                <td className="py-2 text-right">${totalCost.toFixed(4)}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      </div>
    </main>
  );
}