"use client";

import { useState } from "react";

export default function EmbedCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 rounded-[28px] border border-white/10 bg-[#0b1728]/80 p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm text-slate-400">Embed code</div>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Install on your website
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-400">
            Paste this code before closing {"</body>"} tag.
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[20px] border border-white/10 bg-[#050b14] p-4 text-sm text-slate-100 md:p-5">
        <code>{code}</code>
      </div>
    </div>
  );
}
