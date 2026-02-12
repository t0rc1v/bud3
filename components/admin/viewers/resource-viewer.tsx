"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Edit,
  ExternalLink,
  Trash2,
  FileText,
  Video,
  Image as ImageIcon,
  Headphones,
  MoreVertical,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PDFViewer } from "./pdf-viewer";
import { VideoViewer } from "./video-viewer";
import { AudioViewer } from "./audio-viewer";
import { ImageViewer } from "./image-viewer";
import { EditResourceForm } from "../edit-resource-form";
import { deleteResource, updateResource } from "@/lib/actions/admin";
import type {
  ResourceWithRelations,
  SubjectWithTopicsAndLevel,
  TopicWithResources,
  ResourceType,
} from "@/lib/types";

interface ResourceViewerProps {
  resource: ResourceWithRelations;
  onBack: () => void;
  subjects: SubjectWithTopicsAndLevel[];
  topics: TopicWithResources[];
  initialEditMode?: boolean;
}

const typeIcons: Record<ResourceType, React.ReactNode> = {
  notes: <FileText className="h-5 w-5" />,
  video: <Video className="h-5 w-5" />,
  audio: <Headphones className="h-5 w-5" />,
  image: <ImageIcon className="h-5 w-5" />,
};

const typeLabels: Record<ResourceType, string> = {
  notes: "PDF / Document",
  video: "Video",
  audio: "Audio",
  image: "Image",
};

export function ResourceViewer({
  resource,
  onBack,
  subjects,
  topics,
  initialEditMode = false,
}: ResourceViewerProps) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this resource?")) {
      setIsDeleting(true);
      try {
        await deleteResource(resource.id);
        onBack();
      } catch (error) {
        console.error("Failed to delete resource:", error);
        alert("Failed to delete resource. Please try again.");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const renderContent = () => {
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
          <div className="flex flex-col items-center justify-center h-96 bg-muted/50 rounded-lg">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Unknown resource type</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => window.open(resource.url, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Resource
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              {typeIcons[resource.type]}
              <h2 className="text-xl font-bold">{resource.title}</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Badge variant="secondary">{typeLabels[resource.type]}</Badge>
              {resource.subject && (
                <>
                  <span>•</span>
                  <span>{resource.subject.name}</span>
                </>
              )}
              {resource.topic && (
                <>
                  <span>•</span>
                  <span>{resource.topic.title}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(resource.url, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open
          </Button>

          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Resource</DialogTitle>
              </DialogHeader>
              <EditResourceForm
                resource={resource}
                subjects={subjects}
                topics={topics}
                onSuccess={() => setIsEditing(false)}
                onCancel={() => setIsEditing(false)}
              />
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Resource
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete Resource"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Resource Info */}
      {resource.description && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{resource.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Content Viewer */}
      <Card>
        <CardContent className="p-6">
          {renderContent()}
        </CardContent>
      </Card>

      {/* Metadata */}
      <div className="text-sm text-muted-foreground">
        <p>Created: {new Date(resource.createdAt).toLocaleDateString()}</p>
        {resource.updatedAt && (
          <p>Updated: {new Date(resource.updatedAt).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  );
}

export function ResourceViewerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
