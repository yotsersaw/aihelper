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

type SearchParams = {
  id?: string;
  page?: string;
};

export default async function ClientConversationsPage({
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

  const [
    { data: bot },
    { count: totalConversations },
    { data: conversations }
  ] = await Promise.all([
    supabase
      .from("bots")
      .select("company_name, public_bot_id")
      .eq("id", session.botId)
      .single(),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("bot_id", session.botId),
    supabase
      .from("conversations")
      .select("id, created_at, session_id")
      .eq("bot_id", session.botId)
      .order("created_at", { ascending: false })
      .range(from, to)
  ]);

  const conversationList = conversations ?? [];
  const total = totalConversations ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const requestedId = searchParams?.id;
  const selectedConversation =
    conversationList.find((item) => item.id === requestedId) || conversationList[0] || null;

  const conversationIds = conversationList.map((item) => item.id);

  let messageCounts: Record<string, number> = {};
  let selectedMessages: Array<{
    id: string;
    role: string;
    content: string | null;
    created_at: string | null;
  }> = [];

  if (conversationIds.length > 0) {
    const { data: messageRows } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds);

    for (const row of messageRows ?? []) {
      const key = row.conversation_id;
      messageCounts[key] = (messageCounts[key] || 0) + 1;
    }
  }

  if (selectedConversation) {
    const { data } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", selectedConversation.id)
      .order("created_at", { ascending: true });

    selectedMessages = data ?? [];
  }

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
                Conversations
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Client conversations
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Review all assistant conversations in a clean read-only timeline.
              </p>

              <div className="mt-5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 inline-flex">
                {bot?.company_name || "Your bot"} · {bot?.public_bot_id || "—"}
              </div>
            </div>

            <div className="grid w-full max-w-md gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-[#0b1728]/80 p-5">
                <div className="text-sm text-slate-400">Total</div>
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

          {conversationList.length === 0 ? (
            <div className="mt-6 rounded-[28px] border border-white/10 bg-[#0b1728]/80 p-12 text-center text-slate-400">
              No conversations yet
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[430px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1728]/80">
                <div className="border-b border-white/10 px-5 py-4">
                  <h2 className="text-lg font-semibold text-white">Conversation list</h2>
                </div>

                <div className="max-h-[760px] overflow-y-auto">
                  {conversationList.map((conversation) => {
                    const isActive = selectedConversation?.id === conversation.id;

                    return (
                      <Link
                        key={conversation.id}
                        href={`/client/conversations?page=${currentPage}&id=${conversation.id}`}
                        className={`block border-b border-white/5 px-5 py-4 transition ${
                          isActive ? "bg-white/10" : "bg-transparent hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-white">
                              {bot?.company_name || "Conversation"}
                            </div>
                            <div className="mt-1 break-all text-xs text-slate-500">
                              {conversation.id}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                            {messageCounts[conversation.id] || 0} msgs
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-slate-400">
                          {formatDate(conversation.created_at)}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {total > 0 && (
                  <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 px-4 py-4 md:flex-row">
                    {currentPage > 1 ? (
                      <Link
                        href={`/client/conversations?page=${currentPage - 1}`}
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
                      <span className="font-medium text-white">{currentPage}</span> /{" "}
                      <span className="font-medium text-white">{totalPages}</span>
                    </div>

                    {currentPage < totalPages ? (
                      <Link
                        href={`/client/conversations?page=${currentPage + 1}`}
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

              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1728]/80">
                {selectedConversation ? (
                  <>
                    <div className="border-b border-white/10 px-5 py-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-white">
                            {bot?.company_name || "Conversation"}
                          </h2>

                          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-400">
                            <div>
                              Created:{" "}
                              <span className="text-slate-200">
                                {formatDate(selectedConversation.created_at)}
                              </span>
                            </div>

                            <div className="break-all">
                              ID:{" "}
                              <span className="text-slate-200">{selectedConversation.id}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                            <div className="text-slate-400">Messages</div>
                            <div className="mt-1 font-semibold text-white">
                              {selectedMessages.length}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                            <div className="text-slate-400">Session</div>
                            <div className="mt-1 break-all text-white">
                              {selectedConversation.session_id || "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[760px] overflow-y-auto p-5 md:p-6">
                      {selectedMessages.length === 0 ? (
                        <div className="text-sm text-slate-400">
                          No messages in this conversation
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedMessages.map((message) => {
                            const isUser = message.role === "user";

                            return (
                              <div
                                key={message.id}
                                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                              >
                                <div className="max-w-[88%]">
                                  <div className="mb-1.5 text-xs text-slate-500">
                                    {isUser ? "Client" : "Bot"} · {formatDate(message.created_at)}
                                  </div>

                                  <div
                                    className={`rounded-[22px] px-4 py-3 text-sm leading-7 shadow-lg shadow-black/10 ${
                                      isUser
                                        ? "border border-cyan-400/20 bg-cyan-500/15 text-cyan-50"
                                        : "border border-white/10 bg-white/[0.05] text-slate-100"
                                    }`}
                                  >
                                    <div className="whitespace-pre-wrap break-words">
                                      {message.content || "—"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center text-slate-400">
                    Select a conversation
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

