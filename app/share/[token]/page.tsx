"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"

type Payload = {
  strategicFocus?: { currentWeek?: string; currentCourse?: string; weeklyFocus?: string } | null
  progress?: { items?: { label: string; value: number }[] } | null
  dailyLogs?: { id: string; date?: string; hours?: number; learned?: string; built?: string; insight?: string; blockers?: string; nextAction?: string }[]
  sprints?: { id: string; hypothesis?: string; testMethod?: string; status?: string; decision?: string; isCurrent?: boolean }[]
  vaultEntries?: { id: string; title?: string; category?: string; linkedCourse?: string; date?: string; url?: string; note?: string }[]
}

export default function SharePage() {
  const params = useParams()
  const token = typeof params.token === "string" ? params.token : ""
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError("Invalid link")
      return
    }
    getDoc(doc(db, "shareLinks", token))
      .then((snap) => {
        if (!snap.exists()) {
          setError("Link not found or expired")
          return
        }
        const data = snap.data()
        setPayload((data.payload as Payload) ?? null)
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-destructive">{error ?? "Nothing to show"}</p>
      </div>
    )
  }

  const focus = payload.strategicFocus
  const progressItems = payload.progress?.items ?? []
  const logs = payload.dailyLogs ?? []
  const sprints = payload.sprints ?? []
  const vault = payload.vaultEntries ?? []
  const currentSprint = sprints.find((s) => s.isCurrent) ?? sprints[0]

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Learning Portfolio (shared)
          </h1>
        </div>
        <div className="h-px bg-accent" />
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-10">
        {focus && (focus.currentWeek || focus.currentCourse || focus.weeklyFocus) && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-px bg-accent" />
              <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
                Strategic Focus
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {focus.currentWeek && (
                <div className="border-l-2 border-l-accent border border-border bg-card rounded-sm p-4">
                  <p className="text-[11px] text-muted-foreground mb-1 uppercase">Current Week</p>
                  <p className="text-sm font-medium">{focus.currentWeek}</p>
                </div>
              )}
              {focus.currentCourse && (
                <div className="border-l-2 border-l-accent border border-border bg-card rounded-sm p-4">
                  <p className="text-[11px] text-muted-foreground mb-1 uppercase">Current Course</p>
                  <p className="text-sm font-medium">{focus.currentCourse}</p>
                </div>
              )}
              {focus.weeklyFocus && (
                <div className="border-l-2 border-l-accent border border-border bg-card rounded-sm p-4">
                  <p className="text-[11px] text-muted-foreground mb-1 uppercase">Weekly Focus</p>
                  <p className="text-sm font-medium">{focus.weeklyFocus}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {progressItems.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-px bg-accent" />
              <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
                Progress
              </h2>
            </div>
            <div className="rounded-sm border border-border bg-card p-5">
              <div className="flex flex-col gap-4">
                {progressItems.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.label}</span>
                      <span className="text-muted-foreground">{item.value}%</span>
                    </div>
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {currentSprint && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-px bg-accent" />
              <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
                Current Sprint
              </h2>
            </div>
            <div className="rounded-sm border-l-2 border-l-accent border border-border bg-card p-4">
              {currentSprint.hypothesis && (
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Hypothesis</p>
                  <p className="text-sm">{currentSprint.hypothesis}</p>
                </div>
              )}
              {currentSprint.testMethod && (
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Test Method</p>
                  <p className="text-sm">{currentSprint.testMethod}</p>
                </div>
              )}
              {(currentSprint.status || currentSprint.decision) && (
                <div className="flex gap-2 mt-2">
                  {currentSprint.status && (
                    <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs">{currentSprint.status}</span>
                  )}
                  {currentSprint.decision && (
                    <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs">{currentSprint.decision}</span>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {logs.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-px bg-accent" />
              <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
                Recent Daily Logs
              </h2>
            </div>
            <div className="flex flex-col gap-2">
              {logs.slice(0, 10).map((entry) => (
                <div key={entry.id} className="rounded-sm border-l-2 border-l-accent border border-border bg-card p-4">
                  <div className="flex gap-4 text-sm mb-2">
                    <span className="font-medium">{entry.date ? format(new Date(entry.date), "MMM d, yyyy") : ""}</span>
                    {entry.hours != null && <span className="text-muted-foreground">{entry.hours}h</span>}
                  </div>
                  {entry.learned && <p className="text-sm mb-1"><span className="text-muted-foreground">Learned:</span> {entry.learned}</p>}
                  {entry.built && <p className="text-sm mb-1"><span className="text-muted-foreground">Built:</span> {entry.built}</p>}
                  {entry.insight && <p className="text-sm whitespace-pre-wrap">{entry.insight}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {vault.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-px bg-accent" />
              <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
                Knowledge Vault
              </h2>
            </div>
            <div className="flex flex-col gap-2">
              {vault.slice(0, 15).map((entry) => (
                <div key={entry.id} className="rounded-sm border-l-2 border-l-accent border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{entry.title}</span>
                    {entry.category && (
                      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {entry.category}
                      </span>
                    )}
                    {entry.date && <span className="text-xs text-muted-foreground">{format(new Date(entry.date), "MMM d")}</span>}
                  </div>
                  {entry.url && (
                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline break-all">
                      {entry.url}
                    </a>
                  )}
                  {entry.note && <p className="text-sm mt-2 whitespace-pre-wrap">{entry.note}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {!focus?.currentWeek && !focus?.currentCourse && !focus?.weeklyFocus && progressItems.length === 0 && !currentSprint && logs.length === 0 && vault.length === 0 && (
          <p className="text-sm text-muted-foreground">No content in this share yet.</p>
        )}
      </main>
    </div>
  )
}
