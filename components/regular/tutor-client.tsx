"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Plus, StopCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TutorStats {
  totalSessions: number;
  topicsCovered: number;
  averageDuration: number;
}

interface TutorSession {
  id: string;
  subject: string;
  topic: string;
  mode: string;
  status: "active" | "ended";
  createdAt: string;
}

export function TutorClient() {
  const router = useRouter();
  const [stats, setStats] = useState<TutorStats | null>(null);
  const [sessions, setSessions] = useState<TutorSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TutorSession | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);

  // Form state
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState("practice");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/tutor/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
    } catch {
      toast.error("Failed to load tutor stats");
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/tutor/sessions");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      toast.error("Failed to load sessions");
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStats(), fetchSessions()]).finally(() =>
      setLoading(false)
    );
  }, [fetchStats, fetchSessions]);

  const createSession = async () => {
    if (!subject.trim() || !topic.trim()) {
      toast.error("Subject and topic are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/ai/tutor/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic, mode }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      const chatId = data.session?.chatId;
      toast.success("Session started — opening chat");
      setCreateDialogOpen(false);

      // Build auto-prompt with session details
      const modeLabel = mode === "socratic" ? "Socratic" : mode === "guided" ? "Guided" : "Practice";
      const autoPrompt = `I'd like to start a ${modeLabel.toLowerCase()} tutoring session on ${subject.trim()} — specifically the topic: ${topic.trim()}. Please begin.`;

      // Navigate to regular page with chat open and auto-prompt
      const params = new URLSearchParams();
      if (chatId) params.set("chatId", chatId);
      params.set("tutorMode", mode);
      params.set("tutorPrompt", encodeURIComponent(autoPrompt));
      router.push(`/regular?${params.toString()}`);
    } catch {
      toast.error("Failed to start session");
    } finally {
      setCreating(false);
    }
  };

  const endSession = async (id: string) => {
    setEndingId(id);
    try {
      const res = await fetch(`/api/ai/tutor/sessions/${id}/end`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to end session");
      toast.success("Session ended");
      await Promise.all([fetchSessions(), fetchStats()]);
    } catch {
      toast.error("Failed to end session");
    } finally {
      setEndingId(null);
    }
  };

  const viewSession = async (id: string) => {
    setDetailLoading(true);
    setDetailDialogOpen(true);
    setSelectedSession(null);
    try {
      const res = await fetch(`/api/ai/tutor/sessions/${id}`);
      if (!res.ok) throw new Error("Failed to fetch session");
      const data = await res.json();
      setSelectedSession(data.session ?? data);
    } catch {
      toast.error("Failed to load session details");
      setDetailDialogOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tutor Sessions</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Start New Session
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">
                  {stats.totalSessions}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Topics Covered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{stats.topicsCovered}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {stats.averageDuration}m
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-muted-foreground">
          <MessageCircle className="h-12 w-12" />
          <p className="text-lg font-medium">No sessions yet</p>
          <p className="text-sm">Start a new session to begin learning</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => viewSession(session.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{session.subject}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-muted-foreground">
                      {session.topic}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline">{session.mode}</Badge>
                    <Badge
                      variant={
                        session.status === "active" ? "default" : "secondary"
                      }
                      className={
                        session.status === "active"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                      }
                    >
                      {session.status}
                    </Badge>
                    <span>{formatDate(session.createdAt)}</span>
                  </div>
                </div>
                {session.status === "active" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => endSession(session.id)}
                    disabled={endingId === session.id}
                  >
                    {endingId === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <StopCircle className="h-4 w-4 mr-1" />
                    )}
                    End
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create session dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Tutor Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Subject</label>
              <Input
                placeholder="e.g. Mathematics"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Topic</label>
              <Input
                placeholder="e.g. Quadratic Equations"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Mode</label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="guided">Guided</SelectItem>
                  <SelectItem value="socratic">Socratic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={createSession}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Start Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Session detail dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedSession ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="font-medium">Subject:</span>
                <span>{selectedSession.subject}</span>
                <span className="font-medium">Topic:</span>
                <span>{selectedSession.topic}</span>
                <span className="font-medium">Mode:</span>
                <Badge variant="outline">{selectedSession.mode}</Badge>
                <span className="font-medium">Status:</span>
                <Badge
                  variant={
                    selectedSession.status === "active"
                      ? "default"
                      : "secondary"
                  }
                  className={
                    selectedSession.status === "active"
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                  }
                >
                  {selectedSession.status}
                </Badge>
                <span className="font-medium">Started:</span>
                <span>{formatDate(selectedSession.createdAt)}</span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
