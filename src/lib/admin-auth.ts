import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE_NAME = "admin_session";

export function isAdminAuthenticated() {
  const cookie = cookies().get(COOKIE_NAME)?.value;
  return cookie === env.ADMIN_SECRET;
}

export function setAdminSession() {
  cookies().set(COOKIE_NAME, env.ADMIN_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export function clearAdminSession() {
  cookies().delete(COOKIE_NAME);
}