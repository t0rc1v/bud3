/**
 * Scalable Permission System
 * 
 * This file defines all permissions in the system using a hierarchical structure.
 * Permissions are grouped by domain (resource, user, system, etc.) and can be easily extended.
 * 
 * Permission Naming Convention:
 * - {domain}:{action} - e.g., "content:create", "users:read"
 * - {domain}:{subdomain}:{action} - e.g., "content:grades:create"
 * 
 * Actions:
 * - read: View/list resources
 * - create: Create new resources
 * - update: Modify existing resources
 * - delete: Remove resources
 * - manage: Full control including permissions
 */

export const PermissionDomains = {
  CONTENT: "content",
  USERS: "users",
  ADMIN: "admin",
  SYSTEM: "system",
  ANALYTICS: "analytics",
  FINANCE: "finance",
} as const;

export type PermissionDomain = (typeof PermissionDomains)[keyof typeof PermissionDomains];

// Content-related permissions
export const ContentPermissions = {
  // Levels
  LEVELS_READ: "content:levels:read",
  LEVELS_CREATE: "content:levels:create",
  LEVELS_UPDATE: "content:levels:update",
  LEVELS_DELETE: "content:levels:delete",
  
  // Subjects
  SUBJECTS_READ: "content:subjects:read",
  SUBJECTS_CREATE: "content:subjects:create",
  SUBJECTS_UPDATE: "content:subjects:update",
  SUBJECTS_DELETE: "content:subjects:delete",
  
  // Topics
  TOPICS_READ: "content:topics:read",
  TOPICS_CREATE: "content:topics:create",
  TOPICS_UPDATE: "content:topics:update",
  TOPICS_DELETE: "content:topics:delete",
  
  // Resources
  RESOURCES_READ: "content:resources:read",
  RESOURCES_CREATE: "content:resources:create",
  RESOURCES_UPDATE: "content:resources:update",
  RESOURCES_DELETE: "content:resources:delete",
  
  // Bulk content operations
  CONTENT_IMPORT: "content:import",
  CONTENT_EXPORT: "content:export",
  CONTENT_PUBLISH: "content:publish",
  CONTENT_UNPUBLISH: "content:unpublish",
} as const;

// User-related permissions
export const UserPermissions = {
  // Regular users (formerly learners)
  REGULARS_READ: "users:regulars:read",
  REGULARS_CREATE: "users:regulars:create",
  REGULARS_UPDATE: "users:regulars:update",
  REGULARS_DELETE: "users:regulars:delete",
  REGULARS_MANAGE: "users:regulars:manage",
  REGULARS_ADD: "users:regulars:add", // Add regulars to admin
  REGULARS_REMOVE: "users:regulars:remove", // Remove regulars from admin
  
  // General user operations
  USERS_READ: "users:read",
  USERS_IMPERSONATE: "users:impersonate",
  USERS_BULK_ACTIONS: "users:bulk_actions",
} as const;

// Admin-related permissions
export const AdminPermissions = {
  // Admin management
  ADMINS_READ: "admin:read",
  ADMINS_CREATE: "admin:create",
  ADMINS_UPDATE: "admin:update",
  ADMINS_DELETE: "admin:delete",
  ADMINS_MANAGE_PERMISSIONS: "admin:manage_permissions",
  
  // Role management (for super-admin)
  ROLES_READ: "admin:roles:read",
  ROLES_CREATE: "admin:roles:create",
  ROLES_UPDATE: "admin:roles:update",
  ROLES_DELETE: "admin:roles:delete",
  ROLES_MANAGE_PERMISSIONS: "admin:roles:manage_permissions",
} as const;

// System-related permissions
export const SystemPermissions = {
  // Settings
  SETTINGS_READ: "system:settings:read",
  SETTINGS_UPDATE: "system:settings:update",
  
  // Maintenance
  SYSTEM_MAINTENANCE: "system:maintenance",
  SYSTEM_BACKUP: "system:backup",
  SYSTEM_RESTORE: "system:restore",
  
  // Logs
  LOGS_READ: "system:logs:read",
  LOGS_CLEAR: "system:logs:clear",
  
  // API
  API_KEYS_MANAGE: "system:api_keys:manage",
  WEBHOOKS_MANAGE: "system:webhooks:manage",
} as const;

// Analytics permissions
export const AnalyticsPermissions = {
  ANALYTICS_VIEW: "analytics:view",
  ANALYTICS_EXPORT: "analytics:export",
  ANALYTICS_DASHBOARD: "analytics:dashboard",
  REPORTS_CREATE: "analytics:reports:create",
  REPORTS_SCHEDULE: "analytics:reports:schedule",
} as const;

// Finance/Credit permissions
export const FinancePermissions = {
  CREDITS_PURCHASE: "finance:credits:purchase",
  CREDITS_GIFT: "finance:credits:gift",
  CREDITS_MANAGE: "finance:credits:manage",
  PAYMENTS_VIEW: "finance:payments:view",
  PAYMENTS_REFUND: "finance:payments:refund",
} as const;

// Combine all permissions
export const Permissions = {
  ...ContentPermissions,
  ...UserPermissions,
  ...AdminPermissions,
  ...SystemPermissions,
  ...AnalyticsPermissions,
  ...FinancePermissions,
} as const;

// Type for all permission strings
export type Permission = (typeof Permissions)[keyof typeof Permissions];

// Permission groups for easier assignment
export const PermissionGroups = {
  // Full content access
  CONTENT_FULL: Object.values(ContentPermissions),
  
  // Read-only content access
  CONTENT_READ_ONLY: [
    ContentPermissions.LEVELS_READ,
    ContentPermissions.SUBJECTS_READ,
    ContentPermissions.TOPICS_READ,
    ContentPermissions.RESOURCES_READ,
  ],
  
  // Content manager (create, read, update - no delete)
  CONTENT_MANAGER: [
    ContentPermissions.LEVELS_READ,
    ContentPermissions.LEVELS_CREATE,
    ContentPermissions.LEVELS_UPDATE,
    ContentPermissions.SUBJECTS_READ,
    ContentPermissions.SUBJECTS_CREATE,
    ContentPermissions.SUBJECTS_UPDATE,
    ContentPermissions.TOPICS_READ,
    ContentPermissions.TOPICS_CREATE,
    ContentPermissions.TOPICS_UPDATE,
    ContentPermissions.RESOURCES_READ,
    ContentPermissions.RESOURCES_CREATE,
    ContentPermissions.RESOURCES_UPDATE,
  ],
  
  // Regular user permissions - manage own content including levels
  REGULAR_USER: [
    // Levels - full management of their own levels
    ContentPermissions.LEVELS_READ,
    ContentPermissions.LEVELS_CREATE,
    ContentPermissions.LEVELS_UPDATE,
    ContentPermissions.LEVELS_DELETE,
    // Subjects - full management
    ContentPermissions.SUBJECTS_READ,
    ContentPermissions.SUBJECTS_CREATE,
    ContentPermissions.SUBJECTS_UPDATE,
    ContentPermissions.SUBJECTS_DELETE,
    // Topics - full management
    ContentPermissions.TOPICS_READ,
    ContentPermissions.TOPICS_CREATE,
    ContentPermissions.TOPICS_UPDATE,
    ContentPermissions.TOPICS_DELETE,
    // Resources - full management
    ContentPermissions.RESOURCES_READ,
    ContentPermissions.RESOURCES_CREATE,
    ContentPermissions.RESOURCES_UPDATE,
    ContentPermissions.RESOURCES_DELETE,
    UserPermissions.REGULARS_READ,
    FinancePermissions.CREDITS_PURCHASE,
  ],
  
  // Admin user permissions - can manage all their own content but not regulars
  ADMIN_USER: [
    // Levels - full management
    ContentPermissions.LEVELS_READ,
    ContentPermissions.LEVELS_CREATE,
    ContentPermissions.LEVELS_UPDATE,
    ContentPermissions.LEVELS_DELETE,
    // Subjects - full management
    ContentPermissions.SUBJECTS_READ,
    ContentPermissions.SUBJECTS_CREATE,
    ContentPermissions.SUBJECTS_UPDATE,
    ContentPermissions.SUBJECTS_DELETE,
    // Topics - full management
    ContentPermissions.TOPICS_READ,
    ContentPermissions.TOPICS_CREATE,
    ContentPermissions.TOPICS_UPDATE,
    ContentPermissions.TOPICS_DELETE,
    // Resources - full management
    ContentPermissions.RESOURCES_READ,
    ContentPermissions.RESOURCES_CREATE,
    ContentPermissions.RESOURCES_UPDATE,
    ContentPermissions.RESOURCES_DELETE,
    // Only read regulars, not manage them (moved to super-admin)
    UserPermissions.REGULARS_READ,
    AdminPermissions.ADMINS_READ,
    // Finance
    FinancePermissions.CREDITS_GIFT,
  ],
  
  // User management
  USERS_FULL: Object.values(UserPermissions),
  
  // Admin management
  ADMIN_FULL: Object.values(AdminPermissions),
  
  // System administration
  SYSTEM_FULL: Object.values(SystemPermissions),
  
  // Analytics access
  ANALYTICS_FULL: Object.values(AnalyticsPermissions),
  
  // Super admin - all permissions
  SUPER_ADMIN: Object.values(Permissions),
  
  // Basic admin - limited set
  BASIC_ADMIN: [
    ContentPermissions.LEVELS_READ,
    ContentPermissions.SUBJECTS_READ,
    ContentPermissions.TOPICS_READ,
    ContentPermissions.RESOURCES_READ,
    ContentPermissions.RESOURCES_CREATE,
    ContentPermissions.RESOURCES_UPDATE,
    UserPermissions.REGULARS_READ,
    AdminPermissions.ADMINS_READ,
    AnalyticsPermissions.ANALYTICS_VIEW,
  ],
};

// Permission descriptions for UI display
export const PermissionDescriptions: Record<Permission, { label: string; description: string; category: string }> = {
  // Content - Levels
  [ContentPermissions.LEVELS_READ]: { label: "View Levels", description: "View level listings and details", category: "Content - Levels" },
  [ContentPermissions.LEVELS_CREATE]: { label: "Create Levels", description: "Add new levels to the system", category: "Content - Levels" },
  [ContentPermissions.LEVELS_UPDATE]: { label: "Edit Levels", description: "Modify existing level information", category: "Content - Levels" },
  [ContentPermissions.LEVELS_DELETE]: { label: "Delete Levels", description: "Remove levels from the system", category: "Content - Levels" },
  
  // Content - Subjects
  [ContentPermissions.SUBJECTS_READ]: { label: "View Subjects", description: "View subject listings and details", category: "Content - Subjects" },
  [ContentPermissions.SUBJECTS_CREATE]: { label: "Create Subjects", description: "Add new subjects", category: "Content - Subjects" },
  [ContentPermissions.SUBJECTS_UPDATE]: { label: "Edit Subjects", description: "Modify existing subjects", category: "Content - Subjects" },
  [ContentPermissions.SUBJECTS_DELETE]: { label: "Delete Subjects", description: "Remove subjects", category: "Content - Subjects" },
  
  // Content - Topics
  [ContentPermissions.TOPICS_READ]: { label: "View Topics", description: "View topic listings", category: "Content - Topics" },
  [ContentPermissions.TOPICS_CREATE]: { label: "Create Topics", description: "Add new topics", category: "Content - Topics" },
  [ContentPermissions.TOPICS_UPDATE]: { label: "Edit Topics", description: "Modify existing topics", category: "Content - Topics" },
  [ContentPermissions.TOPICS_DELETE]: { label: "Delete Topics", description: "Remove topics", category: "Content - Topics" },
  
  // Content - Resources
  [ContentPermissions.RESOURCES_READ]: { label: "View Resources", description: "View educational resources", category: "Content - Resources" },
  [ContentPermissions.RESOURCES_CREATE]: { label: "Create Resources", description: "Upload and add new resources", category: "Content - Resources" },
  [ContentPermissions.RESOURCES_UPDATE]: { label: "Edit Resources", description: "Modify existing resources", category: "Content - Resources" },
  [ContentPermissions.RESOURCES_DELETE]: { label: "Delete Resources", description: "Remove resources", category: "Content - Resources" },
  
  // Content - Bulk Operations
  [ContentPermissions.CONTENT_IMPORT]: { label: "Import Content", description: "Bulk import content from files", category: "Content - Bulk Operations" },
  [ContentPermissions.CONTENT_EXPORT]: { label: "Export Content", description: "Export content to files", category: "Content - Bulk Operations" },
  [ContentPermissions.CONTENT_PUBLISH]: { label: "Publish Content", description: "Make content visible to users", category: "Content - Bulk Operations" },
  [ContentPermissions.CONTENT_UNPUBLISH]: { label: "Unpublish Content", description: "Hide content from users", category: "Content - Bulk Operations" },
  
  // Users - Regulars (formerly Learners)
  [UserPermissions.REGULARS_READ]: { label: "View Regulars", description: "View regular user profiles and data", category: "Users - Regulars" },
  [UserPermissions.REGULARS_CREATE]: { label: "Create Regulars", description: "Add new regular user accounts", category: "Users - Regulars" },
  [UserPermissions.REGULARS_UPDATE]: { label: "Edit Regulars", description: "Modify regular user information", category: "Users - Regulars" },
  [UserPermissions.REGULARS_DELETE]: { label: "Delete Regulars", description: "Remove regular user accounts", category: "Users - Regulars" },
  [UserPermissions.REGULARS_MANAGE]: { label: "Manage Regulars", description: "Full regular user management access", category: "Users - Regulars" },
  [UserPermissions.REGULARS_ADD]: { label: "Add Regulars", description: "Add regular users to your institution", category: "Users - Regulars" },
  [UserPermissions.REGULARS_REMOVE]: { label: "Remove Regulars", description: "Remove regular users from your institution", category: "Users - Regulars" },
  

  
  // Users - General
  [UserPermissions.USERS_READ]: { label: "View All Users", description: "Access all user accounts", category: "Users - General" },
  [UserPermissions.USERS_IMPERSONATE]: { label: "Impersonate Users", description: "Log in as another user", category: "Users - General" },
  [UserPermissions.USERS_BULK_ACTIONS]: { label: "Bulk User Actions", description: "Perform actions on multiple users", category: "Users - General" },
  
  // Admin Management
  [AdminPermissions.ADMINS_READ]: { label: "View Admins", description: "View administrator accounts", category: "Admin Management" },
  [AdminPermissions.ADMINS_CREATE]: { label: "Create Admins", description: "Add new administrators", category: "Admin Management" },
  [AdminPermissions.ADMINS_UPDATE]: { label: "Edit Admins", description: "Modify administrator accounts", category: "Admin Management" },
  [AdminPermissions.ADMINS_DELETE]: { label: "Delete Admins", description: "Remove administrators", category: "Admin Management" },
  [AdminPermissions.ADMINS_MANAGE_PERMISSIONS]: { label: "Manage Admin Permissions", description: "Assign permissions to admins", category: "Admin Management" },
  
  // Role Management
  [AdminPermissions.ROLES_READ]: { label: "View Roles", description: "View system roles", category: "Role Management" },
  [AdminPermissions.ROLES_CREATE]: { label: "Create Roles", description: "Create new roles", category: "Role Management" },
  [AdminPermissions.ROLES_UPDATE]: { label: "Edit Roles", description: "Modify existing roles", category: "Role Management" },
  [AdminPermissions.ROLES_DELETE]: { label: "Delete Roles", description: "Remove roles", category: "Role Management" },
  [AdminPermissions.ROLES_MANAGE_PERMISSIONS]: { label: "Manage Role Permissions", description: "Assign permissions to roles", category: "Role Management" },
  
  // System - Settings
  [SystemPermissions.SETTINGS_READ]: { label: "View Settings", description: "View system settings", category: "System - Settings" },
  [SystemPermissions.SETTINGS_UPDATE]: { label: "Edit Settings", description: "Modify system configuration", category: "System - Settings" },
  
  // System - Maintenance
  [SystemPermissions.SYSTEM_MAINTENANCE]: { label: "System Maintenance", description: "Perform maintenance tasks", category: "System - Maintenance" },
  [SystemPermissions.SYSTEM_BACKUP]: { label: "Create Backups", description: "Backup system data", category: "System - Maintenance" },
  [SystemPermissions.SYSTEM_RESTORE]: { label: "Restore Backups", description: "Restore from backup", category: "System - Maintenance" },
  
  // System - Logs
  [SystemPermissions.LOGS_READ]: { label: "View Logs", description: "Access system logs", category: "System - Logs" },
  [SystemPermissions.LOGS_CLEAR]: { label: "Clear Logs", description: "Clear log history", category: "System - Logs" },
  
  // System - API
  [SystemPermissions.API_KEYS_MANAGE]: { label: "Manage API Keys", description: "Create and manage API keys", category: "System - API" },
  [SystemPermissions.WEBHOOKS_MANAGE]: { label: "Manage Webhooks", description: "Configure webhooks", category: "System - API" },
  
  // Analytics
  [AnalyticsPermissions.ANALYTICS_VIEW]: { label: "View Analytics", description: "Access analytics data", category: "Analytics" },
  [AnalyticsPermissions.ANALYTICS_EXPORT]: { label: "Export Analytics", description: "Export analytics reports", category: "Analytics" },
  [AnalyticsPermissions.ANALYTICS_DASHBOARD]: { label: "Analytics Dashboard", description: "View analytics dashboard", category: "Analytics" },
  [AnalyticsPermissions.REPORTS_CREATE]: { label: "Create Reports", description: "Generate custom reports", category: "Analytics" },
  [AnalyticsPermissions.REPORTS_SCHEDULE]: { label: "Schedule Reports", description: "Set up automated reports", category: "Analytics" },
  
  // Finance - Credits
  [FinancePermissions.CREDITS_PURCHASE]: { label: "Purchase Credits", description: "Buy AI credits using M-Pesa", category: "Finance - Credits" },
  [FinancePermissions.CREDITS_GIFT]: { label: "Gift Credits", description: "Gift credits to other users (admin only)", category: "Finance - Credits" },
  [FinancePermissions.CREDITS_MANAGE]: { label: "Manage Credits", description: "View and manage user credit balances", category: "Finance - Credits" },
  [FinancePermissions.PAYMENTS_VIEW]: { label: "View Payments", description: "View payment history and transactions", category: "Finance - Payments" },
  [FinancePermissions.PAYMENTS_REFUND]: { label: "Process Refunds", description: "Refund payments to users", category: "Finance - Payments" },
};

// Helper function to check if a permission exists
export function isValidPermission(permission: string): permission is Permission {
  return Object.values(Permissions).includes(permission as Permission);
}

// Helper function to get permissions by category
export function getPermissionsByCategory(): Record<string, Permission[]> {
  const categories: Record<string, Permission[]> = {};
  
  for (const [permission, info] of Object.entries(PermissionDescriptions)) {
    if (!categories[info.category]) {
      categories[info.category] = [];
    }
    categories[info.category].push(permission as Permission);
  }
  
  return categories;
}

// Helper function to get all permissions as array
export function getAllPermissions(): Permission[] {
  return Object.values(Permissions);
}
