"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Lock, 
  Unlock, 
  Coins, 
  CreditCard,
  Loader2,
  CheckCircle,
  Search,
  AlertTriangle,
  RefreshCw,
  FileText,
  Video,
  Headphones,
  Image as ImageIcon,
  BookOpen,
  Folder,
  GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UnlockFeeData {
  id: string;
  type: "resource" | "topic" | "subject";
  resourceId?: string;
  topicId?: string;
  subjectId?: string;
  feeAmount: number;
  creditsRequired: number;
  isActive: boolean;
  resource?: {
    id: string;
    title: string;
    type: string;
    topic?: {
      title: string;
      subject?: {
        name: string;
        grade?: {
          title: string;
        };
      };
    };
  };
  topic?: {
    id: string;
    title: string;
    subject?: {
      name: string;
      grade?: {
        title: string;
      };
    };
  };
  subject?: {
    id: string;
    name: string;
    grade?: {
      title: string;
    };
  };
}

const ResourceTypeIcons = {
  notes: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
};

export default function ManageUnlockFeesPage() {
  const [fees, setFees] = useState<UnlockFeeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingFee, setEditingFee] = useState<UnlockFeeData | null>(null);
  const [newFeeAmount, setNewFeeAmount] = useState<number>(100);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [initializeLoading, setInitializeLoading] = useState(false);

  const fetchFees = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/admin/unlock-fees");
      if (!response.ok) {
        throw new Error("Failed to fetch unlock fees");
      }

      const data = await response.json();
      setFees(data.fees || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load unlock fees");
      console.error("Error fetching unlock fees:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  const handleUpdateFee = async (feeId: string) => {
    setIsSaving(true);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/admin/unlock-fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeId,
          feeAmount: newFeeAmount,
          isActive,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update unlock fee");
      }

      setSuccessMessage("Unlock fee updated successfully");
      setEditingFee(null);
      fetchFees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update unlock fee");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInitializeFees = async () => {
    setInitializeLoading(true);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/admin/init-unlock-fees", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initialize unlock fees");
      }

      const data = await response.json();
      setSuccessMessage(`Initialized ${data.created} unlock fees (${data.skipped} already existed)`);
      fetchFees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize unlock fees");
    } finally {
      setInitializeLoading(false);
    }
  };

  const openEditDialog = (fee: UnlockFeeData) => {
    setEditingFee(fee);
    setNewFeeAmount(fee.feeAmount);
    setIsActive(fee.isActive);
    setSuccessMessage(null);
  };

  const filteredFees = fees.filter((fee) => {
    // Filter by tab
    if (activeTab !== "all" && fee.type !== activeTab) {
      return false;
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = 
        fee.resource?.title || 
        fee.topic?.title || 
        fee.subject?.name || 
        "";
      return name.toLowerCase().includes(query);
    }

    return true;
  });

  const getContentName = (fee: UnlockFeeData) => {
    if (fee.resource) return fee.resource.title;
    if (fee.topic) return fee.topic.title;
    if (fee.subject) return fee.subject.name;
    return "Unknown";
  };

  const getContentType = (fee: UnlockFeeData) => {
    return fee.type.charAt(0).toUpperCase() + fee.type.slice(1);
  };

  const getHierarchyPath = (fee: UnlockFeeData) => {
    if (fee.resource?.topic?.subject?.grade) {
      return `${fee.resource.topic.subject.grade.title} > ${fee.resource.topic.subject.name} > ${fee.resource.topic.title}`;
    }
    if (fee.topic?.subject?.grade) {
      return `${fee.topic.subject.grade.title} > ${fee.topic.subject.name}`;
    }
    if (fee.subject?.grade) {
      return fee.subject.grade.title;
    }
    return "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manage Unlock Fees</h2>
          <p className="text-gray-600">
            Set and manage unlock prices for resources, topics, and subjects
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleInitializeFees}
            disabled={initializeLoading}
          >
            {initializeLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Initialize Missing Fees
              </>
            )}
          </Button>
          <Button onClick={fetchFees} variant="outline">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Error</AlertTitle>
          <AlertDescription className="text-red-700">
            {error}
            <Button
              variant="outline"
              size="sm"
              className="ml-4"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fees.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {fees.filter(f => f.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {fees.filter(f => !f.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg. Fee</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Ksh {fees.length > 0 
                ? Math.round(fees.reduce((sum, f) => sum + f.feeAmount, 0) / fees.length)
                : 0
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Content Unlock Fees</CardTitle>
          <CardDescription>
            Manage unlock fees for all content. Users will pay these amounts via M-Pesa to unlock content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({fees.length})</TabsTrigger>
              <TabsTrigger value="resource">
                Resources ({fees.filter(f => f.type === "resource").length})
              </TabsTrigger>
              <TabsTrigger value="topic">
                Topics ({fees.filter(f => f.type === "topic").length})
              </TabsTrigger>
              <TabsTrigger value="subject">
                Subjects ({fees.filter(f => f.type === "subject").length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <ScrollArea className="h-[500px]">
                {filteredFees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No unlock fees found</p>
                    {searchQuery && (
                      <p className="text-sm">Try adjusting your search</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFees.map((fee) => (
                      <div
                        key={fee.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border",
                          fee.isActive
                            ? "bg-white border-gray-200"
                            : "bg-gray-50 border-gray-200 opacity-75"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            fee.isActive ? "bg-yellow-100" : "bg-gray-100"
                          )}>
                            {fee.type === "resource" ? (
                              <FileText className="h-5 w-5 text-yellow-600" />
                            ) : fee.type === "topic" ? (
                              <Folder className="h-5 w-5 text-amber-600" />
                            ) : (
                              <BookOpen className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">{getContentName(fee)}</h4>
                            <p className="text-sm text-muted-foreground">
                              {getHierarchyPath(fee)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {getContentType(fee)}
                              </Badge>
                              {fee.isActive ? (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold">Ksh {fee.feeAmount}</div>
                            <p className="text-xs text-muted-foreground">unlock fee</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(fee)}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingFee} onOpenChange={() => setEditingFee(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Unlock Fee</DialogTitle>
            <DialogDescription>
              {editingFee && (
                <>
                  {getContentName(editingFee)} ({getContentType(editingFee)})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="feeAmount">Unlock Fee (Ksh)</Label>
              <Input
                id="feeAmount"
                type="number"
                min={1}
                value={newFeeAmount}
                onChange={(e) => setNewFeeAmount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Users will pay this amount via M-Pesa to unlock this content
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive content cannot be unlocked by users
                </p>
              </div>
              <Button
                type="button"
                variant={isActive ? "default" : "secondary"}
                onClick={() => setIsActive(!isActive)}
                className={isActive ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {isActive ? "Active" : "Inactive"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingFee(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editingFee && handleUpdateFee(editingFee.id)}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
