"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useCallback } from "react";
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
  Paperclip,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { createChat, deleteChat, getUserChats, getChatMessages, type Chat } from "@/lib/actions/ai";
import { AddResourceToChat, type Resource } from "./add-resource-to-chat";

const TYPE_ICONS = {
  notes: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
};

const TYPE_COLORS = {
  notes: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  video: "bg-red-100 text-red-800 hover:bg-red-200",
  audio: "bg-purple-100 text-purple-800 hover:bg-purple-200",
  image: "bg-green-100 text-green-800 hover:bg-green-200",
};

interface AIChatProps {
  userId: string;
  initialChatId?: string;
}

export function AIChat({
  userId,
  initialChatId,
}: AIChatProps) {
  const [chatId, setChatId] = useState<string | undefined>(initialChatId);
  const [input, setInput] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [attachedResources, setAttachedResources] = useState<Resource[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        chatId,
      }),
    }),
    id: chatId || "default",
  });

  // Load user's chats and messages on mount
  useEffect(() => {
    async function loadChats() {
      try {
        const userChats = await getUserChats(userId);
        setChats(userChats);
        
        // If there's an initialChatId, load its messages
        if (initialChatId) {
          const chatMessages = await getChatMessages(initialChatId);
          
          const formattedMessages = chatMessages.map((msg) => {
            const parts: Array<
              | { type: "text"; text: string }
              | { type: "file"; filename: string; url: string; mediaType: string }
            > = [{ type: "text", text: msg.content }];
            
            // Add file parts from metadata if present
            if (msg.metadata?.attachedResources && Array.isArray(msg.metadata.attachedResources)) {
              msg.metadata.attachedResources.forEach((resource: {id: string; title: string; url: string; type: string}) => {
                parts.push({
                  type: "file",
                  filename: resource.title,
                  url: resource.url,
                  mediaType: resource.type === 'image' ? 'image/*' : 
                            resource.type === 'notes' ? 'application/pdf' : 'application/octet-stream'
                });
              });
            }
            
            return {
              id: msg.id,
              role: msg.role as "user" | "assistant",
              parts,
              createdAt: msg.createdAt,
            };
          });
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error("Failed to load chats:", error);
      } finally {
        setIsLoadingChats(false);
      }
    }
    loadChats();
  }, [userId, initialChatId, setMessages]);

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
    
    // Convert attached resources to FileUIPart format for AI SDK
    const fileParts = attachedResources.map((resource) => ({
      type: "file" as const,
      url: resource.url,
      mediaType: getMediaType(resource.type),
      filename: resource.title,
    }));
    
    sendMessage({ 
      text: userMessage,
      files: fileParts,
    });
  };

  // Helper function to map resource types to MIME types
  const getMediaType = (type: string): string => {
    switch (type) {
      case "notes":
        return "application/pdf"; // Assuming notes are PDFs
      case "image":
        return "image/*";
      case "video":
        return "video/*";
      case "audio":
        return "audio/*";
      default:
        return "application/octet-stream";
    }
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
      setAttachedResources([]);
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
        setAttachedResources([]);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const handleSelectChat = async (id: string) => {
    setChatId(id);
    // Clear attached resources when switching chats
    setAttachedResources([]);
    try {
      const chatMessages = await getChatMessages(id);
      
      // Convert database messages to useChat format with file parts from metadata
      const formattedMessages = chatMessages.map((msg) => {
        const parts: Array<
          | { type: "text"; text: string }
          | { type: "file"; filename: string; url: string; mediaType: string }
        > = [{ type: "text", text: msg.content }];
        
        // Add file parts from metadata if present
        if (msg.metadata?.attachedResources && Array.isArray(msg.metadata.attachedResources)) {
          msg.metadata.attachedResources.forEach((resource: {id: string; title: string; url: string; type: string}) => {
            parts.push({
              type: "file",
              filename: resource.title,
              url: resource.url,
              mediaType: resource.type === 'image' ? 'image/*' : 
                        resource.type === 'notes' ? 'application/pdf' : 'application/octet-stream'
            });
          });
        }
        
        return {
          id: msg.id,
          role: msg.role as "user" | "assistant",
          parts,
          createdAt: msg.createdAt,
        };
      });
      setMessages(formattedMessages);
    } catch (error) {
      console.error("Failed to load chat:", error);
      setMessages([]);
    }
  };

  const handleAddResource = useCallback((resource: Resource) => {
    setAttachedResources((prev) => {
      // Prevent duplicates
      if (prev.some((r) => r.id === resource.id)) {
        return prev;
      }
      return [...prev, resource];
    });
  }, []);

  const handleRemoveResource = useCallback((resourceId: string) => {
    setAttachedResources((prev) => prev.filter((r) => r.id !== resourceId));
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <AddResourceToChat
            attachedResources={attachedResources}
            onAddResource={handleAddResource}
            onRemoveResource={handleRemoveResource}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="h-8 w-8 p-0"
            title="New Chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Chat History">
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
        <div className="border-b px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Context Resources ({attachedResources.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {attachedResources.map((resource) => {
              const Icon = TYPE_ICONS[resource.type];
              return (
                <Badge
                  key={resource.id}
                  variant="secondary"
                  className={cn(
                    "flex items-center gap-1.5 pl-2 pr-1 py-1 transition-colors",
                    TYPE_COLORS[resource.type]
                  )}
                  title={resource.description}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="max-w-[100px] truncate text-xs font-medium">
                    {resource.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 ml-1 hover:bg-black/10 rounded-full"
                    onClick={() => handleRemoveResource(resource.id)}
                    title="Remove resource"
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
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="space-y-4 px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Bot className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Start a conversation with your AI assistant
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ask questions about your educational content
              </p>
              {attachedResources.length > 0 && (
                <p className="text-xs text-primary mt-2">
                  {attachedResources.length} resource{attachedResources.length !== 1 ? "s" : ""} attached as context
                </p>
              )}
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
                    "rounded-lg px-4 py-2 max-w-[85%] overflow-hidden",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <div key={i} className="whitespace-pre-wrap break-words text-sm overflow-wrap-anywhere">
                          {part.text}
                        </div>
                      );
                    }
                    if (part.type === "file") {
                      // Render attached files (images, PDFs, etc.)
                      if (part.mediaType?.startsWith("image/")) {
                        return (
                          <div key={i} className="mt-2">
                            <img 
                              src={part.url} 
                              alt={part.filename || "Attached image"}
                              className="max-w-full rounded-lg max-h-[300px] object-contain"
                            />
                          </div>
                        );
                      }
                      if (part.mediaType === "application/pdf") {
                        return (
                          <div key={i} className="mt-2 max-w-full">
                            <a 
                              href={part.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 bg-background/50 rounded text-xs hover:bg-background/70 transition-colors min-w-0"
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate min-w-0">{part.filename || "PDF Document"}</span>
                            </a>
                          </div>
                        );
                      }
                      // Generic file attachment
                      return (
                      <div key={i} className="mt-2 max-w-full">
                            <a 
                              href={part.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 bg-background/50 rounded text-xs hover:bg-background/70 transition-colors min-w-0"
                            >
                              <Paperclip className="h-4 w-4 shrink-0" />
                              <span className="truncate min-w-0">{part.filename || "Attached file"}</span>
                            </a>
                          </div>
                      );
                    }
                    if (part.type === "tool-web_search" || part.type === "tool-youtube_search") {
                      return (
                        <div key={i} className="mt-2 p-2 bg-background/50 rounded text-xs max-w-full">
                          <div className="flex items-center gap-1 text-muted-foreground mb-1">
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{part.type === "tool-web_search" ? "Web Search" : "YouTube Search"}</span>
                          </div>
                          <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-w-full">
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

export type { Resource };
