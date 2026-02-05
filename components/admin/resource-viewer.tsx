"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { EditResourceForm } from "./edit-resource-form";
import { deleteResource } from "@/lib/actions/admin";
import type { ResourceWithRelations, ResourceType } from "@/lib/types";

interface ResourceViewerProps {
  resource: ResourceWithRelations;
  onBack: () => void;
  subjects: { id: string; name: string; grade: { id: string; title: string } }[];
  topics: { id: string; title: string; subjectId: string }[];
  initialEditMode?: boolean;
}

const TYPE_ICONS: Record<ResourceType, typeof FileText> = {
  notes: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
};

const TYPE_COLORS: Record<ResourceType, string> = {
  notes: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  video: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  audio: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  image: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
};

export function ResourceViewer({
  resource,
  onBack,
  subjects,
  topics,
  initialEditMode = false,
}: ResourceViewerProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
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
                <Badge variant="outline">{resource.subject.name}</Badge>
                {resource.topic && (
                  <Badge variant="secondary">{resource.topic.title}</Badge>
                )}
              </div>
            </div>
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
