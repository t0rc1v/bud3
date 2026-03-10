"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, Printer, CheckCircle, Clock, Calendar } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { jsPDF } from "jspdf";

interface Question {
  id: string;
  number: number;
  type: "multiple_choice" | "true_false" | "short_answer" | "essay" | "fill_in_blank" | "matching";
  text: string;
  options?: string[];
  marks: number;
}

interface AssignmentData {
  metadata: {
    title: string;
    subject: string;
    grade: string;
    type: string;
    createdAt: string;
    totalMarks: number;
    questionCount: number;
    timeLimit?: number;
    dueDate?: string;
    includeAnswerKey: boolean;
  };
  content: {
    header: {
      title: string;
      subject: string;
      grade: string;
      type: string;
      totalMarks: number;
      timeLimit?: number;
      dueDate?: string;
    };
    instructions: string;
    questions: Question[];
  };
  answerKey?: {
    title: string;
    answers: Array<{
      number: number;
      id: string;
      type: string;
      correctAnswer: unknown;
      marks: number;
      explanation?: string;
    }>;
  } | null;
}

interface AssignmentExportProps {
  data: AssignmentData;
}

export function AssignmentExport({ data }: AssignmentExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: data.metadata.title,
  });

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      // Create PDF using jsPDF directly
      const pdf = new jsPDF("p", "mm", "a4");
      
      // Set up PDF document
      const pageWidth = 210; // A4 width in mm
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;
      
      // Helper function to add text with word wrap
      const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12, align: 'left' | 'center' = 'left') => {
        pdf.setFontSize(fontSize);
        const splitText = pdf.splitTextToSize(text, maxWidth);
        pdf.text(splitText, x, y, { align });
        return (splitText.length * fontSize * 0.5) + 5; // Return height used
      };
      
      // Header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(data.content.header.title, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 12;
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Subject: ${data.content.header.subject} | Grade: ${data.content.header.grade}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;
      pdf.text(`Type: ${data.content.header.type} | Total Marks: ${data.content.header.totalMarks}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;
      
      if (data.content.header.timeLimit) {
        pdf.text(`Time Limit: ${data.content.header.timeLimit} minutes`, pageWidth / 2, yPosition, { align: "center" });
        yPosition += 8;
      }
      
      if (data.content.header.dueDate) {
        pdf.text(`Due Date: ${new Date(data.content.header.dueDate).toLocaleDateString()}`, pageWidth / 2, yPosition, { align: "center" });
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
      const instructionHeight = addWrappedText(data.content.instructions, margin, yPosition, contentWidth, 11);
      yPosition += instructionHeight + 15;
      
      // Questions
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Questions:", margin, yPosition);
      yPosition += 12;
      
      // Add each question
      data.content.questions.forEach((question, index) => {
        // Check if we need a new page
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = margin;
        }
        
        // Question number and text
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        const questionText = `${index + 1}. ${question.text}`;
        const questionHeight = addWrappedText(questionText, margin, yPosition, contentWidth - 10, 11);
        yPosition += questionHeight;
        
        // Question type and marks
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`(${question.marks} mark${question.marks !== 1 ? "s" : ""}) - ${getQuestionTypeLabel(question.type)}`, margin + 5, yPosition);
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
            pdf.text(`${String.fromCharCode(65 + optIndex)}. ${option}`, margin + 10, yPosition);
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
      if (data.metadata.includeAnswerKey && data.answerKey) {
        pdf.addPage();
        yPosition = margin;
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text(data.answerKey.title, pageWidth / 2, yPosition, { align: "center" });
        yPosition += 15;
        
        data.answerKey.answers.forEach((answer) => {
          if (yPosition > 280) {
            pdf.addPage();
            yPosition = margin;
          }
          
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.text(`${answer.number}. `, margin, yPosition);
          
          pdf.setTextColor(0, 128, 0); // Green for correct answers
          const answerStr = `Answer: ${JSON.stringify(answer.correctAnswer)}`;
          pdf.text(answerStr, margin + 15, yPosition);
          pdf.setTextColor(0, 0, 0);
          
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`(${answer.marks} mark${answer.marks !== 1 ? "s" : ""})`, margin + 15 + pdf.getTextWidth(answerStr) + 5, yPosition);
          pdf.setTextColor(0, 0, 0);
          
          yPosition += 8;
          
          if (answer.explanation) {
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            const explanationHeight = addWrappedText(answer.explanation, margin + 15, yPosition, contentWidth - 25, 9);
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
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      multiple_choice: "Multiple Choice",
      true_false: "True/False",
      short_answer: "Short Answer",
      essay: "Essay",
      fill_in_blank: "Fill in the Blank",
      matching: "Matching",
    };
    return labels[type] || type;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {data.metadata.title}
            </CardTitle>
            <CardDescription className="mt-1">
              {data.metadata.subject} • {data.metadata.grade} • {data.metadata.type.replace(/_/g, " ")}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2"
            >
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
              {isExporting ? "Exporting..." : "Export to PDF"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {data.metadata.totalMarks} marks
          </Badge>
          <Badge variant="secondary">
            {data.metadata.questionCount} questions
          </Badge>
          {data.metadata.timeLimit && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {data.metadata.timeLimit} minutes
            </Badge>
          )}
          {data.metadata.dueDate && (
            <Badge variant="secondary" className="gap-1">
              <Calendar className="h-3 w-3" />
              Due: {new Date(data.metadata.dueDate).toLocaleDateString()}
            </Badge>
          )}
        </div>

        {data.metadata.includeAnswerKey && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnswerKey(!showAnswerKey)}
            >
              {showAnswerKey ? "Hide Answer Key" : "Show Answer Key"}
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Print-friendly container */}
        <div ref={printRef} className="space-y-6 p-6 bg-white">
          {/* Header Section */}
          <div className="text-center border-b pb-4 mb-6">
            <h1 className="text-2xl font-bold mb-2">{data.content.header.title}</h1>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Subject:</strong> {data.content.header.subject} |{" "}
                <strong>Grade:</strong> {data.content.header.grade}
              </p>
              <p>
                <strong>Type:</strong> {data.content.header.type} |{" "}
                <strong>Total Marks:</strong> {data.content.header.totalMarks}
              </p>
              {data.content.header.timeLimit && (
                <p>
                  <strong>Time Limit:</strong> {data.content.header.timeLimit} minutes
                </p>
              )}
              {data.content.header.dueDate && (
                <p>
                  <strong>Due Date:</strong> {new Date(data.content.header.dueDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Instructions:</h3>
            <p className="text-sm whitespace-pre-wrap">{data.content.instructions}</p>
          </div>

          <Separator />

          {/* Questions */}
          <div className="space-y-6">
            <h3 className="font-semibold text-lg">Questions:</h3>
            {data.content.questions.map((question) => (
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
                        <span>{option}</span>
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
          {showAnswerKey && data.answerKey && (
            <>
              <div className="page-break-before" />
              <Separator className="my-8" />
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-center">{data.answerKey.title}</h2>
                <div className="space-y-2">
                  {data.answerKey.answers.map((answer) => (
                    <div key={answer.id} className="flex items-start gap-2 text-sm">
                      <span className="font-semibold min-w-[30px]">{answer.number}.</span>
                      <div className="flex-1">
                        <span className="font-medium text-green-600">
                          Answer: {JSON.stringify(answer.correctAnswer)}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          ({answer.marks} mark{answer.marks !== 1 ? "s" : ""})
                        </span>
                        {answer.explanation && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {answer.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
