"use client";

import { type ReactNode } from "react";
import { AdminFileTree } from "@/components/admin/admin-file-tree";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { PanelLeft, PanelRight, MessageSquare, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AIChat } from "@/components/ai/ai-chat";
import { UserButton } from "@clerk/nextjs";

interface AdminLayoutClientProps {
  children: ReactNode;
  userId: string | null;
  userRole?: "admin" | "super_admin";
}

export function AdminLayoutClient({ children, userId, userRole }: AdminLayoutClientProps) {
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = useState(false);
  // Default to closed on mobile, open on desktop (for SSR consistency)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(!isMobile);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    // After hydration, set isClient to true to allow mobile detection
    const timeoutId = setTimeout(() => setIsClient(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const pathname = usePathname();

  // Prevent hydration mismatch by rendering desktop layout until client-side hydration is complete
  const showMobile = isClient && isMobile;

  // Mobile layout with sheets
  if (showMobile) {
    return (
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
              <SheetTitle className="sr-only">File Tree Sidebar</SheetTitle>
              <div className="flex h-full flex-col">
                <div className="border-b p-4">
                  <h2 className="font-semibold">File Tree</h2>
                  <p className="text-xs text-muted-foreground">Browse content</p>
                </div>
                <div className="flex-1 overflow-auto">
                  <AdminFileTree />
                </div>
                {/* Mobile Super Admin Navigation */}
                {userRole === "super_admin" && (
                  <div className="border-t p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                      <Shield className="h-4 w-4" />
                      Super Admin
                    </div>
                    <nav className="space-y-1">
                      <Link
                        href="/admin/manage-admins"
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                          pathname === "/admin/manage-admins"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Users className="h-4 w-4" />
                        Manage Admins
                      </Link>
                    </nav>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
          
          <h1 className="font-semibold">Admin</h1>
          
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
                    {userId && (
                      <AIChat userId={userId} />
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
  }

  // Desktop layout with collapsible sidebars
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - File Tree - Hidden during initial load to prevent flash on mobile */}
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
          <AdminFileTree />
        </div>
        
        {/* Super Admin Navigation */}
        {userRole === "super_admin" && (
          <div className="border-t p-4">
            <div className={cn("mb-2 transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Shield className="h-4 w-4" />
                Super Admin
              </div>
            </div>
            <nav className={cn("space-y-1 transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
              <Link
                href="/admin/manage-admins"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                  pathname === "/admin/manage-admins"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Users className="h-4 w-4" />
                Manage Admins
              </Link>
            </nav>
          </div>
        )}
      </div>
      
      {/* Center - Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toggle Bar */}
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
      
      {/* Right Sidebar - AI Chat - Hidden during initial load to prevent flash on mobile */}
      <div
        className={cn(
          "flex-shrink-0 border-l bg-background transition-all duration-300 ease-in-out flex flex-col",
          !isClient ? "w-0 overflow-hidden" : rightSidebarOpen ? "w-96" : "w-0 overflow-hidden"
        )}
      >
        {userId && (
          <AIChat userId={userId} />
        )}
      </div>
    </div>
  );
}
