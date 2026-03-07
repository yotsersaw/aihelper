import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase";

const schema = z.object({
  botId: z.string().min(2),
  sessionId: z.string().min(8),
  name: z.string().min(2),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
  sourcePage: z.string().url().optional().or(z.literal(""))
});

export async function POST(req: Request) {
  try {
    const payload = schema.parse(await req.json());
    const supabase = getServiceSupabase();

    const { data: bot } = await supabase.from("bots").select("id").eq("public_bot_id", payload.botId).single();
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

    const { error } = await supabase.from("leads").insert({
      bot_id: bot.id,
      session_id: payload.sessionId,
      name: payload.name,
      phone: payload.phone || null,
      email: payload.email || null,
      note: payload.note || null,
      source_page: payload.sourcePage || null
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
