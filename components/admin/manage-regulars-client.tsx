"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getMyLearnersPaginated,
  addMyLearner,
  removeMyLearner,
  bulkAddMyLearners,
  bulkRemoveMyLearners,
  type MyLearnerWithDetails,
  type PaginatedLearners,
} from "@/lib/actions/admin";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const PAGE_SIZE = 10;

interface ManageRegularsClientProps {
  adminId: string;
  initialData: PaginatedLearners;
}

export function AdminManageRegularsClient({
  adminId,
  initialData,
}: ManageRegularsClientProps) {
  const [learnersData, setLearnersData] = useState<PaginatedLearners>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingSingle, setIsAddingSingle] = useState(false);
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [newRegularEmail, setNewRegularEmail] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [learnerToDelete, setLearnerToDelete] = useState<MyLearnerWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [selectedLearners, setSelectedLearners] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState("");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadLearners = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getMyLearnersPaginated(
        adminId,
        currentPage,
        PAGE_SIZE,
        debouncedSearch || undefined
      );
      setLearnersData(data);
      setSelectedLearners(new Set());
    } catch {
      toast.error("Failed to load learners");
    } finally {
      setIsLoading(false);
    }
  }, [adminId, currentPage, debouncedSearch]);

  useEffect(() => {
    loadLearners();
  }, [loadLearners]);

  const handleAddRegular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegularEmail) return;
    try {
      setIsAddingSingle(true);
      await addMyLearner(adminId, newRegularEmail);
      toast.success(`Added ${newRegularEmail} to your institution`);
      setNewRegularEmail("");
      loadLearners();
    } catch (error) {
      console.error("Failed to add learner:", error);
      toast.error("Failed to add learner. Please try again.");
    } finally {
      setIsAddingSingle(false);
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkEmails.trim()) return;
    try {
      setIsAddingBulk(true);
      const emailList = bulkEmails
        .split(/[,\n\s]+/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      if (emailList.length === 0) {
        toast.error("No valid email addresses found");
        return;
      }

      const result = await bulkAddMyLearners(adminId, emailList);
      const messages: string[] = [];

      if (result.successfullyAdded.length > 0)
        messages.push(`Successfully added: ${result.successfullyAdded.length}`);
      if (result.alreadyExists.length > 0)
        messages.push(`Already exist: ${result.alreadyExists.length}`);
      if (result.invalidEmails.length > 0)
        messages.push(`Invalid emails: ${result.invalidEmails.length}`);
      if (result.notFound.length > 0)
        messages.push(`Not found: ${result.notFound.length}`);
      if (result.notRegularRole.length > 0)
        messages.push(`Not regular users: ${result.notRegularRole.length}`);

      if (result.successfullyAdded.length === result.totalProcessed) {
        toast.success(`Successfully added ${result.successfullyAdded.length} learners`);
      } else if (result.successfullyAdded.length > 0) {
        toast.success(
          <div className="space-y-1">
            <p>Added {result.successfullyAdded.length} of {result.totalProcessed} users</p>
            {messages.slice(1).map((msg, i) => (
              <p key={i} className="text-xs text-muted-foreground">{msg}</p>
            ))}
          </div>
        );
      } else {
        toast.error(
          <div className="space-y-1">
            <p>No users were added</p>
            {messages.map((msg, i) => (
              <p key={i} className="text-xs text-muted-foreground">{msg}</p>
            ))}
          </div>
        );
      }

      setBulkEmails("");
      loadLearners();
    } catch {
      toast.error("Failed to add learners");
    } finally {
      setIsAddingBulk(false);
    }
  };

  const handleRemoveLearner = async () => {
    if (!learnerToDelete) return;
    try {
      setIsDeleting(true);
      await removeMyLearner(adminId, learnerToDelete.regularId);
      toast.success("Learner removed successfully");
      setIsDeleteDialogOpen(false);
      setLearnerToDelete(null);
      loadLearners();
    } catch {
      toast.error("Failed to remove learner");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLearners.size === 0) return;
    const expectedText = `DELETE ${selectedLearners.size} REGULARS`;
    if (bulkDeleteConfirmText.toUpperCase() !== expectedText) {
      toast.error("Confirmation text does not match");
      return;
    }
    try {
      setIsBulkDeleting(true);
      const result = await bulkRemoveMyLearners(adminId, Array.from(selectedLearners));

      if (result.deletedCount === selectedLearners.size) {
        toast.success(`Removed ${result.deletedCount} learners`);
      } else {
        toast.success(
          <div className="space-y-1">
            <p>Removed {result.deletedCount} of {selectedLearners.size} users</p>
            {result.failedCount > 0 && (
              <p className="text-xs text-muted-foreground">Failed: {result.failedCount}</p>
            )}
          </div>
        );
      }

      setSelectedLearners(new Set());
      setBulkDeleteConfirmText("");
      setIsBulkDeleteDialogOpen(false);
      loadLearners();
    } catch {
      toast.error("Failed to remove learners");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelection = (regularId: string) => {
    const next = new Set(selectedLearners);
    if (next.has(regularId)) next.delete(regularId);
    else next.add(regularId);
    setSelectedLearners(next);
  };

  const toggleAllSelection = () => {
    if (selectedLearners.size === learnersData.learners.length) {
      setSelectedLearners(new Set());
    } else {
      setSelectedLearners(new Set(learnersData.learners.map((l) => l.regularId)));
    }
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > learnersData.totalPages) return;
    setCurrentPage(page);
  };

  if (isLoading && learnersData.learners.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage Learners</h1>
        <p className="text-muted-foreground mt-1">
          Add and manage learners for your institution
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Single Add */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Single Learner
            </CardTitle>
            <CardDescription>
              Invite a learner by their email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddRegular} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Learner Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newRegularEmail}
                  onChange={(e) => setNewRegularEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={isAddingSingle || !newRegularEmail}>
                {isAddingSingle ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" />Add Learner</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Bulk Add */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Bulk Add Learners
            </CardTitle>
            <CardDescription>
              Add multiple learners at once (comma, space, or newline separated)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBulkAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-emails">Email Addresses</Label>
                <Textarea
                  id="bulk-emails"
                  placeholder="user1@example.com, user2@example.com&#10;user3@example.com"
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Separate emails with commas, spaces, or new lines
                </p>
              </div>
              <Button type="submit" disabled={isAddingBulk || !bulkEmails.trim()}>
                {isAddingBulk ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" />Add Learners</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Learners List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your Learners
                <Badge variant="secondary">{learnersData.totalCount} total</Badge>
              </CardTitle>
              <CardDescription>
                Manage learners associated with your institution
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by email..."
                className="pl-8 w-full sm:w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {selectedLearners.size > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="font-medium">
                  {selectedLearners.size} selected
                </Badge>
                <Separator orientation="vertical" className="h-4" />
                <Button variant="ghost" size="sm" onClick={toggleAllSelection} className="h-8">
                  {selectedLearners.size === learnersData.learners.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLearners(new Set())}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setBulkDeleteConfirmText("");
                  setIsBulkDeleteDialogOpen(true);
                }}
                className="h-8"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {learnersData.learners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p>No learners added yet</p>
              <p className="text-sm">Use the form above to add your first learner</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            selectedLearners.size === learnersData.learners.length &&
                            learnersData.learners.length > 0
                          }
                          onCheckedChange={toggleAllSelection}
                          aria-label="Select all learners"
                        />
                      </TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {learnersData.learners.map((learner) => (
                      <TableRow
                        key={learner.id}
                        data-state={
                          selectedLearners.has(learner.regularId) ? "selected" : undefined
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedLearners.has(learner.regularId)}
                            onCheckedChange={() => toggleSelection(learner.regularId)}
                            aria-label={`Select ${learner.regular?.name || learner.regularEmail}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                              <Users className="h-4 w-4 text-primary-foreground" />
                            </div>
                            <span className="font-medium">
                              {learner.regular?.name || "Unknown User"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {learner.regularEmail}
                        </TableCell>
                        <TableCell>{learner.regular?.level || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {learner.regular
                            ? new Date(learner.regular.createdAt).toLocaleDateString()
                            : new Date(learner.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setLearnerToDelete(learner);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {learnersData.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {learnersData.totalPages} ({learnersData.totalCount} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: learnersData.totalPages }, (_, i) => i + 1)
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === learnersData.totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                        )
                        .map((page, index, array) => (
                          <div key={page} className="flex items-center">
                            {index > 0 && array[index - 1] !== page - 1 && (
                              <span className="px-2">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(page)}
                              disabled={isLoading}
                              className="min-w-[32px]"
                            >
                              {page}
                            </Button>
                          </div>
                        ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === learnersData.totalPages || isLoading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Single Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Learner</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {learnerToDelete?.regular?.name || learnerToDelete?.regularEmail} from your
              institution? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setLearnerToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveLearner}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Removing...</>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete {selectedLearners.size} Learners?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will permanently remove {selectedLearners.size} learners from your
                institution.
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-medium mb-2">To confirm, type:</p>
                <code className="bg-background px-2 py-1 rounded text-sm font-mono">
                  DELETE {selectedLearners.size} REGULARS
                </code>
              </div>
              <Input
                placeholder={`Type: DELETE ${selectedLearners.size} REGULARS`}
                value={bulkDeleteConfirmText}
                onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                className="mt-2"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsBulkDeleteDialogOpen(false);
                setBulkDeleteConfirmText("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={
                isBulkDeleting ||
                bulkDeleteConfirmText.toUpperCase() !==
                  `DELETE ${selectedLearners.size} REGULARS`
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" />Delete {selectedLearners.size} Learners</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
