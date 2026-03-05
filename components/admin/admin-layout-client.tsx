"use client";

import { type ReactNode } from "react";
import { SidebarContentTree } from "@/components/content/sidebar-content-tree";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { PanelLeft, PanelRight, MessageSquare, Shield, Gift, Coins, Users, LayoutDashboard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AIChat, type Resource as ChatResource } from "@/components/ai/ai-chat";
import { UserButton } from "@clerk/nextjs";
import { CreditBadge, CreditModal } from "@/components/credits/credit-modal";
import { UnlockedResourcesProvider } from "@/components/credits/unlocked-resources-context";
import type { Resource } from "@/lib/types";
import type { LevelWithFullHierarchy } from "@/lib/types";

interface AdminLayoutClientProps {
  children: ReactNode;
  userId: string | null;
  dbUserId?: string | null;
  userRole?: "admin" | "super_admin";
  initialLevels: LevelWithFullHierarchy[];
}

function getPageTitle(pathname: string, routes: Record<string, string>): string {
  return routes[pathname] ?? "Content";
}

export function AdminLayoutClient({ children, userId, dbUserId, userRole, initialLevels }: AdminLayoutClientProps) {
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(!isMobile);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(!isMobile);
  const [resourceToAddToChat, setResourceToAddToChat] = useState<ChatResource | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => setIsClient(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname, {
    "/admin": "Dashboard",
    "/admin/rewards": "Rewards & Unlocks",
    "/admin/manage-unlock-fees": "Manage Unlock Fees",
  });

  const handleResourceSelect = useCallback((resource: Resource) => {
    const params = new URLSearchParams(window.location.search);
    params.set("viewResource", resource.id);
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

  const handleAddResourceToChat = useCallback((resource: Resource) => {
    const chatResource: ChatResource = {
      id: resource.id,
      title: resource.title,
      description: resource.description || "",
      url: resource.url || "",
      type: (resource.type as "notes" | "video" | "audio" | "image") || "notes",
    };
    
    if (!rightSidebarOpen) {
      setRightSidebarOpen(true);
    }
    
    setResourceToAddToChat(chatResource);
  }, [rightSidebarOpen]);

  const showMobile = isClient && isMobile;

  // Mobile layout
  const mobileLayout = (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">Open file tree</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetTitle className="sr-only">File Tree Sidebar</SheetTitle>
            <div className="flex h-full flex-col">
              <div className="border-b p-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Shield className="h-3.5 w-3.5" />
                  </div>
                  <h2 className="font-semibold">BudLMS</h2>
                </div>
                <p className="text-xs text-muted-foreground">Browse content</p>
              </div>
              <div className="flex-1 overflow-auto">
                {dbUserId && (
                  <SidebarContentTree
                    initialLevels={initialLevels}
                    userId={dbUserId}
                    userRole="admin"
                    onResourceSelect={handleResourceSelect}
                    onAddResourceToChat={handleAddResourceToChat}
                    enableCrud={true}
                    className="h-full"
                  />
                )}
              </div>
              {userRole === "admin" && (
                <div className="border-t p-4">
                  <Separator className="mb-3" />
                  <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    Admin Tools
                  </div>
                  <nav className="space-y-1">
                    <Link
                      href="/admin"
                      className={cn(
                        "flex items-center gap-2 pr-3 py-2 text-sm rounded-r-md transition-all duration-150 border-l-2",
                        pathname === "/admin"
                          ? "border-primary bg-primary/15 text-foreground pl-[10px]"
                          : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground pl-[10px]"
                      )}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <Link
                      href="/admin/rewards"
                      className={cn(
                        "flex items-center gap-2 pr-3 py-2 text-sm rounded-r-md transition-all duration-150 border-l-2",
                        pathname === "/admin/rewards"
                          ? "border-primary bg-primary/15 text-foreground pl-[10px]"
                          : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground pl-[10px]"
                      )}
                    >
                      <Gift className="h-4 w-4" />
                      Rewards & Unlocks
                    </Link>
                    <Link
                      href="/admin/manage-unlock-fees"
                      className={cn(
                        "flex items-center gap-2 pr-3 py-2 text-sm rounded-r-md transition-all duration-150 border-l-2",
                        pathname === "/admin/manage-unlock-fees"
                          ? "border-primary bg-primary/15 text-foreground pl-[10px]"
                          : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground pl-[10px]"
                      )}
                    >
                      <Coins className="h-4 w-4" />
                      Manage Unlock Fees
                    </Link>
                  </nav>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <Shield className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold">Admin</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div suppressHydrationWarning>
            <CreditModal trigger={<CreditBadge className="cursor-pointer" />} />
          </div>
          {isClient && <UserButton />}
          
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
      
      <main className="flex-1 overflow-auto p-4">
        {children}
      </main>
    </div>
  );

  // Desktop layout
  const desktopLayout = (
    <div className="flex h-screen overflow-hidden">
      <div
        className={cn(
          "flex-shrink-0 border-r bg-sidebar transition-all duration-300 ease-in-out flex flex-col",
          !isClient ? "w-0 overflow-hidden" : leftSidebarOpen ? "w-72" : "w-0 overflow-hidden"
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <span className={cn(
            "font-semibold tracking-tight transition-all duration-200",
            leftSidebarOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
          )}>
            BudLMS
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          {dbUserId && (
            <SidebarContentTree
              initialLevels={initialLevels}
              userId={dbUserId}
              userRole="admin"
              onResourceSelect={handleResourceSelect}
              onAddResourceToChat={handleAddResourceToChat}
              enableCrud={true}
              className="h-full"
            />
          )}
        </div>
        
        {userRole === "admin" && (
          <div className="border-t p-4">
            <div className={cn("mb-3 transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
              <Separator className="mb-3" />
              <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                Admin Tools
              </div>
            </div>
            <nav className={cn("space-y-1 transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-2 pr-3 py-2 text-sm rounded-r-md transition-all duration-150 border-l-2",
                  pathname === "/admin"
                    ? "border-primary bg-primary/15 text-foreground pl-[10px]"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground pl-[10px]"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/admin/rewards"
                className={cn(
                  "flex items-center gap-2 pr-3 py-2 text-sm rounded-r-md transition-all duration-150 border-l-2",
                  pathname === "/admin/rewards"
                    ? "border-primary bg-primary/15 text-foreground pl-[10px]"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground pl-[10px]"
                )}
              >
                <Gift className="h-4 w-4" />
                Rewards & Unlocks
              </Link>
              <Link
                href="/admin/manage-unlock-fees"
                className={cn(
                  "flex items-center gap-2 pr-3 py-2 text-sm rounded-r-md transition-all duration-150 border-l-2",
                  pathname === "/admin/manage-unlock-fees"
                    ? "border-primary bg-primary/15 text-foreground pl-[10px]"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground pl-[10px]"
                )}
              >
                <Coins className="h-4 w-4" />
                Manage Unlock Fees
              </Link>
            </nav>
          </div>
        )}
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden">
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
                <Shield className="h-3.5 w-3.5 text-primary" />
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

              {isClient && <UserButton />}
            </div>
          </div>
        </TooltipProvider>
        
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
      
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
