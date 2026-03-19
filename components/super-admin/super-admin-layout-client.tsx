"use client";

import { type ReactNode } from "react";
import { SidebarContentTree } from "@/components/content/sidebar-content-tree";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { PanelLeft, PanelRight, MessageSquare, Crown, Gift, Users, LayoutDashboard, BarChart2, BarChart3, ChevronDown, Loader2, Bell, Flame, Upload, FileText, BookCopy, FileCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import type { Resource as ChatResource } from "@/components/ai/ai-chat";
const AIChat = dynamic(() => import("@/components/ai/ai-chat").then(m => ({ default: m.AIChat })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>,
});
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserButtonWrapper } from "@/components/auth/user-button-wrapper";
import { CreditModal, CreditBadge } from "@/components/credits/credit-modal";
import type { Resource } from "@/lib/types";
import type { LevelWithFullHierarchy } from "@/lib/types";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { NotificationBell } from "@/components/shared/notification-bell";

interface SuperAdminLayoutClientProps {
  children: ReactNode;
  userId: string;
  dbUserId?: string;
  initialLevels: LevelWithFullHierarchy[];
}

function getPageTitle(pathname: string, routes: Record<string, string>): string {
  return routes[pathname] ?? "Content";
}

export function SuperAdminLayoutClient({ children, userId, dbUserId, initialLevels }: SuperAdminLayoutClientProps) {
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(!isMobile);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(!isMobile);
  const [resourceToAddToChat, setResourceToAddToChat] = useState<ChatResource | null>(null);
  const [toolsOpen, setToolsOpen] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => setIsClient(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname, {
    "/super-admin": "Dashboard",
    "/super-admin/analytics": "Analytics",
    "/super-admin/rewards": "Gift Credits & Unlocks",
    "/super-admin/manage-admins": "Manage Admins",
    "/super-admin/regulars": "Manage Regulars",
    "/super-admin/notifications": "Send Notifications",
    "/super-admin/streaks": "Streak Leaderboard",
    "/super-admin/ai-analytics": "AI Analytics",
    "/super-admin/bulk-upload": "Bulk Upload",
    "/super-admin/reports": "Reports",
    "/super-admin/curriculum-import": "Curriculum Import",
    "/super-admin/submissions": "Learner Submissions",
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

  useKeyboardShortcuts({
    onToggleLeftSidebar: () => setLeftSidebarOpen(prev => !prev),
    onToggleRightSidebar: () => setRightSidebarOpen(prev => !prev),
    onClosePanel: () => {
      if (rightSidebarOpen) setRightSidebarOpen(false);
    },
  });

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
                    <Crown className="h-3.5 w-3.5" />
                  </div>
                  <h2 className="font-semibold">BudLMS</h2>
                </div>
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
              <div className="border-t p-4 max-h-[50%] flex flex-col">
                <Separator className="mb-3 flex-shrink-0" />
                <button
                  onClick={() => setToolsOpen(!toolsOpen)}
                  className="mb-2 flex-shrink-0 flex w-full items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Crown className="h-3.5 w-3.5" />
                    Super Admin Tools
                  </span>
                  <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", toolsOpen && "rotate-180")} />
                </button>
                {toolsOpen && (
                  <nav className="space-y-1 overflow-y-auto">
                    {[
                      { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
                      { href: "/super-admin/analytics", label: "Analytics", icon: BarChart2 },
                      { href: "/super-admin/rewards", label: "Gift Credits", icon: Gift },
                      { href: "/super-admin/manage-admins", label: "Manage Admins", icon: Users },
                      { href: "/super-admin/regulars", label: "Manage Regulars", icon: Users },
                      { href: "/super-admin/notifications", label: "Notifications", icon: Bell },
                      { href: "/super-admin/streaks", label: "Streaks", icon: Flame },
                      { href: "/super-admin/ai-analytics", label: "AI Analytics", icon: BarChart3 },
                      { href: "/super-admin/bulk-upload", label: "Bulk Upload", icon: Upload },
                      { href: "/super-admin/reports", label: "Reports", icon: FileText },
                      { href: "/super-admin/submissions", label: "Submissions", icon: FileCheck },
                      { href: "/super-admin/curriculum-import", label: "Curriculum Import", icon: BookCopy },
                    ].map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-2 pr-3 py-2 text-sm rounded-r-md transition-all duration-150 border-l-2",
                          pathname === href
                            ? "border-primary bg-primary/15 text-foreground pl-[10px]"
                            : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground pl-[10px]"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    ))}
                  </nav>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <Crown className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold">Super Admin</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div suppressHydrationWarning>
            <CreditModal trigger={<CreditBadge className="cursor-pointer" />} />
          </div>
          <NotificationBell />
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
          leftSidebarOpen ? "w-72 max-md:hidden" : "w-0 overflow-hidden max-md:hidden"
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Crown className="h-4 w-4" />
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
            userId={dbUserId || userId}
            userRole="super_admin"
            onResourceSelect={handleResourceSelect}
            onAddResourceToChat={handleAddResourceToChat}
            enableCrud={true}
            className="h-full"
          />
        </div>
        
        <div className="border-t p-4 max-h-[50%] flex flex-col">
          <div className={cn("flex-shrink-0 mb-3 transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
            <Separator className="mb-3" />
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              className="mb-2 flex w-full items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <Crown className="h-3.5 w-3.5" />
                Super Admin Tools
              </span>
              <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", toolsOpen && "rotate-180")} />
            </button>
          </div>
          {toolsOpen && (
            <nav className={cn("space-y-1 overflow-y-auto transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
              {[
                { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
                { href: "/super-admin/analytics", label: "Analytics", icon: BarChart2 },
                { href: "/super-admin/rewards", label: "Gift Credits & Unlocks", icon: Gift },
                { href: "/super-admin/manage-admins", label: "Manage Admins", icon: Users },
                { href: "/super-admin/regulars", label: "Manage Regulars", icon: Users },
                { href: "/super-admin/notifications", label: "Notifications", icon: Bell },
                { href: "/super-admin/streaks", label: "Streaks", icon: Flame },
                { href: "/super-admin/ai-analytics", label: "AI Analytics", icon: BarChart3 },
                { href: "/super-admin/bulk-upload", label: "Bulk Upload", icon: Upload },
                { href: "/super-admin/reports", label: "Reports", icon: FileText },
                { href: "/super-admin/submissions", label: "Submissions", icon: FileCheck },
                { href: "/super-admin/curriculum-import", label: "Curriculum Import", icon: BookCopy },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 pr-3 py-2 text-sm rounded-r-md transition-all duration-150 border-l-2",
                    pathname === href
                      ? "border-primary bg-primary/15 text-foreground pl-[10px]"
                      : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground pl-[10px]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </div>
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
                <Crown className="h-3.5 w-3.5 text-primary" />
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

              <NotificationBell />
              {isClient && <ThemeToggle />}
              {isClient && <UserButtonWrapper />}
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
          rightSidebarOpen ? "w-96 max-md:hidden" : "w-0 overflow-hidden max-md:hidden"
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

  return showMobile ? mobileLayout : desktopLayout;
}
