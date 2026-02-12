"use server";

import { db } from "@/lib/db";
import { user, role, rolePermission, userPermission, userRoles } from "@/lib/db/schema";
import { eq, and, inArray, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { Permission } from "@/lib/permissions";
import type { User, UserRole } from "@/lib/types";

// Types
export interface RoleWithPermissions {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminBase {
  id: string;
  userId: string;
  email: string;
  role: "regular" | "admin" | "super_admin";
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminWithPermissions extends AdminBase {
  directPermissions: string[];
  assignedRoles: RoleWithPermissions[];
  allPermissions: string[]; // Combined from roles and direct permissions
}

// ============== ROLE MANAGEMENT ==============

export async function getAllRoles(): Promise<RoleWithPermissions[]> {
  const rolesData = await db
    .select()
    .from(role)
    .orderBy(asc(role.name));
  
  // Fetch permissions for all roles
  const roleIds = rolesData.map(r => r.id);
  const permissionsData = roleIds.length > 0
    ? await db
        .select()
        .from(rolePermission)
        .where(inArray(rolePermission.roleId, roleIds))
    : [];
  
  return rolesData.map((r) => ({
    ...r,
    permissions: permissionsData
      .filter(p => p.roleId === r.id)
      .map((p) => p.permission),
  }));
}

export async function getRoleById(id: string): Promise<RoleWithPermissions | null> {
  const roleData = await db
    .select()
    .from(role)
    .where(eq(role.id, id))
    .limit(1)
    .then(res => res[0] || null);

  if (!roleData) return null;
  
  // Fetch permissions for this role
  const permissionsData = await db
    .select()
    .from(rolePermission)
    .where(eq(rolePermission.roleId, id));

  return {
    ...roleData,
    permissions: permissionsData.map((p) => p.permission),
  };
}

export async function createRole(
  name: string,
  description: string | null,
  permissions: Permission[],
  createdByUserId: string
): Promise<{ success: boolean; error?: string; roleId?: string }> {
  try {
    // Check if role name already exists
    const existing = await db
      .select()
      .from(role)
      .where(eq(role.name, name))
      .limit(1)
      .then(res => res[0] || null);

    if (existing) {
      return { success: false, error: "A role with this name already exists" };
    }

    // Create the role
    const [newRole] = await db
      .insert(role)
      .values({
        name,
        description,
        isActive: true,
      })
      .returning({ id: role.id });

    // Add permissions
    if (permissions.length > 0) {
      await db.insert(rolePermission).values(
        permissions.map((permission) => ({
          roleId: newRole.id,
          permission,
        }))
      );
    }

    revalidatePath("/super-admin/manage-admins");
    return { success: true, roleId: newRole.id };
  } catch (error) {
    console.error("Error creating role:", error);
    return { success: false, error: "Failed to create role" };
  }
}

export async function updateRole(
  roleId: string,
  updates: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    permissions?: Permission[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check for name conflict if name is being updated
    if (updates.name) {
      const existing = await db
        .select()
        .from(role)
        .where(and(eq(role.name, updates.name), eq(role.id, roleId)))
        .limit(1)
        .then(res => res[0] || null);
      if (existing) {
        return { success: false, error: "A role with this name already exists" };
      }
    }

    // Update role details
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    await db.update(role).set(updateData).where(eq(role.id, roleId));

    // Update permissions if provided
    if (updates.permissions !== undefined) {
      // Remove existing permissions
      await db.delete(rolePermission).where(eq(rolePermission.roleId, roleId));

      // Add new permissions
      if (updates.permissions.length > 0) {
        await db.insert(rolePermission).values(
          updates.permissions.map((permission) => ({
            roleId,
            permission,
          }))
        );
      }
    }

    revalidatePath("/super-admin/manage-admins");
    return { success: true };
  } catch (error) {
    console.error("Error updating role:", error);
    return { success: false, error: "Failed to update role" };
  }
}

export async function deleteRole(roleId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if any users are assigned to this role
    const assignedUsers = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));

    if (assignedUsers.length > 0) {
      return {
        success: false,
        error: `Cannot delete role: ${assignedUsers.length} user(s) are assigned to this role. Please reassign them first.`,
      };
    }

    // Delete role permissions first (cascade should handle this, but being explicit)
    await db.delete(rolePermission).where(eq(rolePermission.roleId, roleId));

    // Delete the role
    await db.delete(role).where(eq(role.id, roleId));

    revalidatePath("/super-admin/manage-admins");
    return { success: true };
  } catch (error) {
    console.error("Error deleting role:", error);
    return { success: false, error: "Failed to delete role" };
  }
}

// ============== ADMIN USER MANAGEMENT ==============

export async function getAllAdmins(): Promise<AdminWithPermissions[]> {
  // Get all users with admin or super_admin roles
  const adminUsers = await db
    .select()
    .from(user)
    .where(inArray(user.role, ["admin", "super_admin" as const]))
    .orderBy(desc(user.createdAt));

  // Get permissions and roles for each admin
  const adminsWithPermissions: AdminWithPermissions[] = await Promise.all(
    adminUsers.map(async (adminUser): Promise<AdminWithPermissions> => {
      // Get direct permissions
      const directPerms = await db
        .select()
        .from(userPermission)
        .where(and(
          eq(userPermission.userId, adminUser.id),
          eq(userPermission.isActive, true)
        ));

      // Get assigned roles
      const assignedRolesData = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.userId, adminUser.id));
      
      // Fetch role details and permissions
      const roleIds = assignedRolesData.map(ur => ur.roleId);
      const rolesData = roleIds.length > 0
        ? await db.select().from(role).where(inArray(role.id, roleIds))
        : [];
      
      const rolePermissionsData = roleIds.length > 0
        ? await db.select().from(rolePermission).where(inArray(rolePermission.roleId, roleIds))
        : [];

      const assignedRoles = rolesData.map((r) => ({
        ...r,
        permissions: rolePermissionsData
          .filter(p => p.roleId === r.id)
          .map((p) => p.permission),
      }));

      // Combine all permissions (direct + from roles)
      const directPermissionStrings = directPerms.map((p) => p.permission);
      const rolePermissionStrings = assignedRoles.flatMap((r) => r.permissions);
      const allPermissions = [...new Set([...directPermissionStrings, ...rolePermissionStrings])];

      return {
        id: adminUser.id,
        userId: adminUser.clerkId,
        email: adminUser.email,
        role: adminUser.role,
        onboardingCompleted: adminUser.onboardingCompleted,
        createdAt: adminUser.createdAt,
        updatedAt: adminUser.updatedAt,
        directPermissions: directPermissionStrings,
        assignedRoles,
        allPermissions,
      };
    })
  );

  return adminsWithPermissions;
}

export async function getAdminById(id: string): Promise<AdminWithPermissions | null> {
  const adminUser = await db
    .select()
    .from(user)
    .where(and(
      eq(user.id, id),
      inArray(user.role, ["admin", "super_admin" as const])
    ))
    .limit(1);

  if (!adminUser[0]) return null;

  const admin = adminUser[0];

  // Get direct permissions
  const directPerms = await db
    .select()
    .from(userPermission)
    .where(and(
      eq(userPermission.userId, admin.id),
      eq(userPermission.isActive, true)
    ));

  // Get assigned roles
  const assignedRolesData = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, admin.id));
  
  // Fetch role details and permissions
  const roleIds = assignedRolesData.map(ur => ur.roleId);
  const rolesData = roleIds.length > 0
    ? await db.select().from(role).where(inArray(role.id, roleIds))
    : [];
  
  const rolePermissionsData = roleIds.length > 0
    ? await db.select().from(rolePermission).where(inArray(rolePermission.roleId, roleIds))
    : [];

  const assignedRoles = rolesData.map((r) => ({
    ...r,
    permissions: rolePermissionsData
      .filter(p => p.roleId === r.id)
      .map((p) => p.permission),
  }));

  // Combine all permissions
  const directPermissionStrings = directPerms.map((p) => p.permission);
  const rolePermissionStrings = assignedRoles.flatMap((r) => r.permissions);
  const allPermissions = [...new Set([...directPermissionStrings, ...rolePermissionStrings])];

  const result: AdminWithPermissions = {
    id: admin.id,
    userId: admin.clerkId,
    email: admin.email,
    role: admin.role,
    onboardingCompleted: admin.onboardingCompleted,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
    directPermissions: directPermissionStrings,
    assignedRoles,
    allPermissions,
  };
  
  return result;
}

export async function updateAdminRole(
  adminId: string,
  newRole: "admin" | "super_admin",
  updatedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Prevent changing the last super admin to admin
    if (newRole === "admin") {
      const superAdmins = await db
        .select()
        .from(user)
        .where(eq(user.role, "super_admin"));

      const targetAdmin = await db
        .select()
        .from(user)
        .where(eq(user.id, adminId))
        .limit(1)
        .then(res => res[0] || null);

      if (targetAdmin?.role === "super_admin" && superAdmins.length <= 1) {
        return {
          success: false,
          error: "Cannot change the role of the last super admin",
        };
      }
    }

    await db
      .update(user)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(user.id, adminId));

    revalidatePath("/super-admin/manage-admins");
    return { success: true };
  } catch (error) {
    console.error("Error updating admin role:", error);
    return { success: false, error: "Failed to update admin role" };
  }
}

export async function deleteAdmin(
  adminId: string,
  deletedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if trying to delete the last super admin
    const adminToDelete = await db
      .select()
      .from(user)
      .where(eq(user.id, adminId))
      .limit(1)
      .then(res => res[0] || null);

    if (adminToDelete?.role === "super_admin") {
      const superAdmins = await db
        .select()
        .from(user)
        .where(eq(user.role, "super_admin"));

      if (superAdmins.length <= 1) {
        return {
          success: false,
          error: "Cannot delete the last super admin",
        };
      }
    }

    // Prevent super admin from deleting themselves
    if (adminId === deletedByUserId) {
      return {
        success: false,
        error: "You cannot delete your own account",
      };
    }

    // Delete user permissions first
    await db.delete(userPermission).where(eq(userPermission.userId, adminId));

    // Delete user role assignments
    await db.delete(userRoles).where(eq(userRoles.userId, adminId));

    // Delete the user (or update role back to regular)
    await db
      .update(user)
      .set({
        role: "regular",
        updatedAt: new Date(),
      })
      .where(eq(user.id, adminId));

    revalidatePath("/super-admin/manage-admins");
    return { success: true };
  } catch (error) {
    console.error("Error deleting admin:", error);
    return { success: false, error: "Failed to delete admin" };
  }
}

// ============== USER PERMISSIONS MANAGEMENT ==============

export async function assignPermissionsToUser(
  userId: string,
  permissions: Permission[],
  grantedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Remove existing direct permissions
    await db.delete(userPermission).where(eq(userPermission.userId, userId));

    // Add new permissions
    if (permissions.length > 0) {
      await db.insert(userPermission).values(
        permissions.map((permission) => ({
          userId,
          permission,
          grantedBy: grantedByUserId,
          isActive: true,
        }))
      );
    }

    revalidatePath("/super-admin/manage-admins");
    return { success: true };
  } catch (error) {
    console.error("Error assigning permissions:", error);
    return { success: false, error: "Failed to assign permissions" };
  }
}

export async function revokePermissionFromUser(
  userId: string,
  permission: Permission
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(userPermission)
      .where(
        and(
          eq(userPermission.userId, userId),
          eq(userPermission.permission, permission)
        )
      );

    revalidatePath("/super-admin/manage-admins");
    return { success: true };
  } catch (error) {
    console.error("Error revoking permission:", error);
    return { success: false, error: "Failed to revoke permission" };
  }
}

// ============== USER ROLES MANAGEMENT ==============

export async function assignRoleToUser(
  userId: string,
  roleId: string,
  assignedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already assigned
    const existing = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      .limit(1)
      .then(res => res[0] || null);

    if (existing) {
      return { success: false, error: "User already has this role assigned" };
    }

    await db.insert(userRoles).values({
      userId,
      roleId,
      assignedBy: assignedByUserId,
    });

    revalidatePath("/super-admin/manage-admins");
    return { success: true };
  } catch (error) {
    console.error("Error assigning role:", error);
    return { success: false, error: "Failed to assign role" };
  }
}

export async function removeRoleFromUser(
  userId: string,
  roleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));

    revalidatePath("/super-admin/manage-admins");
    return { success: true };
  } catch (error) {
    console.error("Error removing role:", error);
    return { success: false, error: "Failed to remove role" };
  }
}

// ============== PERMISSION CHECKING ==============

export async function checkUserPermission(
  userId: string,
  permission: Permission
): Promise<boolean> {
  // Super admin always has all permissions
  const userData = await db
    .select()
    .from(user)
    .where(eq(user.clerkId, userId))
    .limit(1)
    .then(res => res[0] || null);

  if (userData?.role === "super_admin") {
    return true;
  }

  if (!userData) {
    return false;
  }

  // Use the database user ID (UUID) for permission queries, not the Clerk ID
  const dbUserId = userData.id;

  // Check direct permissions
  const directPerm = await db
    .select()
    .from(userPermission)
    .where(and(
      eq(userPermission.userId, dbUserId),
      eq(userPermission.permission, permission),
      eq(userPermission.isActive, true)
    ))
    .limit(1)
    .then(res => res[0] || null);

  if (directPerm) {
    return true;
  }

  // Check role-based permissions
  const userRoleRecords = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, dbUserId));
  
  // Fetch roles and their permissions
  const roleIds = userRoleRecords.map(ur => ur.roleId);
  if (roleIds.length === 0) return false;
  
  const rolePermissionsData = await db
    .select()
    .from(rolePermission)
    .where(inArray(rolePermission.roleId, roleIds));

  // Check if any role has the permission
  for (const rp of rolePermissionsData) {
    if (rp.permission === permission) {
      return true;
    }
  }

  return false;
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  // Super admin gets all permissions
  const userData = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .then(res => res[0] || null);

  if (userData?.role === "super_admin") {
    // Import all permissions from the permissions file
    const { getAllPermissions } = await import("@/lib/permissions");
    return getAllPermissions();
  }

  // Get direct permissions
  const directPerms = await db
    .select()
    .from(userPermission)
    .where(and(
      eq(userPermission.userId, userId),
      eq(userPermission.isActive, true)
    ));

  // Get role-based permissions
  const userRoleRecords = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  
  // Fetch role permissions
  const roleIds = userRoleRecords.map(ur => ur.roleId);
  const rolePermissionsData = roleIds.length > 0
    ? await db.select().from(rolePermission).where(inArray(rolePermission.roleId, roleIds))
    : [];

  const rolePermissions = rolePermissionsData.map((p) => p.permission);

  // Combine and deduplicate
  const allPermissions = [
    ...directPerms.map((p) => p.permission),
    ...rolePermissions,
  ];

  return [...new Set(allPermissions)];
}

// ============== PROMOTE USER TO ADMIN ==============

export async function promoteUserToAdmin(
  userId: string,
  promotedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user exists
    const targetUser = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
      .then(res => res[0] || null);

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    // Check if already an admin
    if (targetUser.role === "admin" || targetUser.role === "super_admin") {
      return { success: false, error: "User is already an admin" };
    }

    // Update role to admin
    await db
      .update(user)
      .set({
        role: "admin",
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    revalidatePath("/super-admin/manage-admins");
    return { success: true };
  } catch (error) {
    console.error("Error promoting user to admin:", error);
    return { success: false, error: "Failed to promote user to admin" };
  }
}

// ============== ENSURE ADMIN PERMISSIONS ==============

import { PermissionGroups } from "@/lib/permissions";

/**
 * Ensures an admin user has all the default ADMIN_USER permissions
 * This should be called when an admin user is created or when they log in
 */
export async function ensureAdminPermissions(
  clerkUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the user from database
    const userData = await db
      .select()
      .from(user)
      .where(eq(user.clerkId, clerkUserId))
      .limit(1)
      .then(res => res[0] || null);

    if (!userData) {
      return { success: false, error: "User not found" };
    }

    // Only admins and super admins should have these permissions
    if (userData.role !== "admin" && userData.role !== "super_admin") {
      return { success: false, error: "User is not an admin" };
    }

    const dbUserId = userData.id;

    // Get the default admin permissions from the permission groups
    const defaultAdminPermissions = PermissionGroups.ADMIN_USER;

    // Check which permissions the user already has
    const existingPermissions = await db
      .select()
      .from(userPermission)
      .where(eq(userPermission.userId, dbUserId));

    const existingPermissionSet = new Set(existingPermissions.map(p => p.permission));

    // Add any missing permissions
    const permissionsToAdd = defaultAdminPermissions.filter(
      perm => !existingPermissionSet.has(perm)
    );

    if (permissionsToAdd.length > 0) {
      // Insert missing permissions
      await db.insert(userPermission).values(
        permissionsToAdd.map(permission => ({
          userId: dbUserId,
          permission: permission,
          grantedBy: dbUserId, // Self-granted for default permissions
          isActive: true,
        }))
      );
    }

    return { success: true };
  } catch (error) {
    console.error("Error ensuring admin permissions:", error);
    return { success: false, error: "Failed to ensure admin permissions" };
  }
}
