# Content Unlocking & Rewards System

## Overview
This system implements a complete content locking and unlocking mechanism where all resources are locked by default. Users must pay credits to unlock content. Admins with the `credit_reward` permission can gift credits and manually unlock content for users.

## Key Features

### 1. Content Locking
- **All resources are locked by default**
- **One-time unlock fee**: 50 credits (Ksh 100) per resource
- **Permanent access**: Once unlocked, user has forever access
- **Hierarchical locking**: Can be set at resource, topic, or subject level

### 2. Credit System
- **AI Responses**: 1 credit per response
- **Content Unlock**: 50 credits per resource
- **Purchase via M-Pesa**: 50 credits = Ksh 100 (minimum)
- **Gifting**: Admins can gift credits to any user

### 3. Admin Rewards Management
- **Gift Credits**: Give credits to users by email
- **Unlock Content**: Manually unlock resources for specific users
- **Permission-based**: Only users with `credit_reward` permission can access

## Permission System

### New Permissions Added
1. `credit_reward` - Allows gifting credits and unlocking content
2. `content_unlock` - Allows manual content unlocking

### Access Levels
- **Super Admin**: Has all permissions automatically
- **Admin with credit_reward**: Can access rewards panel
- **Admin without credit_reward**: Cannot access rewards panel
- **Learner**: Can purchase and unlock content

## API Endpoints

### Admin Endpoints
```
POST /api/admin/credits/gift
  - Gift credits to user by email
  - Body: { email: string, amount: number, reason: string }

POST /api/admin/content/unlock
  - Manually unlock content for user
  - Body: { userEmail: string, resourceId?: string, topicId?: string, subjectId?: string }

POST /api/admin/init-unlock-fees
  - Initialize unlock fees for all existing resources
  - Requires admin/super_admin role

GET /api/admin/users/search?email=
  - Search user by email

GET /api/admin/resources/[id]
  - Get resource details with unlock fee
```

### Learner Endpoints
```
GET /api/learner/grades-with-unlock-status
  - Get all content with unlock status for current user

POST /api/content/unlock
  - Unlock a resource (deducts credits)
  - Body: { resourceId: string }

GET /api/content/hierarchy
  - Get full content hierarchy (for admin selection)
```

### Credit Endpoints
```
GET /api/credits/balance
  - Get current user's credit balance and history

POST /api/payments/initiate
  - Initiate M-Pesa payment
  - Body: { phoneNumber: string, amount: number }

POST /api/payments/callback
  - M-Pesa callback webhook

POST /api/payments/query
  - Query payment status
  - Body: { checkoutRequestId: string }
```

## User Flows

### Learner Unlocking Content
1. Navigate to `/learner/dashboard`
2. Browse locked content (shown with lock icon)
3. Click unlock button (shows credit cost)
4. If sufficient credits: Content unlocks immediately
5. If insufficient credits: Prompted to buy credits
6. Unlocked content shows unlock icon and is available in AI chat

### Admin Gifting Credits
1. Navigate to `/admin/rewards`
2. Select "Gift Credits" tab
3. Enter user email
4. Enter credit amount
5. Enter reason
6. Submit - credits added immediately

### Admin Unlocking Content
1. Navigate to `/admin/rewards`
2. Select "Unlock Content" tab
3. Search for user by email
4. Browse content tree
5. Select resource to unlock
6. Submit - user gains immediate access

### Buying Credits
1. Click "Buy Credits" button in header or dashboard
2. Select amount or enter custom
3. Enter M-Pesa phone number
4. Receive STK push notification
5. Enter M-Pesa PIN
6. Payment confirmed, credits added

## UI Components

### CreditBadge
- Shows in header next to user button
- Displays current credit balance
- Clickable - opens CreditModal
- Auto-refreshes every 30 seconds

### CreditModal
- Balance tab: Shows credits and usage stats
- Purchase tab: Buy credits with M-Pesa
- History tab: View all transactions

### ContentLockCard (Admin)
- Shows locked/unlocked status
- Displays unlock fee
- Unlock button with credit check
- Insufficient credits warning

### RewardsManager (Admin)
- Tab 1: Gift Credits interface
- Tab 2: Unlock Content interface with tree view
- Shows user search and content selection

## Database Schema

### unlock_fee table
- `id`: UUID
- `type`: "resource" | "topic" | "subject"
- `resourceId`: Foreign key to resource
- `topicId`: Foreign key to topic
- `subjectId`: Foreign key to subject
- `feeAmount`: KES amount (default: 100)
- `creditsRequired`: Credits needed (default: 50)
- `isActive`: Boolean

### unlocked_content table
- `id`: UUID
- `userId`: Who unlocked it
- `unlockFeeId`: Which fee was paid
- `creditsUsed`: How many credits were used
- `transactionId`: Reference to credit transaction
- `unlockedAt`: Timestamp

## Configuration

### Default Values
```typescript
DEFAULT_CREDIT_CONFIG = {
  creditsPerAIResponse: 1,
  defaultUnlockFeeKes: 100,
  defaultUnlockCredits: 50,
  minimumPurchaseKes: 100,
  creditsPerUnit: 50,
}
```

## Setup Instructions

### 1. Initialize Unlock Fees
For existing resources, run once:
```bash
curl -X POST https://your-domain.com/api/admin/init-unlock-fees
```

### 2. Assign Permissions
Give `credit_reward` permission to admins who should manage rewards:
- Go to Admin → Manage Admins
- Select admin user
- Assign `credit_reward` permission

### 3. Configure M-Pesa
Add to `.env`:
```env
MPESA_ENVIRONMENT=sandbox
MPESA_SANDBOX_SHORTCODE=174379
MPESA_SANDBOX_PASSKEY=your_passkey
MPESA_SANDBOX_CONSUMER_KEY=your_key
MPESA_SANDBOX_CONSUMER_SECRET=your_secret
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 4. Test Flow
1. Create a learner account
2. Verify all resources are locked on dashboard
3. Buy credits via M-Pesa (use test phone: 0712345678)
4. Unlock a resource
5. Verify it appears in AI chat

## Error Handling

### Common Errors
- **Insufficient Credits**: UI shows warning and buy credits link
- **Payment Failed**: Shows specific error (cancelled, wrong PIN, etc.)
- **Already Unlocked**: "Content already unlocked" message
- **Resource Not Found**: Check if resource exists in database

### Debug Logs
All payment and unlock actions are logged to console:
- Payment initiation
- Callback received
- Unlock status
- Credit transactions

## Security

### Permission Checks
- All admin endpoints verify `credit_reward` permission
- Unlock endpoints verify user owns the purchase
- Credit endpoints verify sufficient balance

### Rate Limiting
Consider adding rate limiting to:
- `/api/payments/initiate`
- `/api/content/unlock`
- `/api/admin/credits/gift`

## Future Enhancements

1. **Bulk Unlock**: Unlock multiple resources at once with discount
2. **Subscription Model**: Monthly subscription for unlimited access
3. **Promo Codes**: Discount codes for credits
4. **Analytics**: Track most unlocked content
5. **Refund System**: Allow refunds for accidental purchases

## Support

For issues:
1. Check browser console for error messages
2. Verify M-Pesa callback URL is accessible
3. Check database for unlock fees existing
4. Ensure user has proper permissions
5. Review transaction history in database
