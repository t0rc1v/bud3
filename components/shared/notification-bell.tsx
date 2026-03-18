"use client";

import { useState } from "react";
import { Bell, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b sticky top-0 bg-popover z-10">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAllRead();
              }}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No new notifications
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((n) => {
              const isExpanded = expandedId === n.id;
              const hasBody = !!n.body;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "border-b last:border-b-0 transition-colors",
                    !n.isRead && "bg-primary/5"
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (hasBody) {
                        toggleExpand(n.id);
                      } else {
                        markRead(n.id);
                      }
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {hasBody && !isExpanded && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.body}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {timeAgo(n.createdAt)}
                        </span>
                        {hasBody && (
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded body */}
                  {isExpanded && hasBody && (
                    <div className="px-3 pb-2.5">
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {n.body}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n.id);
                          setExpandedId(null);
                        }}
                        className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Check className="h-3 w-3" />
                        Mark as read
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
