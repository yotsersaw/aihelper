"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/client/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      setError("Wrong email or password");
      setLoading(false);
      return;
    }

    router.push("/client");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-[320px] w-[320px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-140px] top-[80px] h-[340px] w-[340px] rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[20%] h-[280px] w-[280px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center px-6 py-10 md:grid-cols-2 md:gap-10">
        <div className="hidden md:block">
          <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
            Selvanto client area
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white">
            Access your assistant dashboard
          </h1>

          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            Review leads, conversations, account status, and installation details in one premium client space.
          </p>
        </div>

        <div className="w-full">
          <form
            onSubmit={submit}
            className="w-full rounded-[32px] border border-white/10 bg-white/[0.05] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl md:p-8"
          >
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
              Login
            </div>

            <h2 className="mt-4 text-3xl font-semibold text-white">
              Client login
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Enter your client access details to open the read-only dashboard.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-white/10 bg-[#0b1728]/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-2xl border border-white/10 bg-[#0b1728]/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
