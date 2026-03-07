import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { setAdminSession } from "@/lib/admin-auth";

const schema = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { password } = schema.parse(await req.json());
    if (password !== env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    setAdminSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
