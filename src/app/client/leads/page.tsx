import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getServiceSupabase } from "@/lib/supabase";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function trimText(value?: string | null, max = 70) {
  if (!value) return "—";
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function getLeadName(lead: any) {
  return lead.name || lead.client_name || lead.full_name || "—";
}

function getLeadPhone(lead: any) {
  return lead.phone || lead.telephone || lead.whatsapp || "—";
}

function getLeadEmail(lead: any) {
  return lead.email || "—";
}

function getLeadSummary(lead: any) {
  return trimText(
    lead.note ||
      lead.summary ||
      lead.message ||
      lead.notes ||
      lead.details ||
      lead.request ||
      lead.service ||
      lead.intent ||
      lead.comment ||
      "—",
    90
  );
}

type SearchParams = {
  page?: string;
};

export default async function ClientLeadsPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const session = getClientSession();

  if (!session) {
    redirect("/client/login");
  }

  const supabase = getServiceSupabase();

  const pageSize = 10;
  const currentPage = Math.max(1, Number(searchParams?.page || "1") || 1);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const [{ data: bot }, { count: totalLeads }, { data: leads }] = await Promise.all([
    supabase
      .from("bots")
      .select("company_name, public_bot_id")
      .eq("id", session.botId)
      .single(),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("bot_id", session.botId),
    supabase
      .from("leads")
      .select("*")
      .eq("bot_id", session.botId)
      .order("created_at", { ascending: false })
      .range(from, to)
  ]);

  const total = totalLeads ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-[320px] w-[320px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-140px] top-[80px] h-[340px] w-[340px] rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[20%] h-[280px] w-[280px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-8 md:py-10">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-6 border-b border-white/10 pb-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <Link
                href="/client"
                className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
              >
                <span>←</span>
                <span>Back to dashboard</span>
              </Link>

              <div className="mt-4 inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
                Leads
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Client leads
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Recent lead submissions collected by your assistant.
              </p>

              <div className="mt-5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 inline-flex">
                {bot?.company_name || "Your bot"} · {bot?.public_bot_id || "—"}
              </div>
            </div>

            <div className="grid w-full max-w-md gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
                <div className="text-sm text-slate-400">Total leads</div>
                <div className="mt-3 text-3xl font-semibold text-white">{total}</div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
                <div className="text-sm text-slate-400">Page</div>
                <div className="mt-3 text-3xl font-semibold text-white">
                  {currentPage} / {totalPages}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1728]/80">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-left text-slate-400">
                  <tr>
                    <th className="px-5 py-4 font-medium">Date</th>
                    <th className="px-5 py-4 font-medium">Name</th>
                    <th className="px-5 py-4 font-medium">Phone</th>
                    <th className="px-5 py-4 font-medium">Email</th>
                    <th className="px-5 py-4 font-medium">Summary</th>
                  </tr>
                </thead>

                <tbody>
                  {(leads ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-14 text-center text-slate-400">
                        No leads yet
                      </td>
                    </tr>
                  ) : (
                    (leads ?? []).map((lead: any) => (
                      <tr
                        key={lead.id}
                        className="border-t border-white/5 text-slate-200 transition hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-4 whitespace-nowrap text-slate-300">
                          {formatDate(lead.created_at)}
                        </td>
                        <td className="px-5 py-4 font-medium text-white">
                          {getLeadName(lead)}
                        </td>
                        <td className="px-5 py-4 text-slate-300">
                          {getLeadPhone(lead)}
                        </td>
                        <td className="px-5 py-4 text-slate-300">
                          <div className="max-w-[220px] truncate">
                            {getLeadEmail(lead)}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-300">
                          <div className="max-w-[360px] leading-6">
                            {getLeadSummary(lead)}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {total > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 px-5 py-4 md:flex-row">
                {currentPage > 1 ? (
                  <Link
                    href={`/client/leads?page=${currentPage - 1}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <div className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-500">
                    ← Previous
                  </div>
                )}

                <div className="text-sm text-slate-400">
                  Showing page <span className="font-medium text-white">{currentPage}</span> of{" "}
                  <span className="font-medium text-white">{totalPages}</span>
                </div>

                {currentPage < totalPages ? (
                  <Link
                    href={`/client/leads?page=${currentPage + 1}`}
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-90"
                  >
                    Next →
                  </Link>
                ) : (
                  <div className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-500">
                    Next →
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
