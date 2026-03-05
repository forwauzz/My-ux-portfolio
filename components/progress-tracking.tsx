"use client"

import { useState, useEffect, useCallback } from "react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"

interface ProgressItem {
  label: string
  value: number
}

const defaultItems: ProgressItem[] = [
  { label: "Course Completion", value: 0 },
  { label: "ALIE Artifacts Completed", value: 0 },
  { label: "Research Sessions Completed", value: 0 },
]

export function ProgressTracking() {
  const { user } = useAuth()
  const [items, setItems] = useState<ProgressItem[]>(defaultItems)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const progressRef = user ? doc(db, "users", user.uid, "progress", "items") : null

  useEffect(() => {
    if (!user || !progressRef) {
      setLoading(false)
      return
    }
    let cancelled = false
    getDoc(progressRef)
      .then((snap) => {
        if (cancelled) return
        if (snap.exists()) {
          const arr = snap.data().items as { label: string; value: number }[] | undefined
          if (Array.isArray(arr) && arr.length > 0) {
            setItems(arr)
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.uid, progressRef])

  const save = useCallback(async () => {
    if (!user || !progressRef) return
    try {
      await setDoc(progressRef, { items }, { merge: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    }
  }, [user?.uid, progressRef, items])

  const updateValue = (index: number, val: string) => {
    const num = Math.min(100, Math.max(0, parseInt(val, 10) || 0))
    setItems((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, value: num } : item))
      return next
    })
  }

  useEffect(() => {
    if (!user || loading) return
    const t = setTimeout(save, 500)
    return () => clearTimeout(t)
  }, [items, user, loading, save])

  if (loading) {
    return (
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-px bg-accent" />
          <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
            Progress Tracking
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-5 h-px bg-accent" />
        <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
          Progress Tracking
        </h2>
      </div>
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      <div className="rounded-sm border border-border bg-card p-5">
        <div className="flex flex-col gap-5">
          {items.map((item, index) => (
            <div key={item.label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">{item.label}</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={item.value}
                    onChange={(e) => updateValue(index, e.target.value)}
                    className="w-14 h-7 text-xs text-center border-border"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <Progress value={item.value} className="h-1 bg-border [&>[data-slot=progress-indicator]]:bg-accent" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
