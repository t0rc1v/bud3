"use client";

import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
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
  Square,
  RotateCcw,
  Brain,
  Pencil,
  Share2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { createChat, deleteChat, getUserChats, getChatMessages, updateChatTitle, deleteChatMessagesFrom, generateChatShareToken, updateChatVisibility, type Chat } from "@/lib/actions/ai";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AddResourceToChat, type ChatResource as Resource } from "./add-resource-to-chat";
import { ModelSelector } from "./model-selector";
import type { UserRole } from "@/lib/types";
import { AssignmentModalTrigger } from "./assignment-modal";
import { QuizModalTrigger } from "./quiz-modal";
import { FlashcardModalTrigger } from "./flashcard-modal";
import { NotesDocumentModalTrigger } from "./notes-document-modal";
import { ExamModalTrigger } from "./exam-modal";
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
  notes: "bg-primary/15 text-foreground hover:bg-primary/25",
  video: "bg-red-500/15 text-foreground hover:bg-red-500/25",
  audio: "bg-primary/35 text-foreground hover:bg-primary/45",
  image: "bg-primary/50 text-foreground hover:bg-primary/60",
};

// Helper function to generate contextual chat title from message and resources
function generateChatTitle(input: string, resources: Resource[]): string {
  // Clean up the input - remove extra whitespace and limit length
  const cleanInput = input.trim().slice(0, 100);
  
  if (cleanInput.length === 0) {
    return resources.length > 0 
      ? `Chat about ${resources[0].title.slice(0, 30)}${resources[0].title.length > 30 ? '...' : ''}`
      : "New Chat";
  }
  
  // If input is a question, extract the key subject
  let title = cleanInput;
  
  // Remove common question prefixes
  const prefixes = [
    /^(can you|could you|would you|will you|please|help me|i need|i want|how do|how can|how to|what is|what are|tell me about|explain|describe|analyze|compare|summarize)\s+/i,
    /^(create|make|generate|write|build|design|develop)\s+(a|an|the)?\s*/i,
  ];
  
  for (const prefix of prefixes) {
    title = title.replace(prefix, "");
  }
  
  // Remove trailing punctuation
  title = title.replace(/[?.!,;:]$/, "");
  
  // Truncate to reasonable length
  const maxLength = resources.length > 0 ? 40 : 50;
  if (title.length > maxLength) {
    title = title.slice(0, maxLength) + "...";
  }
  
  // If there are resources, append context
  if (resources.length > 0) {
    const resourceHint = resources.length === 1 
      ? ` [${resources[0].title.slice(0, 20)}${resources[0].title.length > 20 ? '...' : ''}]`
      : ` [${resources.length} resources]`;
    
    // Make sure title + resource hint isn't too long
    if (title.length + resourceHint.length > 60) {
      title = title.slice(0, Math.max(20, 60 - resourceHint.length)) + "...";
    }
    title += resourceHint;
  }
  
  return title || "New Chat";
}

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [textareaRows, setTextareaRows] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [creditError, setCreditError] = useState<{ message: string; remainingCredits?: number } | null>(null);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  
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
  // Track which resource IDs have already been sent to avoid repetition
  const sentResourceIdsRef = useRef<Set<string>>(new Set());
  // Track if chat was created via "New Chat" button and needs title update after first message
  const needsTitleUpdateRef = useRef<boolean>(false);

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

  const { messages, sendMessage, status, stop, regenerate, setMessages, error, addToolApprovalResponse } = useChat({
    experimental_throttle: 50,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        chatId,
        ...(selectedModelId ? { modelId: selectedModelId } : {}),
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
    onFinish({ isAbort }) {
      if (isAbort) return;
      // Ensure scroll to bottom when response fully completes
      if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
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

  // Scroll textarea into view when focused on mobile
  const handleTextareaFocus = useCallback(() => {
    if (isMobile && textareaRef.current) {
      // Small delay to allow keyboard to open
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300);
    }
  }, [isMobile]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || status !== "ready") return;

    const userMessage = input;
    
    // Convert attached resources to FileUIPart format for AI SDK
    // Only include resources that haven't been sent yet to avoid context repetition
    const unsentResources = attachedResources.filter(
      (resource) => !sentResourceIdsRef.current.has(resource.id)
    );

    // Smart batch: if >3 non-image resources, send as references instead of raw files
    // so the AI can use read_resource_content to access them on-demand
    const imageResources = unsentResources.filter((r) => r.type === "image");
    const nonImageResources = unsentResources.filter((r) => r.type !== "image");
    const useSmartBatch = nonImageResources.length > 3;

    let fileParts: Array<{ type: "file"; url: string; mediaType: string; filename: string }>;
    let resourceRefText = "";

    if (useSmartBatch) {
      // Images still go as FileUIPart (models handle them well visually)
      fileParts = imageResources.map((resource) => ({
        type: "file" as const,
        url: resource.url,
        mediaType: getMediaType(resource.type),
        filename: resource.title,
      }));
      // Non-image resources sent as text references with IDs
      resourceRefText = "\n\n[Attached Resources - use read_resource_content tool to access content]\n" +
        nonImageResources.map((r) => `- ${r.title} (${r.type}, ID: ${r.id})`).join("\n");
    } else {
      fileParts = unsentResources.map((resource) => ({
        type: "file" as const,
        url: resource.url,
        mediaType: getMediaType(resource.type),
        filename: resource.title,
      }));
    }

    // If no chat exists, create one optimistically and send the message
    if (!chatId) {
      const newChatId = crypto.randomUUID();
      const chatTitle = generateChatTitle(input, unsentResources);

      // Store pending message for the useEffect to send after re-render
      pendingMessageRef.current = { text: userMessage + resourceRefText, files: fileParts };
      unsentResources.forEach(r => sentResourceIdsRef.current.add(r.id));

      // Optimistically update state + URL immediately (no server round-trip)
      newlyCreatedChatRef.current = newChatId;
      needsTitleUpdateRef.current = false;
      setChatId(newChatId);
      updateUrlWithChatId(newChatId);
      setChats(prev => [
        { id: newChatId, userId, title: chatTitle, isActive: true, visibility: 'private' as const, shareToken: null, createdAt: new Date(), updatedAt: new Date() },
        ...prev,
      ]);

      // Create chat in DB in the background — API route is resilient to brief delay
      createChat({ id: newChatId, userId, title: chatTitle }).catch(err => {
        console.error("Failed to create chat:", err);
      });

      // Message is sent by the useEffect once chatId state propagates
    } else {
      // Chat exists, send message immediately
      sendMessage({
        text: userMessage + resourceRefText,
        files: fileParts,
      });
      
      // Mark resources as sent and clear from UI
      unsentResources.forEach((resource) => {
        sentResourceIdsRef.current.add(resource.id);
      });
      setAttachedResources([]);
      
      // If chat needs title update (created via "New Chat" button without resources), update it now
      if (needsTitleUpdateRef.current && chatId) {
        const newTitle = generateChatTitle(userMessage, []);
        // Update title in background (don't block UI)
        updateChatTitle({ chatId, title: newTitle })
          .then((updatedChat) => {
            // Update local chat list state
            setChats((prev) =>
              prev.map((chat) =>
                chat.id === chatId ? { ...chat, title: updatedChat.title } : chat
              )
            );
          })
          .catch((error) => {
            console.error("Failed to update chat title:", error);
          });
        needsTitleUpdateRef.current = false;
      }
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
      // Generate contextual title based on attached resources if any
      const chatTitle = generateChatTitle("", attachedResources);
      const newChat = await createChat({
        userId,
        title: chatTitle,
      });
      setChatId(newChat.id);
      updateUrlWithChatId(newChat.id); // Update URL with new chat ID
      setChats((prev) => [newChat, ...prev]);
      setMessages([]);
      setAttachedResources([]);
      // Reset refs for new chat
      lastChatIdRef.current = null;
      newlyCreatedChatRef.current = newChat.id;
      sentResourceIdsRef.current.clear(); // Reset sent resources tracking
      // Mark chat as needing title update after first message (if no resources attached)
      needsTitleUpdateRef.current = attachedResources.length === 0;
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
        sentResourceIdsRef.current.clear(); // Reset sent resources tracking
        needsTitleUpdateRef.current = false; // Reset title update flag
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
    sentResourceIdsRef.current.clear(); // Reset sent resources tracking for new chat
    needsTitleUpdateRef.current = false; // Reset title update flag
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

  // Derive sharing state from current chat
  const currentChat = chats.find(c => c.id === chatId);
  const currentShareToken = currentChat?.shareToken ?? null;
  const currentVisibility = currentChat?.visibility ?? 'private';

  const handleEditMessage = useCallback(async (messageId: string, newText: string) => {
    if (!chatId || !newText.trim()) return;
    setEditingMessageId(null);
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    setMessages(messages.slice(0, msgIndex));
    deleteChatMessagesFrom({ chatId, fromMessageId: messageId }).catch(console.error);
    sendMessage({ text: newText.trim() });
  }, [chatId, messages, setMessages, sendMessage]);

  const handleGenerateShareLink = async () => {
    if (!chatId) return;
    setShareLoading(true);
    try {
      const { shareToken } = await generateChatShareToken({ chatId, userId });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, visibility: 'link' as const, shareToken } : c));
    } catch (e) {
      console.error(e);
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeSharing = async () => {
    if (!chatId) return;
    setShareLoading(true);
    try {
      await updateChatVisibility({ chatId, userId, visibility: 'private' });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, visibility: 'private' as const, shareToken: null } : c));
    } catch (e) {
      console.error(e);
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col" suppressHydrationWarning>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          {chatId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Share Chat"
              onClick={() => setIsShareModalOpen(true)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          )}
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
                  "flex gap-2 min-w-0 group/msg",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {/* Pencil edit button — only for user messages, shown on hover */}
                {message.role === "user" && chatId && status === "ready" && editingMessageId !== message.id && (
                  <button
                    className="self-center opacity-0 group-hover/msg:opacity-100 transition-opacity shrink-0"
                    title="Edit message"
                    onClick={() => {
                      const textContent = message.parts
                        .filter((p): p is { type: "text"; text: string } => p.type === "text")
                        .map(p => p.text)
                        .join("");
                      setEditingText(textContent);
                      setEditingMessageId(message.id);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}

                {editingMessageId === message.id ? (
                  <div className="w-full max-w-[85%] space-y-2">
                    <Textarea
                      value={editingText}
                      onChange={e => setEditingText(e.target.value)}
                      autoFocus
                      rows={3}
                      className="w-full resize-none"
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                          e.preventDefault();
                          if (editingText.trim()) handleEditMessage(message.id, editingText);
                        }
                        if (e.key === "Escape") setEditingMessageId(null);
                      }}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingMessageId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!editingText.trim()}
                        onClick={() => handleEditMessage(message.id, editingText)}
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                ) : (
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
                    if (part.type === "reasoning") {
                      return (
                        <details key={i} className="my-1 group">
                          <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors list-none">
                            <Brain className="h-3.5 w-3.5 shrink-0" />
                            <span>Show reasoning</span>
                          </summary>
                          <div className="mt-1.5 pl-5 text-xs text-muted-foreground border-l-2 border-muted whitespace-pre-wrap">
                            {part.text}
                          </div>
                        </details>
                      );
                    }
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
                        // AI SDK wraps output as { type: "json", value: {...} } during streaming
                        // When loaded from DB, output is stored directly without wrapper
                        const outputWrapper = output as { type?: string; value?: { success?: boolean; format?: string; assignmentId?: string; metadata?: unknown; content?: unknown; answerKey?: unknown; exportOptions?: unknown; error?: string } } | undefined;
                        const assignmentOutput = outputWrapper?.value ?? output;

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
                        // AI SDK wraps output as { type: "json", value: {...} } during streaming
                        // When loaded from DB, output is stored directly without wrapper
                        const outputWrapper = output as { type?: string; value?: { success?: boolean; format?: string; artifact?: string; quizId?: string; metadata?: unknown; quiz?: unknown; actions?: unknown; error?: string } } | undefined;
                        const quizOutput = outputWrapper?.value ?? output;

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

                      // Create Flashcard Tool
                      if (toolType === "tool-create_flashcards") {
                        // AI SDK wraps output as { type: "json", value: {...} } during streaming
                        // When loaded from DB, output is stored directly without wrapper
                        const outputWrapper = output as { type?: string; value?: { success?: boolean; format?: string; artifact?: string; flashcardId?: string; metadata?: unknown; flashcards?: unknown; actions?: unknown; error?: string } } | undefined;
                        const flashcardOutput = outputWrapper?.value ?? output;

                        if (flashcardOutput?.success) {
                          return (
                            <div key={i} className="mt-2 w-full min-w-0">
                              <FlashcardModalTrigger data={flashcardOutput as unknown as React.ComponentProps<typeof FlashcardModalTrigger>['data']} />
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
                                errorText={flashcardOutput?.error}
                                output={flashcardOutput?.success ? "Flashcards created successfully" : undefined}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      
                      // Create Notes Document Tool
                      if (toolType === "tool-create_notes_document") {
                        const outputWrapper = output as { type?: string; value?: { success?: boolean; format?: string; notesDocumentId?: string; metadata?: unknown; document?: unknown; exportOptions?: unknown; error?: string } } | undefined;
                        const notesOutput = outputWrapper?.value ?? output;

                        if (notesOutput?.success) {
                          return (
                            <div key={i} className="mt-2 w-full min-w-0">
                              <NotesDocumentModalTrigger data={notesOutput as unknown as React.ComponentProps<typeof NotesDocumentModalTrigger>['data']} />
                            </div>
                          );
                        }

                        return (
                          <Tool key={i} defaultOpen={false} className="mt-2 min-w-0">
                            <ToolHeader toolType={toolType} state={state} />
                            <ToolContent>
                              <ToolInput input={input} />
                              <ToolOutput
                                errorText={notesOutput?.error}
                                output={notesOutput?.success ? "Notes document created successfully" : undefined}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }

                      // Create Exam Tool
                      if (toolType === "tool-create_exam") {
                        const outputWrapper = output as { type?: string; value?: { success?: boolean; format?: string; examId?: string; metadata?: unknown; exam?: unknown; answerKey?: unknown; exportOptions?: unknown; error?: string } } | undefined;
                        const examOutput = outputWrapper?.value ?? output;

                        if (examOutput?.success) {
                          return (
                            <div key={i} className="mt-2 w-full min-w-0">
                              <ExamModalTrigger data={examOutput as unknown as React.ComponentProps<typeof ExamModalTrigger>['data']} />
                            </div>
                          );
                        }

                        return (
                          <Tool key={i} defaultOpen={false} className="mt-2 min-w-0">
                            <ToolHeader toolType={toolType} state={state} />
                            <ToolContent>
                              <ToolInput input={input} />
                              <ToolOutput
                                errorText={examOutput?.error}
                                output={examOutput?.success ? "Exam created successfully" : undefined}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }

                      // Server Actions — show approval UI for mutations
                      if (toolType === "tool-server_actions" && state === "approval-requested") {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const actionInput = input as any;
                        const action: string = actionInput?.action ?? "";
                        const params = actionInput?.params ?? {};
                        const toolCallId: string = toolPart.toolCallId;

                        const summary =
                          action === "add_regular"
                            ? `Add learner: ${params.email ?? "unknown"}`
                            : action === "create_resource"
                            ? `Create resource: "${params.title ?? "untitled"}" (${params.type ?? ""}) in topic ${params.topicId ?? ""}`
                            : action;

                        const handleApprove = () => {
                          addToolApprovalResponse({ id: toolCallId, approved: true });
                        };

                        const handleDeny = () => {
                          addToolApprovalResponse({
                            id: toolCallId,
                            approved: false,
                            reason: "Action cancelled by user.",
                          });
                        };

                        return (
                          <Tool key={i} defaultOpen className="mt-2 min-w-0">
                            <ToolHeader toolType={toolType} state={state} title="Confirm Action" />
                            <ToolContent>
                              <p className="text-sm text-muted-foreground">{summary}</p>
                              <div className="flex gap-2 mt-2">
                                <Button size="sm" onClick={handleApprove}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={handleDeny}>
                                  Deny
                                </Button>
                              </div>
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
                  {message.role === "assistant" && (message.metadata as { totalTokens?: number; createdAt?: number } | undefined)?.totalTokens && (
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-muted-foreground/10">
                      <span className="text-[10px] text-muted-foreground">
                        {(message.metadata as { totalTokens: number }).totalTokens} tokens
                      </span>
                      {(message.metadata as { createdAt?: number } | undefined)?.createdAt && (
                        <span className="text-[10px] text-muted-foreground">
                          · {new Date((message.metadata as { createdAt: number }).createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  )}
                  </div>
                </div>
                )} {/* end editing ternary */}
              </div>
            )))}
            {/* Regenerate button — shown after last assistant message when idle */}
            {messages.at(-1)?.role === "assistant" && status === "ready" && (
              <div className="flex justify-start pl-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground h-7 px-2 hover:text-foreground"
                  onClick={() => regenerate()}
                >
                  <RotateCcw className="h-3 w-3" />
                  Regenerate
                </Button>
              </div>
            )}

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

            {status === "submitted" && (
              <div className="flex items-center gap-1.5 px-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
              </div>
            )}
            {status === "streaming" && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm px-1">
                <Loader2 className="h-4 w-4 animate-spin" />
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
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background sticky bottom-0 z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div className="rounded-2xl border bg-background shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/50">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onFocus={handleTextareaFocus}
              placeholder={mounted && isMobile ? "Ask anything..." : "Ask anything... (Shift+Enter for new line)"}
              disabled={status !== "ready"}
              rows={textareaRows}
              className="min-h-[52px] max-h-[160px] resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent px-4 pt-3 pb-2 text-sm w-full"
            />
            {/* Bottom toolbar */}
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <div className="flex items-center gap-1">
                <ModelSelector
                  selectedModelId={selectedModelId}
                  onModelChange={setSelectedModelId}
                />
                <AddResourceToChat
                  attachedResources={attachedResources}
                  userId={userId}
                  userRole={userRole}
                  onAddResource={handleAddResource}
                  onRemoveResource={handleRemoveResource}
                />
              </div>
              {status !== "ready" ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 rounded-xl shrink-0"
                  onClick={stop}
                  title="Stop generating"
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 rounded-xl shrink-0"
                  disabled={!input.trim()}
                  title="Send (Enter)"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Share Dialog */}
      <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {currentVisibility === 'link' && currentShareToken ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Anyone with this link can view this chat (read-only).
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/${currentShareToken}`}
                    className="flex-1 text-xs border rounded-md px-3 py-2 bg-muted/50 font-mono truncate"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/share/${currentShareToken}`
                      );
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={shareLoading}
                  onClick={handleRevokeSharing}
                  className="w-full"
                >
                  {shareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke Link"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Generate a read-only public link to share this conversation.
                </p>
                <Button
                  className="w-full gap-2"
                  disabled={shareLoading}
                  onClick={handleGenerateShareLink}
                >
                  {shareLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  Generate Share Link
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export type { Resource };
