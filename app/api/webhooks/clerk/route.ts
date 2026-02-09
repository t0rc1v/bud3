import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { getOrCreateUser, deleteUser, updateUserRole, getUserByClerkId } from '@/lib/actions/auth'
import type { UserRole } from '@/lib/types'

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occurred', {
      status: 400,
    })
  }

  // Do something with the payload
  const { id } = evt.data
  const eventType = evt.type

  console.log(`Webhook with and ID of ${id} and type of ${eventType}`)
  console.log('Webhook body:', body)

  // Handle user creation
  if (eventType === 'user.created') {
    const { id, email_addresses, primary_email_address_id, public_metadata } = evt.data as unknown as {
      id: string;
      email_addresses: { id: string; email_address: string }[];
      primary_email_address_id: string;
      public_metadata?: { role?: string };
    }
    
    // Get the primary email address
    const primaryEmail = email_addresses?.find(
      email => email.id === primary_email_address_id
    )?.email_address

    if (!primaryEmail) {
      console.error('No email address found for user:', id)
      return new Response('No email address found', { status: 400 })
    }

    // Check for role in metadata (for manually created admins/super admins)
    const metadataRole = public_metadata?.role as UserRole | undefined
    const role: UserRole = metadataRole || 'learner'

    try {
      const { user, isNew } = await getOrCreateUser(id, primaryEmail, role)
      console.log(`User ${isNew ? 'created' : 'already exists'} with role ${user.role}:`, user.id)
    } catch (error) {
      console.error('Error creating user:', error)
      return new Response('Error creating user', { status: 500 })
    }
  }

  // Handle user updates (for role changes via metadata)
  if (eventType === 'user.updated') {
    const { id, public_metadata } = evt.data as unknown as {
      id: string;
      public_metadata?: { role?: string };
    }
    
    // Check if role is specified in metadata
    const metadataRole = public_metadata?.role as UserRole | undefined
    
    if (metadataRole) {
      try {
        // Check if user exists in database
        const existingUser = await getUserByClerkId(id)
        
        if (existingUser) {
          // Update user role
          const updatedUser = await updateUserRole(id, metadataRole)
          console.log(`User ${id} role updated to ${updatedUser.role} via metadata`)
        } else {
          // User doesn't exist in DB yet, they will be created when webhook receives user.created
          console.log(`User ${id} not found in database, role update will apply on next sync`)
        }
      } catch (error) {
        console.error('Error updating user role from metadata:', error)
        // Don't return error response here - we don't want to break the webhook
      }
    }
  }

  // Handle user deletion
  if (eventType === 'user.deleted') {
    const { id } = evt.data
    
    if (!id) {
      return new Response('No user ID provided', { status: 400 })
    }

    try {
      await deleteUser(id)
      console.log('User deleted:', id)
    } catch (error) {
      console.error('Error deleting user:', error)
      return new Response('Error deleting user', { status: 500 })
    }
  }

  return new Response('', { status: 200 })
}
