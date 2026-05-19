'use client'

import { ThemeProvider } from 'next-themes'
import { ToastProvider } from '@/lib/toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  )
}
