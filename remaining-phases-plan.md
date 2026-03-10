# Remaining Phases Plan — bud3 LMS

Phase 1 (Learner Experience) is complete.
  - Add resourceProgress, resourceBookmark, resourceNote,
    resourceRating
      tables to schema with indexes and FK constraints (migration
    0002)
  - New lib/actions/learner.ts with all
  progress/bookmark/note/rating
    DB actions including bulk helpers and getTopRatedResources
  - New API routes: /api/learner/progress,
  /api/learner/bookmarks,
    /api/learner/notes, /api/learner/ratings (auth +
  rate-limited)
  - ResourceViewer: bookmark toggle, Mark as Complete button,
  thumbs
    up/down rating, collapsible notes panel with auto-save
  - RegularDashboardClient: Resume card, progress summary,
  Bookmarks
    tab, fires progress update on resource open
  - New BookmarksTab component with resource grid
  - Super-admin analytics: Content Ratings section (top-rated
  resources)
  - Extend /api/admin/analytics to include getTopRatedResources
   data
   
This document covers Phases 2–4 and the "Other" extras.

---

## Phase 2 — Payments & Credits

### 2a. Promo Codes

**Goal:** Super-admins create discount codes; learners redeem them for bonus credits.

**DB changes (`lib/db/schema.ts`)**
```
promoCode table:
  id uuid PK
  code varchar(32) UNIQUE NOT NULL  -- e.g. "LAUNCH50"
  creditAmount integer NOT NULL      -- credits awarded on redemption
  maxUses integer nullable           -- null = unlimited
  usedCount integer DEFAULT 0
  expiresAt timestamptz nullable
  createdBy uuid FK → user.id
  isActive boolean DEFAULT true
  createdAt, updatedAt

promoCodeRedemption table:
  id uuid PK
  promoCodeId uuid FK → promoCode.id ON DELETE CASCADE
  userId uuid FK → user.id ON DELETE CASCADE
  redeemedAt timestamptz DEFAULT now()
  UNIQUE(promoCodeId, userId)        -- one redemption per user per code
  INDEX: userId
```

**Actions (`lib/actions/credits.ts` additions)**
- `createPromoCode(createdByUserId, { code, creditAmount, maxUses?, expiresAt? })` — inserts; validates code uniqueness
- `redeemPromoCode(userId, code)` — checks active/not expired/not exceeded/not already redeemed; awards credits via existing `giftCredits()`-style insert into `creditTransaction`; increments `usedCount`; returns `{ credited: number }`
- `listPromoCodes()` — for super-admin UI
- `deactivatePromoCode(id)` — sets `isActive = false`

**API Routes**
- `POST /api/credits/redeem-promo` — body `{ code }` — learner-facing; rate-limit 5/min; returns `{ credited, newBalance }`
- `GET /api/admin/promo-codes` — super-admin list (requires `CREDITS_MANAGE` permission)
- `POST /api/admin/promo-codes` — create code
- `PATCH /api/admin/promo-codes/[id]` — deactivate

**UI**
- Super-admin: new "Promo Codes" card in analytics or dedicated `/super-admin/promo-codes` page with create form + table (code, credits, uses, expiry, active toggle)
- Regular dashboard: "Redeem Code" input in credits section; shows success toast with credits awarded

---

### 2b. Referral Credits

**Goal:** Learner A shares a referral link; when Learner B makes their first purchase, A earns bonus credits.

**DB changes**
```
referral table:
  id uuid PK
  referrerId uuid FK → user.id   -- the sharer
  referredId uuid FK → user.id   -- the new user (set on signup)
  firstPurchaseAt timestamptz nullable  -- set when credited
  creditAwarded integer nullable
  createdAt

INDEX: referrerId, referredId (UNIQUE)
```

**Referral flow**
1. User visits `/invite?ref=<clerkId>` → stored in cookie/localStorage
2. On Clerk sign-up webhook (`POST /api/webhooks/clerk` user.created): if ref cookie present, insert `referral` row with `referrerId`
3. On M-Pesa callback success: check if this user has a `referral` row with `firstPurchaseAt IS NULL`; if yes, award referrer 50 credits (configurable constant), set `firstPurchaseAt`, `creditAwarded`

**Actions**
- `createReferral(referrerId, referredId)` — safe upsert
- `awardReferralCredits(referredUserId)` — awards referrer, marks referral complete; use DB transaction

**API**
- `GET /api/referral/link` — returns `{ link: "https://.../invite?ref=<userId>" }` for regular dashboard
- No separate endpoint needed for creation (webhook handles it)

**UI**
- Regular dashboard: "Refer a Friend" card — copy-to-clipboard referral link; shows "X friends referred, Y credits earned from referrals"

---

### 2c. Invoice / PDF Receipt Download

**Goal:** Learner can download a PDF receipt for each completed M-Pesa purchase.

**Approach:** Server-rendered PDF via `@react-pdf/renderer` (install package).

**Actions**
- `getCreditPurchase(purchaseId, userId)` — fetch purchase + user email for ownership check

**API Route**
- `GET /api/payments/receipt/[purchaseId]` — auth required; ownership check; generate PDF using `@react-pdf/renderer` server-side; respond with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="receipt-<id>.pdf"`

**PDF content:** Logo, "Payment Receipt", date, amount (KES), credits purchased, M-Pesa transaction ID, user email.

**UI**
- In the existing credits/purchase history table: add "Download Receipt" icon button per completed purchase row

---

### 2d. Expiring Content Access

**Goal:** Admins can set a duration on unlock fees so that unlocked content expires after N days.

**DB changes**
```
ALTER TABLE unlockFee ADD COLUMN accessDurationDays integer nullable;
  -- null = permanent (current behavior)

ALTER TABLE contentUnlock ADD COLUMN expiresAt timestamptz nullable;
  -- null = permanent
```

**Logic changes (`lib/actions/credits.ts`)**
- `unlockContentWithCredits`: if `unlockFee.accessDurationDays` is set, compute `expiresAt = now() + interval`; insert into `contentUnlock` with `expiresAt`
- `checkContentAccess`: existing query already filters `expiresAt` via `checkUserPermission` — verify `content/access` route also checks expiry

**API/UI changes**
- Unlock fee create/edit form: add "Access duration (days)" field; blank = permanent
- Resource viewer: if `expiresAt` is set, show "Access expires on <date>" badge
- Cron job (`/api/cron/expire-access`): soft-delete or flag expired `contentUnlock` rows (optional — can rely on query-time check instead)

**Files to modify**
- `lib/db/schema.ts` — add columns
- `lib/actions/credits.ts` — propagate duration on unlock
- `app/api/admin/unlock-fees/route.ts` — accept `accessDurationDays` in body
- `components/forms/unlock-fee-form.tsx` (or equivalent) — duration field
- `components/resources/resource-viewer.tsx` — expiry badge

---

### Phase 2 — Implementation Order
1. Schema migration: `promoCode`, `promoCodeRedemption`, `referral` tables + `unlockFee`/`contentUnlock` columns
2. Promo code actions + API + super-admin UI
3. Referral actions + webhook integration + regular dashboard UI
4. Receipt PDF generator + API route + download button
5. Expiring access logic + form field + viewer badge

---

## Phase 3 — Notifications & Announcements

### 3a. In-App Notification Center (Polling)

**Goal:** Users see a bell icon with unread count; dropdown lists recent notifications.

**DB changes**
```
notification table:
  id uuid PK
  userId uuid FK → user.id ON DELETE CASCADE
  type varchar(64) NOT NULL   -- e.g. "new_content", "announcement", "referral_credited"
  title varchar(256) NOT NULL
  body text
  link varchar(512) nullable  -- optional deep link
  isRead boolean DEFAULT false
  createdAt timestamptz DEFAULT now()

  INDEX: (userId, isRead, createdAt DESC)
  INDEX: userId
```

**Actions (`lib/actions/notifications.ts` — new file)**
- `createNotification(userId, { type, title, body?, link? })` — insert
- `getUserNotifications(userId, limit = 20)` — fetch recent, order by `createdAt DESC`
- `markNotificationRead(userId, notificationId)` — update; ownership enforced
- `markAllRead(userId)` — bulk update
- `getUnreadCount(userId)` → number

**API Routes**
- `GET /api/notifications` — returns `{ notifications, unreadCount }`; rate-limit 60/min
- `POST /api/notifications/read` — body `{ id? }` (omit = mark all); rate-limit 30/min

**Polling**
- Client polls `GET /api/notifications` every 30 seconds via `setInterval` in a global `NotificationProvider` (`components/providers/notification-provider.tsx`)
- Provider wraps layout, exposes context: `{ notifications, unreadCount, markRead, markAllRead, refresh }`

**UI**
- `components/shared/notification-bell.tsx` — bell icon button with red badge showing unread count; click opens `Popover` with notification list
- Each notification: title, body (truncated), relative time (`date-fns/formatDistanceToNow`), read/unread styling, link if present
- "Mark all as read" button in popover header
- Add bell to main nav for regular users (and admins)

**Trigger points for notifications**
- New content published in a level the user has unlocked → `new_content` notification (batch: cron or on-publish hook)
- Referral credit awarded → `referral_credited`
- Announcement broadcast → `announcement`

---

### 3b. Email Digests

**Goal:** Weekly email to each regular user summarizing new resources added that week.

**Approach:** Cron job (Vercel cron or manual trigger) calls existing `lib/email.ts` (Resend).

**New cron route:** `app/api/cron/weekly-digest/route.ts`
- Vercel cron: `{"path":"/api/cron/weekly-digest","schedule":"0 8 * * 1"}` in `vercel.json`
- Auth: check `Authorization: Bearer <CRON_SECRET>` header
- Fetches resources added in past 7 days
- Fetches all active `regular` users with email
- Sends one email per user via `resend.emails.send()` with HTML template listing new resources grouped by subject

**DB query needed**
- Resources added in last 7 days: `WHERE resource.createdAt > now() - interval '7 days'` joined with topic/subject/level
- User emails: existing `user` table has email column (verify)

**Opt-out (simple):** Add `emailDigestOptOut boolean DEFAULT false` to `user` table; users can toggle in account settings.

**Files**
- `app/api/cron/weekly-digest/route.ts` — new
- `lib/email.ts` — add `sendWeeklyDigest(to, resources[])` helper
- `vercel.json` — add cron schedule
- Account settings UI (if exists) — opt-out toggle

---

### 3c. Announcement System

**Goal:** Super-admin creates a banner announcement shown to all users (or specific role); users dismiss it.

**DB changes**
```
announcement table:
  id uuid PK
  title varchar(256) NOT NULL
  body text
  targetRole varchar(32) nullable  -- null = all, or 'regular', 'admin'
  isActive boolean DEFAULT true
  startsAt timestamptz DEFAULT now()
  endsAt timestamptz nullable       -- null = no expiry
  createdBy uuid FK → user.id
  createdAt timestamptz

announcementDismissal table:
  id uuid PK
  announcementId uuid FK → announcement.id ON DELETE CASCADE
  userId uuid FK → user.id ON DELETE CASCADE
  dismissedAt timestamptz DEFAULT now()
  UNIQUE(announcementId, userId)
```

**Actions (`lib/actions/announcements.ts` — new file)**
- `getActiveAnnouncements(userId, role)` — active + not dismissed + matching targetRole + within date range
- `dismissAnnouncement(userId, announcementId)`
- `createAnnouncement(...)` — super-admin only
- `deactivateAnnouncement(id)`

**API**
- `GET /api/announcements` — returns active undismissed announcements for current user
- `POST /api/announcements/dismiss` — body `{ id }`
- `GET /api/admin/announcements` — super-admin list
- `POST /api/admin/announcements` — create
- `PATCH /api/admin/announcements/[id]` — deactivate

**UI**
- `components/shared/announcement-banner.tsx` — renders above main content; yellow/blue alert bar with title + body + dismiss X; stacks if multiple
- Fetched on layout render (or via `NotificationProvider`)
- Super-admin: `/super-admin/announcements` page — create form + table with active toggle

---

### Phase 3 — Implementation Order
1. Schema: `notification`, `announcement`, `announcementDismissal` tables + `user.emailDigestOptOut`
2. Notification actions + API + provider + bell UI
3. Announcement actions + API + banner UI + super-admin page
4. Email digest cron + Resend template + vercel.json
5. Wire notification creation to trigger points (referral, new content, announcements)

---

## Phase 4 — Analytics & Reports

### 4a. Per-Resource Analytics

**Goal:** Admins see view count, unique viewers, completion rate, and average time-to-complete per resource.

**Data sources (already exist)**
- `resourceView` table (from `recordResourceView`) — view count, unique viewers
- `resourceProgress` table — completion counts, `startedAt`/`completedAt` for time calc

**New action (`lib/actions/admin.ts` addition)**
```typescript
getResourceAnalytics(resourceId: string): Promise<{
  totalViews: number;
  uniqueViewers: number;
  completionCount: number;
  completionRate: number;  // completionCount / uniqueViewers * 100
  avgDaysToComplete: number | null;  // avg(completedAt - startedAt) WHERE both not null
}>
```

**API**
- `GET /api/admin/analytics/resource/[id]` — permission: `RESOURCES_READ`

**UI**
- Admin resource detail view: stats row showing the 4 metrics with icons
- Or: expandable "Analytics" section in resource card on admin dashboard

---

### 4b. Learner Progress Reports (Admin View)

**Goal:** Admins see a table of learners with their completion % for a given subject/topic.

**New action**
```typescript
getLearnerProgressReport(topicId: string): Promise<Array<{
  userId: string;
  email: string;
  completedCount: number;
  totalCount: number;
  completionPct: number;
  lastAccessedAt: Date | null;
}>>
```

**API**
- `GET /api/admin/reports/learner-progress?topicId=<uuid>` — permission: `USERS_READ`

**UI**
- New `/admin/reports` page (or section in analytics): topic selector dropdown → learner progress table with sortable columns; "Export CSV" button

---

### 4c. Revenue Dashboard

**Goal:** Super-admin sees M-Pesa revenue totals by day/week/month with a chart.

**Data source:** `creditPurchase` table (existing), filtered by `status = 'completed'`.

**New action (`lib/actions/super-admin.ts` addition)**
```typescript
getRevenueStats(period: 'day' | 'week' | 'month', count: number): Promise<Array<{
  periodLabel: string;
  totalKES: number;
  purchaseCount: number;
  uniqueBuyers: number;
}>>
```
Uses `date_trunc` SQL for grouping.

**API**
- `GET /api/admin/revenue?period=week&count=12` — super-admin only

**UI**
- Super-admin analytics page: "Revenue" section with period toggle (day/week/month) + bar chart (use `recharts` — already likely installed, check) + summary KPIs (total revenue, total purchases, avg order value)

---

### 4d. Exportable CSV Reports

**Goal:** Super-admin can download CSV exports for: user progress, transactions, audit logs.

**Approach:** Streaming CSV via `Response` with `Content-Type: text/csv`. No third-party lib needed — build CSV manually with `Array.join('\n')`.

**API Routes**
- `GET /api/admin/reports/export?type=progress` — all `resourceProgress` rows joined with user + resource
- `GET /api/admin/reports/export?type=transactions` — all `creditTransaction` rows joined with user
- `GET /api/admin/reports/export?type=audit` — last 10,000 `auditLog` rows joined with user

All return `Content-Disposition: attachment; filename="<type>-<date>.csv"`. Auth: super-admin role or `CREDITS_MANAGE` permission.

**UI**
- Super-admin analytics page: "Export Reports" card with 3 download buttons

---

### 4e. Cohort Analysis

**Goal:** Group learners by signup month; show completion rates per cohort.

**New action**
```typescript
getCohortAnalysis(): Promise<Array<{
  cohort: string;   // e.g. "2026-01"
  userCount: number;
  usersWithProgress: number;
  avgCompletionPct: number;
}>>
```
Uses `date_trunc('month', user.createdAt)` to group, LEFT JOINs with `resourceProgress`.

**API**
- `GET /api/admin/analytics/cohorts` — super-admin only

**UI**
- Super-admin analytics page: "Cohort Analysis" table

---

### Phase 4 — Implementation Order
1. Per-resource analytics action + API + admin UI widget
2. Learner progress report action + API + `/admin/reports` page
3. Revenue dashboard action + API + charts in super-admin analytics
4. CSV export routes + download buttons
5. Cohort analysis action + API + table UI

---

## Phase 5 (Other) — Content Share Links

**Goal:** Public preview of a resource without login required.

**Approach:** Generate a signed or opaque share token stored in DB; shareable URL `/share/<token>`.

**DB changes**
```
resourceShareLink table:
  id uuid PK
  token varchar(64) UNIQUE NOT NULL  -- crypto.randomBytes(32).toString('hex')
  resourceId uuid FK → resource.id ON DELETE CASCADE
  createdBy uuid FK → user.id
  expiresAt timestamptz nullable
  viewCount integer DEFAULT 0
  isActive boolean DEFAULT true
  createdAt
```

**Actions**
- `createShareLink(userId, resourceId, expiresInDays?)` → token
- `getShareLinkResource(token)` — validates active/not expired; increments viewCount; returns resource

**API**
- `POST /api/resources/share` — creates link, returns URL
- `GET /api/share/[token]` — public (no auth); returns resource metadata for preview

**Page**
- `app/share/[token]/page.tsx` — public page; fetches resource via token; renders read-only `ResourceViewer` with `showLearnerActions={false}`; shows "Sign up to unlock full access" CTA for paywalled content

**UI**
- Resource viewer header: "Share" icon button → copies share link to clipboard; shows expiry option (7 days / 30 days / never) in a small popover before copying

---

## Files Summary

### Phase 2
| File | Action |
|------|--------|
| `lib/db/schema.ts` | Add `promoCode`, `promoCodeRedemption`, `referral`; add columns to `unlockFee`, `contentUnlock` |
| `lib/actions/credits.ts` | Add promo + referral + receipt helpers |
| `app/api/credits/redeem-promo/route.ts` | New |
| `app/api/payments/receipt/[purchaseId]/route.ts` | New |
| `app/api/admin/promo-codes/route.ts` | New |
| `app/api/admin/promo-codes/[id]/route.ts` | New |
| `app/api/webhooks/clerk/route.ts` | Handle referral on user.created |
| `app/api/payments/callback/route.ts` | Award referral credits on first purchase |
| `components/regular/regular-dashboard-client.tsx` | Referral link card, redeem promo input |
| `app/(super-admin)/super-admin/promo-codes/page.tsx` | New |

### Phase 3
| File | Action |
|------|--------|
| `lib/db/schema.ts` | Add `notification`, `announcement`, `announcementDismissal`; add `emailDigestOptOut` to `user` |
| `lib/actions/notifications.ts` | New |
| `lib/actions/announcements.ts` | New |
| `app/api/notifications/route.ts` | New |
| `app/api/notifications/read/route.ts` | New |
| `app/api/announcements/route.ts` | New |
| `app/api/announcements/dismiss/route.ts` | New |
| `app/api/admin/announcements/route.ts` | New |
| `app/api/cron/weekly-digest/route.ts` | New |
| `lib/email.ts` | Add digest template |
| `vercel.json` | Add cron schedule |
| `components/providers/notification-provider.tsx` | New |
| `components/shared/notification-bell.tsx` | New |
| `components/shared/announcement-banner.tsx` | New |
| `app/(super-admin)/super-admin/announcements/page.tsx` | New |

### Phase 4
| File | Action |
|------|--------|
| `lib/actions/admin.ts` | Add `getResourceAnalytics`, `getLearnerProgressReport`, `getRevenueStats`, `getCohortAnalysis` |
| `app/api/admin/analytics/resource/[id]/route.ts` | New |
| `app/api/admin/reports/learner-progress/route.ts` | New |
| `app/api/admin/revenue/route.ts` | New |
| `app/api/admin/reports/export/route.ts` | New |
| `app/api/admin/analytics/cohorts/route.ts` | New |
| `app/(admin)/admin/reports/page.tsx` | New |
| `app/(super-admin)/super-admin/analytics/page.tsx` | Extend with revenue + cohorts |

### Phase 5
| File | Action |
|------|--------|
| `lib/db/schema.ts` | Add `resourceShareLink` |
| `lib/actions/sharing.ts` | New |
| `app/api/resources/share/route.ts` | New |
| `app/api/share/[token]/route.ts` | New |
| `app/share/[token]/page.tsx` | New public page |
| `components/resources/resource-viewer.tsx` | Share button |

---

## Dependencies to Install

| Package | Phase | Purpose |
|---------|-------|---------|
| `@react-pdf/renderer` | 2c | PDF receipt generation |
| `date-fns` | 3a | Relative timestamps in notifications |
| `recharts` | 4c | Revenue bar chart (may already exist) |

---

## Recommended Implementation Order

**Phase 2** → **Phase 3** → **Phase 4** → **Phase 5**

Within each phase, always: schema first → actions → API routes → UI.

Each phase produces a new Drizzle migration. Run `pnpm db:generate && pnpm db:migrate` between phases.
