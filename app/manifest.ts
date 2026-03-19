import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BudLM - AI Learning Platform',
    short_name: 'BudLM',
    description: 'AI-powered educational platform for modern learning',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#c2410c',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
