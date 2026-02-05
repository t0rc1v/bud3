"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Send,
  Bot,
  User,
  Loader2,
  X,
  Plus,
  MoreVertical,
  Trash2,
  FileText,
  Video,
  Headphones,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { createChat, deleteChat, getUserChats, type Chat } from "@/lib/actions/ai";

interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  type: "notes" | "video" | "audio" | "image";
}

interface AIChatProps {
  userId: string;
  initialChatId?: string;
  attachedResources?: Resource[];
  onRemoveResource?: (resourceId: string) => void;
}

const TYPE_ICONS = {
  notes: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
};

const TYPE_COLORS = {
  notes: "bg-blue-100 text-blue-800",
  video: "bg-red-100 text-red-800",
  audio: "bg-purple-100 text-purple-800",
  image: "bg-green-100 text-green-800",
};

export function AIChat({
  userId,
  initialChatId,
  attachedResources = [],
  onRemoveResource,
}: AIChatProps) {
  const [chatId, setChatId] = useState<string | undefined>(initialChatId);
  const [input, setInput] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        chatId,
        resources: attachedResources,
      }),
    }),
    id: chatId || "default",
  });

  // Load user's chats on mount
  useEffect(() => {
    async function loadChats() {
      try {
        const userChats = await getUserChats(userId);
        setChats(userChats);
      } catch (error) {
        console.error("Failed to load chats:", error);
      } finally {
        setIsLoadingChats(false);
      }
    }
    loadChats();
  }, [userId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || status !== "ready") return;

    // If no chat exists, create one
    if (!chatId) {
      try {
        const newChat = await createChat({
          userId,
          title: input.slice(0, 50) + (input.length > 50 ? "..." : ""),
        });
        setChatId(newChat.id);
        setChats((prev) => [newChat, ...prev]);
      } catch (error) {
        console.error("Failed to create chat:", error);
        return;
      }
    }

    const userMessage = input;
    setInput("");
    
    sendMessage({ text: userMessage });
  };

  const handleNewChat = async () => {
    try {
      const newChat = await createChat({
        userId,
        title: "New Chat",
      });
      setChatId(newChat.id);
      setChats((prev) => [newChat, ...prev]);
      setMessages([]);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteChat(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (chatId === id) {
        setChatId(undefined);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const handleSelectChat = (id: string) => {
    setChatId(id);
    // Load messages for this chat would go here
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isLoadingChats ? (
                <DropdownMenuItem disabled>Loading chats...</DropdownMenuItem>
              ) : chats.length === 0 ? (
                <DropdownMenuItem disabled>No chat history</DropdownMenuItem>
              ) : (
                chats.map((chat) => (
                  <DropdownMenuItem
                    key={chat.id}
                    className="flex items-center justify-between"
                    onClick={() => handleSelectChat(chat.id)}
                  >
                    <span className="truncate">{chat.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Attached Resources */}
      {attachedResources.length > 0 && (
        <div className="border-b px-4 py-2">
          <p className="text-xs text-muted-foreground mb-2">Attached resources:</p>
          <div className="flex flex-wrap gap-2">
            {attachedResources.map((resource) => {
              const Icon = TYPE_ICONS[resource.type];
              return (
                <Badge
                  key={resource.id}
                  variant="secondary"
                  className={cn(
                    "flex items-center gap-1 pr-1",
                    TYPE_COLORS[resource.type]
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span className="max-w-[120px] truncate">{resource.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => onRemoveResource?.(resource.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Bot className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Start a conversation with your AI assistant
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ask questions about your educational content
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-[85%]",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <div key={i} className="whitespace-pre-wrap text-sm">
                          {part.text}
                        </div>
                      );
                    }
                    if (part.type === "tool-web_search" || part.type === "tool-youtube_search") {
                      return (
                        <div key={i} className="mt-2 p-2 bg-background/50 rounded text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground mb-1">
                            <ExternalLink className="h-3 w-3" />
                            {part.type === "tool-web_search" ? "Web Search" : "YouTube Search"}
                          </div>
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(part.output, null, 2)}
                          </pre>
                        </div>
                      );
                    }
                    if (part.type === "tool-save_memory") {
                      return (
                        <div key={i} className="mt-2 p-2 bg-green-100/50 rounded text-xs text-green-800">
                          <div className="flex items-center gap-1 mb-1">
                            <span>Memory saved</span>
                          </div>
                        </div>
                      );
                    }
                    if (part.type === "tool-add_learner") {
                      return (
                        <div key={i} className="mt-2 p-2 bg-blue-100/50 rounded text-xs text-blue-800">
                          <div className="flex items-center gap-1 mb-1">
                            <span>Learner added</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))
          )}
          {(status === "submitted" || status === "streaming") && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              {status === "submitted" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Typing...</span>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={stop}
                className="h-6 text-xs"
              >
                Stop
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={status !== "ready"}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || status !== "ready"}
          >
            {status === "ready" ? (
              <Send className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
