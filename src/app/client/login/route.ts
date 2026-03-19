import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase";
import { hashClientPassword, setClientSession } from "@/lib/client-auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  try {
    const { email, password } = schema.parse(await req.json());
    const supabase = getServiceSupabase();

    const { data: account, error } = await supabase
      .from("client_accounts")
      .select("id, bot_id, email, password_hash, is_active")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (error || !account || !account.is_active) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const passwordHash = hashClientPassword(password);

    if (account.password_hash !== passwordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    setClientSession({
      clientId: account.id,
      botId: account.bot_id,
      email: account.email
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
