"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, Eye, Lock, FileText } from "lucide-react";

interface ImpersonateLevel {
  id: string;
  title: string;
  subjects: {
    id: string;
    name: string;
    topics: {
      id: string;
      title: string;
      resources: {
        id: string;
        title: string;
        type: string;
        isLocked: boolean;
        isUnlocked: boolean;
      }[];
    }[];
  }[];
}

interface ImpersonateModalProps {
  userId: string;
  userEmail: string;
  open: boolean;
  onClose: () => void;
}

export function ImpersonateModal({ userId, userEmail, open, onClose }: ImpersonateModalProps) {
  const [levels, setLevels] = useState<ImpersonateLevel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setError(null);
    setLevels([]);
    setExpandedLevels(new Set());
    setExpandedSubjects(new Set());

    fetch(`/api/admin/impersonate?userId=${encodeURIComponent(userId)}`)
      .then((res) => {
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error || "Failed to load"); });
        return res.json();
      })
      .then((data) => setLevels(data.levels ?? data))
      .catch((e) => setError(e.message ?? "Failed to load content"))
      .finally(() => setIsLoading(false));
  }, [open, userId]);

  const toggleLevel = (id: string) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSubject = (id: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Viewing as
            <Badge variant="secondary" className="font-mono text-xs">{userEmail}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 mt-2 pr-2">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-6 w-3/4 ml-4" />
                  <Skeleton className="h-6 w-1/2 ml-8" />
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive py-4">{error}</p>
          ) : levels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No content visible to this user
            </p>
          ) : (
            <div className="space-y-1 py-1">
              {levels.map((level) => (
                <div key={level.id}>
                  <button
                    onClick={() => toggleLevel(level.id)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/60 text-sm font-semibold"
                  >
                    {expandedLevels.has(level.id)
                      ? <ChevronDown className="h-4 w-4 shrink-0" />
                      : <ChevronRight className="h-4 w-4 shrink-0" />}
                    {level.title}
                    <Badge variant="outline" className="ml-auto text-xs">
                      {level.subjects.length} subjects
                    </Badge>
                  </button>

                  {expandedLevels.has(level.id) && (
                    <div className="ml-4 space-y-1">
                      {level.subjects.map((subject) => (
                        <div key={subject.id}>
                          <button
                            onClick={() => toggleSubject(subject.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 text-sm text-muted-foreground"
                          >
                            {expandedSubjects.has(subject.id)
                              ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                              : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            {subject.name}
                          </button>

                          {expandedSubjects.has(subject.id) && (
                            <div className="ml-4 space-y-1">
                              {subject.topics.map((topic) => (
                                <div key={topic.id} className="space-y-0.5">
                                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    {topic.title}
                                  </p>
                                  {topic.resources.map((res) => (
                                    <div
                                      key={res.id}
                                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs hover:bg-muted/40"
                                    >
                                      <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                                      <span className="flex-1 truncate">{res.title}</span>
                                      <Badge variant="outline" className="text-[10px] capitalize">{res.type}</Badge>
                                      {res.isLocked && !res.isUnlocked && (
                                        <Lock className="h-3 w-3 text-muted-foreground" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
