import Link from "next/link";
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function trimText(value?: string | null, max = 140) {
  if (!value) return "—";
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export default async function ClientConversationsPage() {
  const session = getClientSession();

  if (!session) {
    redirect("/client/login");
  }

  const supabase = getServiceSupabase();

  const [{ data: bot }, { data: conversations }] = await Promise.all([
    supabase
      .from("bots")
      .select("company_name, public_bot_id")
      .eq("id", session.botId)
      .single(),
    supabase
      .from("conversations")
      .select("*")
      .eq("bot_id", session.botId)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  const conversationIds = (conversations ?? []).map((item: any) => item.id);

  let messagesByConversation: Record<string, any[]> = {};

  if (conversationIds.length > 0) {
    const { data: messages } = await supabase
      .from("messages")
      .select("id, conversation_id, role, content, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });

    for (const message of messages ?? []) {
      if (!messagesByConversation[message.conversation_id]) {
        messagesByConversation[message.conversation_id] = [];
      }
      messagesByConversation[message.conversation_id].push(message);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/client"
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              ← Назад в кабинет
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Беседы
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {bot?.company_name || "Your bot"} · {bot?.public_bot_id || "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <div className="text-slate-500">Всего</div>
            <div className="font-medium text-slate-900">
              {conversations?.length ?? 0}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {(conversations ?? []).length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
              Бесед пока нет
            </div>
          ) : (
            (conversations ?? []).map((conversation: any) => {
              const messages = messagesByConversation[conversation.id] ?? [];
              const userMessages = messages.filter((m) => m.role === "user");
              const assistantMessages = messages.filter((m) => m.role === "assistant");

              const firstUserMessage =
                userMessages[0]?.content || messages[0]?.content || "—";

              const lastMessage =
                messages[messages.length - 1]?.content || "—";

              return (
                <div
                  key={conversation.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm text-slate-500">
                        Создано: {formatDate(conversation.created_at)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500 break-all">
                        ID: {conversation.id}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <div className="text-slate-500">Сообщений</div>
                        <div className="font-semibold text-slate-900">
                          {messages.length}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <div className="text-slate-500">Клиент</div>
                        <div className="font-semibold text-slate-900">
                          {userMessages.length}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <div className="text-slate-500">Бот</div>
                        <div className="font-semibold text-slate-900">
                          {assistantMessages.length}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-sm text-slate-500">
                        Первое сообщение
                      </div>
                      <div className="mt-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-900">
                        {trimText(firstUserMessage, 180)}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-500">
                        Последнее сообщение
                      </div>
                      <div className="mt-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-900">
                        {trimText(lastMessage, 180)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="text-sm text-slate-500">
                      Страница:{" "}
                      <span className="text-slate-900 break-all">
                        {conversation.source_page || "—"}
                      </span>
                    </div>

                    <div className="text-sm text-slate-500">
                      Session:{" "}
                      <span className="text-slate-900 break-all">
                        {conversation.session_id || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
