"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { AppShell } from "@/components/app-shell"
import { TicketsOverview } from "@/components/tickets-overview"

export default function TicketsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
    }
  }, [loading, router, user])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <AppShell
      title="Tickets"
      description="Track issues across all projects and quickly find what is open, done, or fully verified."
    >
      <TicketsOverview />
    </AppShell>
  )
}
