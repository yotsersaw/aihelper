import { ChatWidget } from "@/components/chat-widget";

export default function DemoBotPage({ params }: { params: { botId: string } }) {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Demo bot: {params.botId}</h1>
      <div className="h-[640px]">
        <ChatWidget botId={params.botId} />
      </div>
    </main>
  );
}
