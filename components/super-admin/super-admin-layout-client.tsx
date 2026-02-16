"use client";

import { type ReactNode } from "react";
import { SidebarContentTree } from "@/components/content/sidebar-content-tree";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { PanelLeft, PanelRight, MessageSquare, Crown, Gift, Unlock, Users, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AIChat, type Resource as ChatResource } from "@/components/ai/ai-chat";
import { UserButton } from "@clerk/nextjs";
import { UnlockedResourcesProvider } from "@/components/credits/unlocked-resources-context";
import type { Resource } from "@/lib/types";
import type { LevelWithFullHierarchy } from "@/lib/types";

interface SuperAdminLayoutClientProps {
  children: ReactNode;
  userId: string;
  dbUserId?: string;
  initialLevels: LevelWithFullHierarchy[];
}

export function SuperAdminLayoutClient({ children, userId, dbUserId, initialLevels }: SuperAdminLayoutClientProps) {
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
                <h2 className="font-semibold">Content</h2>
                <p className="text-xs text-muted-foreground">Browse all content</p>
              </div>
              <div className="flex-1 overflow-auto">
                <SidebarContentTree
                  initialLevels={initialLevels}
                  userId={dbUserId || userId}
                  userRole="super_admin"
                  onResourceSelect={handleResourceSelect}
                  onAddResourceToChat={handleAddResourceToChat}
                  enableCrud={true}
                  className="h-full"
                />
              </div>
              <div className="border-t p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-600">
                  <Crown className="h-4 w-4" />
                  Super Admin Tools
                </div>
                <nav className="space-y-1">
                  <Link
                    href="/super-admin"
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                      pathname === "/super-admin"
                        ? "bg-purple-100 text-purple-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link
                    href="/super-admin/rewards"
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                      pathname === "/super-admin/rewards"
                        ? "bg-purple-100 text-purple-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Gift className="h-4 w-4" />
                    Gift Credits
                  </Link>
                  <Link
                    href="/super-admin/manage-unlock-fees"
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                      pathname === "/super-admin/manage-unlock-fees"
                        ? "bg-purple-100 text-purple-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Unlock className="h-4 w-4" />
                    Manage Unlock Fees
                  </Link>
                  <Link
                    href="/super-admin/manage-admins"
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                      pathname === "/super-admin/manage-admins"
                        ? "bg-purple-100 text-purple-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Users className="h-4 w-4" />
                    Manage Admins
                  </Link>
                </nav>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-purple-600" />
          <h1 className="font-semibold">Super Admin</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <div suppressHydrationWarning>
            <UserButton />
          </div>
          
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
                  <AIChat 
                    userId={dbUserId || userId} 
                    userRole="super_admin"
                    isOpen={true} 
                    resourceToAdd={resourceToAddToChat}
                    onResourceAdded={() => setResourceToAddToChat(null)}
                  />
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
        <div className="flex h-16 items-center justify-between border-b px-4">
          <h2 className={cn("font-semibold transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
            Content
          </h2>
        </div>
        <div className="flex-1 overflow-auto">
          <SidebarContentTree
            initialLevels={initialLevels}
            userId={dbUserId || userId}
            userRole="super_admin"
            onResourceSelect={handleResourceSelect}
            onAddResourceToChat={handleAddResourceToChat}
            enableCrud={true}
            className="h-full"
          />
        </div>
        
        <div className="border-t p-4">
          <div className={cn("mb-2 transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
            <div className="flex items-center gap-2 text-sm font-semibold text-purple-600">
              <Crown className="h-4 w-4" />
              Super Admin Tools
            </div>
          </div>
          <nav className={cn("space-y-1 transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
            <Link
              href="/super-admin"
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                pathname === "/super-admin"
                  ? "bg-purple-100 text-purple-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/super-admin/rewards"
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                pathname === "/super-admin/rewards"
                  ? "bg-purple-100 text-purple-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Gift className="h-4 w-4" />
              Gift Credits & Unlocks
            </Link>
            <Link
              href="/super-admin/manage-unlock-fees"
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                pathname === "/super-admin/manage-unlock-fees"
                  ? "bg-purple-100 text-purple-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Unlock className="h-4 w-4" />
              Manage Unlock Fees
            </Link>
            <Link
              href="/super-admin/manage-admins"
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                pathname === "/super-admin/manage-admins"
                  ? "bg-purple-100 text-purple-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Users className="h-4 w-4" />
              Manage Admins
            </Link>
          </nav>
        </div>
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-12 items-center justify-between border-b bg-background px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className="h-8 w-8"
            >
              <PanelLeft className={cn("h-4 w-4 transition-transform", leftSidebarOpen && "rotate-180")} />
              <span className="sr-only">Toggle file tree</span>
            </Button>
            <span className="text-sm text-muted-foreground">File Tree</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">AI Chat</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                className="h-8 w-8"
              >
                <PanelRight className={cn("h-4 w-4 transition-transform", rightSidebarOpen && "rotate-180")} />
                <span className="sr-only">Toggle chat</span>
              </Button>
            </div>
            <div suppressHydrationWarning>
              <UserButton />
            </div>
          </div>
        </div>
        
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
        <AIChat 
          userId={dbUserId || userId} 
          userRole="super_admin"
          isOpen={rightSidebarOpen} 
          resourceToAdd={resourceToAddToChat}
          onResourceAdded={() => setResourceToAddToChat(null)}
        />
      </div>
    </div>
  );

  return (
    <UnlockedResourcesProvider>
      {showMobile ? mobileLayout : desktopLayout}
    </UnlockedResourcesProvider>
  );
}
