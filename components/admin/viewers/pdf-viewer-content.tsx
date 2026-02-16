"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

// Configure PDF.js worker (uses CDN by default)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerContentProps {
  url: string;
}

export function PDFViewerContent({ url }: PDFViewerContentProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [visiblePages, setVisiblePages] = useState<number[]>([1, 2, 3]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const handleDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    // Show first 3 pages or all if less than 3
    const initialPages = Array.from(
      { length: Math.min(3, numPages) },
      (_, i) => i + 1
    );
    setVisiblePages(initialPages);
  }, []);

  const handleDocumentLoadError = useCallback((error: Error) => {
    console.error("Failed to load PDF:", error);
    setIsLoading(false);
    setError("Failed to load PDF. Please try downloading the file.");
  }, []);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5));
  };

  const handleReset = () => {
    setScale(1);
  };

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!containerRef.current || numPages === 0) return;

    const container = containerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollBottom = scrollTop + clientHeight;
    const scrollThreshold = scrollHeight - 300; // Load 300px before bottom

    if (scrollBottom >= scrollThreshold) {
      setVisiblePages((prev) => {
        const lastVisible = prev[prev.length - 1];
        if (lastVisible < numPages) {
          // Load next 2 pages
          const nextPages = Array.from(
            { length: Math.min(2, numPages - lastVisible) },
            (_, i) => lastVisible + i + 1
          );
          return [...prev, ...nextPages];
        }
        return prev;
      });
    }
  }, [numPages]);

  // Add scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-muted/50 rounded-lg p-6">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-medium text-center">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.open(url, "_blank")}
        >
          Download PDF
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 2}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(url, "_blank")}
        >
          Download
        </Button>
      </div>

      {/* PDF Viewer */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto bg-muted/30 rounded-lg"
        style={{
          WebkitOverflowScrolling: "touch", // Smooth scrolling on iOS
        }}
      >
        <Document
          file={url}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={handleDocumentLoadError}
          loading={
            <div className="flex flex-col items-center justify-center py-8 bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          }
          className="flex flex-col items-center min-h-full pb-4"
        >
          {visiblePages.map((pageNumber) => (
            <div
              key={pageNumber}
              className="mb-2 last:mb-0 shadow-sm"
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                width={isMobile ? undefined : 600}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading={
                  <div className="w-[600px] h-[800px] bg-muted/50 animate-pulse rounded" />
                }
                error={
                  <div className="w-[600px] h-[800px] flex items-center justify-center bg-muted/30 rounded">
                    <p className="text-sm text-muted-foreground">
                      Failed to load page {pageNumber}
                    </p>
                  </div>
                }
              />
            </div>
          ))}

          {/* Loading more indicator */}
          {visiblePages.length < numPages && (
            <div className="py-4 flex flex-col items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">
                Loading more pages ({visiblePages.length} / {numPages})...
              </p>
            </div>
          )}
        </Document>
      </div>
    </div>
  );
}
