"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Coins, 
  CreditCard, 
  History, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Smartphone,
  ArrowRight,
  Gift,
  Zap,
  Wallet,
  Timer,
  AlertTriangle,
  Ban,
  RefreshCw,
  ShieldCheck,
  Phone,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditBalance {
  balance: number;
  totalBalance: number;
  expiredCredits: number;
  expiringSoon: {
    count: number;
    credits: number;
  };
  history: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
    expiresAt: string | null;
  }>;
  pricing: {
    minimumPurchase: number;
    creditsPerUnit: number;
    kesPerUnit: number;
  };
  expiration: {
    days: number;
    warningDays: number;
  };
}

interface CreditModalProps {
  trigger?: React.ReactNode;
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
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

export function CreditModal({ trigger, className, isOpen: controlledIsOpen, onOpenChange }: CreditModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (controlledIsOpen === undefined) {
      setInternalIsOpen(open);
    }
    onOpenChange?.(open);
  };
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentState, setPaymentState] = useState<PaymentState>({ 
    status: "idle", 
    title: "",
    message: "",
    canRetry: true
  });
  const [progress, setProgress] = useState(0);
  
  // Purchase form state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState(100);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [mpesaReceiptNumber, setMpesaReceiptNumber] = useState<string | null>(null);
  const [creditsToReceive, setCreditsToReceive] = useState(50);

  useEffect(() => {
    if (isOpen) {
      fetchBalance();
    }
  }, [isOpen]);

  // Reset payment state when dialog closes
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
    setMpesaReceiptNumber(null);
    setProgress(0);
    setPhoneNumber("");
    setAmount(100);
    setCreditsToReceive(50);
  };

  const fetchBalance = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/credits/balance");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBalance(data);
        }
      }
    } catch (err) {
      console.error("Error fetching balance:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setPaymentState({
      status: "initiating",
      title: "Initiating Payment...",
      message: "Please wait while we connect to M-Pesa...",
      canRetry: false
    });
    setCreditsToReceive(Math.floor((amount / 100) * 50));

    try {
      const response = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          amount,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCheckoutRequestId(data.checkoutRequestId);
        setPaymentState({
          status: "stk-pushed",
          title: "STK Push Sent!",
          message: "Check your phone and enter your M-Pesa PIN to complete the payment.",
          details: `A payment request has been sent to ${phoneNumber}`,
          canRetry: false
        });
        // Start polling for status
        pollPaymentStatus(data.checkoutRequestId);
      } else {
        setPaymentState({
          status: "error",
          title: "Payment Failed",
          message: data.error || "Failed to initiate payment. Please try again.",
          canRetry: true
        });
      }
    } catch (err) {
      setPaymentState({
        status: "error",
        title: "Connection Error",
        message: "Unable to connect to payment service. Please check your internet connection and try again.",
        canRetry: true
      });
    }
  };

  const pollPaymentStatus = async (checkoutId: string) => {
    let attempts = 0;
    const maxAttempts = 18; // Poll for up to 3 minutes (every 10 seconds)
    
    // Update progress bar
    const updateProgress = () => {
      const newProgress = Math.min(((attempts + 1) / maxAttempts) * 100, 95);
      setProgress(newProgress);
    };
    
    // Wait 12 seconds before first check (give user time to receive and respond to push)
    await new Promise(resolve => setTimeout(resolve, 12000));
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        setPaymentState({
          status: "timeout",
          title: "Payment Status Unknown",
          message: "We couldn't confirm your payment status in time. Please check your M-Pesa messages or balance.",
          details: "If the payment was successful, your credits will be added shortly. You can also check your balance to verify.",
          canRetry: true
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
          setMpesaReceiptNumber(data.mpesaReceiptNumber);
          setPaymentState({
            status: "success",
            title: "Payment Successful!",
            message: `Your payment of Ksh ${amount} was successful.`,
            details: `Receipt: ${data.mpesaReceiptNumber}. ${data.credits} credits have been added to your account.`,
            canRetry: false
          });
          setProgress(100);
          fetchBalance(); // Refresh balance
          return;
        } else if (data.status === "cancelled") {
          // User cancelled
          setPaymentState({
            status: "cancelled",
            title: "Payment Cancelled",
            message: "You cancelled the payment request on your phone.",
            details: "No worries! You can try again whenever you're ready.",
            canRetry: true
          });
          setProgress(100);
          return;
        } else if (data.status === "failed") {
          handlePaymentFailure(data);
          return;
        }

        // Still pending, update UI and poll again
        attempts++;
        setPaymentState(prev => ({
          ...prev,
          status: "processing",
          title: "Processing Payment...",
          message: "Waiting for M-Pesa confirmation. Please don't close this window.",
          canRetry: false
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

  interface PaymentFailureData {
    error?: string;
    resultCode?: string;
    status?: string;
    credits?: number;
    mpesaReceiptNumber?: string;
  }

  const handlePaymentFailure = (data: PaymentFailureData) => {
    const errorMsg = (data.error || "").toLowerCase();
    const resultCode = data.resultCode || "";
    
    // User cancelled
    if (errorMsg.includes("cancel") || resultCode === "1032") {
      setPaymentState({
        status: "cancelled",
        title: "Payment Cancelled",
        message: "You cancelled the payment request on your phone.",
        details: "No worries! You can try again whenever you're ready.",
        resultCode: "1032",
        canRetry: true
      });
    }
    // Wrong PIN
    else if (errorMsg.includes("pin") || resultCode === "2001") {
      setPaymentState({
        status: "wrong-pin",
        title: "Incorrect PIN",
        message: "The M-Pesa PIN you entered was incorrect.",
        details: "Please try again and make sure you enter the correct PIN.",
        resultCode: "2001",
        canRetry: true
      });
    }
    // Insufficient funds
    else if (errorMsg.includes("funds") || errorMsg.includes("balance") || resultCode === "1") {
      setPaymentState({
        status: "insufficient-funds",
        title: "Insufficient Funds",
        message: "Your M-Pesa account doesn't have enough balance for this transaction.",
        details: `Required: Ksh ${amount}. Please top up your M-Pesa account and try again.`,
        resultCode: "1",
        canRetry: true
      });
    }
    // Generic failure
    else {
      setPaymentState({
        status: "error",
        title: "Payment Failed",
        message: data.error || "The payment could not be completed.",
        details: "Please try again or contact support if the problem persists.",
        resultCode: resultCode,
        canRetry: true
      });
    }
    setProgress(100);
  };

  const presetAmounts = [100, 200, 500, 1000];
  const creditsForAmount = (kes: number) => Math.floor((kes / 100) * 50);

  const StatusIcon = PaymentStatusConfig[paymentState.status].icon;
  const statusColors = PaymentStatusConfig[paymentState.status];

  const renderPaymentStatus = () => {
    if (paymentState.status as string === "idle") {
      return (
        <form onSubmit={handlePurchase} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Purchase Amount (Ksh)</Label>
            <div className="grid grid-cols-4 gap-2">
              {presetAmounts.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={amount === preset ? "default" : "outline"}
                  onClick={() => setAmount(preset)}
                  className="w-full"
                >
                  Ksh {preset}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4">
              <Input
                id="amount"
                type="number"
                min={balance?.pricing.minimumPurchase || 100}
                step={100}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="flex-1"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
                <span className="font-medium text-foreground">
                  {creditsForAmount(amount)} credits
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum purchase: Ksh {balance?.pricing.minimumPurchase || 100} ({balance?.pricing.creditsPerUnit || 50} credits)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              M-Pesa Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g., 0712345678 or 254712345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              You will receive an M-Pesa STK push notification on this number
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={!["idle", "error", "cancelled", "timeout", "wrong-pin", "insufficient-funds"].includes(paymentState.status as string) || amount < (balance?.pricing.minimumPurchase || 100)}
          >
            {paymentState.status as string === "initiating" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting to M-Pesa...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay Ksh {amount} with M-Pesa
              </>
            )}
          </Button>
        </form>
      );
    }

    return (
      <div className="space-y-4">
        <Card className={cn("border-2", statusColors.bgColor.replace("bg-", "border-"))}>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className={cn("mx-auto w-16 h-16 rounded-full flex items-center justify-center", statusColors.bgColor)}>
                <StatusIcon className={cn("h-8 w-8", statusColors.color, paymentState.status as string === "initiating" || paymentState.status as string === "processing" ? "animate-spin" : "")} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold">{paymentState.title}</h3>
                <p className="text-muted-foreground mt-1">{paymentState.message}</p>
                {paymentState.details && (
                  <p className="text-sm text-muted-foreground mt-2">{paymentState.details}</p>
                )}
              </div>

              {(paymentState.status as string === "initiating" || paymentState.status as string === "stk-pushed" || paymentState.status as string === "processing") && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    {paymentState.status as string === "stk-pushed" && "Waiting for PIN confirmation..."}
                    {paymentState.status as string === "processing" && "Confirming payment with M-Pesa..."}
                    {paymentState.status as string === "initiating" && "Connecting to M-Pesa..."}
                  </p>
                </div>
              )}

              {paymentState.status as string === "stk-pushed" && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <Info className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800">What to expect</AlertTitle>
                  <AlertDescription className="text-yellow-700 text-sm">
                    1. Check your phone for an M-Pesa notification<br/>
                    2. Enter your M-Pesa PIN<br/>
                    3. Wait for confirmation (usually takes 10-30 seconds)
                  </AlertDescription>
                </Alert>
              )}

              {paymentState.status as string === "success" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">{creditsToReceive} credits added!</span>
                  </div>
                  <Button onClick={() => setIsOpen(false)} className="w-full">
                    Close
                  </Button>
                </div>
              )}

              {paymentState.canRetry && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={resetPaymentState}
                    className="flex-1"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setIsOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              )}

              {paymentState.resultCode && paymentState.status !== "success" && (
                <p className="text-xs text-muted-foreground">
                  Error code: {paymentState.resultCode}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {paymentState.status as string === "timeout" && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">What should I do?</AlertTitle>
            <AlertDescription className="text-blue-700 text-sm">
              1. Check your M-Pesa SMS messages for a confirmation<br/>
              2. Check your credit balance - credits may have been added already<br/>
              3. If payment was deducted but no credits received, contact support
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  // Show default trigger button only in uncontrolled mode when no trigger provided
  const showDefaultTrigger = !trigger && controlledIsOpen === undefined;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {(trigger || showDefaultTrigger) && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" className={cn("gap-2", className)}>
              <Coins className="h-4 w-4" />
              <span>Buy Credits</span>
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            AI Credits
          </DialogTitle>
          <DialogDescription>
            Manage your AI credits for unlocking content and getting AI responses
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : balance ? (
          <Tabs defaultValue="balance" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="balance" className="gap-2">
                <Coins className="h-4 w-4" />
                Balance
              </TabsTrigger>
              <TabsTrigger value="purchase" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Buy Credits
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="balance" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{balance.balance}</span>
                    <span className="text-muted-foreground">credits</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    1 credit = 1 AI response
                  </p>
                  {balance.expiringSoon.credits > 0 && (
                    <Alert className="mt-4 bg-orange-50 border-orange-200">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertTitle className="text-orange-800">Credits Expiring Soon</AlertTitle>
                      <AlertDescription className="text-orange-700 text-sm">
                        {balance.expiringSoon.credits} credits will expire within {balance.expiration?.warningDays || 7} days. Use them before they expire!
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">AI Responses</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">
                      {Math.floor(balance.balance / 1)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      responses available
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Unlocks</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">
                      {Math.floor(balance.balance / 50)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      content unlocks available
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Credit Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Credit Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Active Credits</span>
                    <span className="font-medium">{balance.balance}</span>
                  </div>
                  {balance.expiredCredits > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Expired Credits</span>
                      <span className="font-medium text-red-500">{balance.expiredCredits}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Credits (All Time)</span>
                    <span className="font-medium">{balance.totalBalance}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Credits expire {balance.expiration?.days || 30} days from purchase/gift date.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="purchase" className="space-y-4">
              {renderPaymentStatus()}
            </TabsContent>

            <TabsContent value="history">
              <ScrollArea className="h-[400px]">
                {balance.history.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No transactions yet</p>
                    <p className="text-sm">Purchase credits to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {balance.history.map((transaction) => {
                      const isExpired = transaction.expiresAt && new Date(transaction.expiresAt) < new Date();
                      const isExpiringSoon = transaction.expiresAt && 
                        !isExpired && 
                        new Date(transaction.expiresAt) <= new Date(Date.now() + (balance.expiration?.warningDays || 7) * 24 * 60 * 60 * 1000);
                      
                      return (
                        <Card key={transaction.id} className={cn(
                          isExpired && "opacity-60"
                        )}>
                          <CardContent className="flex items-center justify-between py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-full",
                                transaction.amount > 0 ? "bg-green-500/10" : "bg-red-500/10"
                              )}>
                                {transaction.amount > 0 ? (
                                  <Gift className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Zap className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{transaction.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(transaction.createdAt).toLocaleDateString()}
                                </p>
                                {transaction.amount > 0 && transaction.expiresAt && (
                                  <p className={cn(
                                    "text-xs mt-1",
                                    isExpired ? "text-red-500" : isExpiringSoon ? "text-orange-500" : "text-muted-foreground"
                                  )}>
                                    {isExpired ? (
                                      <>Expired on {new Date(transaction.expiresAt).toLocaleDateString()}</>
                                    ) : isExpiringSoon ? (
                                      <>Expires soon: {new Date(transaction.expiresAt).toLocaleDateString()}</>
                                    ) : (
                                      <>Expires: {new Date(transaction.expiresAt).toLocaleDateString()}</>
                                    )}
                                  </p>
                                )}
                                {transaction.amount > 0 && !transaction.expiresAt && (
                                  <p className="text-xs text-green-600 mt-1">
                                    Never expires
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge 
                              variant={transaction.amount > 0 ? "default" : "secondary"}
                              className={cn(
                                transaction.amount > 0 ? "bg-green-500" : "",
                                isExpired && "bg-gray-400"
                              )}
                            >
                              {transaction.amount > 0 ? "+" : ""}{transaction.amount}
                            </Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Failed to load credit information</p>
            <Button onClick={fetchBalance} variant="outline" className="mt-4">
              Retry
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Credit badge component for showing balance in header/nav
export const CreditBadge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { className?: string }
>(({ className, ...props }, ref) => {
  const [balance, setBalance] = useState<number | null>(null);

  const fetchBalance = async () => {
    try {
      const response = await fetch("/api/credits/balance");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBalance(data.balance);
        }
      }
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  };

  useEffect(() => {
    // Fetch balance on mount
    const loadBalance = async () => {
      await fetchBalance();
    };
    loadBalance();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchBalance();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium cursor-pointer hover:bg-yellow-500/20 transition-colors",
        "bg-yellow-500/10 text-yellow-700 border border-yellow-500/20",
        className
      )}
      {...props}
    >
      <Coins className="h-3.5 w-3.5" />
      <span>{balance !== null ? balance : "-"}</span>
    </div>
  );
});
CreditBadge.displayName = "CreditBadge";
