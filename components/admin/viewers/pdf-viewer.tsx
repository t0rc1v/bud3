"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

interface PDFViewerProps {
  url: string;
}

// Dynamically import the PDF viewer with SSR disabled
// This prevents DOMMatrix errors during server-side rendering
const PDFViewerContent = dynamic(
  () => import("./pdf-viewer-content").then((mod) => mod.PDFViewerContent),
  {
    ssr: false,
    loading: function Loading() {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-muted/50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading PDF viewer...</p>
        </div>
      );
    },
  }
);

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-96 bg-muted/50 rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}

export function PDFViewer({ url }: PDFViewerProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PDFViewerContent url={url} />
    </Suspense>
  );
}
