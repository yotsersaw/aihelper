const requiredServer = ["SUPABASE_SERVICE_ROLE_KEY", "OPENROUTER_API_KEY", "ADMIN_SECRET"] as const;

function read(name: string, isPublic = false): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === "production" || !isPublic) {
      throw new Error(`Missing environment variable: ${name}`);
    }
    return "";
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: read("NEXT_PUBLIC_SUPABASE_URL", true),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: read("NEXT_PUBLIC_SUPABASE_ANON_KEY", true),
  SUPABASE_SERVICE_ROLE_KEY: read("SUPABASE_SERVICE_ROLE_KEY"),
  OPENROUTER_API_KEY: read("OPENROUTER_API_KEY"),
  ADMIN_SECRET: read("ADMIN_SECRET"),
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
};

export function assertServerEnv() {
  for (const key of requiredServer) {
    if (!process.env[key]) {
      throw new Error(`Missing required server env: ${key}`);
    }
  }
}
