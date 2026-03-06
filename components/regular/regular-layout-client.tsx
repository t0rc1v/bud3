"use client";

import { type ReactNode } from "react";
import { SidebarContentTree } from "@/components/content/sidebar-content-tree";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { PanelLeft, PanelRight, MessageSquare, LayoutDashboard, GraduationCap, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { AIChat, type Resource as ChatResource } from "@/components/ai/ai-chat";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserButtonWrapper } from "@/components/auth/user-button-wrapper";
import { CreditBadge, CreditModal } from "@/components/credits/credit-modal";
import { UnlockedResourcesProvider } from "@/components/credits/unlocked-resources-context";
import type { Resource } from "@/lib/types";
import type { LevelWithFullHierarchy } from "@/lib/types";

interface ContentLayoutClientProps {
  children: ReactNode;
  userId: string | null;
  dbUserId?: string | null;
  userRole: "admin" | "regular";
  initialLevels: LevelWithFullHierarchy[];
  adminIds?: string[];
}

function getPageTitle(pathname: string, routes: Record<string, string>): string {
  return routes[pathname] ?? "Content";
}

export function RegularLayoutClient({ children, userId, dbUserId, userRole, initialLevels, adminIds = [] }: ContentLayoutClientProps) {
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = useState(false);
  // Default to closed on mobile, open on desktop (for SSR consistency)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(!isMobile);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(!isMobile);
  
  // State for resource actions from file tree
  const [resourceToAddToChat, setResourceToAddToChat] = useState<ChatResource | null>(null);
  const [toolsOpen, setToolsOpen] = useState(true);

  useEffect(() => {
    // After hydration, set isClient to true to allow mobile detection
    const timeoutId = setTimeout(() => setIsClient(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const title = userRole === "admin" ? "Institution Admin" : "Student";
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname, {
    "/regular": "Dashboard",
  });

  // Handle resource selection from sidebar
  const handleResourceSelect = useCallback((resource: Resource) => {
    // Navigate with viewResource query param
    const params = new URLSearchParams(window.location.search);
    params.set("viewResource", resource.id);
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

  // Handle add resource to chat from sidebar
  const handleAddResourceToChat = useCallback((resource: Resource) => {
    const chatResource: ChatResource = {
      id: resource.id,
      title: resource.title,
      description: resource.description || "",
      url: resource.url || "",
      type: (resource.type as "notes" | "video" | "audio" | "image") || "notes",
    };
    
    // Open chat sidebar if closed
    if (!rightSidebarOpen) {
      setRightSidebarOpen(true);
    }
    
    // Store resource to be added when chat opens
    setResourceToAddToChat(chatResource);
  }, [rightSidebarOpen]);

  // Prevent hydration mismatch by rendering desktop layout until client-side hydration is complete
  const showMobile = isClient && isMobile;

  // Mobile layout with sheets
  const mobileLayout = (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Mobile Header */}
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Open file tree</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SheetTitle className="sr-only">Content File Tree Sidebar</SheetTitle>
              <div className="flex h-full flex-col">
                <div className="border-b p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <GraduationCap className="h-3.5 w-3.5" />
                    </div>
                    <h2 className="font-semibold">BudLMS</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">Browse content</p>
                </div>
                <div className="flex-1 overflow-auto">
                  <SidebarContentTree
                    initialLevels={initialLevels}
                    userId={dbUserId || userId || ""}
                    userRole={userRole}
                    adminIds={adminIds}
                    onResourceSelect={handleResourceSelect}
                    onAddResourceToChat={handleAddResourceToChat}
                    enableCrud={true}
                    className="h-full"
                  />
                </div>
                {/* Regular User Navigation */}
                {userRole === "regular" && (
                  <div className="border-t p-4">
                    <Separator className="mb-3" />
                    <button
                      onClick={() => setToolsOpen(!toolsOpen)}
                      className="mb-2 flex w-full items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <GraduationCap className="h-3.5 w-3.5" />
                        Student Tools
                      </span>
                      <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", toolsOpen && "rotate-180")} />
                    </button>
                    {toolsOpen && (
                      <nav className="space-y-1">
                        <Link
                          href="/regular"
                          className={cn(
                            "flex items-center gap-2 pr-3 py-2 text-sm rounded-r-md transition-all duration-150 border-l-2",
                            pathname === "/regular"
                              ? "border-primary bg-primary/15 text-foreground pl-[10px]"
                              : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground pl-[10px]"
                          )}
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Dashboard
                        </Link>
                      </nav>
                    )}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <GraduationCap className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">{title}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div suppressHydrationWarning>
              <CreditModal trigger={<CreditBadge className="cursor-pointer" />} />
            </div>
            {isClient && <ThemeToggle />}
            {isClient && <UserButtonWrapper />}
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MessageSquare className="h-5 w-5" />
                  <span className="sr-only">Open chat</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[22rem] p-0 sm:w-96">
                <SheetTitle className="sr-only">AI Chat Sidebar</SheetTitle>
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2 className="font-semibold">AI Chat</h2>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {(dbUserId || userId) && (
                      <AIChat 
                        userId={dbUserId || userId || ""} 
                        userRole={userRole}
                        isOpen={true} 
                        resourceToAdd={resourceToAddToChat}
                        onResourceAdded={() => setResourceToAddToChat(null)}
                      />
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>
        
        {/* Mobile Main Content */}
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
  );

  // Desktop layout with collapsible sidebars
  const desktopLayout = (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - File Tree - Hidden during initial load to prevent flash on mobile */}
      <div
        className={cn(
          "flex-shrink-0 border-r bg-sidebar transition-all duration-300 ease-in-out flex flex-col",
          !isClient ? "w-0 overflow-hidden" : leftSidebarOpen ? "w-72" : "w-0 overflow-hidden"
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className={cn(
            "font-semibold tracking-tight transition-all duration-200",
            leftSidebarOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
          )}>
            BudLMS
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <SidebarContentTree
            initialLevels={initialLevels}
            userId={dbUserId || userId || ""}
            userRole={userRole}
            adminIds={adminIds}
            onResourceSelect={handleResourceSelect}
            onAddResourceToChat={handleAddResourceToChat}
            enableCrud={true}
            className="h-full"
          />
        </div>
        
        {/* Regular User Navigation */}
        {userRole === "regular" && (
          <div className="border-t p-4">
            <div className={cn("mb-3 transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
              <Separator className="mb-3" />
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                className="mb-2 flex w-full items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Student Tools
                </span>
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", toolsOpen && "rotate-180")} />
              </button>
            </div>
            {toolsOpen && (
              <nav className={cn("space-y-1 transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
                <Link
                  href="/regular"
                  className={cn(
                    "flex items-center gap-2 pr-3 py-2 text-sm rounded-r-md transition-all duration-150 border-l-2",
                    pathname === "/regular"
                      ? "border-primary bg-primary/15 text-foreground pl-[10px]"
                      : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground pl-[10px]"
                  )}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </nav>
            )}
          </div>
        )}
      </div>
      
      {/* Center - Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toggle Bar */}
        <TooltipProvider>
          <div className="flex h-14 items-center justify-between border-b bg-background px-4">
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <PanelLeft className={cn("h-4 w-4 transition-transform duration-200", leftSidebarOpen && "rotate-180")} />
                    <span className="sr-only">Toggle content sidebar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {leftSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                </TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-5" />

              <div className="flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-medium text-foreground">{pageTitle}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div suppressHydrationWarning>
                <CreditModal trigger={<CreditBadge className="cursor-pointer" />} />
              </div>

              <Separator orientation="vertical" className="h-5" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <PanelRight className={cn("h-4 w-4 transition-transform duration-200", rightSidebarOpen && "rotate-180")} />
                    <span className="sr-only">Toggle AI chat</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {rightSidebarOpen ? "Close AI Chat" : "Open AI Chat"}
                </TooltipContent>
              </Tooltip>

              {isClient && <ThemeToggle />}
            {isClient && <UserButtonWrapper />}
            </div>
          </div>
        </TooltipProvider>
        
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
      
      {/* Right Sidebar - AI Chat - Hidden during initial load to prevent flash on mobile */}
      <div
        className={cn(
          "flex-shrink-0 border-l bg-background transition-all duration-300 ease-in-out flex flex-col",
          !isClient ? "w-0 overflow-hidden" : rightSidebarOpen ? "w-96" : "w-0 overflow-hidden"
        )}
      >
      {(dbUserId || userId) && (
          <AIChat 
            userId={dbUserId || userId || ""} 
            userRole={userRole}
            isOpen={rightSidebarOpen} 
            resourceToAdd={resourceToAddToChat}
            onResourceAdded={() => setResourceToAddToChat(null)}
          />
        )}
      </div>
    </div>
  );

  return (
    <UnlockedResourcesProvider>
      {showMobile ? mobileLayout : desktopLayout}
    </UnlockedResourcesProvider>
  );
}
