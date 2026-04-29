"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { CommandSearch } from "@/components/command-search"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/features", label: "Features" },
  { href: "/tickets", label: "Tickets" },
  { href: "/vault", label: "Knowledge Vault" },
  { href: "/ideas", label: "Ideas" },
] as const

export function AppShell({
  children,
  title,
  description,
}: {
  children: ReactNode
  title: string
  description?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  async function handleLogout() {
    if (!auth) return
    await signOut(auth)
    router.replace("/login")
  }

  async function handleCreateShareLink() {
    if (!user) return
    const uid = user.uid
    const [logsSnap, vaultSnap, ideasSnap] = await Promise.all([
      getDocs(
        query(
          collection(db!, "users", uid, "dailyLogs"),
          orderBy("createdAt", "desc"),
        ),
      ),
      getDocs(
        query(
          collection(db!, "users", uid, "vaultEntries"),
          orderBy("createdAt", "desc"),
        ),
      ),
      getDocs(
        query(
          collection(db!, "users", uid, "ideas"),
          orderBy("createdAt", "desc"),
        ),
      ),
    ])
    const payload = {
      dailyLogs: logsSnap.docs.slice(0, 20).map((d) => ({ id: d.id, ...d.data() })),
      vaultEntries: vaultSnap.docs.slice(0, 30).map((d) => ({ id: d.id, ...d.data() })),
      ideas: ideasSnap.docs.slice(0, 30).map((d) => ({ id: d.id, ...d.data() })),
    }
    const token = crypto.randomUUID()
    await setDoc(doc(db!, "shareLinks", token), {
      userId: uid,
      scope: "portfolio",
      createdAt: new Date().toISOString(),
      payload,
    })
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/share/${token}`
        : `/share/${token}`
    await navigator.clipboard.writeText(url)
  }

  return (
    <div className="workspace-shell min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className={`${sidebarCollapsed ? "w-20" : "w-72"} shrink-0 border-r border-border/80 bg-card/85 backdrop-blur-sm transition-all`}>
          <div className="px-4 py-5 flex items-start justify-between gap-3">
            <div className={sidebarCollapsed ? "hidden" : "block"}>
              <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
                Learning Portfolio
              </p>
              <p className="mt-2 text-sm text-foreground">
                Product work, reviews, and tracked issues in one place.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0 shrink-0"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
          <nav className="px-3 pb-4 flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-sm ${sidebarCollapsed ? "px-2 py-3 text-center" : "px-3 py-2.5 text-sm"} transition-colors ${
                    isActive
                      ? "bg-secondary text-foreground font-medium border border-border shadow-[0_1px_0_rgba(44,44,44,0.03)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/70 border border-transparent"
                  }`}
                  title={item.label}
                >
                  {sidebarCollapsed ? item.label.charAt(0) : item.label}
                </Link>
              )
            })}
          </nav>
          <div className={sidebarCollapsed ? "px-3 pb-4" : "px-5 pb-4"}>
            {!sidebarCollapsed && <p className="workspace-section-label mb-2">Quick create</p>}
            <div className="flex flex-col gap-2">
              <Link href="/features?new=1">
                <Button variant="outline" size="sm" className={`w-full ${sidebarCollapsed ? "justify-center px-0" : "justify-start"} text-xs`}>
                  {sidebarCollapsed ? "+" : "New feature"}
                </Button>
              </Link>
              <Link href="/tickets?new=1">
                <Button variant="outline" size="sm" className={`w-full ${sidebarCollapsed ? "justify-center px-0" : "justify-start"} text-xs`}>
                  {sidebarCollapsed ? "+" : "New ticket"}
                </Button>
              </Link>
            </div>
          </div>
          <div className={`${sidebarCollapsed ? "px-3" : "px-5"} py-4 border-t border-border/70`}>
            <p className="text-[11px] text-muted-foreground">
              {sidebarCollapsed ? "Cmd/Ctrl + K" : "Use `Ctrl/Cmd + K` to jump to saved ideas or vault notes."}
            </p>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="bg-card/80 backdrop-blur-sm border-b border-border">
            <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="workspace-section-label">{title}</p>
                {description && (
                  <p className="text-sm text-foreground mt-1 max-w-2xl">
                    {description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs text-muted-foreground max-w-[160px] truncate"
                  title={user?.email ?? undefined}
                >
                  {user?.email}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={handleCreateShareLink}
                  disabled={!user || !db}
                >
                  Share link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={handleLogout}
                >
                  Log out
                </Button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-6 py-8">
            {children}
          </main>
        </div>
      </div>

      <CommandSearch />
    </div>
  )
}
