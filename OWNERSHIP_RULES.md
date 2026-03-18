# Ownership Rules

## Content Ownership Model

Every content entity (level, subject, topic, resource) stores an `ownerId` (user UUID) and `ownerRole` at creation time. These fields determine who can modify and who can view the content.

---

## Ownership Hierarchy

### Super-Admin

- **Modify**: any content (own + all linked admins' + all linked regulars').
- **View**: all three visibility levels (`public`, `admin_only`, `regular_only`).
- Linked to admins via `superAdminAdmins` table.
- Linked to regulars via `superAdminRegulars` table.

### Admin

- **Modify**: own content only.
- **View**: own content + their super-admin's content.
- Cannot modify content belonging to other admins or regulars, even if linked.

### Regular (Learner)

- **Modify**: own content only.
- **View**: own content + super-admin's content + super-admin's admins' content + legacy admin content (`adminRegulars`).
- Cannot modify anyone else's content.

---

## Modification Check

All modification (update/delete) operations use `canModifyContent()` in `lib/actions/admin.ts`:

```typescript
function canModifyContent(contentOwnerId, userId, userRole): boolean {
  if (userRole === "super_admin") return true;
  return contentOwnerId === userId;
}
```

**Applied to**: level update/delete, subject update/delete, topic update/delete.

> **Known gap**: Resource update and resource delete do **not** call `canModifyContent()`. Bulk delete inherits this gap.

---

## Visibility-Based Access

Content has a `visibility` field with three values:

| Visibility      | Public users | Regular | Admin | Super-Admin |
| --------------- | ------------ | ------- | ----- | ----------- |
| `public`        | Yes          | Yes     | Yes   | Yes         |
| `regular_only`  | No           | Yes     | No    | Yes         |
| `admin_only`    | No           | No      | Yes   | Yes         |

Visibility filtering is layered **on top of** ownership. Content must pass both checks:

1. The content's `ownerId` must be in the user's allowed owner set (based on hierarchy).
2. The content's `visibility` must be compatible with the user's role.

Exception: `public` content is visible to everyone regardless of ownership.

---

## Permission vs. Ownership

Two independent systems control access:

| System         | Scope              | Checked via                                  |
| -------------- | ------------------ | -------------------------------------------- |
| **Permission** | Feature-level RBAC | `checkUserPermission(clerkId, permission)`   |
| **Ownership**  | Content-level CRUD | `canModifyContent()` / `canAccessContent()`  |

A user might have `RESOURCES_DELETE` permission but still be blocked from deleting a resource they don't own (unless they are a super-admin).

---

## Content Creation

On creation, the caller's `userId` and `role` are stored as `ownerId` and `ownerRole`. No additional ownership check is needed at creation time — the creator is the owner by definition.

Resource creation additionally involves a credit fee transaction wrapped in a database transaction with `SELECT FOR UPDATE` for atomicity.

---

## Allowed Owner Set Construction

When listing content for a user, the system builds an `allowedOwnerIds` set:

- **Super-admin**: `{self}` ∪ `{all linked admins}` ∪ `{all linked regulars}`
- **Admin**: `{self}` ∪ `{linked super-admin}`
- **Regular**: `{self}` ∪ `{linked super-admin}` ∪ `{super-admin's admins}` ∪ `{legacy admin links}`

Content is only returned if its `ownerId` is in this set (or it is `public`).

---

## Key Files

| File                                               | Responsibility                        |
| -------------------------------------------------- | ------------------------------------- |
| `lib/db/schema.ts`                                 | `ownerId` / `ownerRole` columns       |
| `lib/actions/admin.ts`                             | `canModifyContent`, `canAccessContent` |
| `lib/permissions.ts`                               | Permission enum definitions            |
| `lib/actions/admin-permissions.ts`                 | `checkUserPermission` helper           |
| `app/api/content/hierarchy-with-unlock-status/...` | Visibility filtering for content tree  |
| `app/api/content/proxy/route.ts`                   | Ownership check before streaming       |
