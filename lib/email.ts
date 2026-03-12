import { Resend, CreateEmailOptions } from 'resend';

// Resend client — initialized lazily so missing env vars fail loudly at send time,
// not during build/import (where process.env may not be populated yet).
function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function getFromEmail(): string {
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL environment variable is not set");
  }
  return process.env.RESEND_FROM_EMAIL;
}

export interface EmailData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

/**
 * Send a generic email using Resend
 */
export async function sendEmail(data: EmailData) {
  try {
    const resend = getResendClient();
    const { to, subject, html, text, from = getFromEmail() } = data;

    const emailOptions: CreateEmailOptions = {
      from,
      to,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    } as CreateEmailOptions;

    const result = await resend.emails.send(emailOptions);

    if (result.error) {
      console.error('Resend email error:', result.error);
      throw new Error(`Failed to send email: ${result.error.message}`);
    }

    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

/**
 * Send notification when regular user is added by admin
 */
export async function sendRegularAddedEmail(params: {
  regularEmail: string;
  institutionName: string;
  adminEmail: string;
}) {
  const { regularEmail, institutionName, adminEmail } = params;
  
  const subject = `You've been added to ${institutionName}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Welcome to ${institutionName}!</h2>
      
      <p>You have been added as a regular user to <strong>${institutionName}</strong>.</p>
      
      <p>As a regular user, you can:</p>
      <ul>
        <li>Access resources shared by your institution</li>
        <li>Create and manage your own subjects, topics, and resources</li>
        <li>Use AI chat for learning assistance</li>
        <li>Track your progress</li>
      </ul>
      
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/regular" 
         style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; 
                text-decoration: none; border-radius: 6px; margin-top: 16px;">
        Access Your Dashboard
      </a>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="color: #6b7280; font-size: 14px;">
        If you have any questions, please contact your administrator at ${adminEmail}.
      </p>
    </div>
  `;
  
  return sendEmail({
    to: regularEmail,
    subject,
    html,
  });
}

/**
 * Send credit gift notification
 */
export async function sendCreditGiftEmail(params: {
  recipientEmail: string;
  amount: number;
  senderName: string;
  message?: string;
}) {
  const { recipientEmail, amount, senderName, message } = params;
  
  const subject = `You've received ${amount} AI credits!`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">You've Received AI Credits!</h2>
      
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin: 20px 0;">
        <p style="font-size: 48px; margin: 0; font-weight: bold;">${amount}</p>
        <p style="font-size: 18px; margin: 8px 0 0 0;">AI Credits</p>
      </div>
      
      <p><strong>${senderName}</strong> has gifted you ${amount} AI credits!</p>
      
      ${message ? `<p style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; font-style: italic;">"${message}"</p>` : ''}
      
      <p>You can use these credits to access AI-powered learning assistance, generate quizzes, and more.</p>
      
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/regular/chat" 
         style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; 
                text-decoration: none; border-radius: 6px; margin-top: 16px;">
        Start Using Your Credits
      </a>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="color: #6b7280; font-size: 14px;">
        Credits have been added to your account balance.
      </p>
    </div>
  `;
  
  return sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}

/**
 * Send credit expiration warning (credits expiring within N days)
 */
export async function sendCreditExpirationWarningEmail(params: {
  recipientEmail: string;
  creditsAmount: number;
  daysUntilExpiry: number;
  expiresAt: Date;
}) {
  const { recipientEmail, creditsAmount, daysUntilExpiry, expiresAt } = params;

  const subject = `Your ${creditsAmount} AI credits expire in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d97706;">Credits Expiring Soon</h2>

      <div style="background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color: white; padding: 24px; border-radius: 12px; text-align: center; margin: 20px 0;">
        <p style="font-size: 48px; margin: 0; font-weight: bold;">${creditsAmount}</p>
        <p style="font-size: 16px; margin: 8px 0 0 0;">AI Credits</p>
        <p style="font-size: 14px; margin: 8px 0 0 0; opacity: 0.9;">
          Expire on ${expiresAt.toLocaleDateString("en", { dateStyle: "long" })}
        </p>
      </div>

      <p>
        You have <strong>${creditsAmount} AI credits</strong> that will expire in
        <strong>${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}</strong>.
        Use them before they are gone!
      </p>

      <p>You can use credits to:</p>
      <ul>
        <li>Access AI-powered tutoring and learning assistance</li>
        <li>Generate quizzes and flashcards</li>
        <li>Get help with assignments and study materials</li>
      </ul>

      <a href="${process.env.NEXT_PUBLIC_APP_URL}/regular/chat"
         style="display: inline-block; background-color: #d97706; color: white; padding: 12px 24px;
                text-decoration: none; border-radius: 6px; margin-top: 16px;">
        Use Your Credits Now
      </a>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="color: #6b7280; font-size: 14px;">
        Credits expire ${daysUntilExpiry === 1 ? "tomorrow" : `in ${daysUntilExpiry} days`} on
        ${expiresAt.toLocaleDateString("en", { dateStyle: "long" })}.
      </p>
    </div>
  `;

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}

