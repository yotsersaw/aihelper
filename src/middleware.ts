import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

function hash(secret: string) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_SECRET ? hash(process.env.ADMIN_SECRET) : "";
  const cookie = request.cookies.get("admin_session")?.value;

  if (!expected || cookie !== expected) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
