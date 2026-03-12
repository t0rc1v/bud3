"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Gift,
  Coins,
  Loader2,
  CheckCircle,
  XCircle,
  User,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminRewardsManagerProps {
  userRole: "super_admin" | "admin";
  hasCreditReward: boolean;
}

export function AdminRewardsManager({ userRole, hasCreditReward }: AdminRewardsManagerProps) {
  const canManageRewards = userRole === "super_admin" || hasCreditReward;

  if (!canManageRewards) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Access Denied</h3>
            <p className="text-sm text-muted-foreground mt-2">
              You don&apos;t have permission to manage rewards.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rewards</h1>
          <p className="text-muted-foreground">
            Gift credits to users
          </p>
        </div>
        <Badge variant={userRole === "super_admin" ? "default" : "secondary"}>
          {userRole === "super_admin" ? "Super Admin" : "Admin"}
        </Badge>
      </div>

      <GiftCreditsTab userRole={userRole} />
    </div>
  );
}

// ============== GIFT CREDITS TAB ==============

interface GiftCreditsTabProps {
  userRole: "super_admin" | "admin";
}

function GiftCreditsTab({ userRole }: GiftCreditsTabProps) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState("");
  const [expirationDays, setExpirationDays] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminBalance, setAdminBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    userId?: string;
    email?: string;
  } | null>(null);
  const MINIMUM_BALANCE = 100;
  const isSuperAdmin = userRole === "super_admin";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch admin's credit balance on mount
  useEffect(() => {
    fetchAdminBalance();
  }, []);

  const fetchAdminBalance = async () => {
    try {
      const response = await fetch("/api/credits/balance");
      if (response.ok) {
        const data = await response.json();
        setAdminBalance(data.balance ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch admin balance:", error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/credits/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          amount, 
          reason,
          expirationDays: isSuperAdmin && expirationDays === 0 ? null : expirationDays 
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult({
          success: true,
          message: data.message || `Successfully gifted ${amount} credits to ${email}${data.expiresAt ? ` (expires: ${new Date(data.expiresAt).toLocaleDateString()})` : ' (never expires)'}`,
          userId: data.userId,
          email: data.email,
        });
        // Refresh balance after successful gift
        fetchAdminBalance();
        setEmail("");
        setAmount(50);
        setReason("");
        setExpirationDays(30);
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to gift credits",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableToGift = adminBalance !== null ? Math.max(0, adminBalance - MINIMUM_BALANCE) : 0;
  const canGift = adminBalance !== null && amount > 0 && amount <= availableToGift;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Gift AI Credits
        </CardTitle>
        <CardDescription>
          {isSuperAdmin 
            ? "Gift AI credits to a user by their email address. Credits will be added to their balance immediately."
            : "Gift AI credits to a user by their email address. Credits will be deducted from your account and added to theirs immediately."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result && (
          <Alert className={cn(
            "mb-6",
            result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
          )}>
            {result.success ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertTitle className={result.success ? "text-green-800" : "text-red-800"}>
              {result.success ? "Success!" : "Error"}
            </AlertTitle>
            <AlertDescription className={result.success ? "text-green-700" : "text-red-700"}>
              {result.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Credit Balance Display - Only for regular admins */}
        {!isSuperAdmin && (
          <Alert className="mb-6 bg-primary/15 border-primary/60">
            <Coins className="h-4 w-4 text-foreground" />
            <AlertTitle className="text-foreground">Your Credit Balance</AlertTitle>
            <AlertDescription className="text-foreground">
              {isLoadingBalance ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </span>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold">{adminBalance ?? 0} credits available</p>
                  <p className="text-sm">
                    Minimum balance to maintain: {MINIMUM_BALANCE} credits
                  </p>
                  <p className="text-sm font-medium">
                    Available to gift: {availableToGift} credits
                  </p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              User Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              The user must already have an account in the system
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Amount (Credits)
            </Label>
            <Input
              id="amount"
              type="number"
              min={1}
              max={!isSuperAdmin && availableToGift > 0 ? availableToGift : undefined}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              disabled={!isSuperAdmin && (isLoadingBalance || availableToGift === 0)}
            />
            {!isSuperAdmin && availableToGift === 0 && !isLoadingBalance && (
              <p className="text-xs text-red-500">
                Insufficient credits. You need at least {MINIMUM_BALANCE + 1} credits to gift.
              </p>
            )}
            {!isSuperAdmin && amount > availableToGift && availableToGift > 0 && (
              <p className="text-xs text-red-500">
                Amount exceeds available credits ({availableToGift} credits available to gift)
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {isSuperAdmin 
                ? "Number of credits to gift (minimum 1)"
                : `Number of credits to gift (minimum 1, maximum ${availableToGift > 0 ? availableToGift : 0})`}
            </p>
          </div>

          {/* Expiration Settings */}
          <div className="space-y-3 p-4 bg-muted rounded-lg border border-border">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <RefreshCw className="h-4 w-4" />
              Expiration Settings
            </Label>
            
            {/* Expiration Type Selection */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Choose expiration type:</Label>
              <div className="grid grid-cols-1 gap-2">
                {/* Default 30 Days Option */}
                <label className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border cursor-pointer hover:border-primary transition-colors">
                  <input
                    type="radio"
                    name="expirationType"
                    checked={expirationDays === 30}
                    onChange={() => setExpirationDays(30)}
                    className="w-4 h-4 text-foreground"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-sm">Default (30 days)</span>
                    <p className="text-xs text-muted-foreground">Credits expire 30 days from today</p>
                  </div>
                  <Badge variant="secondary">Standard</Badge>
                </label>

                {/* Custom Date Option */}
                <label className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border cursor-pointer hover:border-primary transition-colors">
                  <input
                    type="radio"
                    name="expirationType"
                    checked={expirationDays !== 30 && expirationDays !== 0}
                    onChange={() => setExpirationDays(60)}
                    className="w-4 h-4 text-foreground"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-sm">Custom Expiration</span>
                    <p className="text-xs text-muted-foreground">Set a specific expiration date</p>
                  </div>
                  <Badge variant="outline">Custom</Badge>
                </label>

                {/* Super Admin Only - Never Expire Option */}
                {isSuperAdmin && (
                  <label className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="radio"
                      name="expirationType"
                      checked={expirationDays === 0}
                      onChange={() => setExpirationDays(0)}
                      className="w-4 h-4 text-foreground"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-sm text-foreground">Never Expire</span>
                      <p className="text-xs text-muted-foreground">Credits never expire (Super Admin only)</p>
                    </div>
                    <Badge className="bg-primary text-primary-foreground border-primary/70">Premium</Badge>
                  </label>
                )}
              </div>
            </div>

            {/* Custom Days Input (shown when custom is selected) */}
            {expirationDays !== 30 && expirationDays !== 0 && (
              <div className="pt-2 border-t border-border">
                <Label htmlFor="customExpiration" className="text-sm mb-2 block">
                  Custom Expiration (Days from today)
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="customExpiration"
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">
                    = Expires on {mounted ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toLocaleDateString() : "..."}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Enter a number between 1 and 365 days
                </p>
              </div>
            )}

            {/* Summary Display */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Expiration Date:</span>
                <span className={cn(
                  "text-sm font-semibold",
                  expirationDays === 0 ? "text-foreground" : "text-foreground"
                )}>
                  {expirationDays === 0 
                    ? "Never expires" 
                    : mounted ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toLocaleDateString() : "..."}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Reason
            </Label>
            <Input
              id="reason"
              placeholder="Why are you gifting these credits?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              This will be recorded in the transaction history
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isSubmitting || !email || !reason || (!isSuperAdmin && !canGift) || (!isSuperAdmin && isLoadingBalance)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Gift className="mr-2 h-4 w-4" />
                Gift {amount} Credits
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

