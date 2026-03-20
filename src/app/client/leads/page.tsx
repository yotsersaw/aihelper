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

export default async function ClientLeadsPage() {
  const session = getClientSession();

  if (!session) {
    redirect("/client/login");
  }

  const supabase = getServiceSupabase();

  const [{ data: bot }, { data: leads }] = await Promise.all([
    supabase
      .from("bots")
      .select("company_name, public_bot_id")
      .eq("id", session.botId)
      .single(),
    supabase
      .from("leads")
      .select("*")
      .eq("bot_id", session.botId)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/client"
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              ← Back to dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Leads
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              {bot?.company_name || "Your bot"} · {bot?.public_bot_id || "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <div className="text-slate-500">Total</div>
            <div className="font-medium text-slate-900">{leads?.length ?? 0}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Summary</th>
                </tr>
              </thead>

              <tbody>
                {(leads ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No leads yet
                    </td>
                  </tr>
                ) : (
                  (leads ?? []).map((lead: any) => (
                    <tr key={lead.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(lead.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {getLeadName(lead)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {getLeadPhone(lead)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {getLeadEmail(lead)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {getLeadSummary(lead)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
