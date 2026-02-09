"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
import { AssignmentModalTrigger } from "./assignment-modal";
import { QuizModalTrigger } from "./quiz-modal";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  SearchResultsOutput,
  type ToolState,
} from "@/components/ai-elements/tool";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  
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

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        chatId,
      }),
    }),
    id: chatId || "default",
  });

  // Sync chatId state with URL when URL changes
  useEffect(() => {
    const currentUrlChatId = searchParams.get("chatId");
    if (currentUrlChatId && currentUrlChatId !== chatId) {
      setChatId(currentUrlChatId);
    }
  }, [searchParams, chatId]);

  // Load user's chats and messages
  useEffect(() => {
    async function loadChats() {
      console.log('=== LOADING CHAT MESSAGES ===');
      console.log('urlChatId:', urlChatId);
      console.log('initialChatId:', initialChatId);
      
      try {
        const userChats = await getUserChats(userId);
        setChats(userChats);
        
        // Load messages for the current chatId (from URL or props)
        const chatIdToLoad = urlChatId || initialChatId;
        console.log('chatIdToLoad:', chatIdToLoad);
        
        if (chatIdToLoad) {
          console.log('Fetching messages for chatId:', chatIdToLoad);
          const chatMessages = await getChatMessages(chatIdToLoad);
          console.log('Fetched', chatMessages.length, 'messages');
          console.log('First message sample:', chatMessages[0] ? JSON.stringify(chatMessages[0], null, 2).slice(0, 500) : 'none');
          
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
              console.log('Message metadata:', JSON.stringify(msg.metadata, null, 2));
              if (msg.metadata?.toolCalls && Array.isArray(msg.metadata.toolCalls)) {
                console.log('Found', msg.metadata.toolCalls.length, 'tool calls');
                msg.metadata.toolCalls.forEach((toolCall: { toolCallId?: string; toolName: string; input?: unknown; args?: unknown; output?: unknown; result?: unknown }, idx: number) => {
                  console.log('Tool call', idx, ':', JSON.stringify(toolCall, null, 2));
                  const toolType = toolCall.toolName as string;
                  const toolCallId = toolCall.toolCallId || `tool-call-${msg.id}-${idx}`;
                  
                  // Use output (new format) or result (old format for backwards compatibility)
                  const output = toolCall.output !== undefined ? toolCall.output : toolCall.result;
                  const hasOutput = output !== undefined && output !== null;
                  const toolInput = toolCall.input !== undefined ? toolCall.input : toolCall.args;
                  
                  console.log('Tool', toolType, 'hasOutput:', hasOutput, 'outputType:', typeof output);
                  
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
              } else {
                console.log('No tool calls in metadata');
              }
              
              return {
                id: msg.id,
                role: msg.role as "user" | "assistant",
                parts,
                createdAt: msg.createdAt,
              };
            });
          
          console.log('Formatted', formattedMessages.length, 'messages');
          console.log('First formatted message parts:', formattedMessages[0]?.parts.map((p: { type: string }) => p.type));
          setMessages(formattedMessages as typeof messages);
        } else {
          console.log('No chatIdToLoad, skipping message fetch');
        }
      } catch (error) {
        console.error("Failed to load chats:", error);
      } finally {
        setIsLoadingChats(false);
      }
    }
    loadChats();
  }, [userId, urlChatId, initialChatId, setMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    console.log('Messages updated. Count:', messages.length);
    if (messages.length > 0) {
      console.log('Last message role:', messages[messages.length - 1].role);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.parts) {
        console.log('Last message parts:', lastMsg.parts.map((p: { type: string }) => p.type));
      }
    }
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
        updateUrlWithChatId(newChat.id); // Update URL with new chat ID
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
      updateUrlWithChatId(newChat.id); // Update URL with new chat ID
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
        updateUrlWithChatId(undefined); // Clear chatId from URL
        setMessages([]);
        setAttachedResources([]);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const handleSelectChat = async (id: string) => {
    setChatId(id);
    updateUrlWithChatId(id); // Update URL with selected chat ID
    // Clear attached resources when switching chats
    setAttachedResources([]);
    try {
      const chatMessages = await getChatMessages(id);
      
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
                    // Handle tool parts - check if type starts with "tool-"
                    if (typeof part.type === 'string' && part.type.startsWith("tool-")) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const toolPart = part as any;
                      const toolType = toolPart.type;
                      const state = toolPart.state as ToolState;
                      const input = toolPart.input;
                      const output = toolPart.output;
                      
                      console.log('Rendering tool part:', toolType, 'state:', state, 'has output:', output !== undefined);
                      
                      // Determine if we should auto-open (completed tools)
                      const shouldAutoOpen = state === 'output-available' || state === 'output-error';
                      
                      // Web Search or YouTube Search
                      if (toolType === "tool-web_search" || toolType === "tool-youtube_search") {
                        // AI SDK stores output as { type: "json", value: { results: [...] } }
                        const outputWrapper = output as { type?: string; value?: { results?: Array<{ title?: string; url?: string; description?: string; snippet?: string }>; formatted?: string } } | undefined;
                        const searchOutput = outputWrapper?.value;
                        
                        return (
                          <Tool key={i} defaultOpen={shouldAutoOpen} className="mt-2">
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
                          <Tool key={i} defaultOpen={shouldAutoOpen} className="mt-2">
                            <ToolHeader
                              toolType={toolType}
                              state={state}
                            />
                            <ToolContent>
                              <ToolInput input={input} />
                              <ToolOutput
                                output={
                                  researchOutput?.results && researchOutput.results.length > 0 ? (
                                    <div className="space-y-2">
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
                          <Tool key={i} defaultOpen={shouldAutoOpen} className="mt-2">
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
                          <Tool key={i} defaultOpen={shouldAutoOpen} className="mt-2">
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
                          <Tool key={i} defaultOpen={shouldAutoOpen} className="mt-2">
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
                        <Tool key={i} defaultOpen={shouldAutoOpen} className="mt-2">
                          <ToolHeader
                            toolType={toolType}
                            state={state}
                          />
                          <ToolContent>
                            <ToolInput input={input} />
                            <ToolOutput
                              output={
                                output && typeof output === 'object' ? (
                                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">
                                    {JSON.stringify(output, null, 2)}
                                  </pre>
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
