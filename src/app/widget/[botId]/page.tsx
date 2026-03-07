import { ChatWidget } from "@/components/chat-widget";

export default function WidgetFramePage({ params }: { params: { botId: string } }) {
  return (
    <main className="h-screen bg-white p-2">
      <ChatWidget botId={params.botId} embedded />
    </main>
  );
}
