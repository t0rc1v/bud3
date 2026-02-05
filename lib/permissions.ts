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
} as const;

export type PermissionDomain = (typeof PermissionDomains)[keyof typeof PermissionDomains];

// Content-related permissions
export const ContentPermissions = {
  // Grades
  GRADES_READ: "content:grades:read",
  GRADES_CREATE: "content:grades:create",
  GRADES_UPDATE: "content:grades:update",
  GRADES_DELETE: "content:grades:delete",
  
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
  // Learners
  LEARNERS_READ: "users:learners:read",
  LEARNERS_CREATE: "users:learners:create",
  LEARNERS_UPDATE: "users:learners:update",
  LEARNERS_DELETE: "users:learners:delete",
  LEARNERS_MANAGE: "users:learners:manage",
  
  // Teachers
  TEACHERS_READ: "users:teachers:read",
  TEACHERS_CREATE: "users:teachers:create",
  TEACHERS_UPDATE: "users:teachers:update",
  TEACHERS_DELETE: "users:teachers:delete",
  TEACHERS_MANAGE: "users:teachers:manage",
  
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

// Combine all permissions
export const Permissions = {
  ...ContentPermissions,
  ...UserPermissions,
  ...AdminPermissions,
  ...SystemPermissions,
  ...AnalyticsPermissions,
} as const;

// Type for all permission strings
export type Permission = (typeof Permissions)[keyof typeof Permissions];

// Permission groups for easier assignment
export const PermissionGroups = {
  // Full content access
  CONTENT_FULL: Object.values(ContentPermissions),
  
  // Read-only content access
  CONTENT_READ_ONLY: [
    ContentPermissions.GRADES_READ,
    ContentPermissions.SUBJECTS_READ,
    ContentPermissions.TOPICS_READ,
    ContentPermissions.RESOURCES_READ,
  ],
  
  // Content manager (create, read, update - no delete)
  CONTENT_MANAGER: [
    ContentPermissions.GRADES_READ,
    ContentPermissions.GRADES_CREATE,
    ContentPermissions.GRADES_UPDATE,
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
    ContentPermissions.GRADES_READ,
    ContentPermissions.SUBJECTS_READ,
    ContentPermissions.TOPICS_READ,
    ContentPermissions.RESOURCES_READ,
    ContentPermissions.RESOURCES_CREATE,
    ContentPermissions.RESOURCES_UPDATE,
    UserPermissions.LEARNERS_READ,
    UserPermissions.TEACHERS_READ,
    AnalyticsPermissions.ANALYTICS_VIEW,
  ],
};

// Permission descriptions for UI display
export const PermissionDescriptions: Record<Permission, { label: string; description: string; category: string }> = {
  // Content - Grades
  [ContentPermissions.GRADES_READ]: { label: "View Grades", description: "View grade listings and details", category: "Content - Grades" },
  [ContentPermissions.GRADES_CREATE]: { label: "Create Grades", description: "Add new grades to the system", category: "Content - Grades" },
  [ContentPermissions.GRADES_UPDATE]: { label: "Edit Grades", description: "Modify existing grade information", category: "Content - Grades" },
  [ContentPermissions.GRADES_DELETE]: { label: "Delete Grades", description: "Remove grades from the system", category: "Content - Grades" },
  
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
  
  // Users - Learners
  [UserPermissions.LEARNERS_READ]: { label: "View Learners", description: "View learner profiles and data", category: "Users - Learners" },
  [UserPermissions.LEARNERS_CREATE]: { label: "Create Learners", description: "Add new learner accounts", category: "Users - Learners" },
  [UserPermissions.LEARNERS_UPDATE]: { label: "Edit Learners", description: "Modify learner information", category: "Users - Learners" },
  [UserPermissions.LEARNERS_DELETE]: { label: "Delete Learners", description: "Remove learner accounts", category: "Users - Learners" },
  [UserPermissions.LEARNERS_MANAGE]: { label: "Manage Learners", description: "Full learner management access", category: "Users - Learners" },
  
  // Users - Teachers
  [UserPermissions.TEACHERS_READ]: { label: "View Teachers", description: "View teacher profiles", category: "Users - Teachers" },
  [UserPermissions.TEACHERS_CREATE]: { label: "Create Teachers", description: "Add new teacher accounts", category: "Users - Teachers" },
  [UserPermissions.TEACHERS_UPDATE]: { label: "Edit Teachers", description: "Modify teacher information", category: "Users - Teachers" },
  [UserPermissions.TEACHERS_DELETE]: { label: "Delete Teachers", description: "Remove teacher accounts", category: "Users - Teachers" },
  [UserPermissions.TEACHERS_MANAGE]: { label: "Manage Teachers", description: "Full teacher management access", category: "Users - Teachers" },
  
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
