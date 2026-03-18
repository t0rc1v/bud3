"use client";

import { useState, useEffect, useCallback } from "react";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function useNotifications(pollingInterval = 30_000) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount((data.notifications || []).length);
    } catch {
      // silently ignore
    }
  }, []);

  const markRead = useCallback(async (notificationId: string) => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silently ignore
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, pollingInterval);

    const handleRefresh = () => fetchNotifications();
    window.addEventListener("notifications:refresh", handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications:refresh", handleRefresh);
    };
  }, [fetchNotifications, pollingInterval]);

  return { notifications, unreadCount, markRead, markAllRead, refresh: fetchNotifications };
}
