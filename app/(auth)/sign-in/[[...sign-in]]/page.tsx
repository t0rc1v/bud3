import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <SignIn
        forceRedirectUrl="/api/auth/callback"
        fallbackRedirectUrl="/api/auth/callback"
      />
    </div>
  )
}