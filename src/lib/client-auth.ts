import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

const COOKIE_NAME = "client_session";

export type ClientSession = {
  clientId: string;
  botId: string;
  email: string;
};

function sign(value: string) {
  return createHmac("sha256", env.ADMIN_SECRET).update(value).digest("hex");
}

function encodeSession(session: ClientSession) {
  const data = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = sign(data);
  return `${data}.${signature}`;
}

function decodeSession(raw?: string | null): ClientSession | null {
  if (!raw) return null;

  const [data, signature] = raw.split(".");
  if (!data || !signature) return null;

  const expected = sign(data);

  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));

    if (!parsed?.clientId || !parsed?.botId || !parsed?.email) {
      return null;
    }

    return parsed as ClientSession;
  } catch {
    return null;
  }
}

export function hashClientPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

export function getClientSession() {
  const raw = cookies().get(COOKIE_NAME)?.value;
  return decodeSession(raw);
}

export function setClientSession(session: ClientSession) {
  cookies().set(COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearClientSession() {
  cookies().delete(COOKIE_NAME);
}
