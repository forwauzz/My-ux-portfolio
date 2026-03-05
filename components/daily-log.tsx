"use client"

import { useState, useEffect, useRef } from "react"
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadImage } from "@/lib/upload-image"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
interface LogEntry {
  id: string
  date: string
  hours: number
  learned: string
  built: string
  insight: string
  blockers: string
  nextAction: string
  imageUrl?: string
}

const emptyForm = {
  date: "",
  hours: 0,
  learned: "",
  built: "",
  insight: "",
  blockers: "",
  nextAction: "",
}

export function DailyLog() {
  const { user } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    const col = collection(db, "users", user.uid, "dailyLogs")
    const q = query(col, orderBy("createdAt", "desc"))
    let cancelled = false
    getDocs(q)
      .then((snap) => {
        if (cancelled) return
        setEntries(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              date: (data.date as string) ?? "",
              hours: Number(data.hours) ?? 0,
              learned: (data.learned as string) ?? "",
              built: (data.built as string) ?? "",
              insight: (data.insight as string) ?? "",
              blockers: (data.blockers as string) ?? "",
              nextAction: (data.nextAction as string) ?? "",
              imageUrl: (data.imageUrl as string | undefined) || undefined,
            }
          })
        )
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.uid])

  function startEdit(entry: LogEntry) {
    setFormOpen(true)
    setEditingId(entry.id)
    setForm({
      date: entry.date,
      hours: entry.hours,
      learned: entry.learned,
      built: entry.built,
      insight: entry.insight,
      blockers: entry.blockers,
      nextAction: entry.nextAction,
    })
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  function closeForm() {
    setFormOpen(false)
    cancelEdit()
  }

  async function handleSave() {
    if (!form.date || !user) return
    setSaving(true)
    setError(null)
    try {
      const col = collection(db, "users", user.uid, "dailyLogs")
      let imageUrl: string | undefined
      if (imageFile) {
        setImageUploading(true)
        try {
          imageUrl = await uploadImage(imageFile)
        } catch (uploadErr) {
          setError(
            "Log saved without image: " +
              (uploadErr instanceof Error ? uploadErr.message : "image upload failed"),
          )
        }
        setImageUploading(false)
      } else if (editingId) {
        const entry = entries.find((e) => e.id === editingId)
        if (entry?.imageUrl) imageUrl = entry.imageUrl
      }
      const docData: Record<string, unknown> = {
        date: form.date,
        hours: form.hours,
        learned: form.learned,
        built: form.built,
        insight: form.insight,
        blockers: form.blockers,
        nextAction: form.nextAction,
      }
      if (imageUrl != null) docData.imageUrl = imageUrl
      if (editingId) {
        const docRef = doc(db, "users", user.uid, "dailyLogs", editingId)
        await updateDoc(docRef, docData)
        setEditingId(null)
      } else {
        docData.createdAt = serverTimestamp()
        await addDoc(col, docData)
      }
      setForm(emptyForm)
      setImageFile(null)
      setImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setFormOpen(false)
      toast.success(editingId ? "Log updated" : "Log saved")
      const q = query(col, orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      setEntries(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            date: (data.date as string) ?? "",
            hours: Number(data.hours) ?? 0,
            learned: (data.learned as string) ?? "",
            built: (data.built as string) ?? "",
            insight: (data.insight as string) ?? "",
            blockers: (data.blockers as string) ?? "",
            nextAction: (data.nextAction as string) ?? "",
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

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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

  const fields = [
    { key: "learned" as const, label: "Key Concept / Framework" },
    { key: "built" as const, label: "Artifact Produced" },
    { key: "insight" as const, label: "Assumption Challenged" },
    { key: "blockers" as const, label: "Blockers" },
  ]

  if (loading) {
    return (
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-px bg-accent" />
          <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
            Daily Log
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    )
  }

  function openNewLog() {
    cancelEdit()
    setFormOpen(true)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  function focusEntry(id: string) {
    setFormOpen(false)
    setOpenIds((prev) => new Set(prev).add(id))
    setTimeout(() => {
      document.getElementById(`log-entry-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    }, 100)
  }

  return (
    <section className="flex flex-col md:flex-row gap-6">
      {entries.length > 0 && (
        <aside className="md:w-48 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Logs
            </h3>
          </div>
          <nav className="flex flex-row flex-wrap md:flex-col gap-1">
            <button
              type="button"
              onClick={openNewLog}
              className="text-left px-3 py-1.5 rounded-sm text-sm transition-colors w-full border-l-2 border-l-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              + New log
            </button>
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => focusEntry(entry.id)}
                className={`text-left px-3 py-1.5 rounded-sm text-sm transition-colors w-full ${
                  openIds.has(entry.id)
                    ? "border-l-2 border-l-accent text-foreground font-medium bg-secondary"
                    : "border-l-2 border-l-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <span className="block truncate">
                  {format(new Date(entry.date), "MMM d, yyyy")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {entry.hours}h
                </span>
              </button>
            ))}
          </nav>
        </aside>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
              Daily Log
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={openNewLog}
          >
            New log
          </Button>
        </div>
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}
        {formOpen && (
        <div ref={formRef} className="rounded-sm border border-border bg-card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-date" className="text-xs text-muted-foreground">
              Date
            </Label>
            <Input
              id="log-date"
              type="date"
              value={form.date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, date: e.target.value }))
              }
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="log-hours"
              className="text-xs text-muted-foreground"
            >
              Hours Spent
            </Label>
            <Input
              id="log-hours"
              type="number"
              min={0}
              step={0.5}
              value={form.hours || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  hours: parseFloat(e.target.value) || 0,
                }))
              }
              placeholder="0"
              className="text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-4">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label
                htmlFor={`log-${field.key}`}
                className="text-xs text-muted-foreground"
              >
                {field.label}
              </Label>
              <p className="text-[11px] text-muted-foreground/60">
                Use **text** for bold, - or * for bullet points
              </p>
              <Textarea
                id={`log-${field.key}`}
                value={form[field.key]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={`${field.label}...`}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label
            htmlFor="log-nextAction"
            className="text-xs text-muted-foreground"
          >
            Next Action (Tomorrow)
          </Label>
          <Input
            id="log-nextAction"
            value={form.nextAction}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, nextAction: e.target.value }))
            }
            placeholder="Next Action (Tomorrow)..."
            className="text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label htmlFor="log-image" className="text-xs text-muted-foreground">
            Screenshot / image (optional)
          </Label>
          <Input
            id="log-image"
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
              alt="Selected daily log"
              className="mt-2 max-h-40 rounded-sm border border-border object-cover"
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={!form.date || saving || imageUploading}
            variant="outline"
            className="border-foreground text-foreground hover:bg-foreground hover:text-background"
          >
            {saving || imageUploading
              ? "Saving…"
              : editingId
                ? "Update Entry"
                : "Save Entry"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={cancelEdit}
              disabled={saving}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={closeForm}
              disabled={saving}
              className="text-muted-foreground"
            >
              Close
            </Button>
          )}
        </div>
      </div>
        )}
        {!formOpen && entries.length === 0 && (
          <div className="rounded-sm border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No log entries yet. Click New log to add one.
            </p>
          </div>
        )}
      {entries.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {entries.map((entry) => (
            <Collapsible
              key={entry.id}
              open={openIds.has(entry.id)}
              onOpenChange={() => toggleOpen(entry.id)}
            >
              <CollapsibleTrigger
                id={`log-entry-${entry.id}`}
                className="flex w-full items-center justify-between rounded-sm border-l-2 border-l-accent border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-secondary"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-foreground">
                    {format(new Date(entry.date), "MMM d, yyyy")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.hours}h
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    openIds.has(entry.id) ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mx-1 mt-1 rounded-b-sm border border-t-0 border-border bg-card px-4 py-3">
                  <div className="flex justify-end mb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => startEdit(entry)}
                    >
                      Edit
                    </Button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {fields.map(
                      (field) =>
                        entry[field.key] && (
                          <div key={field.key}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {field.label}
                            </p>
                            <div className="flex flex-col gap-0.5">
                              {renderRich(entry[field.key])}
                            </div>
                          </div>
                        )
                    )}
                    {entry.nextAction && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Next Action
                        </p>
                        <p className="text-sm text-foreground leading-relaxed">
                          {entry.nextAction}
                        </p>
                      </div>
                    )}
                    {entry.imageUrl && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Image
                        </p>
                        <img
                          src={entry.imageUrl}
                          alt={entry.date}
                          className="mt-1 max-h-48 rounded-sm border border-border object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
      </div>
    </section>
  )
}
