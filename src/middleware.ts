import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (
    !request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname === "/admin/login"
  ) {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SECRET ?? "";
  const cookie = request.cookies.get("admin_session")?.value;

  if (!secret || cookie !== secret) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};