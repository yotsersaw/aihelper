"use client";

import { FormEvent, useMemo, useRef, useEffect, useState } from "react";

type Props = {
  botId: string;
  embedded?: boolean;
  welcomeMessage?: string;
  errorMessage?: string;
  botName?: string;
  widgetColor?: string;
};

type Message = { role: "user" | "assistant"; content: string };

function getOrCreateSessionId(botId: string): string {
  const key = `chat_session_${botId}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    try {
      const existing = sessionStorage.getItem(key);
      if (existing) return existing;
      const id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
      return id;
    } catch {
      return crypto.randomUUID();
    }
  }
}

export function ChatWidget({
  botId,
  embedded = false,
  welcomeMessage = "Привет! Чем могу помочь?",
  errorMessage = "Извините, произошла ошибка. Попробуйте ещё раз.",
  botName = "AI Assistant",
  widgetColor = "#2563eb"
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "server";
    return getOrCreateSessionId(botId);
  }, [botId]);

  useEffect(() => {
    if (sessionId === "server") return;
    async function loadHistory() {
      try {
        const res = await fetch(`/api/history?botId=${botId}&sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length > 0) {
            setMessages(data.messages);
          }
        }
      } catch {
        // silently fail
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, [botId, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading && !historyLoading) {
      inputRef.current?.focus();
    }
  }, [loading, historyLoading]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || loading) return;

    const userMessage = text.trim();
    setText("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId,
          message: userMessage,
          sessionId,
          pageUrl: typeof window === "undefined" ? "" : window.location.href
        })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Request failed");
      setMessages((prev) => [...prev, { role: "assistant", content: payload.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: errorMessage }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as unknown as FormEvent);
    }
  }

  return (
    <div className={`flex h-full flex-col bg-white ${embedded ? "" : "rounded-xl border border-slate-200 shadow-sm"}`}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3" style={{ borderBottomColor: `${widgetColor}22` }}>
        <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: widgetColor }}>
          {botName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">{botName}</p>
          <p className="text-xs text-emerald-500">● Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
        {historyLoading ? (
          <div className="flex justify-center mt-8">
            <span className="inline-flex gap-1 text-slate-300">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce [animation-delay:0.1s]">.</span>
              <span className="animate-bounce [animation-delay:0.2s]">.</span>
            </span>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-slate-400 text-center mt-8">{welcomeMessage}</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={msg.role === "assistant" ? "flex justify-start" : "flex justify-end"}>
              <div
                className={msg.role === "assistant"
                  ? "max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-slate-800"
                  : "max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-white"
                }
                style={msg.role === "user" ? { backgroundColor: widgetColor } : {}}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-slate-400">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce [animation-delay:0.1s]">.</span>
                <span className="animate-bounce [animation-delay:0.2s]">.</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-slate-100 px-3 py-3">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение..."
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:bg-white transition"
          style={{ borderColor: text ? widgetColor : undefined }}
          disabled={loading || historyLoading}
          autoFocus
        />
        <button
          disabled={loading || historyLoading || !text.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white disabled:opacity-40 transition"
          style={{ backgroundColor: widgetColor }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </form>
    </div>
  );
}