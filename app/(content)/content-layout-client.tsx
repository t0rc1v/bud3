"use client";

import { type ReactNode } from "react";
import { ContentFileTree } from "@/components/content/content-file-tree";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PanelLeft, PanelRight, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AIChat } from "@/components/ai/ai-chat";

interface ContentLayoutClientProps {
  children: ReactNode;
  userId: string | null;
  userRole: "teacher" | "learner";
}

export function ContentLayoutClient({ children, userId, userRole }: ContentLayoutClientProps) {
  const isMobile = useIsMobile();
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(!isMobile);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(!isMobile);

  const title = userRole === "teacher" ? "Teacher" : "Learner";

  // Mobile layout with sheets
  if (isMobile) {
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
              <div className="flex h-full flex-col">
                <div className="border-b p-4">
                  <h2 className="font-semibold">Content</h2>
                  <p className="text-xs text-muted-foreground">Browse content</p>
                </div>
                <div className="flex-1 overflow-auto">
                  <ContentFileTree userRole={userRole} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          
          <h1 className="font-semibold">{title}</h1>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MessageSquare className="h-5 w-5" />
                <span className="sr-only">Open chat</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              {userId && (
                <AIChat userId={userId} />
              )}
            </SheetContent>
          </Sheet>
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
      {/* Left Sidebar - File Tree */}
      <div
        className={cn(
          "flex-shrink-0 border-r bg-sidebar transition-all duration-300 ease-in-out flex flex-col",
          leftSidebarOpen ? "w-72" : "w-0 overflow-hidden"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <h2 className={cn("font-semibold transition-opacity", leftSidebarOpen ? "opacity-100" : "opacity-0")}>
            Content
          </h2>
        </div>
        <div className="flex-1 overflow-auto">
          <ContentFileTree userRole={userRole} />
        </div>
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
            <span className="text-sm text-muted-foreground">Content</span>
          </div>
          
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
        </div>
        
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
      
      {/* Right Sidebar - AI Chat */}
      <div
        className={cn(
          "flex-shrink-0 border-l bg-background transition-all duration-300 ease-in-out flex flex-col",
          rightSidebarOpen ? "w-80" : "w-0 overflow-hidden"
        )}
      >
        {userId && (
          <AIChat userId={userId} />
        )}
      </div>
    </div>
  );
}
