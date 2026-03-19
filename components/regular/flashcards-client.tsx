"use client";

import { useState, useEffect, useCallback } from "react";
import { Layers, RotateCcw, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FlashCard {
  id: string;
  front: string;
  back: string;
  deckTitle: string;
}

const RATING_LABELS = [
  { label: "Again", value: 1, variant: "destructive" as const },
  { label: "Hard", value: 2, variant: "outline" as const },
  { label: "Good", value: 3, variant: "secondary" as const },
  { label: "Easy", value: 4, variant: "default" as const },
];

export function FlashcardsClient() {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRating, setIsRating] = useState(false);

  const fetchDueCards = useCallback(() => {
    setIsLoading(true);
    fetch("/api/ai/flashcards/due")
      .then((r) => r.json())
      .then((d) => {
        if (d?.cards) {
          setCards(d.cards);
          setCurrentIndex(0);
          setIsFlipped(false);
        }
      })
      .catch(() => {
        toast.error("Failed to load flashcards");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchDueCards();
  }, [fetchDueCards]);

  const currentCard = cards[currentIndex] ?? null;
  const dueCount = cards.length - currentIndex;

  async function handleRate(rating: number) {
    if (!currentCard) return;
    setIsRating(true);
    try {
      const res = await fetch("/api/ai/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: currentCard.id, rating }),
      });
      if (!res.ok) {
        toast.error("Failed to submit review");
        return;
      }
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } catch {
      toast.error("Failed to submit review");
    } finally {
      setIsRating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No cards due for review</p>
            <p className="text-sm text-muted-foreground">
              Check back later for more cards to review.
            </p>
            <Button variant="outline" className="mt-4" onClick={fetchDueCards}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <span className="text-sm text-muted-foreground">
          {dueCount} card{dueCount !== 1 ? "s" : ""} due
        </span>
      </div>

      <Card
        className="cursor-pointer min-h-[240px] flex items-center justify-center transition-all hover:shadow-md"
        onClick={() => !isFlipped && setIsFlipped(true)}
      >
        <CardContent className="flex flex-col items-center justify-center py-10 px-6 text-center w-full">
          <p className="text-xs text-muted-foreground mb-4">
            {currentCard.deckTitle}
          </p>
          {!isFlipped ? (
            <>
              <p className="text-lg font-medium">{currentCard.front}</p>
              <p className="text-xs text-muted-foreground mt-4">
                Click to reveal answer
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-2">
                {currentCard.front}
              </p>
              <div className="border-t w-full my-3" />
              <p className="text-lg font-medium">{currentCard.back}</p>
            </>
          )}
        </CardContent>
      </Card>

      {isFlipped && (
        <div className="flex items-center justify-center gap-2">
          {RATING_LABELS.map((r) => (
            <Button
              key={r.value}
              variant={r.variant}
              size="sm"
              disabled={isRating}
              onClick={() => handleRate(r.value)}
            >
              {r.value === 1 && <RotateCcw className="h-3 w-3 mr-1" />}
              {r.value === 4 && <ArrowRight className="h-3 w-3 mr-1" />}
              {r.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
