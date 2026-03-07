"use client";

import { FormEvent, useMemo, useRef, useEffect, useState } from "react";

type Props = {
  botId: string;
  embedded?: boolean;
};

type Message = { role: "user" | "assistant"; content: string };

export function ChatWidget({ botId, embedded = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "server";
    const key = `chat_session_${botId}`;
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  }, [botId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Ошибка: ${fallback}` }
      ]);
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
    <div
      className={`flex h-full flex-col bg-white ${
        embedded ? "" : "rounded-xl border border-slate-200 shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-sm font-semibold text-slate-700">AI Assistant</span>
        <span className="ml-auto text-xs text-slate-400">Online</span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
        {messages.length === 0 && (
          <p className="text-slate-400 text-center mt-8">
            Привет! Чем могу помочь?
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "assistant"
                ? "flex justify-start"
                : "flex justify-end"
            }
          >
            <div
              className={
                msg.role === "assistant"
                  ? "max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-slate-800"
                  : "max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-white"
              }
            >
              {msg.content}
            </div>
          </div>
        ))}
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
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 border-t border-slate-100 px-3 py-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение..."
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
          disabled={loading}
        />
        <button
          disabled={loading || !text.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </form>
    </div>
  );
}