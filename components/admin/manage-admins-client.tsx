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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import type { Permission } from "@/lib/permissions";
import { 
  Permissions, 
  PermissionDescriptions, 
  getPermissionsByCategory,
  PermissionGroups 
} from "@/lib/permissions";
import {
  getAllAdmins,
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  assignPermissionsToUser,
  assignRoleToUser,
  removeRoleFromUser,
  updateAdminRole,
  deleteAdmin,
  promoteUserToAdmin,
  type AdminWithPermissions,
  type RoleWithPermissions,
} from "@/lib/actions/admin-permissions";
import {
  Loader2,
  Plus,
  Trash2,
  UserCog,
  Shield,
  Users,
  Search,
  MoreVertical,
  Edit,
  Check,
  X,
  ChevronDown,
  Crown,
  Key,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ManageAdminsClientProps {
  admins: AdminWithPermissions[];
  roles: RoleWithPermissions[];
  currentUserId: string;
}

export function ManageAdminsClient({ admins: initialAdmins, roles: initialRoles, currentUserId }: ManageAdminsClientProps) {
  const [admins, setAdmins] = useState<AdminWithPermissions[]>(initialAdmins);
  const [roles, setRoles] = useState<RoleWithPermissions[]>(initialRoles);
  const [activeTab, setActiveTab] = useState("admins");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Refresh data
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [newAdmins, newRoles] = await Promise.all([
        getAllAdmins(),
        getAllRoles(),
      ]);
      setAdmins(newAdmins);
      setRoles(newRoles);
    } catch (error) {
      console.error("Error refreshing data:", error);
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
            Create and manage administrator accounts, roles, and permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshData} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="admins" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Admins ({admins.length})
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="space-y-4">
          <AdminsTab 
            admins={admins} 
            roles={roles}
            currentUserId={currentUserId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onDataChange={refreshData}
          />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <RolesTab 
            roles={roles}
            onDataChange={refreshData}
          />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <PermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== ADMINS TAB ==============

function AdminsTab({
  admins,
  roles,
  currentUserId,
  searchQuery,
  setSearchQuery,
  onDataChange,
}: {
  admins: AdminWithPermissions[];
  roles: RoleWithPermissions[];
  currentUserId: string;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onDataChange: () => void;
}) {
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState<AdminWithPermissions | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePromoteToAdmin = async () => {
    if (!promoteEmail || !promoteEmail.includes("@")) {
      return;
    }
    
    // This would need to be implemented in actions to find user by email
    // For now, show a message
    alert(`To promote ${promoteEmail} to admin, use the user management interface.`);
    setPromoteEmail("");
    setIsPromoting(false);
  };

  const handleDeleteAdmin = async (adminId: string) => {
    const result = await deleteAdmin(adminId, currentUserId);
    if (result.success) {
      onDataChange();
    } else {
      alert(result.error);
    }
  };

  const handleChangeAdminRole = async (adminId: string, newRole: "admin" | "super_admin") => {
    const result = await updateAdminRole(adminId, newRole, currentUserId);
    if (result.success) {
      onDataChange();
    } else {
      alert(result.error);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Administrator Accounts
              </CardTitle>
              <CardDescription>
                Manage existing administrators and their permissions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search admins..."
                  className="pl-8 w-[250px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Dialog open={isPromoting} onOpenChange={setIsPromoting}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Promote User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Promote User to Admin</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">User Email</Label>
                      <Input
                        id="email"
                        placeholder="user@example.com"
                        value={promoteEmail}
                        onChange={(e) => setPromoteEmail(e.target.value)}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      The user must already have an account in the system.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPromoting(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handlePromoteToAdmin}>Promote to Admin</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAdmins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No administrators found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Direct Permissions</TableHead>
                  <TableHead>Assigned Roles</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.email}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={admin.role === "super_admin" ? "default" : "secondary"}
                        className={admin.role === "super_admin" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                      >
                        {admin.role === "super_admin" ? (
                          <span className="flex items-center gap-1">
                            <Crown className="h-3 w-3" />
                            Super Admin
                          </span>
                        ) : (
                          "Admin"
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{admin.directPermissions.length}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {admin.assignedRoles.length > 0 ? (
                          admin.assignedRoles.map((role) => (
                            <Badge key={role.id} variant="outline" className="text-xs">
                              {role.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Dialog open={isManageDialogOpen && selectedAdmin?.id === admin.id} 
                                  onOpenChange={(open) => {
                                    setIsManageDialogOpen(open);
                                    if (open) setSelectedAdmin(admin);
                                    else setSelectedAdmin(null);
                                  }}>
                            <DialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Key className="mr-2 h-4 w-4" />
                                Manage Permissions
                              </DropdownMenuItem>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh]">
                              <DialogHeader>
                                <DialogTitle>Manage Admin Permissions</DialogTitle>
                              </DialogHeader>
                              {selectedAdmin && (
                                <ManageAdminPermissions 
                                  admin={selectedAdmin} 
                                  roles={roles}
                                  currentUserId={currentUserId}
                                  onSuccess={() => {
                                    setIsManageDialogOpen(false);
                                    onDataChange();
                                  }}
                                />
                              )}
                            </DialogContent>
                          </Dialog>
                          
                          <DropdownMenuSeparator />
                          
                          {admin.role === "admin" && (
                            <DropdownMenuItem 
                              onClick={() => handleChangeAdminRole(admin.id, "super_admin")}
                            >
                              <Crown className="mr-2 h-4 w-4" />
                              Make Super Admin
                            </DropdownMenuItem>
                          )}
                          
                          {admin.role === "super_admin" && admin.id !== currentUserId && (
                            <DropdownMenuItem 
                              onClick={() => handleChangeAdminRole(admin.id, "admin")}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Demote to Admin
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove Admin Access
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Admin Access</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {admin.email}&apos;s admin privileges and revert them to a regular user.
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteAdmin(admin.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove Access
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============== MANAGE ADMIN PERMISSIONS DIALOG ==============

function ManageAdminPermissions({
  admin,
  roles,
  currentUserId,
  onSuccess,
}: {
  admin: AdminWithPermissions;
  roles: RoleWithPermissions[];
  currentUserId: string;
  onSuccess: () => void;
}) {
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(
    admin.directPermissions as Permission[]
  );
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>(
    admin.assignedRoles.map((r) => r.id)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("direct");

  const permissionsByCategory = getPermissionsByCategory();

  const handlePermissionToggle = (permission: Permission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const handleRoleToggle = (roleId: string) => {
    setAssignedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save direct permissions
      await assignPermissionsToUser(admin.id, selectedPermissions, currentUserId);

      // Update role assignments
      const currentRoleIds = admin.assignedRoles.map((r) => r.id);
      
      // Add new roles
      for (const roleId of assignedRoleIds) {
        if (!currentRoleIds.includes(roleId)) {
          await assignRoleToUser(admin.id, roleId, currentUserId);
        }
      }
      
      // Remove unselected roles
      for (const roleId of currentRoleIds) {
        if (!assignedRoleIds.includes(roleId)) {
          await removeRoleFromUser(admin.id, roleId);
        }
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving permissions:", error);
      alert("Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate effective permissions
  const effectivePermissions = new Set<string>(selectedPermissions);
  for (const roleId of assignedRoleIds) {
    const role = roles.find((r) => r.id === roleId);
    if (role) {
      for (const perm of role.permissions) {
        effectivePermissions.add(perm);
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="font-semibold">{admin.email}</h3>
          <p className="text-sm text-muted-foreground">
            {admin.role === "super_admin" ? "Super Admin" : "Admin"} •{" "}
            {effectivePermissions.size} effective permissions
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="direct">Direct Permissions</TabsTrigger>
          <TabsTrigger value="roles">Role Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="direct" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select individual permissions for this admin. These apply only to this user.
          </p>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                <div key={category} className="space-y-3">
                  <h4 className="font-semibold text-sm sticky top-0 bg-background py-2 border-b">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {permissions.map((permission) => {
                      const desc = PermissionDescriptions[permission];
                      const isSelected = selectedPermissions.includes(permission);
                      const isInherited = effectivePermissions.has(permission) && !isSelected;
                      
                      return (
                        <div
                          key={permission}
                          className={cn(
                            "flex items-start space-x-3 p-3 rounded-lg border transition-colors",
                            isSelected && "border-primary bg-primary/5",
                            isInherited && "border-yellow-500/30 bg-yellow-500/5 opacity-70"
                          )}
                        >
                          <Checkbox
                            id={permission}
                            checked={isSelected || isInherited}
                            disabled={isInherited}
                            onCheckedChange={() => handlePermissionToggle(permission)}
                          />
                          <div className="flex-1">
                            <Label
                              htmlFor={permission}
                              className="font-medium cursor-pointer"
                            >
                              {desc?.label || permission}
                              {isInherited && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  From Role
                                </Badge>
                              )}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {desc?.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Assign roles to this admin. They will inherit all permissions from these roles.
          </p>
          <div className="space-y-3">
            {roles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No roles created yet</p>
                <p className="text-sm">Create roles in the Roles tab</p>
              </div>
            ) : (
              roles.map((role) => {
                const isAssigned = assignedRoleIds.includes(role.id);
                return (
                  <div
                    key={role.id}
                    className={cn(
                      "flex items-start space-x-3 p-4 rounded-lg border transition-colors",
                      isAssigned && "border-primary bg-primary/5"
                    )}
                  >
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={isAssigned}
                      onCheckedChange={() => handleRoleToggle(role.id)}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={`role-${role.id}`}
                        className="font-semibold cursor-pointer"
                      >
                        {role.name}
                      </Label>
                      {role.description && (
                        <p className="text-sm text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {role.permissions.length} permissions
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter className="gap-2">
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ============== ROLES TAB ==============

function RolesTab({
  roles,
  onDataChange,
}: {
  roles: RoleWithPermissions[];
  onDataChange: () => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const permissionsByCategory = getPermissionsByCategory();

  const handleCreateRole = async () => {
    if (!roleName.trim()) return;
    
    setIsSaving(true);
    const result = await createRole(
      roleName.trim(),
      roleDescription.trim() || null,
      selectedPermissions,
      "" // current user id will be handled server-side from auth
    );
    setIsSaving(false);

    if (result.success) {
      setIsCreating(false);
      setRoleName("");
      setRoleDescription("");
      setSelectedPermissions([]);
      onDataChange();
    } else {
      alert(result.error);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole || !roleName.trim()) return;

    setIsSaving(true);
    const result = await updateRole(editingRole.id, {
      name: roleName.trim(),
      description: roleDescription.trim() || null,
      permissions: selectedPermissions,
    });
    setIsSaving(false);

    if (result.success) {
      setEditingRole(null);
      setRoleName("");
      setRoleDescription("");
      setSelectedPermissions([]);
      onDataChange();
    } else {
      alert(result.error);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const result = await deleteRole(roleId);
    if (result.success) {
      onDataChange();
    } else {
      alert(result.error);
    }
  };

  const startEditRole = (role: RoleWithPermissions) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    setSelectedPermissions(role.permissions as Permission[]);
  };

  const handlePermissionToggle = (permission: Permission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const applyPermissionGroup = (groupPermissions: Permission[]) => {
    setSelectedPermissions((prev) => {
      const newPermissions = [...prev];
      for (const perm of groupPermissions) {
        if (!newPermissions.includes(perm)) {
          newPermissions.push(perm);
        }
      }
      return newPermissions;
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Roles
              </CardTitle>
              <CardDescription>
                Create and manage permission roles that can be assigned to administrators
              </CardDescription>
            </div>
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Create New Role</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="role-name">Role Name</Label>
                    <Input
                      id="role-name"
                      placeholder="e.g., Content Manager"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-description">Description</Label>
                    <Input
                      id="role-description"
                      placeholder="Brief description of this role's responsibilities"
                      value={roleDescription}
                      onChange={(e) => setRoleDescription(e.target.value)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Quick Permission Groups</Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPermissionGroup(PermissionGroups.CONTENT_READ_ONLY as Permission[])}
                      >
                        Content Read-Only
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPermissionGroup(PermissionGroups.CONTENT_MANAGER as Permission[])}
                      >
                        Content Manager
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPermissionGroup(PermissionGroups.USERS_FULL as Permission[])}
                      >
                        User Management
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPermissionGroup(PermissionGroups.BASIC_ADMIN as Permission[])}
                      >
                        Basic Admin
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Select Permissions</Label>
                    <ScrollArea className="h-[300px] border rounded-lg p-4">
                      <div className="space-y-6">
                        {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                          <div key={category} className="space-y-3">
                            <h4 className="font-semibold text-sm sticky top-0 bg-background py-2 border-b">
                              {category}
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                              {permissions.map((permission) => {
                                const desc = PermissionDescriptions[permission];
                                const isSelected = selectedPermissions.includes(permission);
                                
                                return (
                                  <div
                                    key={permission}
                                    className={cn(
                                      "flex items-start space-x-3 p-2 rounded-lg border transition-colors",
                                      isSelected && "border-primary bg-primary/5"
                                    )}
                                  >
                                    <Checkbox
                                      id={`new-${permission}`}
                                      checked={isSelected}
                                      onCheckedChange={() => handlePermissionToggle(permission)}
                                    />
                                    <div className="flex-1">
                                      <Label
                                        htmlFor={`new-${permission}`}
                                        className="font-medium cursor-pointer"
                                      >
                                        {desc?.label || permission}
                                      </Label>
                                      <p className="text-sm text-muted-foreground">
                                        {desc?.description}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRole} disabled={isSaving || !roleName.trim()}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Role"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No roles created yet</p>
              <p className="text-sm">Create your first role to get started</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <Card key={role.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{role.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Dialog>
                            <DialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Role
                              </DropdownMenuItem>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh]">
                              <DialogHeader>
                                <DialogTitle>Edit Role</DialogTitle>
                              </DialogHeader>
                              {editingRole?.id === role.id && (
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-role-name">Role Name</Label>
                                    <Input
                                      id="edit-role-name"
                                      value={roleName}
                                      onChange={(e) => setRoleName(e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-role-description">Description</Label>
                                    <Input
                                      id="edit-role-description"
                                      value={roleDescription}
                                      onChange={(e) => setRoleDescription(e.target.value)}
                                    />
                                  </div>

                                  <Separator />

                                  <div className="space-y-2">
                                    <Label>Select Permissions</Label>
                                    <ScrollArea className="h-[300px] border rounded-lg p-4">
                                      <div className="space-y-6">
                                        {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                                          <div key={category} className="space-y-3">
                                            <h4 className="font-semibold text-sm sticky top-0 bg-background py-2 border-b">
                                              {category}
                                            </h4>
                                            <div className="grid grid-cols-1 gap-2">
                                              {permissions.map((permission) => {
                                                const desc = PermissionDescriptions[permission];
                                                const isSelected = selectedPermissions.includes(permission);
                                                
                                                return (
                                                  <div
                                                    key={permission}
                                                    className={cn(
                                                      "flex items-start space-x-3 p-2 rounded-lg border transition-colors",
                                                      isSelected && "border-primary bg-primary/5"
                                                    )}
                                                  >
                                                    <Checkbox
                                                      id={`edit-${permission}`}
                                                      checked={isSelected}
                                                      onCheckedChange={() => handlePermissionToggle(permission)}
                                                    />
                                                    <div className="flex-1">
                                                      <Label
                                                        htmlFor={`edit-${permission}`}
                                                        className="font-medium cursor-pointer"
                                                      >
                                                        {desc?.label || permission}
                                                      </Label>
                                                      <p className="text-sm text-muted-foreground">
                                                        {desc?.description}
                                                      </p>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </div>

                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => setEditingRole(null)}>
                                      Cancel
                                    </Button>
                                    <Button onClick={handleUpdateRole} disabled={isSaving}>
                                      {isSaving ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Saving...
                                        </>
                                      ) : (
                                        "Save Changes"
                                      )}
                                    </Button>
                                  </DialogFooter>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          
                          <DropdownMenuSeparator />
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Role
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the role &quot;{role.name}&quot;? 
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteRole(role.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {role.description && (
                      <CardDescription>{role.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        <Key className="mr-1 h-3 w-3" />
                        {role.permissions.length} permissions
                      </Badge>
                      <Badge variant={role.isActive ? "default" : "secondary"}>
                        {role.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============== PERMISSIONS TAB ==============

function PermissionsTab() {
  const permissionsByCategory = getPermissionsByCategory();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = Object.entries(permissionsByCategory).reduce(
    (acc, [category, permissions]) => {
      const filtered = permissions.filter(
        (p) =>
          p.toLowerCase().includes(searchQuery.toLowerCase()) ||
          PermissionDescriptions[p]?.label
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          PermissionDescriptions[p]?.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[category] = filtered;
      }
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            All Permissions
          </CardTitle>
          <CardDescription>
            Reference guide for all available permissions in the system
          </CardDescription>
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search permissions..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-8">
              {Object.entries(filteredCategories).map(([category, permissions]) => (
                <div key={category} className="space-y-4">
                  <h3 className="font-semibold text-lg sticky top-0 bg-background py-2 border-b">
                    {category}
                  </h3>
                  <div className="grid gap-3">
                    {permissions.map((permission) => {
                      const desc = PermissionDescriptions[permission];
                      return (
                        <div
                          key={permission}
                          className="flex items-start justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <code className="text-sm bg-muted px-2 py-1 rounded">
                                {permission}
                              </code>
                            </div>
                            <p className="font-medium">{desc?.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {desc?.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
