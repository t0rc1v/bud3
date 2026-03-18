"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, Send, Users, Shield, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Audience = "all" | "regulars" | "admins";

const audienceOptions: { value: Audience; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "All Users", icon: Users },
  { value: "regulars", label: "Learners", icon: GraduationCap },
  { value: "admins", label: "Admins", icon: Shield },
];

export default function NotificationsPage() {
  const [audience, setAudience] = useState<Audience>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number } | null>(null);

  const handleSend = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSending(true);
    setLastResult(null);

    try {
      const res = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          title: title.trim(),
          body: body.trim() || undefined,
          type: "announcement",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send notifications");
        return;
      }

      toast.success(`Notification sent to ${data.sent} user${data.sent !== 1 ? "s" : ""}`);
      setLastResult({ sent: data.sent });
      window.dispatchEvent(new CustomEvent("notifications:refresh"));
      setTitle("");
      setBody("");
    } catch {
      toast.error("Failed to send notifications");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Send Notifications
        </h1>
        <p className="text-muted-foreground mt-1">
          Broadcast announcements to users on the platform
        </p>
      </div>

      {/* Full-width compose card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compose Notification</CardTitle>
          <CardDescription>This will appear in each user&apos;s notification bell</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Audience selector - compact inline */}
          <div className="space-y-2">
            <Label>Audience</Label>
            <div className="flex gap-2">
              {audienceOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = audience === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAudience(opt.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. New content available!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
            />
            <p className="text-xs text-muted-foreground">{title.length}/255</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Body (optional)</Label>
            <Textarea
              id="body"
              placeholder="Add more details about the notification..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{body.length}/2000</p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSend} disabled={isSending || !title.trim()}>
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Notification
                </>
              )}
            </Button>

            {lastResult && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Sent to {lastResult.sent} user{lastResult.sent !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
