"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getSuperAdminRegularsPaginated,
  addSuperAdminRegular,
  removeSuperAdminRegular,
  bulkAddSuperAdminRegulars,
  bulkRemoveSuperAdminRegulars,
  type SuperAdminRegular,
  type PaginatedRegulars,
} from "@/lib/actions/super-admin";

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
import { Users, Plus, Trash2, Loader2, X, Search, ChevronLeft, ChevronRight } from "lucide-react";
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
  superAdminId: string;
  initialData: PaginatedRegulars;
}

export function ManageRegularsClient({ superAdminId, initialData }: ManageRegularsClientProps) {
  const [regularsData, setRegularsData] = useState<PaginatedRegulars>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingSingle, setIsAddingSingle] = useState(false);
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [newRegularEmail, setNewRegularEmail] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [regularToDelete, setRegularToDelete] = useState<SuperAdminRegular | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Bulk selection state
  const [selectedRegulars, setSelectedRegulars] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState("");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadRegulars = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getSuperAdminRegularsPaginated(
        superAdminId,
        currentPage,
        PAGE_SIZE,
        debouncedSearch || undefined
      );
      setRegularsData(data);
      // Clear selection when data changes
      setSelectedRegulars(new Set());
    } catch (error) {
      console.error("Error loading regulars:", error);
      toast.error("Failed to load regulars");
    } finally {
      setIsLoading(false);
    }
  }, [superAdminId, currentPage, debouncedSearch]);

  useEffect(() => {
    loadRegulars();
  }, [loadRegulars]);

  const handleAddRegular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegularEmail) return;

    try {
      setIsAddingSingle(true);
      const result = await addSuperAdminRegular(superAdminId, newRegularEmail);

      if (result.success) {
        toast.success(`Added ${newRegularEmail} to your institution`);
        setNewRegularEmail("");
        loadRegulars();
      } else {
        toast.error(result.error || "Failed to add regular");
      }
    } catch (error) {
      console.error("Error adding regular:", error);
      toast.error("Failed to add regular");
    } finally {
      setIsAddingSingle(false);
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkEmails.trim()) return;

    try {
      setIsAddingBulk(true);

      // Parse emails from textarea (comma, newline, or space separated)
      const emailList = bulkEmails
        .split(/[,\n\s]+/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      if (emailList.length === 0) {
        toast.error("No valid email addresses found");
        return;
      }

      const result = await bulkAddSuperAdminRegulars(superAdminId, emailList);

      // Build comprehensive result message
      const messages: string[] = [];

      if (result.successfullyAdded.length > 0) {
        messages.push(`✓ Successfully added: ${result.successfullyAdded.length}`);
      }

      if (result.alreadyExists.length > 0) {
        messages.push(
          `⚠ Already exist: ${result.alreadyExists.length} (${result.alreadyExists.slice(0, 3).join(", ")}${result.alreadyExists.length > 3 ? "..." : ""})`
        );
      }

      if (result.invalidEmails.length > 0) {
        messages.push(
          `✗ Invalid emails: ${result.invalidEmails.length} (${result.invalidEmails.slice(0, 3).join(", ")}${result.invalidEmails.length > 3 ? "..." : ""})`
        );
      }

      if (result.notFound.length > 0) {
        messages.push(
          `✗ Not found: ${result.notFound.length} (${result.notFound.slice(0, 3).join(", ")}${result.notFound.length > 3 ? "..." : ""})`
        );
      }

      if (result.notRegularRole.length > 0) {
        messages.push(
          `✗ Not regular users: ${result.notRegularRole.length} (${result.notRegularRole.slice(0, 3).join(", ")}${result.notRegularRole.length > 3 ? "..." : ""})`
        );
      }

      // Show appropriate toast based on results
      if (result.successfullyAdded.length === result.totalProcessed) {
        toast.success(`Successfully added ${result.successfullyAdded.length} regular users`);
      } else if (result.successfullyAdded.length > 0) {
        toast.success(
          <div className="space-y-1">
            <p>Added {result.successfullyAdded.length} of {result.totalProcessed} users</p>
            {messages
              .filter((m) => !m.startsWith("✓ Successfully"))
              .map((msg, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {msg}
                </p>
              ))}
          </div>
        );
      } else {
        toast.error(
          <div className="space-y-1">
            <p>No users were added</p>
            {messages.slice(1).map((msg, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {msg}
              </p>
            ))}
          </div>
        );
      }

      setBulkEmails("");
      loadRegulars();
    } catch (error) {
      console.error("Error bulk adding regulars:", error);
      toast.error("Failed to add regulars");
    } finally {
      setIsAddingBulk(false);
    }
  };

  const handleRemoveRegular = async () => {
    if (!regularToDelete) return;

    try {
      setIsDeleting(true);
      const result = await removeSuperAdminRegular(superAdminId, regularToDelete.regularId);

      if (result.success) {
        toast.success("Regular removed successfully");
        setIsDeleteDialogOpen(false);
        setRegularToDelete(null);
        loadRegulars();
      } else {
        toast.error(result.error || "Failed to remove regular");
      }
    } catch (error) {
      console.error("Error removing regular:", error);
      toast.error("Failed to remove regular");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRegulars.size === 0) return;

    const expectedText = `DELETE ${selectedRegulars.size} REGULARS`;
    if (bulkDeleteConfirmText.toUpperCase() !== expectedText) {
      toast.error("Confirmation text does not match");
      return;
    }

    try {
      setIsBulkDeleting(true);
      const result = await bulkRemoveSuperAdminRegulars(superAdminId, Array.from(selectedRegulars));

      if (result.deletedCount === selectedRegulars.size) {
        toast.success(`Successfully removed ${result.deletedCount} regular users`);
      } else {
        toast.success(
          <div className="space-y-1">
            <p>Removed {result.deletedCount} of {selectedRegulars.size} users</p>
            {result.failedCount > 0 && (
              <p className="text-xs text-muted-foreground">Failed: {result.failedCount}</p>
            )}
          </div>
        );
      }

      setSelectedRegulars(new Set());
      setBulkDeleteConfirmText("");
      setIsBulkDeleteDialogOpen(false);
      loadRegulars();
    } catch (error) {
      console.error("Error bulk removing regulars:", error);
      toast.error("Failed to remove regulars");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openDeleteDialog = (regular: SuperAdminRegular) => {
    setRegularToDelete(regular);
    setIsDeleteDialogOpen(true);
  };

  // Selection handlers
  const toggleSelection = (regularId: string) => {
    const newSelected = new Set(selectedRegulars);
    if (newSelected.has(regularId)) {
      newSelected.delete(regularId);
    } else {
      newSelected.add(regularId);
    }
    setSelectedRegulars(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedRegulars.size === regularsData.regulars.length) {
      setSelectedRegulars(new Set());
    } else {
      setSelectedRegulars(new Set(regularsData.regulars.map((r) => r.regularId)));
    }
  };

  const openBulkDeleteDialog = () => {
    if (selectedRegulars.size === 0) return;
    setBulkDeleteConfirmText("");
    setIsBulkDeleteDialogOpen(true);
  };

  const clearSelection = () => {
    setSelectedRegulars(new Set());
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > regularsData.totalPages) return;
    setCurrentPage(page);
  };

  if (isLoading && regularsData.regulars.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage Regulars</h1>
        <p className="text-gray-600 mt-1">
          Add and manage regular users for your institution
        </p>
      </div>

      {/* Add Regular Forms */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Single Add */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Single Regular
            </CardTitle>
            <CardDescription>
              Invite a single regular user by their email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddRegular} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Regular User Email</Label>
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
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Regular
                  </>
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
              Bulk Add Regulars
            </CardTitle>
            <CardDescription>
              Add multiple regular users at once (comma, space, or newline separated)
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
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Regulars
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Regulars List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your Regulars
                <Badge variant="secondary">{regularsData.totalCount} total</Badge>
              </CardTitle>
              <CardDescription>
                Manage the regular users associated with your institution
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

          {/* Bulk Actions Toolbar */}
          {selectedRegulars.size > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="font-medium">
                  {selectedRegulars.size} selected
                </Badge>
                <Separator orientation="vertical" className="h-4" />
                <Button variant="ghost" size="sm" onClick={toggleAllSelection} className="h-8">
                  {selectedRegulars.size === regularsData.regulars.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={openBulkDeleteDialog}
                className="h-8"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {regularsData.regulars.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No regulars added yet</p>
              <p className="text-sm">Use the form above to add your first regular user</p>
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
                            selectedRegulars.size === regularsData.regulars.length &&
                            regularsData.regulars.length > 0
                          }
                          onCheckedChange={toggleAllSelection}
                          aria-label="Select all regulars"
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
                    {regularsData.regulars.map((regular) => (
                      <TableRow
                        key={regular.id}
                        data-state={selectedRegulars.has(regular.regularId) ? "selected" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedRegulars.has(regular.regularId)}
                            onCheckedChange={() => toggleSelection(regular.regularId)}
                            aria-label={`Select ${regular.regular?.name || regular.regularEmail}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <Users className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="font-medium">
                              {regular.regular?.name || "Unknown User"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {regular.regularEmail}
                        </TableCell>
                        <TableCell>{regular.regular?.level || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {regular.regular ? (
                            new Date(regular.regular.createdAt).toLocaleDateString()
                          ) : (
                            new Date(regular.createdAt).toLocaleDateString()
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteDialog(regular)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {regularsData.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {regularsData.totalPages} ({regularsData.totalCount} total)
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
                      {Array.from({ length: regularsData.totalPages }, (_, i) => i + 1)
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === regularsData.totalPages ||
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
                      disabled={currentPage === regularsData.totalPages || isLoading}
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

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Regular User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {regularToDelete?.regular?.name || regularToDelete?.regularEmail} from your institution?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setRegularToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveRegular}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete {selectedRegulars.size} Regular Users?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This action cannot be undone. This will permanently remove {selectedRegulars.size}{" "}
                regular users from your institution.
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-medium mb-2">To confirm, type:</p>
                <code className="bg-background px-2 py-1 rounded text-sm font-mono">
                  DELETE {selectedRegulars.size} REGULARS
                </code>
              </div>
              <Input
                placeholder={`Type: DELETE ${selectedRegulars.size} REGULARS`}
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
                bulkDeleteConfirmText.toUpperCase() !== `DELETE ${selectedRegulars.size} REGULARS`
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {selectedRegulars.size} Users
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
