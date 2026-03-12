import { ChatWidget } from "@/components/chat-widget";
import { getServiceSupabase } from "@/lib/supabase";

export default async function WidgetFramePage({ params }: { params: { botId: string } }) {
  const supabase = getServiceSupabase();
  const { data: bot } = await supabase
    .from("bots")
    .select("welcome_message, error_message, bot_name, widget_color")
    .eq("public_bot_id", params.botId)
    .single();

  return (
    <main className="h-screen bg-white p-2">
      <ChatWidget
        botId={params.botId}
        embedded
        welcomeMessage={bot?.welcome_message ?? undefined}
        errorMessage={bot?.error_message ?? undefined}
        botName={bot?.bot_name ?? undefined}
        widgetColor={bot?.widget_color ?? undefined}
      />
    </main>
  );
}