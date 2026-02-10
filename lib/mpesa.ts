// M-Pesa Daraja API Integration
// Note: crypto imports removed as they're not currently used but reserved for future signature verification

// M-Pesa Daraja API Configuration
const MPESA_CONFIG = {
  environment: process.env.MPESA_ENVIRONMENT || 'sandbox', // 'sandbox' or 'production'
  sandbox: {
    baseUrl: 'https://sandbox.safaricom.co.ke',
    shortcode: process.env.MPESA_SANDBOX_SHORTCODE || '174379',
    passkey: process.env.MPESA_SANDBOX_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    consumerKey: process.env.MPESA_SANDBOX_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_SANDBOX_CONSUMER_SECRET || '',
  },
  production: {
    baseUrl: 'https://api.safaricom.co.ke',
    shortcode: process.env.MPESA_PRODUCTION_SHORTCODE || '',
    passkey: process.env.MPESA_PRODUCTION_PASSKEY || '',
    consumerKey: process.env.MPESA_PRODUCTION_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_PRODUCTION_CONSUMER_SECRET || '',
  },
};

// Credit pricing configuration
export const CREDIT_PRICING = {
  // 50 credits = Ksh 100
  creditsPerUnit: 50,
  kesPerUnit: 100,
  minimumPurchaseKes: 100,
  
  // Calculate credits from KES amount
  calculateCredits: (kesAmount: number): number => {
    return Math.floor((kesAmount / CREDIT_PRICING.kesPerUnit) * CREDIT_PRICING.creditsPerUnit);
  },
  
  // Calculate KES from credits
  calculateKes: (credits: number): number => {
    return Math.ceil((credits / CREDIT_PRICING.creditsPerUnit) * CREDIT_PRICING.kesPerUnit);
  },
  
  // Validate minimum purchase
  isValidAmount: (kesAmount: number): boolean => {
    return kesAmount >= CREDIT_PRICING.minimumPurchaseKes;
  },
};

// Get current environment config
function getConfig() {
  const env = MPESA_CONFIG.environment as 'sandbox' | 'production';
  return MPESA_CONFIG[env];
}

// Generate OAuth token
export async function generateAuthToken(): Promise<string> {
  const config = getConfig();
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
  
  const response = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to generate auth token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

// Generate password for STK push
function generatePassword(shortcode: string, passkey: string, timestamp: string): string {
  const str = shortcode + passkey + timestamp;
  return Buffer.from(str).toString('base64');
}

// Generate timestamp in the format YYYYMMDDHHmmss
function generateTimestamp(): string {
  const now = new Date();
  return now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
}

// Format phone number to 2547XXXXXXXX format
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove leading 0 if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Add 254 prefix if not present
  if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }
  
  return cleaned;
}

// Validate phone number
export function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  // Check if it matches Kenyan phone number format (2547XXXXXXXX or 2541XXXXXXXX)
  return /^254[71]\d{8}$/.test(formatted);
}

// Initiate STK Push (M-Pesa Express)
export interface STKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl: string;
}

export interface STKPushResponse {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  responseCode?: string;
  responseDescription?: string;
  error?: string;
}

export async function initiateSTKPush(
  request: STKPushRequest
): Promise<STKPushResponse> {
  try {
    const token = await generateAuthToken();
    const config = getConfig();
    const timestamp = generateTimestamp();
    const password = generatePassword(config.shortcode, config.passkey, timestamp);
    const formattedPhone = formatPhoneNumber(request.phoneNumber);
    
    const payload = {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: MPESA_CONFIG.environment === 'production' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
      Amount: Math.ceil(request.amount), // M-Pesa expects whole numbers
      PartyA: formattedPhone,
      PartyB: config.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: request.callbackUrl,
      AccountReference: request.accountReference.substring(0, 12), // Max 12 chars
      TransactionDesc: request.transactionDesc.substring(0, 13), // Max 13 chars
    };
    
    console.log('STK Push Request:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    console.log('STK Push Response:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.ResponseCode === '0') {
      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
      };
    } else {
      return {
        success: false,
        error: data.errorMessage || data.errorMessage || data.ResponseDescription || 'Failed to initiate STK push',
        responseCode: data.ResponseCode || data.errorCode,
      };
    }
  } catch (error) {
    console.error('STK Push Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Query STK Push transaction status
export interface STKQueryRequest {
  checkoutRequestId: string;
}

export interface STKQueryResponse {
  success: boolean;
  resultCode?: string;
  resultDesc?: string;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  amount?: number;
  error?: string;
}

export async function querySTKPush(
  request: STKQueryRequest
): Promise<STKQueryResponse> {
  try {
    const token = await generateAuthToken();
    const config = getConfig();
    const timestamp = generateTimestamp();
    const password = generatePassword(config.shortcode, config.passkey, timestamp);
    
    const payload = {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: request.checkoutRequestId,
    };
    
    const response = await fetch(`${config.baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    interface CallbackItem {
      Name: string;
      Value: string | number;
    }
    
    if (response.ok) {
      // Log the response for debugging
      console.log('STK Query Response:', JSON.stringify(data, null, 2));
      
      return {
        success: data.ResultCode === '0',
        resultCode: String(data.ResultCode),
        resultDesc: data.ResultDesc,
        mpesaReceiptNumber: data.CallbackMetadata?.Item?.find((item: CallbackItem) => item.Name === 'MpesaReceiptNumber')?.Value as string | undefined,
        transactionDate: data.CallbackMetadata?.Item?.find((item: CallbackItem) => item.Name === 'TransactionDate')?.Value as string | undefined,
        amount: data.CallbackMetadata?.Item?.find((item: CallbackItem) => item.Name === 'Amount')?.Value as number | undefined,
      };
    } else {
      console.log('STK Query Error Response:', JSON.stringify(data, null, 2));
      return {
        success: false,
        error: data.errorMessage || data.ResultDesc || 'Failed to query transaction',
        resultCode: data.ResultCode || data.errorCode,
      };
    }
  } catch (error) {
    console.error('STK Query Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Parse M-Pesa callback data
export interface CallbackData {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

export function parseCallbackData(callbackBody: CallbackData) {
  const { stkCallback } = callbackBody.Body;
  
  const metadata: Record<string, string | number> = {};
  if (stkCallback.CallbackMetadata?.Item) {
    for (const item of stkCallback.CallbackMetadata.Item) {
      metadata[item.Name] = item.Value;
    }
  }
  
  return {
    merchantRequestId: stkCallback.MerchantRequestID,
    checkoutRequestId: stkCallback.CheckoutRequestID,
    resultCode: stkCallback.ResultCode,
    resultDesc: stkCallback.ResultDesc,
    isSuccessful: stkCallback.ResultCode === 0,
    mpesaReceiptNumber: metadata.MpesaReceiptNumber as string | undefined,
    transactionDate: metadata.TransactionDate as string | undefined,
    amount: metadata.Amount as number | undefined,
    phoneNumber: metadata.PhoneNumber as string | undefined,
  };
}

// Credit configuration defaults
export const DEFAULT_CREDIT_CONFIG = {
  // 1 credit = 1 AI response (customizable)
  creditsPerAIResponse: 1,
  
  // Default unlock fee
  defaultUnlockFeeKes: 100,
  defaultUnlockCredits: 50,
  
  // Minimum purchase amount
  minimumPurchaseKes: 100,
  
  // Credit packages (optional presets)
  creditPackages: [
    { name: 'Basic', credits: 50, kes: 100 },
    { name: 'Standard', credits: 150, kes: 300 },
    { name: 'Premium', credits: 500, kes: 1000 },
    { name: 'Ultimate', credits: 1000, kes: 2000 },
  ],
};

// Export all functions as a service object
export const MpesaService = {
  initiateSTKPush,
  querySTKPush,
  parseCallbackData,
  formatPhoneNumber,
  isValidPhoneNumber,
  generateAuthToken,
  CREDIT_PRICING,
  DEFAULT_CREDIT_CONFIG,
};
