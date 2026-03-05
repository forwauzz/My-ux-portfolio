"use client"

import { useState, useEffect } from "react"
import {
  collection,
  addDoc,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadImage } from "@/lib/upload-image"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
const STATUS_OPTIONS = [
  "Not Started",
  "Testing",
  "Iterating",
  "Validated",
] as const

const DECISION_OPTIONS = [
  "Ship",
  "Iterate",
  "Kill",
  "Escalate",
] as const

type SprintStatus = (typeof STATUS_OPTIONS)[number]
type SprintDecision = (typeof DECISION_OPTIONS)[number] | ""

interface Sprint {
  id: string
  hypothesis: string
  testMethod: string
  status: SprintStatus
  decision: SprintDecision
  isCurrent?: boolean
  imageUrl?: string
}

export function SprintTracker() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    hypothesis: "",
    testMethod: "",
    status: "Not Started" as SprintStatus,
    decision: "" as SprintDecision,
  })
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    const col = collection(db, "users", user.uid, "sprints")
    let cancelled = false
    getDocs(col)
      .then((snap) => {
        if (cancelled) return
        const list: Sprint[] = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            hypothesis: (data.hypothesis as string) ?? "",
            testMethod: (data.testMethod as string) ?? "",
            status: (data.status as SprintStatus) ?? "Not Started",
            decision: (data.decision as SprintDecision) ?? "",
            isCurrent: data.isCurrent === true,
            imageUrl: (data.imageUrl as string | undefined) || undefined,
          }
        })
        setSprints(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.uid])

  const displaySprint = sprints.length > 0
    ? (sprints.find((s) => s.isCurrent) ?? sprints[0])
    : null

  async function handleSave() {
    if (!form.hypothesis || !user) return
    setSaving(true)
    setError(null)
    try {
      const col = collection(db, "users", user.uid, "sprints")
      let imageUrl: string | undefined
      if (imageFile) {
        setImageUploading(true)
        try {
          imageUrl = await uploadImage(imageFile)
        } finally {
          setImageUploading(false)
        }
      }
      if (sprints.length > 0) {
        const batch = writeBatch(db)
        sprints.forEach((s) => {
          batch.update(doc(db, "users", user.uid, "sprints", s.id), { isCurrent: false })
        })
        await batch.commit()
      }
      await addDoc(col, {
        hypothesis: form.hypothesis,
        testMethod: form.testMethod,
        status: form.status,
        decision: form.decision,
        imageUrl,
        isCurrent: true,
        createdAt: serverTimestamp(),
      })
      setForm((prev) => ({ ...prev, hypothesis: "", testMethod: "" }))
      setImageFile(null)
      setImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      const snap = await getDocs(col)
      setSprints(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            hypothesis: (data.hypothesis as string) ?? "",
            testMethod: (data.testMethod as string) ?? "",
            status: (data.status as SprintStatus) ?? "Not Started",
            decision: (data.decision as SprintDecision) ?? "",
            isCurrent: data.isCurrent === true,
            imageUrl: (data.imageUrl as string | undefined) || undefined,
          }
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  const statusColor: Record<SprintStatus, string> = {
    "Not Started": "bg-muted text-muted-foreground",
    Testing: "bg-primary/15 text-primary",
    Iterating: "bg-accent text-accent-foreground",
    Validated: "bg-primary/25 text-foreground",
  }

  const renderRich = (text: string) => {
    return text.split("\n").map((line, i) => {
      const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      const isBullet =
        line.trim().startsWith("- ") || line.trim().startsWith("* ")
      if (isBullet) {
        const bulletContent = boldProcessed.replace(/^[\s]*[-*]\s/, "")
        return (
          <li
            key={i}
            className="ml-4 list-disc text-sm text-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: bulletContent }}
          />
        )
      }
      return (
        <p
          key={i}
          className="text-sm text-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ __html: boldProcessed }}
        />
      )
    })
  }

  if (loading) {
    return (
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-px bg-accent" />
          <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
            Sprint Tracker
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
          Sprint Tracker
        </h2>
      </div>
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      <div className="rounded-sm border border-border bg-card p-5">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="sprint-hypothesis"
              className="text-xs text-muted-foreground"
            >
              Sprint Hypothesis
            </Label>
            <p className="text-[11px] text-muted-foreground/60">
              Use **text** for bold, - or * for bullet points
            </p>
            <Textarea
              id="sprint-hypothesis"
              value={form.hypothesis}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, hypothesis: e.target.value }))
              }
              placeholder="What are you testing this sprint..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="sprint-method"
              className="text-xs text-muted-foreground"
            >
              Test Method
            </Label>
            <p className="text-[11px] text-muted-foreground/60">
              Use **text** for bold, - or * for bullet points
            </p>
            <Textarea
              id="sprint-method"
              value={form.testMethod}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, testMethod: e.target.value }))
              }
              placeholder="How will you validate this..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={form.status}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, status: val as SprintStatus }))
              }
            >
              <SelectTrigger className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Decision After Sprint
            </Label>
            <Select
              value={form.decision}
              onValueChange={(val) =>
                setForm((prev) => ({
                  ...prev,
                  decision: val as SprintDecision,
                }))
              }
            >
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Select decision..." />
              </SelectTrigger>
              <SelectContent>
                {DECISION_OPTIONS.map((decision) => (
                  <SelectItem key={decision} value={decision}>
                    {decision}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="sprint-image"
              className="text-xs text-muted-foreground"
            >
              Experiment image (optional)
            </Label>
            <Input
              id="sprint-image"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files ? e.target.files[0] ?? null : null
                setImageFile(file)
                setImagePreview((prev) => {
                  if (prev) URL.revokeObjectURL(prev)
                  return file ? URL.createObjectURL(file) : null
                })
              }}
              className="text-sm"
            />
            {imageFile && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {imageFile.name}
              </p>
            )}
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Selected sprint image"
                className="mt-2 max-h-40 rounded-sm border border-border object-cover"
              />
            )}
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={!form.hypothesis || saving || imageUploading}
          variant="outline"
          className="w-full md:w-auto border-foreground text-foreground hover:bg-foreground hover:text-background"
        >
          {saving || imageUploading ? "Saving…" : "Save Sprint"}
        </Button>
      </div>

      {displaySprint && (
        <div className="mt-4 rounded-sm border-l-2 border-l-accent border border-border bg-card p-4">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Current Sprint
            </p>
            <div className="flex items-center gap-2">
              {displaySprint.decision && (
                <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                  {displaySprint.decision}
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${statusColor[displaySprint.status]}`}
              >
                {displaySprint.status}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Hypothesis</p>
              <div className="flex flex-col gap-0.5">
                {renderRich(displaySprint.hypothesis)}
              </div>
            </div>
            {displaySprint.testMethod && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Test Method
                </p>
                <div className="flex flex-col gap-0.5">
                  {renderRich(displaySprint.testMethod)}
                </div>
              </div>
            )}
            {displaySprint.decision && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Decision After Sprint
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {displaySprint.decision}
                </p>
              </div>
            )}
            {displaySprint.imageUrl && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Experiment Image
                </p>
                <img
                  src={displaySprint.imageUrl}
                  alt="Sprint experiment"
                  className="mt-1 max-h-48 rounded-sm border border-border object-cover"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
