"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  FileText,
  Video,
  Headphones,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  AlertCircle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PDFViewer } from "@/components/admin/viewers/pdf-viewer";
import { VideoViewer } from "@/components/admin/viewers/video-viewer";
import { AudioViewer } from "@/components/admin/viewers/audio-viewer";
import { ImageViewer } from "@/components/admin/viewers/image-viewer";

interface ReadOnlyResourceViewerProps {
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  resourceDescription?: string;
  subjectName?: string;
  topicTitle?: string;
  onBack: () => void;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  notes: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
};

const TYPE_COLORS: Record<string, string> = {
  notes: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  video: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  audio: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  image: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
};

export function ReadOnlyResourceViewer({
  resourceId,
  resourceTitle,
  resourceType,
  resourceDescription,
  subjectName,
  topicTitle,
  onBack,
}: ReadOnlyResourceViewerProps) {
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const TypeIcon = TYPE_ICONS[resourceType] || FileText;
  const typeColorClass = TYPE_COLORS[resourceType] || "bg-gray-100 text-gray-800";

  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/content/proxy?resourceId=${resourceId}`);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setContentUrl(url);
        } else if (response.status === 403) {
          const data = await response.json();
          setError(data.error || "Content is locked");
        } else {
          setError("Failed to load content");
        }
      } catch (err) {
        console.error("Error loading content:", err);
        setError("Failed to load content");
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();

    return () => {
      if (contentUrl) {
        URL.revokeObjectURL(contentUrl);
      }
    };
  }, [resourceId]);

  const renderViewer = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-muted/50 rounded-lg">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading content...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-muted/50 rounded-lg">
          <Lock className="h-12 w-12 text-destructive mb-4" />
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            This content may be locked or unavailable
          </p>
        </div>
      );
    }

    if (!contentUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-muted/50 rounded-lg">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No content available</p>
        </div>
      );
    }

    switch (resourceType) {
      case "notes":
        return <PDFViewer url={contentUrl} />;
      case "video":
        return <VideoViewer url={contentUrl} title={resourceTitle} />;
      case "audio":
        return <AudioViewer url={contentUrl} title={resourceTitle} />;
      case "image":
        return (
          <ImageViewer
            url={contentUrl}
            title={resourceTitle}
            thumbnailUrl={null}
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

  return (
    <Card className="w-full">
      {/* Header */}
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          {/* Top row: Back button */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to content
            </Button>
          </div>

          {/* Title and badges */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{resourceTitle}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={typeColorClass}>
                  <TypeIcon className="h-3 w-3 mr-1" />
                  {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}
                </Badge>
                {subjectName && (
                  <Badge variant="outline">{subjectName}</Badge>
                )}
                {topicTitle && (
                  <Badge variant="secondary">{topicTitle}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Main content */}
      <CardContent className="pt-0">
        {/* Description */}
        {resourceDescription && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {resourceDescription}
            </p>
          </div>
        )}

        {/* Content viewer */}
        <div className="mt-4">{renderViewer()}</div>
      </CardContent>
    </Card>
  );
}

export function ReadOnlyResourceViewerSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-32" />
          </div>
          <Skeleton className="h-8 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-96 w-full" />
      </CardContent>
    </Card>
  );
}
