"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Unlock, Coins, Loader2, CheckCircle, XCircle, CreditCard, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentMethod = "credits" | "mpesa";

interface ContentLockProps {
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  unlockFee: number;
  creditsRequired: number;
  isUnlocked: boolean;
  onUnlock: (paymentMethod: PaymentMethod) => Promise<void>;
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credits");

  const hasEnoughCredits = userCredits >= creditsRequired;

  const handleUnlock = async () => {
    if (paymentMethod === "credits" && !hasEnoughCredits) return;
    
    setIsUnlocking(true);
    setUnlockStatus("idle");
    setErrorMessage("");

    try {
      await onUnlock(paymentMethod);
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
          Choose your payment method to unlock this {resourceType}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {unlockStatus === "error" && (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
            <XCircle className="h-4 w-4 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <Tabs 
          value={paymentMethod} 
          onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="credits" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              <span className="hidden sm:inline">Credits</span>
            </TabsTrigger>
            <TabsTrigger value="mpesa" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">M-Pesa</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="credits" className="mt-4 space-y-4">
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
                <a href="/regular" className="text-yellow-600 hover:underline ml-1">
                  Buy Credits
                </a>
              </p>
            )}
          </TabsContent>

          <TabsContent value="mpesa" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-700">
                <CreditCard className="h-4 w-4" />
                <span className="font-medium">Ksh {unlockFee}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                (Direct Payment)
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Pay instantly via M-Pesa STK push
            </div>

            <Button
              onClick={handleUnlock}
              disabled={isUnlocking}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isUnlocking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Smartphone className="mr-2 h-4 w-4" />
                  Pay Ksh {unlockFee} with M-Pesa
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
