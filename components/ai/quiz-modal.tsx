"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { HelpCircle, ExternalLink, Play, Printer, Download } from "lucide-react";
import { InteractiveQuiz } from "./interactive-quiz";
import { useReactToPrint } from "react-to-print";
import { jsPDF } from "jspdf";

interface QuizModalProps {
  data: {
    success: boolean;
    format: string;
    artifact: string;
    quizId?: string;
    metadata: {
      title: string;
      subject: string;
      description?: string;
      createdAt: string;
      questionCount: number;
      totalMarks: number;
      passingMarks: number;
      passingScore: number;
    };
    quiz: {
      title: string;
      subject: string;
      description?: string;
      instructions: string;
      settings: {
        shuffleQuestions: boolean;
        shuffleOptions: boolean;
        showCorrectAnswerImmediately: boolean;
        showExplanation: boolean;
        allowRetake: boolean;
        timeLimit: number | null;
        passingScore: number;
        maxAttempts: number | null;
      };
      questions: Array<{
        number: number;
        id: string;
        type: string;
        text: string;
        options: Array<{
          id: string;
          text: string;
          isCorrect: boolean;
        }>;
        marks: number;
        explanation: string | null;
        hint: string | null;
      }>;
      validation: {
        answers: Array<{
          id: string;
          correctAnswer: unknown;
          marks: number;
        }>;
      };
    };
    exportOptions?: {
      canExportPDF: boolean;
      canPrint: boolean;
    };
    warning?: string | null;
    actions?: {
      canStart: boolean;
      canSave: boolean;
      canSubmit: boolean;
      canViewResults: boolean;
    };
  };
}

// Quiz Print/Export Component
function QuizExport({ data, showAnswerKey }: { data: QuizModalProps['data']; showAnswerKey: boolean }) {
  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      multiple_choice: "Multiple Choice",
      true_false: "True/False",
      short_answer: "Short Answer",
      fill_in_blank: "Fill in the Blank",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6 p-6 bg-white">
      {/* Header Section */}
      <div className="text-center border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold mb-2">{data.quiz.title}</h1>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <strong>Subject:</strong> {data.quiz.subject}
          </p>
          <p>
            <strong>Total Marks:</strong> {data.metadata.totalMarks} |{" "}
            <strong>Questions:</strong> {data.metadata.questionCount}
          </p>
          {data.quiz.settings.timeLimit && (
            <p>
              <strong>Time Limit:</strong> {data.quiz.settings.timeLimit} minutes
            </p>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Instructions:</h3>
        <p className="text-sm whitespace-pre-wrap">{data.quiz.instructions}</p>
      </div>

      <hr className="border-t" />

      {/* Questions */}
      <div className="space-y-6">
        <h3 className="font-semibold text-lg">Questions:</h3>
        {data.quiz.questions.map((question) => (
          <div key={question.id} className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="font-semibold min-w-[30px]">{question.number}.</span>
              <div className="flex-1">
                <p className="text-sm">{question.text}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ({question.marks} mark{question.marks !== 1 ? "s" : ""}) •{" "}
                  {getQuestionTypeLabel(question.type)}
                </p>
              </div>
            </div>

            {/* Options for multiple choice */}
            {question.options && question.options.length > 0 && (
              <div className="ml-8 space-y-1">
                {question.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{String.fromCharCode(65 + idx)}.</span>
                    <span>{option.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Answer space */}
            <div className="ml-8 border-b-2 border-dashed border-muted-foreground/30 min-h-[60px] mt-2" />
          </div>
        ))}
      </div>

      {/* Answer Key (if enabled and shown) */}
      {showAnswerKey && (
        <>
          <div className="page-break-before" />
          <hr className="border-t my-8" />
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center">{data.quiz.title} - ANSWER KEY</h2>
            <div className="space-y-2">
              {data.quiz.validation.answers.map((answer, index) => {
                const question = data.quiz.questions.find(q => q.id === answer.id);
                return (
                  <div key={answer.id} className="flex items-start gap-2 text-sm">
                    <span className="font-semibold min-w-[30px]">{index + 1}.</span>
                    <div className="flex-1">
                      <span className="font-medium text-green-600">
                        Answer: {JSON.stringify(answer.correctAnswer)}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        ({answer.marks} mark{answer.marks !== 1 ? "s" : ""})
                      </span>
                      {question?.explanation && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {question.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function QuizModal({ data }: QuizModalProps) {
  const [open, setOpen] = useState(false);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;
      
      const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12, align: 'left' | 'center' = 'left') => {
        pdf.setFontSize(fontSize);
        const splitText = pdf.splitTextToSize(text, maxWidth);
        pdf.text(splitText, x, y, { align });
        return (splitText.length * fontSize * 0.5) + 5;
      };
      
      // Header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(data.quiz.title, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 12;
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Subject: ${data.quiz.subject}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;
      pdf.text(`Total Marks: ${data.metadata.totalMarks} | Questions: ${data.metadata.questionCount}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;
      
      if (data.quiz.settings.timeLimit) {
        pdf.text(`Time Limit: ${data.quiz.settings.timeLimit} minutes`, pageWidth / 2, yPosition, { align: "center" });
        yPosition += 8;
      }
      
      // Line under header
      yPosition += 5;
      pdf.setDrawColor(0);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;
      
      // Instructions
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Instructions:", margin, yPosition);
      yPosition += 8;
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      const instructionHeight = addWrappedText(data.quiz.instructions, margin, yPosition, contentWidth, 11);
      yPosition += instructionHeight + 15;
      
      // Questions
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Questions:", margin, yPosition);
      yPosition += 12;
      
      // Add each question
      data.quiz.questions.forEach((question, index) => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = margin;
        }
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        const questionText = `${index + 1}. ${question.text}`;
        const questionHeight = addWrappedText(questionText, margin, yPosition, contentWidth - 10, 11);
        yPosition += questionHeight;
        
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        
        const typeLabel = question.type === 'multiple_choice' ? 'Multiple Choice' : 
                         question.type === 'true_false' ? 'True/False' :
                         question.type === 'short_answer' ? 'Short Answer' :
                         question.type === 'fill_in_blank' ? 'Fill in the Blank' : question.type;
        pdf.text(`(${question.marks} mark${question.marks !== 1 ? "s" : ""}) - ${typeLabel}`, margin + 5, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 6;
        
        // Options for multiple choice
        if (question.options && question.options.length > 0) {
          question.options.forEach((option, optIndex) => {
            if (yPosition > 280) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10);
            pdf.text(`${String.fromCharCode(65 + optIndex)}. ${option.text}`, margin + 10, yPosition);
            yPosition += 6;
          });
        }
        
        // Answer space line
        yPosition += 8;
        pdf.setDrawColor(150, 150, 150);
        pdf.setLineDashPattern([3, 3], 0);
        pdf.line(margin + 10, yPosition, pageWidth - margin, yPosition);
        pdf.setLineDashPattern([], 0);
        pdf.setDrawColor(0, 0, 0);
        yPosition += 15;
      });
      
      // Answer Key (if included)
      if (showAnswerKey) {
        pdf.addPage();
        yPosition = margin;
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text(`${data.quiz.title} - ANSWER KEY`, pageWidth / 2, yPosition, { align: "center" });
        yPosition += 15;
        
        data.quiz.validation.answers.forEach((answer, index) => {
          if (yPosition > 280) {
            pdf.addPage();
            yPosition = margin;
          }
          
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.text(`${index + 1}. `, margin, yPosition);
          
          pdf.setTextColor(0, 128, 0);
          const answerStr = `Answer: ${JSON.stringify(answer.correctAnswer)}`;
          pdf.text(answerStr, margin + 15, yPosition);
          pdf.setTextColor(0, 0, 0);
          
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`(${answer.marks} mark${answer.marks !== 1 ? "s" : ""})`, margin + 15 + pdf.getTextWidth(answerStr) + 5, yPosition);
          pdf.setTextColor(0, 0, 0);
          
          yPosition += 8;
          
          const question = data.quiz.questions.find(q => q.id === answer.id);
          if (question?.explanation) {
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            const explanationHeight = addWrappedText(question.explanation, margin + 15, yPosition, contentWidth - 25, 9);
            pdf.setTextColor(0, 0, 0);
            yPosition += explanationHeight;
          }
          
          yPosition += 5;
        });
      }
      
      // Save PDF
      const filename = data.metadata.title.replace(/[^a-zA-Z0-9\-_\s]/g, "_").substring(0, 50);
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!data.success) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 text-red-600">
        Failed to create quiz
      </div>
    );
  }

  const hasExportOptions = data.exportOptions?.canExportPDF || data.exportOptions?.canPrint;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 w-full max-w-md mx-auto"
          onClick={() => setOpen(true)}
        >
          <HelpCircle className="h-4 w-4" />
          <span className="truncate">{data.metadata.title}</span>
          <span className="text-xs text-muted-foreground ml-2">
            ({data.metadata.totalMarks} marks, {data.metadata.questionCount} questions)
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                {data.metadata.title}
              </DialogTitle>
              <DialogDescription>
                {data.metadata.subject} • {data.metadata.questionCount} questions • {data.metadata.totalMarks} marks
              </DialogDescription>
            </div>
            {hasExportOptions && (
              <div className="flex gap-2">
                {data.exportOptions?.canPrint && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    className="gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                )}
                {data.exportOptions?.canExportPDF && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={exportToPDF}
                    disabled={isExporting}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {isExporting ? "Exporting..." : "Export to PDF"}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnswerKey(!showAnswerKey)}
            >
              {showAnswerKey ? "Hide Answer Key in Export" : "Show Answer Key in Export"}
            </Button>
          </div>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0 p-4">
          <InteractiveQuiz data={{ metadata: data.metadata, quiz: data.quiz as React.ComponentProps<typeof InteractiveQuiz>['data']['quiz'] }} />
        </div>
        
        {/* Hidden print/export content */}
        <div ref={printRef} className="hidden print:block">
          <QuizExport data={data} showAnswerKey={showAnswerKey} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact version for chat interface - just shows the trigger button
export function QuizModalTrigger({ data, autoOpen = false }: QuizModalProps & { autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;
      
      const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12, align: 'left' | 'center' = 'left') => {
        pdf.setFontSize(fontSize);
        const splitText = pdf.splitTextToSize(text, maxWidth);
        pdf.text(splitText, x, y, { align });
        return (splitText.length * fontSize * 0.5) + 5;
      };
      
      // Header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(data.quiz.title, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 12;
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Subject: ${data.quiz.subject}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;
      pdf.text(`Total Marks: ${data.metadata.totalMarks} | Questions: ${data.metadata.questionCount}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;
      
      if (data.quiz.settings.timeLimit) {
        pdf.text(`Time Limit: ${data.quiz.settings.timeLimit} minutes`, pageWidth / 2, yPosition, { align: "center" });
        yPosition += 8;
      }
      
      // Line under header
      yPosition += 5;
      pdf.setDrawColor(0);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;
      
      // Instructions
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Instructions:", margin, yPosition);
      yPosition += 8;
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      const instructionHeight = addWrappedText(data.quiz.instructions, margin, yPosition, contentWidth, 11);
      yPosition += instructionHeight + 15;
      
      // Questions
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Questions:", margin, yPosition);
      yPosition += 12;
      
      // Add each question
      data.quiz.questions.forEach((question, index) => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = margin;
        }
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        const questionText = `${index + 1}. ${question.text}`;
        const questionHeight = addWrappedText(questionText, margin, yPosition, contentWidth - 10, 11);
        yPosition += questionHeight;
        
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        
        const typeLabel = question.type === 'multiple_choice' ? 'Multiple Choice' : 
                         question.type === 'true_false' ? 'True/False' :
                         question.type === 'short_answer' ? 'Short Answer' :
                         question.type === 'fill_in_blank' ? 'Fill in the Blank' : question.type;
        pdf.text(`(${question.marks} mark${question.marks !== 1 ? "s" : ""}) - ${typeLabel}`, margin + 5, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 6;
        
        // Options for multiple choice
        if (question.options && question.options.length > 0) {
          question.options.forEach((option, optIndex) => {
            if (yPosition > 280) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10);
            pdf.text(`${String.fromCharCode(65 + optIndex)}. ${option.text}`, margin + 10, yPosition);
            yPosition += 6;
          });
        }
        
        // Answer space line
        yPosition += 8;
        pdf.setDrawColor(150, 150, 150);
        pdf.setLineDashPattern([3, 3], 0);
        pdf.line(margin + 10, yPosition, pageWidth - margin, yPosition);
        pdf.setLineDashPattern([], 0);
        pdf.setDrawColor(0, 0, 0);
        yPosition += 15;
      });
      
      // Answer Key (if included)
      if (showAnswerKey) {
        pdf.addPage();
        yPosition = margin;
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text(`${data.quiz.title} - ANSWER KEY`, pageWidth / 2, yPosition, { align: "center" });
        yPosition += 15;
        
        data.quiz.validation.answers.forEach((answer, index) => {
          if (yPosition > 280) {
            pdf.addPage();
            yPosition = margin;
          }
          
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.text(`${index + 1}. `, margin, yPosition);
          
          pdf.setTextColor(0, 128, 0);
          const answerStr = `Answer: ${JSON.stringify(answer.correctAnswer)}`;
          pdf.text(answerStr, margin + 15, yPosition);
          pdf.setTextColor(0, 0, 0);
          
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`(${answer.marks} mark${answer.marks !== 1 ? "s" : ""})`, margin + 15 + pdf.getTextWidth(answerStr) + 5, yPosition);
          pdf.setTextColor(0, 0, 0);
          
          yPosition += 8;
          
          const question = data.quiz.questions.find(q => q.id === answer.id);
          if (question?.explanation) {
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            const explanationHeight = addWrappedText(question.explanation, margin + 15, yPosition, contentWidth - 25, 9);
            pdf.setTextColor(0, 0, 0);
            yPosition += explanationHeight;
          }
          
          yPosition += 5;
        });
      }
      
      // Save PDF
      const filename = data.metadata.title.replace(/[^a-zA-Z0-9\-_\s]/g, "_").substring(0, 50);
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!data.success) {
    return (
      <div className="p-3 border rounded-lg bg-red-50 text-red-600 text-sm">
        Failed to create quiz
      </div>
    );
  }

  const hasExportOptions = data.exportOptions?.canExportPDF || data.exportOptions?.canPrint;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full text-left bg-card hover:bg-accent border border-border rounded-lg p-3 transition-colors cursor-pointer group">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <HelpCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{data.metadata.title}</p>
              <p className="text-xs text-muted-foreground">
                {data.metadata.totalMarks} marks • {data.metadata.questionCount} questions
              </p>
            </div>
            <Play className="h-4 w-4 text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                {data.metadata.title}
              </DialogTitle>
              <DialogDescription>
                {data.metadata.subject} • {data.metadata.questionCount} questions • {data.metadata.totalMarks} marks
              </DialogDescription>
            </div>
            {hasExportOptions && (
              <div className="flex gap-2">
                {data.exportOptions?.canPrint && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    className="gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                )}
                {data.exportOptions?.canExportPDF && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={exportToPDF}
                    disabled={isExporting}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {isExporting ? "Exporting..." : "Export to PDF"}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnswerKey(!showAnswerKey)}
            >
              {showAnswerKey ? "Hide Answer Key in Export" : "Show Answer Key in Export"}
            </Button>
          </div>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0 p-4">
          <InteractiveQuiz data={{ metadata: data.metadata, quiz: data.quiz as React.ComponentProps<typeof InteractiveQuiz>['data']['quiz'] }} />
        </div>
        
        {/* Hidden print/export content */}
        <div ref={printRef} className="hidden print:block">
          <QuizExport data={data} showAnswerKey={showAnswerKey} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
