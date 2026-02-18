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
import { BookOpen, Play } from "lucide-react";
import { InteractiveFlashcards } from "./interactive-flashcards";

interface FlashcardModalProps {
  data: {
    success: boolean;
    format: string;
    artifact: string;
    flashcardId?: string;
    metadata: {
      title: string;
      subject: string;
      topic?: string;
      totalCards: number;
      createdAt: string;
    };
    flashcards: {
      title: string;
      subject: string;
      topic?: string;
      cards: Array<{
        id: string;
        number: number;
        front: string;
        back: string;
        tags?: string[];
        difficulty?: 'easy' | 'medium' | 'hard';
      }>;
      settings: {
        shuffle?: boolean;
        showDifficulty?: boolean;
        reviewMode?: 'sequential' | 'random' | 'spaced';
      };
    };
    actions?: {
      canStudy: boolean;
      canSave: boolean;
      canShuffle: boolean;
    };
  };
}

export function FlashcardModal({ data }: FlashcardModalProps) {
  const [open, setOpen] = useState(false);

  if (!data.success) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 text-red-600">
        Failed to create flashcards
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
          <BookOpen className="h-4 w-4" />
          <span className="truncate">{data.metadata.title}</span>
          <span className="text-xs text-muted-foreground ml-2">
            ({data.metadata.totalCards} cards)
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {data.metadata.title}
          </DialogTitle>
          <DialogDescription>
            {data.metadata.subject}
            {data.metadata.topic && ` • ${data.metadata.topic}`}
            {' • '}
            {data.metadata.totalCards} flashcards
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0 p-4">
          <InteractiveFlashcards data={{ flashcards: data.flashcards }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact version for chat interface - just shows the trigger button
export function FlashcardModalTrigger({ data, autoOpen = false }: FlashcardModalProps & { autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);

  if (!data.success) {
    return (
      <div className="p-3 border rounded-lg bg-red-50 text-red-600 text-sm">
        Failed to create flashcards
      </div>
    );
  }

  return (
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
                {data.metadata.subject}
                {data.metadata.topic && ` • ${data.metadata.topic}`}
                {' • '}
                {data.metadata.totalCards} cards
              </p>
            </div>
            <Play className="h-4 w-4 text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {data.metadata.title}
          </DialogTitle>
          <DialogDescription>
            {data.metadata.subject}
            {data.metadata.topic && ` • ${data.metadata.topic}`}
            {' • '}
            {data.metadata.totalCards} flashcards
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0 p-4">
          <InteractiveFlashcards data={{ flashcards: data.flashcards }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
