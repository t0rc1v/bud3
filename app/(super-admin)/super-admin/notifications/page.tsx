"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, Send, Users, Shield, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Audience = "all" | "regulars" | "admins";

const audienceOptions: { value: Audience; label: string; description: string; icon: React.ElementType }[] = [
  { value: "all", label: "All Users", description: "Send to every user on the platform", icon: Users },
  { value: "regulars", label: "Learners Only", description: "Send to all regular/learner accounts", icon: GraduationCap },
  { value: "admins", label: "Admins Only", description: "Send to all admin accounts", icon: Shield },
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

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Compose form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compose Notification</CardTitle>
            <CardDescription>This will appear in each user&apos;s notification bell</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <Button onClick={handleSend} disabled={isSending || !title.trim()} className="w-full">
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
              <p className="text-sm text-center text-green-600 dark:text-green-400">
                Successfully sent to {lastResult.sent} user{lastResult.sent !== 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Audience selector */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Audience
          </h3>
          {audienceOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = audience === opt.value;
            return (
              <Card
                key={opt.value}
                className={`cursor-pointer transition-all ${
                  isSelected ? "ring-2 ring-primary" : "hover:bg-muted/40"
                }`}
                onClick={() => setAudience(opt.value)}
              >
                <CardContent className="py-3 px-4 flex items-start gap-3">
                  <div className={`mt-0.5 rounded-md p-1.5 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{opt.label}</p>
                      {isSelected && <Badge variant="secondary" className="text-[10px]">Selected</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
