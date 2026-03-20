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
    year: "numeric"
  }).format(date);
}

function isExpired(value?: string | null) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

function getStatusTone(statusText: string) {
  if (statusText === "Active") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  }

  if (statusText === "Expired") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-300";
  }

  return "border-white/10 bg-white/5 text-slate-300";
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
      <main className="min-h-screen bg-[#07111f] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-red-400/20 bg-red-500/10 p-6 text-red-200 backdrop-blur">
          Bot not found
        </div>
      </main>
    );
  }

  const conversations = conversationRows ?? [];
  const expired = isExpired(bot.paid_until);
  const statusText = !bot.is_active ? "Inactive" : expired ? "Expired" : "Active";
  const statusTone = getStatusTone(statusText);
  const embedCode = `<script async src="https://app.selvanto.com/widget.js?botId=${bot.public_bot_id}"></script>`;

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
              <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
                Client dashboard
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
                {bot.company_name || "Your bot"}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                View your assistant status, recent leads, conversations, and installation code.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className={`rounded-full border px-3 py-1 text-sm font-medium ${statusTone}`}>
                  {statusText}
                </div>

                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                  Bot ID: <span className="font-medium text-white">{bot.public_bot_id}</span>
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Account
              </div>

              <div className="mt-3 text-sm text-slate-400">Login email</div>
              <div className="mt-1 break-all text-base font-medium text-white">
                {session.email}
              </div>

              <form action="/api/client/logout" method="post" className="mt-5">
                <button
                  type="submit"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
              <div className="text-sm text-slate-400">Status</div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusText}</div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
              <div className="text-sm text-slate-400">Tariff</div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {bot.tariff || "—"}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
              <div className="text-sm text-slate-400">Paid until</div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {formatDate(bot.paid_until)}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
              <div className="text-sm text-slate-400">Total leads</div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {leadCount ?? 0}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_1.1fr_0.9fr]">
            <div className="rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
              <div className="text-sm text-slate-400">Conversations this month</div>
              <div className="mt-3 text-4xl font-semibold text-white">
                {conversations.length}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Total conversations created since the start of the current month.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
              <div className="text-sm text-slate-400">Company</div>
              <div className="mt-3 text-2xl font-semibold text-white">
                {bot.company_name || "—"}
              </div>

              <div className="mt-6 text-sm text-slate-400">Niche</div>
              <div className="mt-2 text-base leading-7 text-slate-200">
                {bot.niche || "—"}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
              <div className="text-sm text-slate-400">Quick actions</div>

              <div className="mt-5 flex flex-col gap-3">
                <Link
                  href="/client/leads?page=1"
                  className="rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:opacity-90"
                >
                  View leads
                </Link>

                <Link
                  href="/client/conversations?page=1"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  View conversations
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-[#0b1728]/80 p-5 md:p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm text-slate-400">Embed code</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Install on your website</h2>
              </div>

              <div className="text-sm text-slate-400">
                Paste this code before closing {"</body>"} tag.
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-[20px] border border-white/10 bg-[#050b14] p-4 text-sm text-slate-100 md:p-5">
              <code>{embedCode}</code>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
