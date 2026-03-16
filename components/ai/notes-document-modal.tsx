"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Printer, Download, Youtube, Image as ImageIcon } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { jsPDF } from "jspdf";
import { MarkdownRenderer } from "./markdown-renderer";

interface NotesSection {
  heading: string;
  content: string;
  type: "introduction" | "main" | "summary" | "practice";
}

interface KeyTerm {
  term: string;
  definition: string;
}

interface YoutubeVideo {
  title: string;
  url: string;
  description: string;
}

interface NoteImage {
  url: string;
  caption: string;
  alt: string;
}

interface NotesDocumentData {
  success: boolean;
  format: string;
  notesDocumentId?: string;
  metadata: {
    title: string;
    subject: string;
    topic?: string | null;
    level?: string | null;
    sectionCount: number;
    keyTermCount: number;
    hasVideos: boolean;
    hasImages: boolean;
    createdAt: string;
  };
  document: {
    title: string;
    subject: string;
    topic?: string | null;
    level?: string | null;
    summary?: string;
    sections: NotesSection[];
    keyTerms: KeyTerm[];
    youtubeVideos: YoutubeVideo[];
    images: NoteImage[];
  };
  exportOptions?: {
    canExportPDF: boolean;
    canPrint: boolean;
  };
}

// Strips basic markdown for plain-text PDF output
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "")
    .trim();
}

// Extract YouTube video ID from URL
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

const sectionTypeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  introduction: "default",
  main: "secondary",
  summary: "outline",
  practice: "outline",
};

// Print-only layout
function NotesDocumentPrint({ data }: { data: NotesDocumentData }) {
  const doc = data.document;
  return (
    <div className="space-y-6 p-8 bg-white text-black">
      {/* Header */}
      <div className="text-center border-b pb-4">
        <h1 className="text-2xl font-bold">{doc.title}</h1>
        <p className="text-sm mt-1">
          {doc.subject}
          {doc.topic ? ` • ${doc.topic}` : ""}
          {doc.level ? ` • ${doc.level}` : ""}
        </p>
      </div>

      {/* Summary */}
      {doc.summary && (
        <div className="bg-gray-50 p-4 rounded">
          <h2 className="font-bold mb-2">Summary</h2>
          <p className="text-sm whitespace-pre-wrap">{doc.summary}</p>
        </div>
      )}

      {/* Sections */}
      {doc.sections.map((section, i) => (
        <div key={i} className="space-y-2">
          <h2 className="font-bold text-lg border-b pb-1">{section.heading}</h2>
          <div className="text-sm whitespace-pre-wrap">{stripMarkdown(section.content)}</div>
        </div>
      ))}

      {/* Key Terms */}
      {doc.keyTerms.length > 0 && (
        <div>
          <h2 className="font-bold text-lg border-b pb-1 mb-3">Key Terms</h2>
          <div className="grid grid-cols-2 gap-3">
            {doc.keyTerms.map((kt, i) => (
              <div key={i} className="border p-2 rounded text-sm">
                <span className="font-semibold">{kt.term}:</span> {kt.definition}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* YouTube References */}
      {doc.youtubeVideos.length > 0 && (
        <div>
          <h2 className="font-bold text-lg border-b pb-1 mb-2">Video Resources</h2>
          <ul className="space-y-1 text-sm">
            {doc.youtubeVideos.map((v, i) => (
              <li key={i}>
                <span className="font-medium">{v.title}</span> — {v.url}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function NotesDocumentModalTrigger({ data }: { data: NotesDocumentData }) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const doc = data.document;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: data.metadata.title,
  });

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const addText = (
        text: string,
        fontSize: number,
        bold: boolean,
        color: [number, number, number] = [0, 0, 0]
      ): number => {
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(text, contentWidth);
        if (y + lines.length * fontSize * 0.45 > 280) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(lines, margin, y);
        return lines.length * fontSize * 0.45 + 3;
      };

      // Title
      y += addText(doc.title, 18, true);
      y += addText(
        [doc.subject, doc.topic, doc.level].filter(Boolean).join(" • "),
        11,
        false,
        [80, 80, 80]
      );
      pdf.setDrawColor(0);
      pdf.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 10;

      // Summary
      if (doc.summary) {
        y += addText("Summary", 13, true);
        y += addText(doc.summary, 10, false, [60, 60, 60]);
        y += 5;
      }

      // Sections
      for (const section of doc.sections) {
        if (y > 260) { pdf.addPage(); y = margin; }
        y += addText(section.heading, 13, true);
        y += addText(stripMarkdown(section.content), 10, false);
        y += 6;
      }

      // Key Terms
      if (doc.keyTerms.length > 0) {
        if (y > 240) { pdf.addPage(); y = margin; }
        pdf.setDrawColor(0);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 8;
        y += addText("Key Terms", 14, true);
        for (const kt of doc.keyTerms) {
          if (y > 275) { pdf.addPage(); y = margin; }
          y += addText(`${kt.term}: ${kt.definition}`, 10, false);
        }
        y += 5;
      }

      // Video Resources
      if (doc.youtubeVideos.length > 0) {
        if (y > 250) { pdf.addPage(); y = margin; }
        y += addText("Video Resources", 13, true);
        for (const v of doc.youtubeVideos) {
          if (y > 275) { pdf.addPage(); y = margin; }
          y += addText(`${v.title} — ${v.url}`, 9, false, [60, 60, 60]);
        }
      }

      const filename = doc.title.replace(/[^a-zA-Z0-9\-_\s]/g, "_").substring(0, 50);
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!data.success) {
    return (
      <div className="p-3 border rounded-lg bg-red-50 text-red-600 text-sm">
        Failed to create notes document
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="w-full text-left bg-card hover:bg-accent border border-border rounded-lg p-3 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{data.metadata.title}</p>
                <p className="text-xs text-muted-foreground">
                  {data.metadata.sectionCount} sections • {data.metadata.subject}
                  {data.metadata.topic ? ` • ${data.metadata.topic}` : ""}
                </p>
              </div>
              <BookOpen className="h-4 w-4 text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {data.metadata.title}
                </DialogTitle>
                <DialogDescription>
                  {data.metadata.subject}
                  {data.metadata.topic ? ` • ${data.metadata.topic}` : ""}
                  {data.metadata.level ? ` • ${data.metadata.level}` : ""}
                </DialogDescription>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={exportToPDF}
                  disabled={isExporting}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? "Exporting..." : "Export PDF"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0">
            <Tabs defaultValue="notes" className="h-full flex flex-col">
              <TabsList className="mx-6 mt-4 w-auto self-start">
                <TabsTrigger value="notes">Notes</TabsTrigger>
                {(doc.youtubeVideos.length > 0 || doc.images.length > 0) && (
                  <TabsTrigger value="media">
                    Media
                    {data.metadata.hasVideos && <Youtube className="h-3 w-3 ml-1" />}
                    {data.metadata.hasImages && <ImageIcon className="h-3 w-3 ml-1" />}
                  </TabsTrigger>
                )}
                {doc.keyTerms.length > 0 && (
                  <TabsTrigger value="terms">Key Terms ({doc.keyTerms.length})</TabsTrigger>
                )}
              </TabsList>

              {/* Notes Tab */}
              <TabsContent value="notes" className="flex-1 overflow-y-auto px-6 pb-6 mt-4 space-y-6">
                {doc.summary && (
                  <div className="bg-muted/40 rounded-lg p-4 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground mb-1">Overview</p>
                    <p>{doc.summary}</p>
                  </div>
                )}
                {doc.sections.map((section, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{section.heading}</h3>
                      <Badge variant={sectionTypeBadgeVariant[section.type] ?? "outline"} className="text-xs capitalize">
                        {section.type}
                      </Badge>
                    </div>
                    <MarkdownRenderer content={section.content} />
                  </div>
                ))}
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media" className="flex-1 overflow-y-auto px-6 pb-6 mt-4 space-y-6">
                {doc.youtubeVideos.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-red-500" /> Video Resources
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {doc.youtubeVideos.map((video, i) => {
                        const videoId = getYouTubeId(video.url);
                        return (
                          <div key={i} className="border rounded-lg overflow-hidden">
                            {videoId && (
                              <img
                                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                                alt={video.title}
                                className="w-full h-40 object-cover"
                              />
                            )}
                            <div className="p-3">
                              <p className="font-medium text-sm">{video.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">{video.description}</p>
                              <a
                                href={video.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary mt-2 inline-block hover:underline"
                              >
                                Watch on YouTube →
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {doc.images.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" /> Images
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                      {doc.images.map((img, i) => (
                        <div key={i} className="border rounded-lg overflow-hidden">
                          <img
                            src={img.url}
                            alt={img.alt}
                            className="w-full h-36 object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <p className="p-2 text-xs text-muted-foreground">{img.caption}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {doc.youtubeVideos.length === 0 && doc.images.length === 0 && (
                  <p className="text-sm text-muted-foreground">No media resources in this document.</p>
                )}
              </TabsContent>

              {/* Key Terms Tab */}
              <TabsContent value="terms" className="flex-1 overflow-y-auto px-6 pb-6 mt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {doc.keyTerms.map((kt, i) => (
                    <div key={i} className="border rounded-lg p-3">
                      <p className="font-semibold text-sm">{kt.term}</p>
                      <p className="text-xs text-muted-foreground mt-1">{kt.definition}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Hidden print content */}
          <div ref={printRef} className="hidden print:block">
            <NotesDocumentPrint data={data} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
