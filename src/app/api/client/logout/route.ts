import { NextResponse } from "next/server";
import { clearClientSession } from "@/lib/client-auth";

export async function POST(req: Request) {
  clearClientSession();
  return NextResponse.redirect(new URL("/client/login", req.url), {
    status: 303
  });
}
