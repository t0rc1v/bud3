# M-Pesa Integration Documentation

## Overview
This project integrates M-Pesa Daraja API for purchasing AI credits. Users can buy credits using M-Pesa STK Push to unlock content and get AI responses.

## Pricing Structure

### Credit Purchase
- **Rate**: 50 credits = Ksh 100
- **Minimum Purchase**: Ksh 100
- **Credit Packages**:
  - Basic: 50 credits for Ksh 100
  - Standard: 150 credits for Ksh 300
  - Premium: 500 credits for Ksh 1,000 (5% bonus)
  - Ultimate: 1,000 credits for Ksh 2,000 (10% bonus)

### Credit Usage
- **AI Response**: 1 credit per response (customizable in `DEFAULT_CREDIT_CONFIG`)
- **Content Unlock**: 50 credits (default) or custom amount set per resource/topic/subject

### Unlock Fees
- **Default Fee**: Ksh 100 / 50 credits
- **Customizable**: Can be set differently for resources, topics, or subjects
- **One-time fee**: Users only pay once to unlock content permanently

## Environment Variables

Create a `.env` file with the following variables:

### M-Pesa Configuration

```env
# M-Pesa Environment (sandbox or production)
MPESA_ENVIRONMENT=sandbox

# Sandbox Credentials (for testing)
MPESA_SANDBOX_SHORTCODE=174379
MPESA_SANDBOX_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_SANDBOX_CONSUMER_KEY=your_sandbox_consumer_key
MPESA_SANDBOX_CONSUMER_SECRET=your_sandbox_consumer_secret

# Production Credentials (for live transactions)
MPESA_PRODUCTION_SHORTCODE=your_paybill_number
MPESA_PRODUCTION_PASSKEY=your_production_passkey
MPESA_PRODUCTION_CONSUMER_KEY=your_production_consumer_key
MPESA_PRODUCTION_CONSUMER_SECRET=your_production_consumer_secret
```

### Application Configuration

```env
# App URL (required for callback URL)
NEXT_PUBLIC_APP_URL=https://your-domain.com
# For local development:
# NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.app
```

## Setup Instructions

### 1. Get M-Pesa Daraja API Credentials

1. Register at [Daraja Developer Portal](https://developer.safaricom.co.ke/)
2. Create a new app (choose "MPesa Sandbox" for testing)
3. Get your Consumer Key and Consumer Secret
4. For production, go through the Go Live process

### 2. Configure Callback URL

For local development, use ngrok to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Expose your local development server
ngrok http 3000

# Copy the HTTPS URL and set it in your .env
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.app
```

### 3. Database Migration

The credit system tables have been added to the database schema. Run:

```bash
npm run db:generate
npm run db:migrate
```

### 4. Test the Integration

1. Navigate to the learner dashboard
2. Click on the credit badge or "Buy Credits" button
3. Enter a test phone number (e.g., 0712345678 for sandbox)
4. Complete the payment flow

## Admin Features

### Credit Gifting
Admins with `finance:credits:gift` permission can gift credits to users:
1. Go to Admin → Manage Credits
2. Enter the user's email
3. Specify the amount and reason
4. Submit to gift credits instantly

### Managing Unlock Fees
Admins can set custom unlock fees for specific:
- Resources (e.g., premium PDF notes)
- Topics (e.g., exam preparation guides)
- Subjects (e.g., specialized courses)

## API Endpoints

### Public Endpoints

- `POST /api/payments/initiate` - Initiate M-Pesa payment
- `POST /api/payments/callback` - M-Pesa callback handler
- `POST /api/payments/query` - Query payment status
- `GET /api/credits/balance` - Get user's credit balance and history

### Admin Endpoints

- `POST /api/admin/credits/gift` - Gift credits to users (requires `finance:credits:gift` permission)

## Components

### CreditModal
Main component for credit management:
- Shows current balance
- Purchase credits with M-Pesa
- View transaction history

Usage:
```tsx
import { CreditModal, CreditBadge } from "@/components/credits/credit-modal";

// Modal with trigger
<CreditModal />

// Balance badge for header
<CreditBadge />
```

## Security Considerations

1. **Never commit `.env` files** to version control
2. **Use HTTPS** in production for callback URLs
3. **Validate phone numbers** before initiating payments
4. **Check permissions** before allowing credit operations
5. **Log all transactions** for audit purposes
6. **Use rate limiting** on payment endpoints

## Testing in Sandbox

Use these test credentials:
- **Phone Number**: 0712345678 (or any valid format)
- **PIN**: Any 4-digit PIN
- **Amount**: Any amount (minimum Ksh 100)

## Production Deployment Checklist

- [ ] Switch MPESA_ENVIRONMENT to "production"
- [ ] Update all production M-Pesa credentials
- [ ] Set NEXT_PUBLIC_APP_URL to production domain
- [ ] Enable HTTPS
- [ ] Configure CORS if needed
- [ ] Set up monitoring and logging
- [ ] Test complete payment flow
- [ ] Verify callback URL is publicly accessible
- [ ] Configure error alerting

## Troubleshooting

### Common Issues

1. **"Failed to generate auth token"**
   - Check Consumer Key and Consumer Secret
   - Verify network connectivity

2. **"Callback not received"**
   - Ensure callback URL is publicly accessible
   - Check server logs for incoming requests
   - Verify HTTPS is used in production

3. **"Insufficient credits"**
   - User needs to purchase credits first
   - Check credit balance in database

4. **"Payment not completing"**
   - Check M-Pesa result codes
   - Verify phone number format (2547XXXXXXXX)
   - Ensure STK push is not blocked by user

## Support

For M-Pesa API support:
- Daraja Developer Portal: https://developer.safaricom.co.ke/
- Documentation: https://developer.safaricom.co.ke/docs

For application support:
- Check server logs
- Review transaction history in database
- Verify environment variables
