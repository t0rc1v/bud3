"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Send,
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
  ChevronDown,
  Sparkles,
  MessageSquare,
  Coins,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { createChat, deleteChat, getUserChats, getChatMessages, type Chat } from "@/lib/actions/ai";
import { AddResourceToChat, type ChatResource as Resource } from "./add-resource-to-chat";
import type { UserRole } from "@/lib/types";
import { AssignmentModalTrigger } from "./assignment-modal";
import { QuizModalTrigger } from "./quiz-modal";
import { MarkdownRenderer } from "./markdown-renderer";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  SearchResultsOutput,
  type ToolState,
} from "@/components/ai-elements/tool";
import { CreditModal } from "@/components/credits/credit-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  userRole?: UserRole;
  initialChatId?: string;
  isOpen?: boolean;
  resourceToAdd?: Resource | null;
  onResourceAdded?: () => void;
}

export function AIChat({
  userId,
  userRole,
  initialChatId,
  isOpen = true,
  resourceToAdd,
  onResourceAdded,
}: AIChatProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Get chatId from URL query params or props
  const urlChatId = searchParams.get("chatId");
  const [chatId, setChatId] = useState<string | undefined>(urlChatId || initialChatId);
  
  const [input, setInput] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [attachedResources, setAttachedResources] = useState<Resource[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [textareaRows, setTextareaRows] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [creditError, setCreditError] = useState<{ message: string; remainingCredits?: number } | null>(null);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  
  // Detect mobile device - use state + useEffect to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    };
    setIsMobile(checkMobile());
    
    const handleResize = () => {
      setIsMobile(checkMobile());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
   
  // Store pending message to send after chat is created
  const pendingMessageRef = useRef<{ text: string; files: Array<{ type: "file"; url: string; mediaType: string; filename: string }> } | null>(null);
  // Track chats that were just created to prevent loading messages and overwriting pending messages
  const newlyCreatedChatRef = useRef<string | null>(null);
  // Track last chat ID to prevent duplicate loads when dependencies change
  const lastChatIdRef = useRef<string | null>(null);
  
  // Helper function to update URL with chatId
  const updateUrlWithChatId = useCallback((newChatId: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newChatId) {
      params.set("chatId", newChatId);
    } else {
      params.delete("chatId");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  const { messages, sendMessage, status, stop, setMessages, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        chatId,
      }),
    }),
    id: chatId || "default",
    onError: (err) => {
      // Check if it's a credit error (402 status)
      if (err instanceof Error) {
        try {
          const errorData = JSON.parse(err.message);
          if (errorData.type === 'INSUFFICIENT_CREDITS') {
            setCreditError({
              message: errorData.error || 'Insufficient credits',
              remainingCredits: errorData.remainingCredits,
            });
          }
        } catch {
          // Not a JSON error, ignore
        }
      }
    },
  });

  // Sync chatId state with URL when URL changes
  useEffect(() => {
    const currentUrlChatId = searchParams.get("chatId");
    if (currentUrlChatId && currentUrlChatId !== chatId) {
      setChatId(currentUrlChatId);
    }
  }, [searchParams, chatId]);

  // Send pending message after chatId is set (for first message in new chat)
  useEffect(() => {
    if (chatId && pendingMessageRef.current) {
      const message = pendingMessageRef.current;
      pendingMessageRef.current = null;
      // Small delay to ensure useChat has re-rendered with new chatId
      setTimeout(() => {
        sendMessage({
          text: message.text,
          files: message.files,
        });
      }, 0);
    }
  }, [chatId, sendMessage]);

  // Compute the effective chat ID to load
  const chatIdToLoad = urlChatId || initialChatId;
  
  // Load user's chats and messages - only runs when chatIdToLoad or isOpen changes
  useEffect(() => {
    // Only load data when sidebar is open
    if (!isOpen) {
      setIsLoadingChats(false);
      return;
    }

    async function loadChats() {
      // Skip loading messages if this is a newly created chat (first message pending)
      if (chatIdToLoad && newlyCreatedChatRef.current === chatIdToLoad) {
        lastChatIdRef.current = chatIdToLoad;
        return;
      }
      
      try {
        const userChats = await getUserChats(userId);
        setChats(userChats);
        
        if (chatIdToLoad) {
          const chatMessages = await getChatMessages(chatIdToLoad);
          
          // Format messages - results are now stored directly with tool calls
          const formattedMessages = chatMessages
            .filter((msg) => msg.role !== 'tool') // Skip tool role messages
            .map((msg) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const parts: any[] = [{ type: "text", text: msg.content }];
              
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
              
              // Add tool parts - results are now attached directly to tool calls
              if (msg.metadata?.toolCalls && Array.isArray(msg.metadata.toolCalls)) {
                msg.metadata.toolCalls.forEach((toolCall: { toolCallId?: string; toolName: string; input?: unknown; args?: unknown; output?: unknown; result?: unknown }, idx: number) => {
                  const toolType = toolCall.toolName as string;
                  const toolCallId = toolCall.toolCallId || `tool-call-${msg.id}-${idx}`;
                  
                  // Use output (new format) or result (old format for backwards compatibility)
                  const output = toolCall.output !== undefined ? toolCall.output : toolCall.result;
                  const hasOutput = output !== undefined && output !== null;
                  const toolInput = toolCall.input !== undefined ? toolCall.input : toolCall.args;
                  
                  // Create tool part following AI SDK format with state
                  const toolPart: {
                    type: string;
                    toolCallId: string;
                    state: string;
                    input?: unknown;
                    output?: unknown;
                  } = {
                    type: `tool-${toolType}`,
                    toolCallId,
                    state: hasOutput ? 'output-available' : 'input-available',
                    input: toolInput,
                  };
                  
                  if (hasOutput) {
                    toolPart.output = output;
                  }
                  
                  parts.push(toolPart);
                });
              }
              
              return {
                id: msg.id,
                role: msg.role as "user" | "assistant",
                parts,
                createdAt: msg.createdAt,
              };
            });
          
          setMessages(formattedMessages as typeof messages);
          lastChatIdRef.current = chatIdToLoad;
        }
      } catch (error) {
        console.error("Failed to load chats:", error);
      } finally {
        setIsLoadingChats(false);
      }
    }
    loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdToLoad, isOpen]); // Re-run when chatIdToLoad or isOpen changes

  // Track scroll position to show/hide scroll button
  const handleScroll = useCallback(() => {
    if (viewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom < 100;
      setShowScrollButton(!isNearBottom && messages.length > 0);
    }
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive and check button visibility
  useEffect(() => {
    console.log('Messages updated. Count:', messages.length);
    if (messages.length > 0) {
      console.log('Last message role:', messages[messages.length - 1].role);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.parts) {
        console.log('Last message parts:', lastMsg.parts.map((p: { type: string }) => p.type));
      }
    }
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      // Check if we need to show scroll button after auto-scroll
      setTimeout(() => {
        handleScroll();
      }, 100);
    }
  }, [messages, handleScroll]);

  // Auto-resize textarea based on content
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    
    // Calculate rows based on newlines (max 5 rows)
    const newlineCount = (value.match(/\n/g) || []).length;
    const newRows = Math.min(Math.max(newlineCount + 1, 1), 5);
    setTextareaRows(newRows);
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || status !== "ready") return;

    const userMessage = input;
    
    // Convert attached resources to FileUIPart format for AI SDK
    const fileParts = attachedResources.map((resource) => ({
      type: "file" as const,
      url: resource.url,
      mediaType: getMediaType(resource.type),
      filename: resource.title,
    }));

    // If no chat exists, store the message and create one
    if (!chatId) {
      // Store message to send after chat is created
      pendingMessageRef.current = {
        text: userMessage,
        files: fileParts,
      };
      
      try {
        const newChat = await createChat({
          userId,
          title: input.slice(0, 50) + (input.length > 50 ? "..." : ""),
        });
        // Mark this chat as newly created to prevent the load effect from overwriting messages
        newlyCreatedChatRef.current = newChat.id;
        setChatId(newChat.id);
        updateUrlWithChatId(newChat.id); // Update URL with new chat ID
        setChats((prev) => [newChat, ...prev]);
        // Message will be sent by the effect after chatId state updates
      } catch (error) {
        console.error("Failed to create chat:", error);
        pendingMessageRef.current = null;
        newlyCreatedChatRef.current = null;
        return;
      }
    } else {
      // Chat exists, send message immediately
      sendMessage({ 
        text: userMessage,
        files: fileParts,
      });
    }

    setInput("");
    setTextareaRows(1);
  }, [input, status, chatId, attachedResources, sendMessage, updateUrlWithChatId, userId]);

  // Handle Enter key to send message (Shift+Enter for new line)
  // On mobile, Enter creates new lines - use send button to submit
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      if (input.trim() && status === 'ready') {
        handleSend();
      }
    }
  }, [input, status, handleSend, isMobile]);

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
      updateUrlWithChatId(newChat.id); // Update URL with new chat ID
      setChats((prev) => [newChat, ...prev]);
      setMessages([]);
      setAttachedResources([]);
      // Reset refs for new chat
      lastChatIdRef.current = null;
      newlyCreatedChatRef.current = newChat.id;
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
        updateUrlWithChatId(undefined); // Clear chatId from URL
        setMessages([]);
        setAttachedResources([]);
        // Reset refs when deleting current chat
        lastChatIdRef.current = null;
        newlyCreatedChatRef.current = null;
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const handleSelectChat = (id: string) => {
    // Just update the chatId - the useEffect will handle loading messages
    setChatId(id);
    updateUrlWithChatId(id);
    // Clear attached resources when switching chats
    setAttachedResources([]);
    // Reset refs to allow the effect to load the new chat
    lastChatIdRef.current = null;
    newlyCreatedChatRef.current = null;
    // Note: Messages will be loaded by the useEffect when chatIdToLoad changes
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

  // Handle external resource addition from file tree
  useEffect(() => {
    if (resourceToAdd) {
      handleAddResource(resourceToAdd);
      onResourceAdded?.();
    }
  }, [resourceToAdd, handleAddResource, onResourceAdded]);

  return (
    <div className="flex h-full flex-col" suppressHydrationWarning>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <AddResourceToChat
            attachedResources={attachedResources}
            userId={userId}
            userRole={userRole}
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
                    className={cn(
                      "flex items-center justify-between",
                      chatId === chat.id && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => handleSelectChat(chat.id)}
                  >
                    <span className="truncate flex-1">{chat.title}</span>
                    {chatId === chat.id && (
                      <span className="ml-2 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-2 shrink-0"
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
      <div className="flex-1 min-h-0 relative">
        <ScrollArea 
          className="h-full w-full" 
          viewportRef={viewportRef}
          onScroll={handleScroll}
        >
          <div className="space-y-4 px-4 py-6 min-w-0 w-full">
          {isLoadingChats && chatId ? (
            // Loading skeleton for chat messages
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="bg-primary/20 rounded-lg px-4 py-3 w-[70%] animate-pulse">
                  <div className="h-4 bg-primary/30 rounded w-3/4"></div>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-3 w-[80%] animate-pulse space-y-2">
                  <div className="h-4 bg-muted-foreground/20 rounded w-full"></div>
                  <div className="h-4 bg-muted-foreground/20 rounded w-5/6"></div>
                  <div className="h-4 bg-muted-foreground/20 rounded w-4/6"></div>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-primary/20 rounded-lg px-4 py-3 w-[60%] animate-pulse">
                  <div className="h-4 bg-primary/30 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mb-2" />
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
                  "flex gap-2 min-w-0",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 sm:px-4 sm:py-2 overflow-hidden",
                    "w-fit max-w-[85%]",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <div>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <MarkdownRenderer
                          key={i}
                          content={part.text}
                          isAssistant={message.role === "assistant"}
                        />
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
                    // Handle tool parts - check if type starts with "tool-"
                    if (typeof part.type === 'string' && part.type.startsWith("tool-")) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const toolPart = part as any;
                      const toolType = toolPart.type;
                      const state = toolPart.state as ToolState;
                      const input = toolPart.input;
                      const output = toolPart.output;
                      
                      // Tools are collapsed by default - user can click to expand
                      
                      // Web Search or YouTube Search
                      if (toolType === "tool-web_search" || toolType === "tool-youtube_search") {
                        // AI SDK stores output as { type: "json", value: { results: [...] } }
                        const outputWrapper = output as { type?: string; value?: { results?: Array<{ title?: string; url?: string; description?: string; snippet?: string }>; formatted?: string } } | undefined;
                        const searchOutput = outputWrapper?.value;
                        
                        return (
                          <Tool key={i} defaultOpen={false} className="mt-2 min-w-0">
                            <ToolHeader
                              toolType={toolType}
                              state={state}
                            />
                            <ToolContent>
                              <ToolInput input={input} />
                              <ToolOutput
                                output={
                                  searchOutput?.results && searchOutput.results.length > 0 ? (
                                    <SearchResultsOutput results={searchOutput.results.map(r => ({ ...r, description: r.snippet }))} maxDisplay={3} />
                                  ) : undefined
                                }
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      
                      // Research Materials - has formatted output
                      if (toolType === "tool-research_materials") {
                        // AI SDK stores output as { type: "json", value: { results: [...] } }
                        const outputWrapper = output as { type?: string; value?: { results?: Array<{ title?: string; url?: string; description?: string; type?: string }>; formatted?: string } } | undefined;
                        const researchOutput = outputWrapper?.value;
                        
                        return (
                          <Tool key={i} defaultOpen={false} className="mt-2 min-w-0">
                            <ToolHeader
                              toolType={toolType}
                              state={state}
                            />
                            <ToolContent>
                              <ToolInput input={input} />
                              <ToolOutput
                                output={
                                  researchOutput?.results && researchOutput.results.length > 0 ? (
                                    <div className="space-y-2 min-w-0">
                                      <SearchResultsOutput results={researchOutput.results} maxDisplay={5} />
                                    </div>
                                  ) : undefined
                                }
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      
                      // Web Browse - shows title and content preview
                      if (toolType === "tool-web_browse") {
                        const browseOutput = output as { title?: string; url?: string; content?: string; success?: boolean; error?: string } | undefined;
                        const errorText = !browseOutput?.success ? browseOutput?.error : undefined;
                        
                        return (
                          <Tool key={i} defaultOpen={false} className="mt-2 min-w-0">
                            <ToolHeader
                              toolType={toolType}
                              state={state}
                              title={browseOutput?.title}
                            />
                            <ToolContent>
                              <ToolInput input={input} />
                              <ToolOutput
                                output={
                                  browseOutput?.content ? (
                                    <div className="space-y-1">
                                      {browseOutput.url && (
                                        <a
                                          href={browseOutput.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-primary hover:underline flex items-center gap-1"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          View Source
                                        </a>
                                      )}
                                      <div className="text-xs text-muted-foreground line-clamp-4">
                                        {browseOutput.content.slice(0, 500)}
                                        {browseOutput.content.length > 500 && "..."}
                                      </div>
                                    </div>
                                  ) : undefined
                                }
                                errorText={errorText}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      
                      // Create Assignment Tool
                      if (toolType === "tool-create_assignment") {
                        // AI SDK wraps output as { type: "json", value: {...} }
                        const outputWrapper = output as { type?: string; value?: { success?: boolean; format?: string; assignmentId?: string; metadata?: unknown; content?: unknown; answerKey?: unknown; exportOptions?: unknown; error?: string } } | undefined;
                        const assignmentOutput = outputWrapper?.value;

                        if (assignmentOutput?.success) {
                          return (
                            <div key={i} className="mt-2 w-full min-w-0">
                              <AssignmentModalTrigger data={assignmentOutput as unknown as React.ComponentProps<typeof AssignmentModalTrigger>['data']} />
                            </div>
                          );
                        }

                        return (
                          <Tool key={i} defaultOpen={false} className="mt-2 min-w-0">
                            <ToolHeader
                              toolType={toolType}
                              state={state}
                            />
                            <ToolContent>
                              <ToolInput input={input} />
                              <ToolOutput
                                errorText={assignmentOutput?.error}
                                output={assignmentOutput?.success ? "Assignment created successfully" : undefined}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }

                      // Create Quiz Tool
                      if (toolType === "tool-create_quiz") {
                        // AI SDK wraps output as { type: "json", value: {...} }
                        const outputWrapper = output as { type?: string; value?: { success?: boolean; format?: string; artifact?: string; quizId?: string; metadata?: unknown; quiz?: unknown; actions?: unknown; error?: string } } | undefined;
                        const quizOutput = outputWrapper?.value;

                        if (quizOutput?.success) {
                          return (
                            <div key={i} className="mt-2 w-full min-w-0">
                              <QuizModalTrigger data={quizOutput as unknown as React.ComponentProps<typeof QuizModalTrigger>['data']} />
                            </div>
                          );
                        }

                        return (
                          <Tool key={i} defaultOpen={false} className="mt-2">
                            <ToolHeader
                              toolType={toolType}
                              state={state}
                            />
                            <ToolContent>
                              <ToolInput input={input} />
                              <ToolOutput
                                errorText={quizOutput?.error}
                                output={quizOutput?.success ? "Quiz created successfully" : undefined}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      
                      // All other tools
                      return (
                        <Tool key={i} defaultOpen={false} className="mt-2 min-w-0">
                          <ToolHeader
                            toolType={toolType}
                            state={state}
                          />
                          <ToolContent>
                            <ToolInput input={input} />
                            <ToolOutput
                              output={
                                output && typeof output === 'object' ? (
                                  <div className="max-w-full overflow-x-auto">
                                    <pre className="text-xs whitespace-pre-wrap break-all" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                      {JSON.stringify(output, null, 2)}
                                    </pre>
                                  </div>
                                ) : output ? (
                                  String(output)
                                ) : undefined
                              }
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                  </div>
                </div>
              </div>
            )))}
            {/* Depleted Credits Error */}
            {creditError && (
              <div className="flex justify-center">
                <Alert variant="destructive" className="max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Insufficient Credits</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>{creditError.message}</p>
                    {creditError.remainingCredits !== undefined && (
                      <p className="text-sm">
                        Current balance: <strong>{creditError.remainingCredits} credits</strong>
                      </p>
                    )}
                    <CreditModal
                      isOpen={isCreditModalOpen}
                      onOpenChange={(open: boolean) => {
                        setIsCreditModalOpen(open);
                        if (!open) {
                          // Clear credit error when modal closes
                          setCreditError(null);
                        }
                      }}
                    />
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => setIsCreditModalOpen(true)}
                    >
                      <Coins className="h-4 w-4" />
                      Buy Credits
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
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
        
        {/* Scroll to Bottom Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={scrollToBottom}
          className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg rounded-full px-4 py-2 h-auto z-50",
            "bg-background/90 backdrop-blur-sm border hover:bg-accent",
            "transition-opacity duration-300",
            showScrollButton && messages.length > 0 
              ? "opacity-100 pointer-events-auto" 
              : "opacity-0 pointer-events-none"
          )}
        >
          <ChevronDown className="h-4 w-4 animate-bounce" />
          {/* <span className="text-xs font-medium">New messages</span> */}
        </Button>
      </div>

      {/* Input */}
      <div className="border-t p-4 bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 items-end"
        >
          <Textarea
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={mounted && isMobile ? "Type your message..." : "Type your message... (Shift+Enter for new line, Enter to send)"}
            disabled={status !== "ready"}
            rows={textareaRows}
            className="flex-1 min-h-[44px] max-h-[160px] resize-none py-3"
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
