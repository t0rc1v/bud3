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
import { HelpCircle, ExternalLink, Play } from "lucide-react";
import { InteractiveQuiz } from "./interactive-quiz";

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
    actions?: {
      canStart: boolean;
      canSave: boolean;
      canSubmit: boolean;
      canViewResults: boolean;
    };
  };
}

export function QuizModal({ data }: QuizModalProps) {
  const [open, setOpen] = useState(false);

  if (!data.success) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 text-red-600">
        Failed to create quiz
      </div>
    );
  }

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
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            {data.metadata.title}
          </DialogTitle>
          <DialogDescription>
            {data.metadata.subject} • {data.metadata.questionCount} questions • {data.metadata.totalMarks} marks
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-4">
          <InteractiveQuiz data={{ metadata: data.metadata, quiz: data.quiz as React.ComponentProps<typeof InteractiveQuiz>['data']['quiz'] }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact version for chat interface - just shows the trigger button
export function QuizModalTrigger({ data }: QuizModalProps) {
  const [open, setOpen] = useState(false);

  if (!data.success) {
    return (
      <div className="p-3 border rounded-lg bg-red-50 text-red-600 text-sm">
        Failed to create quiz
      </div>
    );
  }

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
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            {data.metadata.title}
          </DialogTitle>
          <DialogDescription>
            {data.metadata.subject} • {data.metadata.questionCount} questions • {data.metadata.totalMarks} marks
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-4">
          <InteractiveQuiz data={{ metadata: data.metadata, quiz: data.quiz as React.ComponentProps<typeof InteractiveQuiz>['data']['quiz'] }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
