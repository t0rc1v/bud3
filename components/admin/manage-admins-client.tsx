"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAdminUser } from "@/lib/actions/auth";
import type { User } from "@/lib/types";
import { Loader2, Plus, Trash2, UserCog } from "lucide-react";

interface ManageAdminsClientProps {
  admins: User[];
}

export function ManageAdminsClient({ admins: initialAdmins }: ManageAdminsClientProps) {
  const [admins, setAdmins] = useState<User[]>(initialAdmins);
  const [isCreating, setIsCreating] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Note: This is a simplified version. In production, you'd want to:
      // 1. Create the user in Clerk first
      // 2. Then create the DB record
      // For now, we'll show a message about manual creation
      
      setSuccess(
        `To create an admin with email ${newAdminEmail}:\n\n` +
        "1. Have them sign up at /sign-up\n" +
        "2. They will select 'Learner' or 'Teacher' role\n" +
        "3. You (super admin) can then change their role to 'admin' in the database\n\n" +
        "Alternative: Use the CLI script to create them directly."
      );
      setNewAdminEmail("");
      setIsCreating(false);
    } catch (err) {
      setError("Failed to create admin. Please try again.");
      console.error("Error creating admin:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Admins</h1>
          <p className="text-muted-foreground">
            Create and manage administrator accounts
          </p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? (
            "Cancel"
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add Admin
            </>
          )}
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600 whitespace-pre-line">
                  {success}
                </div>
              )}

              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Admin"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Current Admins ({admins.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No admins yet. Create one using the button above.
            </p>
          ) : (
            <div className="space-y-2">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCog className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{admin.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(admin.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      // TODO: Implement admin deletion
                      alert("Delete functionality coming soon");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border p-4 bg-muted/50">
        <h3 className="font-semibold mb-2">Super Admin Privileges</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Create and manage admin accounts</li>
          <li>Access all admin functionality</li>
          <li>Cannot be deleted by regular admins</li>
          <li>Only one super admin can exist in the system</li>
        </ul>
      </div>
    </div>
  );
}
