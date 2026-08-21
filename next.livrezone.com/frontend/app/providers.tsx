'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { CommerceProvider } from '@/lib/commerce-store'
import { ToastProvider } from '@/components/Toast'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CommerceProvider>{children}</CommerceProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
