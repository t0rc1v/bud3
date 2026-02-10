"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Unlock, Coins, Loader2, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentLockProps {
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  unlockFee: number;
  creditsRequired: number;
  isUnlocked: boolean;
  onUnlock: () => Promise<void>;
  userCredits: number;
}

export function ContentLockCard({
  resourceId,
  resourceTitle,
  resourceType,
  unlockFee,
  creditsRequired,
  isUnlocked,
  onUnlock,
  userCredits,
}: ContentLockProps) {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const hasEnoughCredits = userCredits >= creditsRequired;

  const handleUnlock = async () => {
    if (!hasEnoughCredits) return;
    
    setIsUnlocking(true);
    setUnlockStatus("idle");
    setErrorMessage("");

    try {
      await onUnlock();
      setUnlockStatus("success");
    } catch (error) {
      setUnlockStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to unlock content");
    } finally {
      setIsUnlocking(false);
    }
  };

  if (isUnlocked) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="h-5 w-5" />
        <span className="text-sm font-medium">Unlocked</span>
      </div>
    );
  }

  return (
    <Card className="border-dashed border-2 border-yellow-500/50 bg-yellow-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-5 w-5 text-yellow-600" />
          Locked Content
        </CardTitle>
        <CardDescription>
          Unlock this {resourceType} to access it
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {unlockStatus === "error" && (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
            <XCircle className="h-4 w-4 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-yellow-700">
            <Coins className="h-4 w-4" />
            <span className="font-medium">{creditsRequired} credits</span>
          </div>
          <div className="text-sm text-muted-foreground">
            (Ksh {unlockFee})
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Your balance: <span className={cn("font-medium", !hasEnoughCredits && "text-red-600")}>{userCredits} credits</span>
        </div>

        <Button
          onClick={handleUnlock}
          disabled={isUnlocking || !hasEnoughCredits}
          className={cn(
            "w-full",
            hasEnoughCredits 
              ? "bg-yellow-600 hover:bg-yellow-700" 
              : "bg-gray-300 cursor-not-allowed"
          )}
        >
          {isUnlocking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Unlocking...
            </>
          ) : !hasEnoughCredits ? (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Insufficient Credits
            </>
          ) : (
            <>
              <Unlock className="mr-2 h-4 w-4" />
              Unlock for {creditsRequired} Credits
            </>
          )}
        </Button>

        {!hasEnoughCredits && (
          <p className="text-xs text-center text-muted-foreground">
            You need {creditsRequired - userCredits} more credits. 
            <a href="/learner/dashboard" className="text-yellow-600 hover:underline ml-1">
              Buy Credits
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
