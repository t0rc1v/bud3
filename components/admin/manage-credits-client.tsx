"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Gift, 
  Coins, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Search,
  RefreshCw,
  User,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ManageCreditsClientProps {
  canGift: boolean;
  canManage: boolean;
  currentUserId: string;
}

export function ManageCreditsClient({ 
  canGift, 
  canManage,
  currentUserId 
}: ManageCreditsClientProps) {
  const [activeTab, setActiveTab] = useState("gift");
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Credits</h1>
          <p className="text-muted-foreground">
            Gift credits to users and manage credit system settings
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          {canGift && (
            <TabsTrigger value="gift" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Gift Credits
            </TabsTrigger>
          )}
          {canManage && (
            <TabsTrigger value="pricing" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing
            </TabsTrigger>
          )}
        </TabsList>

        {canGift && (
          <TabsContent value="gift" className="space-y-4">
            <GiftCreditsTab />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="pricing" className="space-y-4">
            <PricingTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ============== GIFT CREDITS TAB ==============

function GiftCreditsTab() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    userId?: string;
    email?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/credits/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount, reason }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult({
          success: true,
          message: `Successfully gifted ${amount} credits to ${email}`,
          userId: data.userId,
          email: data.email,
        });
        // Reset form
        setEmail("");
        setAmount(50);
        setReason("");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Gift Credits to User
        </CardTitle>
        <CardDescription>
          Gift AI credits to a user by their email address. This will add credits to their balance immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result && (
          <div className={cn(
            "mb-6 p-4 rounded-lg",
            result.success ? "bg-green-500/10 border border-green-500/50" : "bg-red-500/10 border border-red-500/50"
          )}>
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div>
                <p className={cn(
                  "font-medium",
                  result.success ? "text-green-700" : "text-red-700"
                )}>
                  {result.success ? "Success!" : "Error"}
                </p>
                <p className="text-sm text-muted-foreground">{result.message}</p>
              </div>
            </div>
          </div>
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
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
            <p className="text-xs text-muted-foreground">
              Number of credits to gift (minimum 1)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Reason
            </Label>
            <Textarea
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
            disabled={isSubmitting || !email || !reason || amount < 1}
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

// ============== PRICING TAB ==============

function PricingTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Credit Pricing
        </CardTitle>
        <CardDescription>
          Current credit pricing configuration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Credits per Purchase</p>
                <p className="text-2xl font-bold">50 credits</p>
                <p className="text-sm text-muted-foreground">for Ksh 100</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Minimum Purchase</p>
                <p className="text-2xl font-bold">Ksh 100</p>
                <p className="text-sm text-muted-foreground">minimum amount</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">AI Response Cost</p>
                <p className="text-2xl font-bold">1 credit</p>
                <p className="text-sm text-muted-foreground">per response</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-4">Credit Packages</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Price (Ksh)</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Basic</TableCell>
                  <TableCell>50 credits</TableCell>
                  <TableCell>Ksh 100</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Base rate</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Standard</TableCell>
                  <TableCell>150 credits</TableCell>
                  <TableCell>Ksh 300</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Base rate</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Premium</TableCell>
                  <TableCell>500 credits</TableCell>
                  <TableCell>Ksh 1,000</TableCell>
                  <TableCell>
                    <Badge variant="default">5% bonus</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Ultimate</TableCell>
                  <TableCell>1,000 credits</TableCell>
                  <TableCell>Ksh 2,000</TableCell>
                  <TableCell>
                    <Badge variant="default">10% bonus</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-4">Unlock Fees</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content Type</TableHead>
                  <TableHead>Default Fee (Ksh)</TableHead>
                  <TableHead>Credits Required</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Resource</TableCell>
                  <TableCell>Ksh 100</TableCell>
                  <TableCell>50 credits</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Topic</TableCell>
                  <TableCell>Ksh 100</TableCell>
                  <TableCell>50 credits</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Subject</TableCell>
                  <TableCell>Ksh 100</TableCell>
                  <TableCell>50 credits</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground mt-4">
              Note: Unlock fees can be customized per resource, topic, or subject in the content management section.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
