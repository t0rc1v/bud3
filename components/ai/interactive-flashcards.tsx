"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  Shuffle, 
  RotateCw,
  CheckCircle,
  XCircle,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FlashcardData {
  id: string;
  number: number;
  front: string;
  back: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface InteractiveFlashcardsProps {
  data: {
    flashcards: {
      title: string;
      subject: string;
      topic?: string;
      cards: FlashcardData[];
      settings: {
        shuffle?: boolean;
        showDifficulty?: boolean;
        reviewMode?: 'sequential' | 'random' | 'spaced';
      };
    };
  };
}

export function InteractiveFlashcards({ data }: InteractiveFlashcardsProps) {
  const { flashcards } = data;
  const { cards, settings } = flashcards;
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [shuffledCards, setShuffledCards] = useState<FlashcardData[]>(cards);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<string>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);

  // Shuffle cards on mount if shuffle is enabled
  useEffect(() => {
    if (settings.shuffle) {
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      setShuffledCards(shuffled);
    }
  }, [cards, settings.shuffle]);

  const currentCard = shuffledCards[currentIndex];
  const totalCards = shuffledCards.length;
  const progress = ((currentIndex + 1) / totalCards) * 100;

  const handleNext = useCallback(() => {
    if (currentIndex < totalCards - 1) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 150);
    } else {
      setIsCompleted(true);
    }
  }, [currentIndex, totalCards]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
      }, 150);
    }
  }, [currentIndex]);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  const handleShuffle = useCallback(() => {
    const shuffled = [...shuffledCards].sort(() => Math.random() - 0.5);
    setShuffledCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [shuffledCards]);

  const handleMarkKnown = useCallback(() => {
    if (currentCard) {
      setKnownCards(prev => new Set([...prev, currentCard.id]));
      setUnknownCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentCard.id);
        return newSet;
      });
      handleNext();
    }
  }, [currentCard, handleNext]);

  const handleMarkUnknown = useCallback(() => {
    if (currentCard) {
      setUnknownCards(prev => new Set([...prev, currentCard.id]));
      setKnownCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentCard.id);
        return newSet;
      });
      handleNext();
    }
  }, [currentCard, handleNext]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
    setKnownCards(new Set());
    setUnknownCards(new Set());
    if (settings.shuffle) {
      handleShuffle();
    }
  }, [settings.shuffle, handleShuffle]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;
      
      switch (e.key) {
        case 'ArrowRight':
          handleNext();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          handleFlip();
          break;
        case '1':
          handleMarkKnown();
          break;
        case '2':
          handleMarkUnknown();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious, handleFlip, handleMarkKnown, handleMarkUnknown, isCompleted]);

  if (isCompleted) {
    const knownCount = knownCards.size;
    const unknownCount = unknownCards.size;
    const unmarkedCount = totalCards - knownCount - unknownCount;

    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-primary">Study Session Complete!</h3>
          <p className="text-muted-foreground">You&apos;ve reviewed all {totalCards} flashcards</p>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full max-w-md">
          <Card className="p-4 text-center border-green-200 bg-green-50/50">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-700">{knownCount}</div>
            <div className="text-xs text-green-600">Known</div>
          </Card>
          <Card className="p-4 text-center border-red-200 bg-red-50/50">
            <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-700">{unknownCount}</div>
            <div className="text-xs text-red-600">Need Review</div>
          </Card>
          <Card className="p-4 text-center border-gray-200 bg-gray-50/50">
            <BookOpen className="h-8 w-8 text-gray-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-700">{unmarkedCount}</div>
            <div className="text-xs text-gray-600">Unmarked</div>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleRestart} variant="outline" className="gap-2">
            <RotateCw className="h-4 w-4" />
            Study Again
          </Button>
          {unknownCount > 0 && (
            <Button 
              onClick={() => {
                const unknownCardIds = Array.from(unknownCards);
                const filteredCards = cards.filter(c => unknownCardIds.includes(c.id));
                if (filteredCards.length > 0) {
                  setShuffledCards(filteredCards);
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setIsCompleted(false);
                }
              }}
              className="gap-2"
            >
              Review {unknownCount} Unknown
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            Card {currentIndex + 1} of {totalCards}
          </span>
          {settings.showDifficulty && currentCard?.difficulty && (
            <Badge 
              variant={
                currentCard.difficulty === 'easy' ? 'default' : 
                currentCard.difficulty === 'medium' ? 'secondary' : 'destructive'
              }
              className="text-xs"
            >
              {currentCard.difficulty}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {settings.shuffle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShuffle}
              className="h-8 w-8 p-0"
              title="Shuffle cards"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      <Progress value={progress} className="mb-6" />

      {/* Flashcard */}
      <div className="flex-1 flex items-center justify-center mb-6 perspective-1000">
        <div
          className={cn(
            "relative w-full max-w-2xl min-h-[300px] cursor-pointer transition-transform duration-500 transform-style-3d",
            isFlipped && "rotate-y-180"
          )}
          onClick={handleFlip}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <Card
            className={cn(
              "absolute inset-0 p-8 flex flex-col items-center justify-center text-center backface-hidden",
              "border-2 border-primary/20 shadow-lg"
            )}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
              Question
            </div>
            <div className="text-lg md:text-xl font-medium leading-relaxed whitespace-pre-wrap">
              {currentCard?.front}
            </div>
            <div className="absolute bottom-4 text-xs text-muted-foreground">
              Click to reveal answer or press Space
            </div>
          </Card>

          {/* Back */}
          <Card
            className={cn(
              "absolute inset-0 p-8 flex flex-col items-center justify-center text-center",
              "border-2 border-primary/20 shadow-lg bg-primary/5",
              "rotate-y-180"
            )}
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
              Answer
            </div>
            <div className="text-lg md:text-xl leading-relaxed whitespace-pre-wrap">
              {currentCard?.back}
            </div>
            {currentCard?.tags && currentCard.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-4 justify-center">
                {currentCard.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <Button
            variant="default"
            size="lg"
            onClick={handleFlip}
            className="min-w-[140px]"
          >
            {isFlipped ? 'Show Question' : 'Show Answer'}
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            onClick={handleNext}
            disabled={currentIndex === totalCards - 1}
            className="gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Mark as Known/Unknown */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkUnknown}
            className="gap-2 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <XCircle className="h-4 w-4" />
            Need Review (2)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkKnown}
            className="gap-2 border-green-200 hover:bg-green-50 hover:text-green-700"
          >
            <CheckCircle className="h-4 w-4" />
            Known (1)
          </Button>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Keyboard: Space/Enter to flip, ← → to navigate, 1 for Known, 2 for Need Review
        </div>
      </div>
    </div>
  );
}
