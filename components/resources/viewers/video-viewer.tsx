"use client";

import { useState, useMemo } from "react";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoViewerProps {
  url: string;
  title: string;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/shorts\/([^&\s?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

export function VideoViewer({ url, title }: VideoViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const youtubeId = useMemo(() => {
    if (isYouTubeUrl(url)) {
      return extractYouTubeId(url);
    }
    return null;
  }, [url]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setError("Failed to load video. Please try again.");
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-muted/50 rounded-lg">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-medium">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.open(url, "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading video...</p>
        </div>
      )}

      {youtubeId ? (
        <div className="relative pt-[56.25%]">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={title}
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={handleLoad}
          />
        </div>
      ) : (
        <video
          src={url}
          controls
          className="w-full max-h-[600px]"
          onLoadedData={handleLoad}
          onError={handleError}
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
}
