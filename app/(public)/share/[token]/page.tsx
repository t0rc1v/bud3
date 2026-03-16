import { notFound } from "next/navigation";
import { getChatByShareToken } from "@/lib/actions/ai";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const data = await getChatByShareToken(token);

  if (!data) {
    notFound();
  }

  const { chat, messages } = data;
  const visibleMessages = messages.filter(m => m.role !== "tool");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold truncate max-w-[200px] sm:max-w-sm">{chat.title}</span>
        </div>
        <Badge variant="secondary" className="gap-1.5 shrink-0">
          <Lock className="h-3 w-3" />
          Read Only
        </Badge>
      </div>

      {/* Messages */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {visibleMessages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No messages in this chat.</p>
        ) : (
          visibleMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-lg px-4 py-2.5 max-w-[85%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.role === "user" ? (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <MarkdownRenderer content={message.content} isAssistant />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
