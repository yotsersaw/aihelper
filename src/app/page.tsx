import { redirect } from "next/navigation";
import Link from "next/link";

function LegacyHomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          AI SaaS MVP
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          AI website chat widget for client websites
        </h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Multi-tenant chat backend with per-client prompts, domain allowlist, OpenRouter proxy, lead capture,
          usage tracking, and simple admin panel.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/demo/demo-dental"
            className="rounded-lg bg-brand-500 px-4 py-2 font-medium text-white hover:bg-brand-600"
          >
            Open demo
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
          >
            Admin
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  redirect("/client/login");
}
