import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "AI Widget"
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      temperature: 0,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: "Извлеки имя, телефон, email, суть. Верни JSON: {name, phone, email, note, has_contact}. Отвечай ТОЛЬКО валидным JSON."
        },
        {
          role: "user",
          content: "Клиент: стратопендер\nБот: Телефон?\nКлиент: 3452145453"
        }
      ]
    })
  });

  const data = await res.json();
  return NextResponse.json({ status: res.status, data });
}
