"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  FileText,
  Video,
  Headphones,
  Image as ImageIcon,
  ExternalLink,
  AlertCircle,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  Circle,
  ThumbsUp,
  ThumbsDown,
  StickyNote,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PDFViewer } from "./viewers/pdf-viewer";
import { VideoViewer } from "./viewers/video-viewer";
import { AudioViewer } from "./viewers/audio-viewer";
import { ImageViewer } from "./viewers/image-viewer";
import { EditResourceForm } from "@/components/forms/edit-resource-form";
import { deleteResource } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import type { ResourceWithRelations, ResourceType } from "@/lib/types";

interface ResourceViewerProps {
  resource: ResourceWithRelations;
  onBack: () => void;
  subjects: { id: string; name: string; level: { id: string; title: string } }[];
  topics: { id: string; title: string; subjectId: string }[];
  initialEditMode?: boolean;
  /** When provided, enables learner features (bookmark, complete, rate, notes) */
  showLearnerActions?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const TYPE_ICONS: Record<ResourceType, typeof FileText> = {
  notes: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
};

const TYPE_COLORS: Record<ResourceType, string> = {
  notes: "bg-primary/15 text-foreground",
  video: "bg-red-500/15 text-foreground",
  audio: "bg-primary/35 text-foreground",
  image: "bg-primary/50 text-foreground",
};

export function ResourceViewer({
  resource,
  onBack,
  subjects,
  topics,
  initialEditMode = false,
  showLearnerActions = false,
  canEdit = true,
  canDelete = true,
}: ResourceViewerProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Learner state
  const [progressStatus, setProgressStatus] = useState<"not_started" | "started" | "completed">("not_started");
  const [isCompletingLoading, setIsCompletingLoading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);
  const [userRating, setUserRating] = useState<"up" | "down" | null>(null);
  const [ratingCounts, setRatingCounts] = useState<{ up: number; down: number }>({ up: 0, down: 0 });
  const [isRatingLoading, setIsRatingLoading] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteSaved, setNoteSaved] = useState(true);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  // Fetch learner state on mount
  useEffect(() => {
    if (!showLearnerActions) return;
    const resourceId = resource.id;

    Promise.all([
      fetch(`/api/learner/progress?resourceId=${resourceId}`).then((r) => r.json()),
      fetch(`/api/learner/bookmarks`).then((r) => r.json()),
      fetch(`/api/learner/ratings?resourceId=${resourceId}`).then((r) => r.json()),
      fetch(`/api/learner/notes?resourceId=${resourceId}`).then((r) => r.json()),
    ]).then(([prog, bm, rat, note]) => {
      if (prog?.progress?.status) setProgressStatus(prog.progress.status);
      if (bm?.bookmarks) {
        setIsBookmarked(bm.bookmarks.some((b: { resource: { id: string } }) => b.resource.id === resourceId));
      }
      if (rat?.counts) setRatingCounts(rat.counts);
      if (rat?.userRating !== undefined) setUserRating(rat.userRating);
      if (note?.note?.content) setNoteContent(note.note.content);
    }).catch(() => {});
  }, [resource.id, showLearnerActions]);

  const handleMarkComplete = useCallback(async () => {
    setIsCompletingLoading(true);
    try {
      const res = await fetch("/api/learner/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: resource.id, status: "completed" }),
      });
      if (res.ok) setProgressStatus("completed");
    } finally {
      setIsCompletingLoading(false);
    }
  }, [resource.id]);

  const handleToggleBookmark = useCallback(async () => {
    setIsBookmarkLoading(true);
    try {
      const res = await fetch("/api/learner/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: resource.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsBookmarked(data.bookmarked);
      }
    } finally {
      setIsBookmarkLoading(false);
    }
  }, [resource.id]);

  const handleRate = useCallback(async (newRating: "up" | "down") => {
    const effectiveRating = userRating === newRating ? null : newRating;
    setIsRatingLoading(true);
    try {
      const res = await fetch("/api/learner/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: resource.id, rating: effectiveRating }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserRating(data.rating);
        setRatingCounts(data.counts);
      }
    } finally {
      setIsRatingLoading(false);
    }
  }, [resource.id, userRating]);

  const handleSaveNote = useCallback(async () => {
    setIsSavingNote(true);
    try {
      await fetch("/api/learner/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: resource.id, content: noteContent }),
      });
      setNoteSaved(true);
    } finally {
      setIsSavingNote(false);
    }
  }, [resource.id, noteContent]);

  const TypeIcon = TYPE_ICONS[resource.type];
  const typeColorClass = TYPE_COLORS[resource.type];

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteResource(resource.id);
      router.refresh();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete resource");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setIsEditing(false);
    router.refresh();
  };

  const renderViewer = () => {
    switch (resource.type) {
      case "notes":
        return <PDFViewer url={resource.url} />;
      case "video":
        return <VideoViewer url={resource.url} title={resource.title} />;
      case "audio":
        return <AudioViewer url={resource.url} title={resource.title} />;
      case "image":
        return (
          <ImageViewer
            url={resource.url}
            title={resource.title}
            thumbnailUrl={resource.thumbnailUrl}
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Unsupported resource type</p>
          </div>
        );
    }
  };

  if (isEditing) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Viewer
          </Button>
        </CardHeader>
        <CardContent>
          <EditResourceForm
            resource={resource}
            subjects={subjects}
            topics={topics}
            onSuccess={handleEditSuccess}
            onCancel={() => setIsEditing(false)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      {/* Header */}
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          {/* Top row: Back button and actions */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to list
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(resource.url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDeleting}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Resource</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete &quot;{resource.title}&quot;? This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Title and badge */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{resource.title}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={typeColorClass}>
                  <TypeIcon className="h-3 w-3 mr-1" />
                  {resource.type.charAt(0).toUpperCase() + resource.type.slice(1)}
                </Badge>
                {resource.subject && (
                  <Badge variant="outline">{resource.subject.name}</Badge>
                )}
                {resource.topic && (
                  <Badge variant="secondary">{resource.topic.title}</Badge>
                )}
                {showLearnerActions && progressStatus === "completed" && (
                  <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
            </div>

            {/* Learner action buttons */}
            {showLearnerActions && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Bookmark */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleToggleBookmark}
                  disabled={isBookmarkLoading}
                  title={isBookmarked ? "Remove bookmark" : "Bookmark this resource"}
                >
                  {isBookmarked
                    ? <BookmarkCheck className="h-4 w-4 text-primary" />
                    : <Bookmark className="h-4 w-4" />
                  }
                </Button>

                {/* Mark as complete */}
                {progressStatus !== "completed" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={handleMarkComplete}
                    disabled={isCompletingLoading}
                  >
                    {isCompletingLoading
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Circle className="h-3 w-3" />
                    }
                    Mark Complete
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-green-600 dark:text-green-400 pointer-events-none">
                    <CheckCircle className="h-3 w-3" />
                    Completed
                  </Button>
                )}

                {/* Rating */}
                <div className="flex items-center gap-0.5 border rounded-md px-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7", userRating === "up" && "text-green-600 dark:text-green-400")}
                    onClick={() => handleRate("up")}
                    disabled={isRatingLoading}
                    title="Helpful"
                  >
                    <ThumbsUp className={cn("h-3.5 w-3.5", userRating === "up" && "fill-current")} />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[14px] text-center">{ratingCounts.up}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7", userRating === "down" && "text-red-500")}
                    onClick={() => handleRate("down")}
                    disabled={isRatingLoading}
                    title="Not helpful"
                  >
                    <ThumbsDown className={cn("h-3.5 w-3.5", userRating === "down" && "fill-current")} />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[14px] text-center">{ratingCounts.down}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Error display */}
      {error && (
        <div className="mx-6 mb-4 p-3 rounded-md bg-destructive/10 text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Description section */}
      <CardContent className="pt-0">
        <Collapsible
          open={isDescriptionOpen}
          onOpenChange={setIsDescriptionOpen}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start">
              {isDescriptionOpen ? (
                <ChevronUp className="h-4 w-4 mr-2" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-2" />
              )}
              Description
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {resource.description || "No description provided."}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Main content viewer */}
        <div className="mt-6">{renderViewer()}</div>

        {/* Notes panel (learner only) */}
        {showLearnerActions && (
          <div className="mt-6">
            <Collapsible open={isNotesOpen} onOpenChange={setIsNotesOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  {isNotesOpen
                    ? <ChevronUp className="h-4 w-4 mr-2" />
                    : <ChevronDown className="h-4 w-4 mr-2" />
                  }
                  <StickyNote className="h-4 w-4 mr-2" />
                  My Notes
                  {noteContent && (
                    <Badge variant="secondary" className="ml-2 text-xs">Saved</Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-2">
                  <Textarea
                    placeholder="Add your private notes for this resource…"
                    value={noteContent}
                    onChange={(e) => {
                      setNoteContent(e.target.value);
                      setNoteSaved(false);
                    }}
                    onBlur={handleSaveNote}
                    className="min-h-[100px] resize-none text-sm"
                    maxLength={4000}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{noteContent.length}/4000</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleSaveNote}
                      disabled={isSavingNote || noteSaved}
                    >
                      {isSavingNote
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Save className="h-3 w-3" />
                      }
                      {noteSaved ? "Saved" : "Save"}
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Metadata footer */}
        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
          Created: {new Date(resource.createdAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}

export function ResourceViewerSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <Skeleton className="h-8 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-9 w-full mb-2" />
        <Skeleton className="h-20 w-full mb-6" />
        <Skeleton className="h-96 w-full" />
      </CardContent>
    </Card>
  );
}
