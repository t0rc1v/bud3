"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Gift, 
  Unlock, 
  Coins, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Search,
  User,
  MessageSquare,
  BookOpen,
  AlertTriangle,
  FileText,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SuperAdminRewardsManager() {
  const [activeTab, setActiveTab] = useState("credits");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rewards & Unlocks</h1>
          <p className="text-muted-foreground">
            Gift credits from your credit pool and unlock content for users
          </p>
        </div>
        <Badge variant="default">
          Super Admin
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Gift Credits
          </TabsTrigger>
          <TabsTrigger value="unlock" className="flex items-center gap-2">
            <Unlock className="h-4 w-4" />
            Unlock Content
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credits" className="space-y-4">
          <GiftCreditsTab />
        </TabsContent>

        <TabsContent value="unlock" className="space-y-4">
          <UnlockContentTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== GIFT CREDITS TAB ==============

function GiftCreditsTab() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState("");
  const [expirationDays, setExpirationDays] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminBalance, setAdminBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const MINIMUM_BALANCE = 100;
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    userId?: string;
    email?: string;
  } | null>(null);

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
          expirationDays: expirationDays === 0 ? null : expirationDays 
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
          Gift AI credits to a user by their email address. Credits will be deducted from your credit pool and added to their balance immediately.
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

        {/* Credit Balance Display */}
        <Alert className="mb-6 bg-primary/15 border-primary/60">
          <Coins className="h-4 w-4 text-foreground" />
          <AlertTitle className="text-foreground">Your Credit Pool Balance</AlertTitle>
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
              max={availableToGift > 0 ? availableToGift : undefined}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              disabled={isLoadingBalance || availableToGift === 0}
            />
            {availableToGift === 0 && !isLoadingBalance && (
              <p className="text-xs text-red-500">
                Insufficient credits. You need at least {MINIMUM_BALANCE + 1} credits to gift.
              </p>
            )}
            {amount > availableToGift && availableToGift > 0 && (
              <p className="text-xs text-red-500">
                Amount exceeds available credits ({availableToGift} credits available to gift)
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Number of credits to gift (minimum 1, maximum {availableToGift > 0 ? availableToGift : 0})
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

                {/* Never Expire Option - Super Admin Only */}
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
                    = Expires on {new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
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
                    : new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
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
            disabled={isSubmitting || !email || !reason || !canGift || isLoadingBalance}
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

// ============== UNLOCK CONTENT TAB ==============

interface ContentItem {
  id: string;
  name: string;
  type: "level" | "subject" | "topic" | "resource";
  children?: ContentItem[];
}

function UnlockContentTab() {
  const [email, setEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState<{ email: string; userId: string; name?: string } | null>(null);
  const [contentHierarchy, setContentHierarchy] = useState<ContentItem[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Load content hierarchy on mount
  useEffect(() => {
    loadContentHierarchy();
  }, []);

  const loadContentHierarchy = async () => {
    setIsLoadingContent(true);
    try {
      const response = await fetch("/api/content/hierarchy");
      if (response.ok) {
        const data = await response.json();
        setContentHierarchy(data.grades || []);
      }
    } catch (error) {
      console.error("Failed to load content hierarchy:", error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const searchUser = async () => {
    if (!email) return;
    setIsSearching(true);
    setUserData(null);
    
    try {
      const response = await fetch(`/api/admin/users/search?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      
      if (response.ok && data.user) {
        setUserData(data.user);
      } else {
        setResult({
          success: false,
          message: "User not found with this email address",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Failed to search for user",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleExpand = (id: string, type: Set<string>, setType: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setType(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleUnlock = async () => {
    if (!userData || !selectedResourceId) return;
    
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/content/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: userData.email,
          resourceId: selectedResourceId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult({
          success: true,
          message: `Successfully unlocked content for ${userData.email}`,
        });
        setSelectedResourceId(null);
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to unlock content",
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

  const renderContentTree = (items: ContentItem[], depth = 0) => {
    return items.map((item) => {
      const isExpanded = 
        item.type === "level" ? expandedLevels.has(item.id) :
        item.type === "subject" ? expandedSubjects.has(item.id) :
        item.type === "topic" ? expandedTopics.has(item.id) : false;

      const hasChildren = item.children && item.children.length > 0;
      const isSelectable = item.type === "resource";
      const isSelected = selectedResourceId === item.id;

      return (
        <div key={item.id} style={{ marginLeft: depth * 16 }}>
          <div 
            className={cn(
              "flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer transition-colors",
              isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
              isSelectable ? "cursor-pointer" : "cursor-default"
            )}
            onClick={() => {
              if (isSelectable) {
                setSelectedResourceId(item.id);
              } else if (hasChildren) {
                if (item.type === "level") toggleExpand(item.id, expandedLevels, setExpandedLevels);
                else if (item.type === "subject") toggleExpand(item.id, expandedSubjects, setExpandedSubjects);
                else if (item.type === "topic") toggleExpand(item.id, expandedTopics, setExpandedTopics);
              }
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <div className="w-4" />
            )}
            
            {item.type === "level" && <FolderOpen className="h-4 w-4 text-primary" />}
            {item.type === "subject" && <BookOpen className="h-4 w-4 text-primary" />}
            {item.type === "topic" && <FileText className="h-4 w-4 text-yellow-500" />}
            {item.type === "resource" && <FileText className="h-4 w-4 text-gray-500" />}
            
            <span className="text-sm">{item.name}</span>
            
            {isSelected && (
              <Badge variant="default" className="ml-auto text-xs">Selected</Badge>
            )}
          </div>
          
          {hasChildren && isExpanded && (
            <div className="mt-1">
              {renderContentTree(item.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Unlock className="h-5 w-5" />
          Unlock Content for User
        </CardTitle>
        <CardDescription>
          Select a user and choose content to unlock. The user will gain immediate access without paying.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {result && (
          <Alert className={cn(
            result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
          )}>
            {result.success ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <AlertTitle className={result.success ? "text-green-800" : "text-red-800"}>
              {result.success ? "Success!" : "Error"}
            </AlertTitle>
            <AlertDescription className={result.success ? "text-green-700" : "text-red-700"}>
              {result.message}
            </AlertDescription>
          </Alert>
        )}

        {/* User Search */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <User className="h-4 w-4" />
            User Email
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button 
              type="button" 
              variant="outline"
              onClick={searchUser}
              disabled={isSearching || !email}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          {userData && (
            <div className="p-3 bg-primary/15 border border-primary/60 rounded-md">
              <p className="text-sm text-foreground">
                <CheckCircle className="h-4 w-4 inline mr-2" />
                User found: {userData.email}
              </p>
            </div>
          )}
        </div>

        {/* Content Tree */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Select Resource to Unlock
          </Label>
          <div className="border rounded-md p-4 max-h-[400px] overflow-y-auto bg-muted/50">
            {isLoadingContent ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : contentHierarchy.length > 0 ? (
              renderContentTree(contentHierarchy)
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No content available
              </p>
            )}
          </div>
          {selectedResourceId && (
            <p className="text-sm text-muted-foreground">
              Selected resource ID: <code className="bg-muted px-1 rounded">{selectedResourceId}</code>
            </p>
          )}
        </div>

        {/* Unlock Button */}
        <Button 
          className="w-full"
          disabled={isSubmitting || !userData || !selectedResourceId}
          onClick={handleUnlock}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Unlocking...
            </>
          ) : (
            <>
              <Unlock className="mr-2 h-4 w-4" />
              {userData && selectedResourceId 
                ? `Unlock Selected Content for ${userData.email}` 
                : "Unlock Content"}
            </>
          )}
        </Button>

        <Alert className="bg-yellow-950/20 border-yellow-800/40">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-400">Note</AlertTitle>
          <AlertDescription className="text-yellow-400 text-sm">
            Unlocking content allows the user to access it immediately without paying the unlock fee. 
            This action cannot be undone.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
