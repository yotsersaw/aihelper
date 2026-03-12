import { ChatWidget } from "@/components/chat-widget";
import { getServiceSupabase } from "@/lib/supabase";

export default async function DemoBotPage({ params }: { params: { botId: string } }) {
  const supabase = getServiceSupabase();
  const { data: bot } = await supabase
    .from("bots")
    .select("company_name, welcome_message, error_message, bot_name, widget_color")
    .eq("public_bot_id", params.botId)
    .single();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">{bot?.company_name ?? params.botId}</h1>
      <div className="h-[640px]">
        <ChatWidget
          botId={params.botId}
          welcomeMessage={bot?.welcome_message ?? undefined}
          errorMessage={bot?.error_message ?? undefined}
          botName={bot?.bot_name ?? undefined}
          widgetColor={bot?.widget_color ?? undefined}
        />
      </div>
    </main>
  );
}