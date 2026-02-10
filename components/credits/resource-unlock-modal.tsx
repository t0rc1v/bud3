"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Lock,
  Unlock,
  CreditCard,
  Loader2,
  CheckCircle,
  XCircle,
  Smartphone,
  Timer,
  AlertTriangle,
  Ban,
  RefreshCw,
  ShieldCheck,
  Phone,
  Info,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResourceUnlockModalProps {
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  unlockFeeKes: number;
  isUnlocked: boolean;
  trigger?: React.ReactNode;
  onUnlockSuccess?: () => void;
}

type PaymentStatus =
  | "idle"
  | "initiating"
  | "stk-pushed"
  | "processing"
  | "success"
  | "cancelled"
  | "timeout"
  | "insufficient-funds"
  | "wrong-pin"
  | "error";

interface PaymentState {
  status: PaymentStatus;
  title: string;
  message: string;
  details?: string;
  resultCode?: string;
  canRetry: boolean;
}

const PaymentStatusConfig: Record<PaymentStatus, { icon: React.ElementType; color: string; bgColor: string }> = {
  idle: { icon: CreditCard, color: "text-blue-600", bgColor: "bg-blue-50" },
  initiating: { icon: Loader2, color: "text-blue-600", bgColor: "bg-blue-50" },
  "stk-pushed": { icon: Phone, color: "text-yellow-600", bgColor: "bg-yellow-50" },
  processing: { icon: Timer, color: "text-orange-600", bgColor: "bg-orange-50" },
  success: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-50" },
  cancelled: { icon: Ban, color: "text-gray-600", bgColor: "bg-gray-50" },
  timeout: { icon: Timer, color: "text-orange-600", bgColor: "bg-orange-50" },
  "insufficient-funds": { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-50" },
  "wrong-pin": { icon: ShieldCheck, color: "text-red-600", bgColor: "bg-red-50" },
  error: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-50" },
};

export function ResourceUnlockModal({
  resourceId,
  resourceTitle,
  resourceType,
  unlockFeeKes,
  isUnlocked,
  trigger,
  onUnlockSuccess,
}: ResourceUnlockModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentState>({
    status: "idle",
    title: "",
    message: "",
    canRetry: true,
  });
  const [progress, setProgress] = useState(0);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        resetPaymentState();
      }, 300);
    }
  }, [isOpen]);

  const resetPaymentState = () => {
    setPaymentState({ status: "idle", title: "", message: "", canRetry: true });
    setCheckoutRequestId(null);
    setProgress(0);
    setPhoneNumber("");
  };

  // Handle M-Pesa payment for resource unlock
  const handlePayAndUnlock = async (e: React.FormEvent) => {
    e.preventDefault();

    setPaymentState({
      status: "initiating",
      title: "Initiating Payment...",
      message: "Please wait while we connect to M-Pesa...",
      canRetry: false,
    });

    try {
      // First, initiate M-Pesa payment for content unlock
      const paymentResponse = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          amount: unlockFeeKes,
          type: "unlock",
        }),
      });

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok || !paymentData.success) {
        setPaymentState({
          status: "error",
          title: "Payment Failed",
          message: paymentData.error || "Failed to initiate payment. Please try again.",
          canRetry: true,
        });
        return;
      }

      setCheckoutRequestId(paymentData.checkoutRequestId);
      setPaymentState({
        status: "stk-pushed",
        title: "STK Push Sent!",
        message: "Check your phone and enter your M-Pesa PIN to complete the payment.",
        details: `A payment request for Ksh ${unlockFeeKes} has been sent to ${phoneNumber}`,
        canRetry: false,
      });

      // Start polling for payment status
      pollPaymentAndUnlock(paymentData.checkoutRequestId);
    } catch (err) {
      setPaymentState({
        status: "error",
        title: "Connection Error",
        message: "Unable to connect to payment service. Please check your internet connection and try again.",
        canRetry: true,
      });
    }
  };

  const pollPaymentAndUnlock = async (checkoutId: string) => {
    let attempts = 0;
    const maxAttempts = 18; // Poll for up to 3 minutes

    const updateProgress = () => {
      const newProgress = Math.min(((attempts + 1) / maxAttempts) * 100, 95);
      setProgress(newProgress);
    };

    // Wait 12 seconds before first check
    await new Promise((resolve) => setTimeout(resolve, 12000));

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setPaymentState({
          status: "timeout",
          title: "Payment Status Unknown",
          message: "We couldn't confirm your payment status in time. Please check your M-Pesa messages.",
          details: "If the payment was successful, please refresh the page or contact support.",
          canRetry: true,
        });
        setProgress(100);
        return;
      }

      try {
        updateProgress();

        const response = await fetch("/api/payments/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutRequestId: checkoutId }),
        });

        const data = await response.json();

        if (data.status === "completed") {
          // Payment successful - now unlock the resource
          setPaymentState({
            status: "processing",
            title: "Unlocking Content...",
            message: "Payment received! Unlocking your content now...",
            canRetry: false,
          });

          try {
            const unlockResponse = await fetch("/api/content/unlock", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                resourceId,
                paymentReference: data.mpesaReceiptNumber,
              }),
            });

            const unlockData = await unlockResponse.json();

            if (unlockResponse.ok && unlockData.success) {
              setPaymentState({
                status: "success",
                title: "Content Unlocked!",
                message: `You have successfully unlocked "${resourceTitle}"`,
                details: `Receipt: ${data.mpesaReceiptNumber}. You can now view and use this resource in AI chat.`,
                canRetry: false,
              });
              setProgress(100);
              onUnlockSuccess?.();
            } else {
              setPaymentState({
                status: "error",
                title: "Unlock Failed",
                message: unlockData.error || "Payment was successful but we couldn't unlock the content. Please contact support.",
                details: `Receipt: ${data.mpesaReceiptNumber}`,
                canRetry: true,
              });
              setProgress(100);
            }
          } catch (unlockError) {
            setPaymentState({
              status: "error",
              title: "Unlock Failed",
              message: "Payment was successful but we couldn't unlock the content. Please contact support.",
              details: `Receipt: ${data.mpesaReceiptNumber}`,
              canRetry: true,
            });
            setProgress(100);
          }
          return;
        } else if (data.status === "cancelled") {
          setPaymentState({
            status: "cancelled",
            title: "Payment Cancelled",
            message: "You cancelled the payment request on your phone.",
            details: "No worries! You can try again whenever you're ready.",
            canRetry: true,
          });
          setProgress(100);
          return;
        } else if (data.status === "failed") {
          handlePaymentFailure(data);
          return;
        }

        // Still pending
        attempts++;
        setPaymentState((prev) => ({
          ...prev,
          status: "processing",
          title: "Processing Payment...",
          message: "Waiting for M-Pesa confirmation. Please don't close this window.",
          canRetry: false,
        }));
        setTimeout(poll, 10000);
      } catch (err) {
        console.error("Error polling payment status:", err);
        attempts++;
        setTimeout(poll, 10000);
      }
    };

    poll();
  };

  const handlePaymentFailure = (data: { error?: string; resultCode?: string; status?: string }) => {
    const errorMsg = (data.error || "").toLowerCase();
    const resultCode = data.resultCode || "";

    if (errorMsg.includes("cancel") || resultCode === "1032") {
      setPaymentState({
        status: "cancelled",
        title: "Payment Cancelled",
        message: "You cancelled the payment request on your phone.",
        canRetry: true,
      });
    } else if (errorMsg.includes("pin") || resultCode === "2001") {
      setPaymentState({
        status: "wrong-pin",
        title: "Incorrect PIN",
        message: "The M-Pesa PIN you entered was incorrect.",
        canRetry: true,
      });
    } else if (errorMsg.includes("funds") || errorMsg.includes("balance") || resultCode === "1") {
      setPaymentState({
        status: "insufficient-funds",
        title: "Insufficient Funds",
        message: "Your M-Pesa account doesn't have enough balance for this transaction.",
        canRetry: true,
      });
    } else {
      setPaymentState({
        status: "error",
        title: "Payment Failed",
        message: data.error || "The payment could not be completed.",
        canRetry: true,
      });
    }
    setProgress(100);
  };

  const StatusIcon = PaymentStatusConfig[paymentState.status].icon;
  const statusColors = PaymentStatusConfig[paymentState.status];

  // If already unlocked, show unlocked state
  if (isUnlocked) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="h-5 w-5" />
        <span className="text-sm font-medium">Unlocked</span>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 sm:gap-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 min-w-[80px] sm:min-w-[120px] touch-manipulation"
          >
            <Lock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Unlock Ksh {unlockFeeKes}</span>
            <span className="sm:hidden">Ksh {unlockFeeKes}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {paymentState.status === "success" ? (
              <Unlock className="h-5 w-5 text-green-600" />
            ) : (
              <Lock className="h-5 w-5 text-yellow-600" />
            )}
            {isUnlocked ? "Content Unlocked" : "Unlock Content"}
          </DialogTitle>
          <DialogDescription>
            {resourceTitle}
          </DialogDescription>
        </DialogHeader>

        {paymentState.status === "idle" ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Resource Info */}
            <Card className="border-dashed border-2 border-yellow-500/30 bg-yellow-50/30">
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg flex-shrink-0">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-base sm:text-lg truncate">{resourceTitle}</h4>
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-100 rounded">
                      {resourceType}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Info */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between p-3 sm:p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  <span className="font-medium text-sm sm:text-base">Unlock Fee</span>
                </div>
                <span className="text-base sm:text-lg font-bold">Ksh {unlockFeeKes}</span>
              </div>

              <Alert className="bg-blue-50 border-blue-200 py-2 sm:py-3">
                <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <AlertTitle className="text-blue-800 text-xs sm:text-sm">What you get</AlertTitle>
                <AlertDescription className="text-blue-700 text-xs sm:text-sm">
                  Permanent access to view this resource
                </AlertDescription>
              </Alert>
            </div>

            {/* Payment Form */}
            <form onSubmit={handlePayAndUnlock} className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2 text-sm sm:text-base">
                  <Smartphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  M-Pesa Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="e.g., 0712345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  className="h-10 sm:h-11 text-base"
                  autoComplete="tel"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You will receive an M-Pesa STK push on this number
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-yellow-600 hover:bg-yellow-700 h-11 sm:h-12 text-sm sm:text-base touch-manipulation"
                disabled={!phoneNumber}
              >
                <CreditCard className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Pay Ksh {unlockFeeKes}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground px-2">
              Once unlocked, you can view this resource anytime.
            </p>
          </div>
        ) : (
          /* Payment Status */
          <div className="space-y-3 sm:space-y-4">
            <Card className={cn("border-2", statusColors.bgColor.replace("bg-", "border-"))}>
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                <div className="text-center space-y-3 sm:space-y-4">
                  <div className={cn("mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center", statusColors.bgColor)}>
                    <StatusIcon
                      className={cn(
                        "h-6 w-6 sm:h-8 sm:w-8",
                        statusColors.color,
                        paymentState.status === "initiating" || paymentState.status === "processing" ? "animate-spin" : ""
                      )}
                    />
                  </div>

                  <div className="px-2">
                    <h3 className="text-base sm:text-lg font-semibold">{paymentState.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">{paymentState.message}</p>
                    {paymentState.details && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-2">{paymentState.details}</p>
                    )}
                  </div>

                  {(paymentState.status === "initiating" ||
                    paymentState.status === "stk-pushed" ||
                    paymentState.status === "processing") && (
                    <div className="space-y-2">
                      <Progress value={progress} className="w-full" />
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {paymentState.status === "stk-pushed" && "Waiting for PIN..."}
                        {paymentState.status === "processing" && "Confirming payment..."}
                        {paymentState.status === "initiating" && "Processing..."}
                      </p>
                    </div>
                  )}

                  {paymentState.status === "stk-pushed" && (
                    <Alert className="bg-yellow-50 border-yellow-200 py-2 sm:py-3">
                      <Info className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                      <AlertTitle className="text-yellow-800 text-xs sm:text-sm">What to expect</AlertTitle>
                      <AlertDescription className="text-yellow-700 text-xs sm:text-sm">
                        1. Check your phone
                        <br />
                        2. Enter M-Pesa PIN
                        <br />
                        3. Wait 10-30 seconds
                      </AlertDescription>
                    </Alert>
                  )}

                  {paymentState.status === "success" && (
                    <Button onClick={() => setIsOpen(false)} className="w-full h-10 sm:h-11 text-sm sm:text-base">
                      <CheckCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      Done
                    </Button>
                  )}

                  {paymentState.canRetry && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={resetPaymentState} 
                        className="flex-1 h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Try Again
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={() => setIsOpen(false)}
                        className="h-10 sm:h-11 px-3 sm:px-4"
                      >
                        Close
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
