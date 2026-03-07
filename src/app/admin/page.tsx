import { revalidatePath } from "next/cache";
import { getServiceSupabase } from "@/lib/supabase";

async function createBot(formData: FormData) {
  "use server";
  const supabase = getServiceSupabase();

  const payload = {
    public_bot_id: String(formData.get("public_bot_id") || "").trim(),
    company_name: String(formData.get("company_name") || "").trim(),
    niche: String(formData.get("niche") || "").trim() || null,
    system_prompt: String(formData.get("system_prompt") || "").trim(),
    model: String(formData.get("model") || "openai/gpt-4o-mini"),
    temperature: Number(formData.get("temperature") || 0.3),
    max_completion_tokens: Number(formData.get("max_completion_tokens") || 350),
    allowed_domain: String(formData.get("allowed_domain") || "*"),
    handoff_email: String(formData.get("handoff_email") || "").trim() || null,
    monthly_token_limit: Number(formData.get("monthly_token_limit") || 200000),
    monthly_cost_limit: Number(formData.get("monthly_cost_limit") || 50),
    is_active: formData.get("is_active") === "on"
  };

  await supabase.from("bots").insert(payload);
  revalidatePath("/admin");
}

async function updateBot(formData: FormData) {
  "use server";
  const supabase = getServiceSupabase();
  const id = String(formData.get("id"));
  await supabase
    .from("bots")
    .update({
      company_name: String(formData.get("company_name") || "").trim(),
      allowed_domain: String(formData.get("allowed_domain") || "*"),
      model: String(formData.get("model") || "openai/gpt-4o-mini"),
      is_active: formData.get("is_active") === "on",
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  revalidatePath("/admin");
}

export default async function AdminPage() {
  const supabase = getServiceSupabase();
  const [{ data: bots }, { data: leads }, { data: conversations }, { data: usage }] = await Promise.all([
    supabase.from("bots").select("*").order("created_at", { ascending: false }),
    supabase.from("leads").select("*, bots(company_name)").order("created_at", { ascending: false }).limit(30),
    supabase
      .from("conversations")
      .select("id,session_id,last_message_at,bots(company_name),messages(id)")
      .order("last_message_at", { ascending: false })
      .limit(30),
    supabase
      .from("usage_daily")
      .select("usage_date,total_tokens,total_cost,bots(company_name)")
      .order("usage_date", { ascending: false })
      .limit(60)
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin dashboard</h1>
        <form action="/api/admin/logout" method="post">
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Logout</button>
        </form>
      </div>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Create bot</h2>
        <form action={createBot} className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input required name="public_bot_id" placeholder="public_bot_id" className="rounded-md border p-2" />
          <input required name="company_name" placeholder="company_name" className="rounded-md border p-2" />
          <input name="niche" placeholder="niche" className="rounded-md border p-2" />
          <input name="allowed_domain" placeholder="allowed_domain" defaultValue="*" className="rounded-md border p-2" />
          <input name="model" defaultValue="openai/gpt-4o-mini" className="rounded-md border p-2" />
          <input name="handoff_email" placeholder="handoff_email" className="rounded-md border p-2" />
          <input name="temperature" type="number" step="0.1" defaultValue="0.3" className="rounded-md border p-2" />
          <input name="max_completion_tokens" type="number" defaultValue="350" className="rounded-md border p-2" />
          <input name="monthly_token_limit" type="number" defaultValue="200000" className="rounded-md border p-2" />
          <input name="monthly_cost_limit" type="number" step="0.01" defaultValue="50" className="rounded-md border p-2" />
          <label className="inline-flex items-center gap-2 p-2 text-sm">
            <input name="is_active" type="checkbox" defaultChecked /> active
          </label>
          <textarea required name="system_prompt" placeholder="system_prompt" rows={4} className="rounded-md border p-2 md:col-span-2" />
          <button className="rounded-md bg-brand-500 px-4 py-2 font-medium text-white md:col-span-2">Create bot</button>
        </form>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Bots</h2>
        <div className="space-y-3">
          {bots?.map((bot) => (
            <form key={bot.id} action={updateBot} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-6">
              <input type="hidden" name="id" value={bot.id} />
              <input defaultValue={bot.public_bot_id} disabled className="rounded-md border bg-slate-100 p-2 text-xs" />
              <input name="company_name" defaultValue={bot.company_name} className="rounded-md border p-2" />
              <input name="allowed_domain" defaultValue={bot.allowed_domain} className="rounded-md border p-2" />
              <input name="model" defaultValue={bot.model} className="rounded-md border p-2" />
              <label className="inline-flex items-center gap-2 p-2 text-sm">
                <input name="is_active" type="checkbox" defaultChecked={bot.is_active} /> active
              </label>
              <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">Save</button>
            </form>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Recent leads</h2>
          <div className="space-y-2 text-sm">
            {leads?.map((lead) => (
              <div key={lead.id} className="rounded-md border p-2">
                <p className="font-medium">{lead.name} — {(lead.bots as { company_name?: string } | null)?.company_name || "Bot"}</p>
                <p>{lead.phone || lead.email || "No contacts"}</p>
                <p className="text-slate-500">{lead.note || "-"}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Recent conversations</h2>
          <div className="space-y-2 text-sm">
            {conversations?.map((conv) => (
              <div key={conv.id} className="rounded-md border p-2">
                <p className="font-medium">{(conv.bots as { company_name?: string } | null)?.company_name || "Bot"}</p>
                <p className="text-slate-600">session: {conv.session_id}</p>
                <p className="text-slate-500">messages: {(conv.messages as { id: string }[] | null)?.length ?? 0}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Usage summary</h2>
        <div className="grid gap-2 text-sm md:grid-cols-3">
          {usage?.map((row, i) => (
            <div key={i} className="rounded-md border p-2">
              <p className="font-medium">{(row.bots as { company_name?: string } | null)?.company_name || "Bot"}</p>
              <p>{row.usage_date}</p>
              <p>tokens: {row.total_tokens}</p>
              <p>cost: ${Number(row.total_cost).toFixed(4)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
