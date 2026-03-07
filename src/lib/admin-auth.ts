import crypto from "crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE_NAME = "admin_session";

function sessionHash(secret: string) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function isAdminAuthenticated() {
  const cookie = cookies().get(COOKIE_NAME)?.value;
  return cookie === sessionHash(env.ADMIN_SECRET);
}

export function setAdminSession() {
  cookies().set(COOKIE_NAME, sessionHash(env.ADMIN_SECRET), {
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
