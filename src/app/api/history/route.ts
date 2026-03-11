import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("botId");
  const sessionId = searchParams.get("sessionId");

  if (!botId || !sessionId) {
    return NextResponse.json({ messages: [] });
  }

  const supabase = getServiceSupabase();

  // Get bot
  const { data: bot } = await supabase
    .from("bots")
    .select("id")
    .eq("public_bot_id", botId)
    .single();

  if (!bot) return NextResponse.json({ messages: [] });

  // Get conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("bot_id", bot.id)
    .eq("session_id", sessionId)
    .single();

  if (!conversation) return NextResponse.json({ messages: [] });

  // Get last 20 messages
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const ordered = (messages || []).reverse();

  return NextResponse.json({ messages: ordered });
}