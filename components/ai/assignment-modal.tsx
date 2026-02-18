"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileText, ExternalLink } from "lucide-react";
import { AssignmentExport } from "./assignment-export";

interface AssignmentModalProps {
  data: {
    success: boolean;
    format: string;
    assignmentId?: string;
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
      questions: Array<{
        id: string;
        number: number;
        type: string;
        text: string;
        options?: string[];
        marks: number;
      }>;
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
    exportOptions?: {
      canExportPDF: boolean;
      canExportWord: boolean;
      canPrint: boolean;
    };
  };
}

export function AssignmentModal({ data }: AssignmentModalProps) {
  const [open, setOpen] = useState(false);

  if (!data.success) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 text-red-600">
        Failed to create assignment
      </div>
    );
  }

  // Transform data to match AssignmentExport component format
  const assignmentData = {
    metadata: data.metadata,
    content: data.content,
    answerKey: data.answerKey,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 w-full max-w-md mx-auto"
          onClick={() => setOpen(true)}
        >
          <FileText className="h-4 w-4" />
          <span className="truncate">{data.metadata.title}</span>
          <span className="text-xs text-muted-foreground ml-2">
            ({data.metadata.totalMarks} marks, {data.metadata.questionCount} questions)
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {data.metadata.title}
          </DialogTitle>
          <DialogDescription>
            {data.metadata.subject} • {data.metadata.grade} • {data.metadata.type.replace(/_/g, " ")}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
          <AssignmentExport data={assignmentData as React.ComponentProps<typeof AssignmentExport>['data']} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact version for chat interface - just shows the trigger button
export function AssignmentModalTrigger({ data, autoOpen = false }: AssignmentModalProps & { autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);

  if (!data.success) {
    return (
      <div className="p-3 border rounded-lg bg-red-50 text-red-600 text-sm">
        Failed to create assignment
      </div>
    );
  }

  // Transform data to match AssignmentExport component format
  const assignmentData = {
    metadata: data.metadata,
    content: data.content,
    answerKey: data.answerKey,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full text-left bg-card hover:bg-accent border border-border rounded-lg p-3 transition-colors cursor-pointer group">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{data.metadata.title}</p>
              <p className="text-xs text-muted-foreground">
                {data.metadata.totalMarks} marks • {data.metadata.questionCount} questions
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {data.metadata.title}
          </DialogTitle>
          <DialogDescription>
            {data.metadata.subject} • {data.metadata.grade} • {data.metadata.type.replace(/_/g, " ")}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
          <AssignmentExport data={assignmentData as React.ComponentProps<typeof AssignmentExport>['data']} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
