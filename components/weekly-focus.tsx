"use client"

import { useState, useEffect, useCallback } from "react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface WeeklyFocusData {
  currentWeek: string
  currentCourse: string
  weeklyFocus: string
}

const emptyData: WeeklyFocusData = {
  currentWeek: "",
  currentCourse: "",
  weeklyFocus: "",
}

export function WeeklyFocus() {
  const { user } = useAuth()
  const [data, setData] = useState<WeeklyFocusData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const focusRef = user ? doc(db, "users", user.uid, "strategicFocus", "focus") : null

  useEffect(() => {
    if (!user || !focusRef) {
      setLoading(false)
      return
    }
    let cancelled = false
    getDoc(focusRef)
      .then((snap) => {
        if (cancelled) return
        if (snap.exists()) {
          const d = snap.data()
          setData({
            currentWeek: (d.currentWeek as string) ?? "",
            currentCourse: (d.currentCourse as string) ?? "",
            weeklyFocus: (d.weeklyFocus as string) ?? "",
          })
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.uid, focusRef])

  const save = useCallback(async () => {
    if (!user || !focusRef) return
    setSaving(true)
    setError(null)
    try {
      await setDoc(focusRef, {
        currentWeek: data.currentWeek,
        currentCourse: data.currentCourse,
        weeklyFocus: data.weeklyFocus,
      }, { merge: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }, [user?.uid, focusRef, data.currentWeek, data.currentCourse, data.weeklyFocus])

  const cards = [
    { key: "currentWeek" as const, label: "Current Week" },
    { key: "currentCourse" as const, label: "Current Course" },
    { key: "weeklyFocus" as const, label: "Weekly Focus" },
  ]

  if (loading) {
    return (
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-px bg-accent" />
          <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
            Strategic Focus
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
          Strategic Focus
        </h2>
      </div>
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.key}
            className="border-l-2 border-l-accent border border-border bg-card rounded-sm p-4"
          >
            <Label
              htmlFor={card.key}
              className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wide"
            >
              {card.label}
            </Label>
            <Input
              id={card.key}
              value={data[card.key]}
              onChange={(e) =>
                setData((prev) => ({ ...prev, [card.key]: e.target.value }))
              }
              onBlur={save}
              placeholder={`Enter ${card.label.toLowerCase()}...`}
              className="border-0 bg-transparent p-0 h-auto text-sm font-medium text-foreground shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
            />
          </div>
        ))}
      </div>
      {saving && <p className="text-xs text-muted-foreground mt-2">Saving…</p>}
    </section>
  )
}
