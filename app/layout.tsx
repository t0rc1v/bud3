import { type Metadata, type Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter, Geist_Mono } from 'next/font/google'
import './globals.css'
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "@/app/api/uploadthing/core";
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ServiceWorkerRegister } from '@/components/shared/service-worker-register';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bud3',
  description: 'AI-powered educational platform',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
            <NextSSRPlugin
              routerConfig={extractRouterConfig(ourFileRouter)}
            />
            {children}
            <Toaster />
            <ServiceWorkerRegister />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}