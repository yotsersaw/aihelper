import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getServiceSupabase } from "@/lib/supabase";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function isExpired(value?: string | null) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

export default async function ClientPage() {
  const session = getClientSession();

  if (!session) {
    redirect("/client/login");
  }

  const supabase = getServiceSupabase();

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );

  const [{ data: bot }, { data: conversationRows }, { count: leadCount }] =
    await Promise.all([
      supabase
        .from("bots")
        .select("*")
        .eq("id", session.botId)
        .single(),
      supabase
        .from("conversations")
        .select("id, created_at")
        .eq("bot_id", session.botId)
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("bot_id", session.botId)
    ]);

  if (!bot) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          Bot not found
        </div>
      </main>
    );
  }

  const conversations = conversationRows ?? [];
  const expired = isExpired(bot.paid_until);
  const statusText = !bot.is_active ? "Inactive" : expired ? "Expired" : "Active";

  const embedCode = `<script async src="https://app.selvanto.com/widget.js?botId=${bot.public_bot_id}"></script>`;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Client cabinet</p>
            <h1 className="text-3xl font-semibold text-slate-900">
              {bot.company_name || "Your bot"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Bot ID: <span className="font-medium">{bot.public_bot_id}</span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <div className="text-slate-500">Login</div>
            <div className="font-medium text-slate-900">{session.email}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Status</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{statusText}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Tariff</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {bot.tariff || "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Paid until</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {formatDate(bot.paid_until)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Access</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">Read-only</div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Conversations this month</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              {conversations.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Leads total</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              {leadCount ?? 0}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Company</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {bot.company_name || "—"}
            </div>

            <div className="mt-6 text-sm text-slate-500">Niche</div>
            <div className="mt-1 text-base text-slate-900">{bot.niche || "—"}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-slate-500">Embed code</div>
            </div>

            <div className="mt-3 rounded-xl bg-slate-900 p-4 text-sm text-slate-100 overflow-x-auto">
              <code>{embedCode}</code>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Paste this code before closing {"</body>"} tag on your website.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
