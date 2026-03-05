"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Dashboard } from "@/components/dashboard"
import { KnowledgeVault } from "@/components/knowledge-vault"
import { ProjectDashboard } from "@/components/project-dashboard"
import { IdeasDashboard } from "@/components/ideas-dashboard"
import { CommandSearch } from "@/components/command-search"
import { useAuth } from "@/components/auth-provider"
import { auth, db } from "@/lib/firebase"

export default function Page() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [shareLoading, setShareLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("dashboard")

  async function handleCreateShareLink() {
    if (!user) return
    setShareLoading(true)
    setShareUrl(null)
    try {
      const uid = user.uid
      const [logsSnap, vaultSnap, ideasSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "users", uid, "dailyLogs"),
            orderBy("createdAt", "desc"),
          ),
        ),
        getDocs(
          query(
            collection(db, "users", uid, "vaultEntries"),
            orderBy("createdAt", "desc"),
          ),
        ),
        getDocs(
          query(
            collection(db, "users", uid, "ideas"),
            orderBy("createdAt", "desc"),
          ),
        ),
      ])
      const payload = {
        dailyLogs: logsSnap.docs
          .slice(0, 20)
          .map((d) => ({ id: d.id, ...d.data() })),
        vaultEntries: vaultSnap.docs
          .slice(0, 30)
          .map((d) => ({ id: d.id, ...d.data() })),
        ideas: ideasSnap.docs
          .slice(0, 30)
          .map((d) => ({ id: d.id, ...d.data() })),
      }
      const token = crypto.randomUUID()
      const shareRef = doc(db, "shareLinks", token)
      await setDoc(shareRef, {
        userId: uid,
        scope: "portfolio",
        createdAt: new Date().toISOString(),
        payload,
      })
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}/share/${token}`
          : `/share/${token}`
      setShareUrl(url)
      await navigator.clipboard.writeText(url)
    } finally {
      setShareLoading(false)
    }
  }

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
      return
    }
  }, [user, loading, router])

  async function handleLogout() {
    await signOut(auth)
    router.replace("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const tabTriggerClass =
    "text-xs px-3 py-1.5 rounded-none border-b border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"

  return (
    <div className="min-h-screen bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <header className="bg-card">
          <div className="mx-auto max-w-6xl px-6 pt-5 pb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
                Learning Portfolio
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <TabsList className="bg-transparent gap-1 p-0 h-auto">
                <TabsTrigger value="dashboard" className={tabTriggerClass}>
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="projects" className={tabTriggerClass}>
                  Projects
                </TabsTrigger>
                <TabsTrigger value="vault" className={tabTriggerClass}>
                  Knowledge Vault
                </TabsTrigger>
                <TabsTrigger value="ideas" className={tabTriggerClass}>
                  Ideas
                </TabsTrigger>
              </TabsList>
              <span
                className="text-xs text-muted-foreground max-w-[140px] truncate"
                title={user.email ?? undefined}
              >
                {user.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateShareLink}
                disabled={shareLoading}
                className="text-xs"
              >
                {shareLoading ? "…" : "Share link"}
              </Button>
              {shareUrl && (
                <span className="text-xs text-muted-foreground">
                  Copied to clipboard
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-xs"
              >
                Log out
              </Button>
            </div>
          </div>
          <div className="h-px bg-accent" />
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10">
          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>
          <TabsContent value="projects">
            <ProjectDashboard />
          </TabsContent>
          <TabsContent value="vault">
            <KnowledgeVault />
          </TabsContent>
          <TabsContent value="ideas">
            <IdeasDashboard />
          </TabsContent>
        </main>
      </Tabs>

      <CommandSearch onNavigate={setActiveTab} />
    </div>
  )
}
