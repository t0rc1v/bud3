"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { getMyLearners, addMyLearner, removeMyLearner, getGrades } from "@/lib/actions/admin";

import type { MyLearnerWithDetails } from "@/lib/actions/admin";
import type { GradeWithSubjects } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ManageRegularsPage() {
  const { user: clerkUser } = useUser();
  const [regulars, setRegulars] = useState<MyLearnerWithDetails[]>([]);
  const [grades, setGrades] = useState<GradeWithSubjects[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newRegularEmail, setNewRegularEmail] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [adminUser, setAdminUser] = useState<{ id: string; email: string; institutionName?: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [clerkUser]);

  const loadData = async () => {
    if (!clerkUser) return;
    
    try {
      setIsLoading(true);
      const { getUserByClerkId } = await import("@/lib/actions/auth");
      const user = await getUserByClerkId(clerkUser.id);
      
      if (!user) {
        toast.error("User not found");
        return;
      }

      setAdminUser({
        id: user.id,
        email: user.email,
        institutionName: user.institutionName || undefined,
      });

      const [regularsData, gradesData] = await Promise.all([
        getMyLearners(user.id),
        getGrades(),
      ]);

      setRegulars(regularsData);
      setGrades(gradesData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load regulars");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRegular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser || !newRegularEmail || !selectedGrade) return;

    try {
      setIsAdding(true);
      await addMyLearner(adminUser.id, newRegularEmail, selectedGrade);
      
      toast.success(`Added ${newRegularEmail} to your institution`);
      setNewRegularEmail("");
      setSelectedGrade("");
      
      // Refresh list
      const updatedRegulars = await getMyLearners(adminUser.id);
      setRegulars(updatedRegulars);
    } catch (error) {
      console.error("Error adding regular:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add regular");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveRegular = async (regularId: string) => {
    if (!adminUser) return;

    try {
      await removeMyLearner(adminUser.id, regularId);
      toast.success("Regular removed successfully");
      
      // Refresh list
      const updatedRegulars = await getMyLearners(adminUser.id);
      setRegulars(updatedRegulars);
    } catch (error) {
      console.error("Error removing regular:", error);
      toast.error("Failed to remove regular");
    }
  };

  if (isLoading) {
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

      {/* Add Regular Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Regular
          </CardTitle>
          <CardDescription>
            Invite a regular user to join your institution by their email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddRegular} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="grade">Grade/Level</Label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade} required>
                  <SelectTrigger id="grade">
                    <SelectValue placeholder="Select a grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((grade) => (
                      <SelectItem key={grade.id} value={grade.id}>
                        {grade.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={isAdding || !newRegularEmail || !selectedGrade}>
              {isAdding ? (
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

      {/* Regulars List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Regulars ({regulars.length})
          </CardTitle>
          <CardDescription>
            Manage the regular users associated with your institution
          </CardDescription>
        </CardHeader>
        <CardContent>
          {regulars.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No regulars added yet</p>
              <p className="text-sm">Use the form above to add your first regular user</p>
            </div>
          ) : (
            <div className="space-y-3">
              {regulars.map((regular) => (
                <div
                  key={regular.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{regular.regularEmail}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Grade: {regular.grade?.title || "Unknown"}</span>
                        {regular.regular && (
                          <>
                            <span>•</span>
                            <span>Joined: {new Date(regular.regular.createdAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Regular</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {regular.regularEmail} from your institution?
                          They will lose access to your shared resources.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveRegular(regular.regularId)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
