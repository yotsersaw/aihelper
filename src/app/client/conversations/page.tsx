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
              Conversations
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              {bot?.company_name || "Your bot"} · {bot?.public_bot_id || "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <div className="text-slate-500">Total</div>
            <div className="font-medium text-slate-900">{total}</div>
          </div>
        </div>

        {conversationList.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            No conversations yet
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Conversation list
                </h2>
              </div>

              <div className="max-h-[760px] overflow-y-auto">
                {conversationList.map((conversation) => {
                  const isActive = selectedConversation?.id === conversation.id;

                  return (
                    <Link
                      key={conversation.id}
                      href={`/client/conversations?page=${currentPage}&id=${conversation.id}`}
                      className={`block border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50 ${
                        isActive ? "bg-blue-50" : "bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {bot?.company_name || "Conversation"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 break-all">
                            {conversation.id}
                          </div>
                        </div>

                        <div className="shrink-0 text-xs text-slate-500">
                          {messageCounts[conversation.id] || 0} msgs
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-slate-500">
                        {formatDate(conversation.created_at)}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {total > 0 && (
                <div className="flex items-center justify-center gap-3 border-t border-slate-200 px-4 py-4">
                  {currentPage > 1 ? (
                    <Link
                      href={`/client/conversations?page=${currentPage - 1}`}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      ← Previous
                    </Link>
                  ) : (
                    <div className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-300">
                      ← Previous
                    </div>
                  )}

                  <div className="text-sm text-slate-600">
                    {currentPage} / {totalPages}
                  </div>

                  {currentPage < totalPages ? (
                    <Link
                      href={`/client/conversations?page=${currentPage + 1}`}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Next →
                    </Link>
                  ) : (
                    <div className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-300">
                      Next →
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {selectedConversation ? (
                <>
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                          {bot?.company_name || "Conversation"}
                        </h2>
                        <div className="mt-1 text-sm text-slate-500">
                          Created: {formatDate(selectedConversation.created_at)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 break-all">
                          ID: {selectedConversation.id}
                        </div>
                      </div>

                      <div className="text-sm text-slate-500">
                        <div>
                          Messages:{" "}
                          <span className="font-medium text-slate-900">
                            {selectedMessages.length}
                          </span>
                        </div>
                        <div className="mt-1 break-all">
                          Session:{" "}
                          <span className="text-slate-900">
                            {selectedConversation.session_id || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[760px] overflow-y-auto p-5">
                    {selectedMessages.length === 0 ? (
                      <div className="text-sm text-slate-500">
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
                              <div className="max-w-[85%]">
                                <div className="mb-1 text-xs text-slate-500">
                                  {isUser ? "Client" : "Bot"} · {formatDate(message.created_at)}
                                </div>

                                <div
                                  className={`rounded-2xl px-4 py-3 text-sm leading-7 ${
                                    isUser
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-100 text-slate-900"
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
                <div className="p-10 text-center text-slate-500">
                  Select a conversation
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
