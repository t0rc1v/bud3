"use client";

import { useState, useEffect } from "react";
import { FileText, Video, Headphones, Image as ImageIcon, ArrowRight, Bookmark, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BookmarkItem {
  bookmarkId: string;
  bookmarkedAt: string;
  resource: {
    id: string;
    title: string;
    description: string;
    type: "notes" | "video" | "audio" | "image";
    isLocked: boolean;
  };
  topicTitle: string;
  subjectName: string;
  levelTitle: string;
}

const TYPE_ICONS = {
  notes: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
};

const TYPE_COLORS: Record<string, string> = {
  notes: "bg-primary/15 text-foreground",
  video: "bg-red-500/15 text-foreground",
  audio: "bg-primary/35 text-foreground",
  image: "bg-primary/50 text-foreground",
};

interface BookmarksTabProps {
  onOpenResource: (resourceId: string) => void;
}

export function BookmarksTab({ onOpenResource }: BookmarksTabProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learner/bookmarks")
      .then((r) => r.json())
      .then((d) => {
        if (d?.bookmarks) setBookmarks(d.bookmarks);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bookmarks.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No bookmarks yet</p>
          <p className="text-sm text-muted-foreground">
            Bookmark resources while viewing them to save them here for quick access.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {bookmarks.map((bm) => {
        const Icon = TYPE_ICONS[bm.resource.type] ?? FileText;
        return (
          <Card
            key={bm.bookmarkId}
            className="cursor-pointer hover:shadow-md transition-all group"
            onClick={() => onOpenResource(bm.resource.id)}
          >
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{bm.resource.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {bm.levelTitle} › {bm.subjectName} › {bm.topicTitle}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${TYPE_COLORS[bm.resource.type]}`}>
                  <Icon className="h-3 w-3 mr-1" />
                  {bm.resource.type.charAt(0).toUpperCase() + bm.resource.type.slice(1)}
                </Badge>
                {bm.resource.isLocked && (
                  <Badge variant="outline" className="text-xs">Locked</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(bm.bookmarkedAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
