"use client";

import { FormEvent, useMemo, useState } from "react";

type Props = {
  botId: string;
  embedded?: boolean;
};

type Message = { role: "user" | "assistant"; content: string };

type LeadState = { name: string; phone: string; email: string; note: string };

const initialLead: LeadState = { name: "", phone: "", email: "", note: "" };

export function ChatWidget({ botId, embedded = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [leadMode, setLeadMode] = useState(false);
  const [lead, setLead] = useState<LeadState>(initialLead);
  const [leadSaved, setLeadSaved] = useState(false);

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "server";
    const key = `chat_session_${botId}`;
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  }, [botId]);

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
      if (payload.suggestLead) setLeadMode(true);
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Error";
      setMessages((prev) => [...prev, { role: "assistant", content: `Ошибка: ${fallback}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function submitLead(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, botId, sessionId, sourcePage: typeof window !== "undefined" ? window.location.href : "" })
    });

    if (response.ok) {
      setLeadSaved(true);
      setLeadMode(false);
      setLead(initialLead);
      setMessages((prev) => [...prev, { role: "assistant", content: "Спасибо! Мы получили ваши контакты." }]);
    }
  }

  return (
    <div className={`flex h-full flex-col ${embedded ? "" : "rounded-xl border border-slate-200 bg-white shadow-sm"}`}>
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">AI Assistant</div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.length === 0 && <p className="text-slate-500">Спросите о услугах, цене или записи.</p>}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "assistant" ? "rounded-xl bg-slate-100 p-3" : "ml-10 rounded-xl bg-blue-100 p-3"}>
            {msg.content}
          </div>
        ))}
        {loading && <p className="text-slate-400">Печатает...</p>}
        {leadSaved && <p className="text-emerald-600">Лид сохранен.</p>}
      </div>
      {leadMode ? (
        <form onSubmit={submitLead} className="grid gap-2 border-t border-slate-200 p-3">
          <input required className="rounded-md border p-2 text-sm" placeholder="Имя" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
          <input className="rounded-md border p-2 text-sm" placeholder="Телефон" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
          <input type="email" className="rounded-md border p-2 text-sm" placeholder="Email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
          <textarea className="rounded-md border p-2 text-sm" placeholder="Комментарий" value={lead.note} onChange={(e) => setLead({ ...lead, note: e.target.value })} rows={2} />
          <button className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white">Отправить</button>
        </form>
      ) : (
        <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-200 p-3">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Введите сообщение..." className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <button disabled={loading} className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
