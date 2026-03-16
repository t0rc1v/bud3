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
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Printer, Download, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { jsPDF } from "jspdf";

interface ExamQuestion {
  id: string;
  type: "multiple_choice" | "true_false" | "short_answer" | "essay" | "structured" | "fill_in_blank";
  text: string;
  options?: string[];
  marks: number;
}

interface ExamSection {
  sectionTitle: string;
  sectionInstructions: string;
  marks: number;
  questions: ExamQuestion[];
}

interface AnswerKeyItem {
  questionId: string;
  sectionTitle: string;
  correctAnswer: string;
  marks: number;
  explanation: string | null;
}

interface ExamData {
  success: boolean;
  format: string;
  examId?: string;
  metadata: {
    title: string;
    subject: string;
    level: string;
    totalMarks: number;
    timeLimit?: number | null;
    sectionCount: number;
    questionCount: number;
    includeAnswerKey: boolean;
    patternAnalysis?: string | null;
    createdAt: string;
  };
  exam: {
    title: string;
    subject: string;
    level: string;
    instructions: string;
    totalMarks: number;
    timeLimit?: number | null;
    sections: ExamSection[];
  };
  answerKey?: AnswerKeyItem[] | null;
  exportOptions?: {
    canExportPDF: boolean;
    canPrint: boolean;
  };
}

const questionTypeLabel: Record<string, string> = {
  multiple_choice: "Multiple Choice",
  true_false: "True / False",
  short_answer: "Short Answer",
  essay: "Essay",
  structured: "Structured",
  fill_in_blank: "Fill in the Blank",
};

// Print layout component
function ExamPrint({
  data,
  showAnswerKey,
}: {
  data: ExamData;
  showAnswerKey: boolean;
}) {
  const { exam } = data;
  let qCounter = 1;
  return (
    <div className="p-8 bg-white text-black space-y-6">
      {/* Cover */}
      <div className="text-center border-b pb-4">
        <h1 className="text-2xl font-bold">{exam.title}</h1>
        <p className="text-sm mt-1">
          {exam.subject} • {exam.level}
        </p>
        <p className="text-sm">
          Total Marks: {exam.totalMarks}
          {exam.timeLimit ? ` • Time: ${exam.timeLimit} minutes` : ""}
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 p-4 rounded">
        <p className="font-bold mb-1">Instructions:</p>
        <p className="text-sm whitespace-pre-wrap">{exam.instructions}</p>
      </div>

      {/* Sections */}
      {exam.sections.map((section, si) => (
        <div key={si} className="space-y-4">
          <h2 className="font-bold text-lg border-b pb-1">
            {section.sectionTitle}{" "}
            <span className="font-normal text-sm">({section.marks} marks)</span>
          </h2>
          <p className="text-sm italic">{section.sectionInstructions}</p>
          <div className="space-y-5">
            {section.questions.map((q, qi) => {
              const num = qCounter++;
              return (
                <div key={qi} className="space-y-2">
                  <p className="text-sm">
                    <span className="font-semibold">{num}. </span>
                    {q.text}{" "}
                    <span className="text-gray-500 text-xs">({q.marks} mark{q.marks !== 1 ? "s" : ""})</span>
                  </p>
                  {q.options && q.options.length > 0 && (
                    <div className="ml-6 space-y-1">
                      {q.options.map((opt, oi) => (
                        <p key={oi} className="text-sm">
                          {String.fromCharCode(65 + oi)}. {opt}
                        </p>
                      ))}
                    </div>
                  )}
                  {/* Answer space */}
                  {(q.type === "short_answer" || q.type === "fill_in_blank") && (
                    <div className="ml-6 border-b-2 border-dashed border-gray-400 min-h-[40px]" />
                  )}
                  {(q.type === "essay" || q.type === "structured") && (
                    <div className="ml-6 border border-dashed border-gray-300 min-h-[80px] rounded" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Answer Key */}
      {showAnswerKey && data.answerKey && data.answerKey.length > 0 && (
        <div className="mt-8 border-t pt-6">
          <h2 className="text-xl font-bold text-center mb-4">{exam.title} — ANSWER KEY</h2>
          <div className="space-y-2">
            {data.answerKey.map((item, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="font-semibold min-w-[24px]">{i + 1}.</span>
                <div>
                  <span className="text-green-700 font-medium">{item.correctAnswer}</span>
                  <span className="text-gray-500 ml-2">({item.marks} mark{item.marks !== 1 ? "s" : ""})</span>
                  {item.explanation && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.explanation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ExamModalTrigger({ data }: { data: ExamData }) {
  const [open, setOpen] = useState(false);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [showPatternAnalysis, setShowPatternAnalysis] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { exam, metadata } = data;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: metadata.title,
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
        color: [number, number, number] = [0, 0, 0],
        indent = 0
      ): number => {
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(text, contentWidth - indent);
        if (y + lines.length * fontSize * 0.45 > 280) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(lines, margin + indent, y);
        return lines.length * fontSize * 0.45 + 3;
      };

      // Cover page
      y += addText(exam.title, 18, true, [0, 0, 0]);
      y += addText(`${exam.subject} • ${exam.level}`, 11, false, [80, 80, 80]);
      y += addText(
        `Total Marks: ${exam.totalMarks}${exam.timeLimit ? ` • Time Allowed: ${exam.timeLimit} minutes` : ""}`,
        11,
        false,
        [80, 80, 80]
      );
      pdf.setDrawColor(0);
      pdf.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 10;

      // Instructions
      y += addText("Instructions", 13, true);
      y += addText(exam.instructions, 10, false, [60, 60, 60]);
      y += 8;

      // Sections
      let questionNumber = 1;
      for (const section of exam.sections) {
        if (y > 250) { pdf.addPage(); y = margin; }
        y += addText(`${section.sectionTitle} (${section.marks} marks)`, 13, true);
        y += addText(section.sectionInstructions, 10, false, [100, 100, 100]);
        y += 4;

        for (const q of section.questions) {
          if (y > 265) { pdf.addPage(); y = margin; }
          y += addText(`${questionNumber}. ${q.text} (${q.marks} mark${q.marks !== 1 ? "s" : ""})`, 10, false);
          questionNumber++;

          if (q.options && q.options.length > 0) {
            for (let oi = 0; oi < q.options.length; oi++) {
              if (y > 275) { pdf.addPage(); y = margin; }
              y += addText(`${String.fromCharCode(65 + oi)}. ${q.options[oi]}`, 10, false, [0, 0, 0], 8);
            }
          }

          // Answer space
          if (q.type === "short_answer" || q.type === "fill_in_blank") {
            y += 3;
            pdf.setDrawColor(150, 150, 150);
            pdf.setLineDashPattern([2, 2], 0);
            pdf.line(margin + 8, y, pageWidth - margin, y);
            pdf.setLineDashPattern([], 0);
            y += 10;
          } else if (q.type === "essay" || q.type === "structured") {
            y += 3;
            pdf.setDrawColor(180, 180, 180);
            pdf.rect(margin + 8, y, contentWidth - 8, 20);
            y += 25;
          } else {
            y += 6;
          }
        }
        y += 6;
      }

      // Answer Key
      if (showAnswerKey && data.answerKey && data.answerKey.length > 0) {
        pdf.addPage();
        y = margin;
        y += addText(`${exam.title} — ANSWER KEY`, 15, true);
        pdf.line(margin, y + 2, pageWidth - margin, y + 2);
        y += 10;

        data.answerKey.forEach((item, idx) => {
          if (y > 278) { pdf.addPage(); y = margin; }
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.text(`${idx + 1}. `, margin, y);

          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(0, 128, 0);
          const answerLines = pdf.splitTextToSize(`${item.correctAnswer} (${item.marks} mark${item.marks !== 1 ? "s" : ""})`, contentWidth - 10);
          pdf.text(answerLines, margin + 8, y);
          y += answerLines.length * 5 + 2;
          pdf.setTextColor(0, 0, 0);

          if (item.explanation) {
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            const expLines = pdf.splitTextToSize(item.explanation, contentWidth - 10);
            if (y + expLines.length * 4.5 > 278) { pdf.addPage(); y = margin; }
            pdf.text(expLines, margin + 8, y);
            y += expLines.length * 4.5 + 3;
            pdf.setTextColor(0, 0, 0);
          }
          y += 3;
        });
      }

      const filename = exam.title.replace(/[^a-zA-Z0-9\-_\s]/g, "_").substring(0, 50);
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
        Failed to create exam
      </div>
    );
  }

  let questionCounter = 1;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="w-full text-left bg-card hover:bg-accent border border-border rounded-lg p-3 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{metadata.title}</p>
                <p className="text-xs text-muted-foreground">
                  {metadata.totalMarks} marks • {metadata.sectionCount} sections • {metadata.subject}
                </p>
              </div>
              <GraduationCap className="h-4 w-4 text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        </DialogTrigger>

        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  {metadata.title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary">{metadata.subject}</Badge>
                  <Badge variant="outline">{metadata.level}</Badge>
                  <span className="text-xs">{metadata.totalMarks} marks</span>
                  {metadata.timeLimit && (
                    <span className="text-xs flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {metadata.timeLimit} min
                    </span>
                  )}
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
            {/* Controls */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {data.answerKey && data.answerKey.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnswerKey(!showAnswerKey)}
                >
                  {showAnswerKey ? "Hide Answer Key in Export" : "Show Answer Key in Export"}
                </Button>
              )}
              {metadata.patternAnalysis && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPatternAnalysis(!showPatternAnalysis)}
                  className="gap-1 text-xs"
                >
                  Pattern Analysis
                  {showPatternAnalysis ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              )}
            </div>
            {showPatternAnalysis && metadata.patternAnalysis && (
              <div className="mt-2 p-3 bg-muted/40 rounded text-xs text-muted-foreground">
                {metadata.patternAnalysis}
              </div>
            )}
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4 space-y-6">
            {/* Exam Header */}
            <div className="border rounded-lg p-4 space-y-2">
              <h2 className="font-bold text-center text-lg">{exam.title}</h2>
              <p className="text-center text-sm text-muted-foreground">
                {exam.subject} • {exam.level} • {exam.totalMarks} Marks
                {exam.timeLimit ? ` • ${exam.timeLimit} minutes` : ""}
              </p>
              <div className="bg-muted/40 rounded p-3 text-sm">
                <span className="font-semibold">Instructions: </span>
                {exam.instructions}
              </div>
            </div>

            {/* Sections */}
            {exam.sections.map((section, si) => (
              <div key={si} className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold">{section.sectionTitle}</h3>
                  <Badge variant="secondary">{section.marks} marks</Badge>
                </div>
                <p className="text-xs text-muted-foreground italic">{section.sectionInstructions}</p>
                <div className="space-y-4">
                  {section.questions.map((q, qi) => {
                    const num = questionCounter++;
                    return (
                      <div key={qi} className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-sm min-w-[24px]">{num}.</span>
                          <div className="flex-1">
                            <p className="text-sm">{q.text}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {questionTypeLabel[q.type] ?? q.type} •{" "}
                              {q.marks} mark{q.marks !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        {/* Options */}
                        {q.options && q.options.length > 0 && (
                          <div className="ml-6 space-y-1">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex gap-2 text-sm">
                                <span className="font-medium">{String.fromCharCode(65 + oi)}.</span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Answer space visual */}
                        {(q.type === "short_answer" || q.type === "fill_in_blank") && (
                          <div className="ml-6 border-b-2 border-dashed border-muted-foreground/30 min-h-[32px]" />
                        )}
                        {(q.type === "essay" || q.type === "structured") && (
                          <div className="ml-6 border border-dashed border-muted-foreground/30 min-h-[64px] rounded" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Answer Key (visible in modal when toggled) */}
            {showAnswerKey && data.answerKey && data.answerKey.length > 0 && (
              <div className="border-t pt-6 space-y-3">
                <h3 className="font-bold text-center">Answer Key</h3>
                <div className="space-y-2">
                  {data.answerKey.map((item, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="font-semibold min-w-[24px]">{i + 1}.</span>
                      <div>
                        <span className="text-green-700 font-medium">{item.correctAnswer}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          ({item.marks} mark{item.marks !== 1 ? "s" : ""})
                        </span>
                        {item.explanation && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.explanation}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Hidden print content */}
          <div ref={printRef} className="hidden print:block">
            <ExamPrint data={data} showAnswerKey={showAnswerKey} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
