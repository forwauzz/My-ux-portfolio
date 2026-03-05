"use client"

import { useEffect, useState, useMemo } from "react"
import {
  collection,
  addDoc,
  doc,
  getDocs,
  deleteDoc as firestoreDeleteDoc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadImage } from "@/lib/upload-image"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ImageFullScreen } from "@/components/image-fullscreen"
import { MarkdownViewModal } from "@/components/markdown-view-modal"
import { richTextToPlainText } from "@/lib/render-rich"
import { BookOpen, ChevronDown, FolderOpen, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { isWithinInterval, subDays } from "date-fns"
import { toast } from "sonner"

const IDEA_CATEGORIES = [
  "UX Pattern",
  "Product Bet",
  "Experiment",
  "Process",
  "Other",
] as const

const IDEA_STATUSES = [
  "Backlog",
  "In Discovery",
  "In Experiment",
  "Parked",
] as const

const IDEA_SOURCES = ["School", "Real Product", "Customer", "Other"] as const

type IdeaCategory = (typeof IDEA_CATEGORIES)[number]
type IdeaStatus = (typeof IDEA_STATUSES)[number]
type IdeaSource = (typeof IDEA_SOURCES)[number]

interface Idea {
  id: string
  title: string
  category: IdeaCategory
  status: IdeaStatus
  source: IdeaSource
  tags: string[]
  note: string
  imageUrl?: string
  createdAt: string
}

interface IdeaFormState {
  title: string
  category: IdeaCategory | ""
  status: IdeaStatus | ""
  source: IdeaSource | ""
  tags: string
  note: string
}

const emptyForm: IdeaFormState = {
  title: "",
  category: "",
  status: "",
  source: "",
  tags: "",
  note: "",
}

type IdeasViewFilter = "journal" | { type: "category"; value: IdeaCategory } | { type: "status"; value: IdeaStatus }

export function IdeasDashboard() {
  const { user } = useAuth()
  const [form, setForm] = useState<IdeaFormState>(emptyForm)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [viewFilter, setViewFilter] = useState<IdeasViewFilter>("journal")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showNewIdeaForm, setShowNewIdeaForm] = useState(false)
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null)
  const [editingIdeaNote, setEditingIdeaNote] = useState("")
  const [updatingIdea, setUpdatingIdea] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingFullIdeaId, setEditingFullIdeaId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    const col = collection(db, "users", user.uid, "ideas")
    const q = query(col, orderBy("createdAt", "desc"))
    let cancelled = false
    getDocs(q)
      .then((snap) => {
        if (cancelled) return
        setIdeas(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              title: (data.title as string) ?? "",
              category: (data.category as IdeaCategory) ?? "Other",
              status: (data.status as IdeaStatus) ?? "Backlog",
              source: (data.source as IdeaSource) ?? "Other",
              tags:
                Array.isArray(data.tags) && data.tags.length > 0
                  ? (data.tags as string[])
                  : [],
              note: (data.note as string) ?? "",
              imageUrl: (data.imageUrl as string | undefined) || undefined,
              createdAt: (data.createdAt as string) ?? "",
            }
          }),
        )
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  function startFullEdit(idea: Idea) {
    setForm({
      title: idea.title,
      category: idea.category,
      status: idea.status,
      source: idea.source,
      tags: idea.tags.join(", "),
      note: idea.note,
    })
    setEditingFullIdeaId(idea.id)
    setShowNewIdeaForm(true)
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  function cancelFullEdit() {
    setEditingFullIdeaId(null)
    setForm(emptyForm)
    setShowNewIdeaForm(false)
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  async function handleDeleteIdea(ideaId: string) {
    if (!user) return
    try {
      await firestoreDeleteDoc(doc(db, "users", user.uid, "ideas", ideaId))
      setIdeas((prev) => prev.filter((i) => i.id !== ideaId))
      setDeleteConfirmId(null)
      toast.success("Idea deleted")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  async function handleSave() {
    if (!user || !form.title || !form.category || !form.status || !form.source)
      return
    setSaving(true)
    setError(null)
    try {
      const tagsArray =
        form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean) ?? []

      let imageUrl: string | undefined
      if (imageFile) {
        setImageUploading(true)
        try {
          imageUrl = await uploadImage(imageFile)
        } catch {
          throw new Error("Image upload failed. Check IMGBB_API_KEY and try again.")
        }
      }

      if (editingFullIdeaId) {
        const ref = doc(db, "users", user.uid, "ideas", editingFullIdeaId)
        const updateData: Record<string, unknown> = {
          title: form.title,
          category: form.category,
          status: form.status,
          source: form.source,
          tags: tagsArray,
          note: form.note,
          updatedAt: new Date().toISOString(),
          updatedAtServer: serverTimestamp(),
        }
        if (imageUrl) updateData.imageUrl = imageUrl
        await updateDoc(ref, updateData)
        setIdeas((prev) =>
          prev.map((i) =>
            i.id === editingFullIdeaId
              ? {
                  ...i,
                  title: form.title,
                  category: form.category as IdeaCategory,
                  status: form.status as IdeaStatus,
                  source: form.source as IdeaSource,
                  tags: tagsArray,
                  note: form.note,
                  imageUrl: imageUrl || i.imageUrl,
                }
              : i
          )
        )
        setEditingFullIdeaId(null)
        toast.success("Idea updated")
      } else {
        const col = collection(db, "users", user.uid, "ideas")
        await addDoc(col, {
          title: form.title,
          category: form.category,
          status: form.status,
          source: form.source,
          tags: tagsArray,
          note: form.note,
          imageUrl,
          createdAt: new Date().toISOString(),
          createdAtServer: serverTimestamp(),
        })
        const q = query(col, orderBy("createdAt", "desc"))
        const snap = await getDocs(q)
        setIdeas(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              title: (data.title as string) ?? "",
              category: (data.category as IdeaCategory) ?? "Other",
              status: (data.status as IdeaStatus) ?? "Backlog",
              source: (data.source as IdeaSource) ?? "Other",
              tags:
                Array.isArray(data.tags) && data.tags.length > 0
                  ? (data.tags as string[])
                  : [],
              note: (data.note as string) ?? "",
              imageUrl: (data.imageUrl as string | undefined) || undefined,
              createdAt: (data.createdAt as string) ?? "",
            }
          }),
        )
        toast.success("Idea saved")
      }

      setForm(emptyForm)
      setImageFile(null)
      setImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setShowNewIdeaForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setImageUploading(false)
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

  const viewFiltered = useMemo(() => {
    if (viewFilter === "journal") return ideas
    if (viewFilter.type === "category")
      return ideas.filter((i) => i.category === viewFilter.value)
    return ideas.filter((i) => i.status === viewFilter.value)
  }, [ideas, viewFilter])

  const filteredIdeas = useMemo(() => {
    if (!searchQuery.trim()) return viewFiltered
    const q = searchQuery.toLowerCase()
    return viewFiltered.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        richTextToPlainText(i.note).toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
    )
  }, [viewFiltered, searchQuery])

  const journalGroups = useMemo(() => {
    if (viewFilter !== "journal") return null
    const now = new Date()
    const weekStart = subDays(now, 7)
    const monthStart = subDays(now, 30)
    const thisWeek: Idea[] = []
    const thisMonth: Idea[] = []
    const older: Idea[] = []
    filteredIdeas.forEach((idea) => {
      const d = idea.createdAt ? new Date(idea.createdAt) : now
      if (isWithinInterval(d, { start: weekStart, end: now })) thisWeek.push(idea)
      else if (isWithinInterval(d, { start: monthStart, end: now })) thisMonth.push(idea)
      else older.push(idea)
    })
    return [
      { label: "This week", ideas: thisWeek },
      { label: "This month", ideas: thisMonth },
      { label: "Older", ideas: older },
    ].filter((g) => g.ideas.length > 0)
  }, [filteredIdeas, viewFilter])

  const categoryCounts = useMemo(
    () =>
      IDEA_CATEGORIES.map((cat) => ({
        category: cat,
        count: ideas.filter((i) => i.category === cat).length,
      })),
    [ideas],
  )
  const statusCounts = useMemo(
    () =>
      IDEA_STATUSES.map((s) => ({
        status: s,
        count: ideas.filter((i) => i.status === s).length,
      })),
    [ideas],
  )

  if (loading) {
    return (
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-px bg-accent" />
          <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
            Ideas
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    )
  }

  async function handleSaveIdeaEdit(ideaId: string) {
    if (!user) return
    setUpdatingIdea(true)
    setError(null)
    try {
      const ref = doc(db, "users", user.uid, "ideas", ideaId)
      await updateDoc(ref, {
        note: editingIdeaNote,
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp(),
      })
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === ideaId ? { ...idea, note: editingIdeaNote } : idea,
        ),
      )
      setEditingIdeaId(null)
      setEditingIdeaNote("")
      toast.success("Note updated")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update idea note")
    } finally {
      setUpdatingIdea(false)
    }
  }

  function renderIdeaCard(idea: Idea) {
    return (
      <div
        key={idea.id}
        className="rounded-sm border-l-2 border-l-accent border border-border bg-card px-4 py-3"
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {idea.title}
            </p>
            <div className="flex flex-wrap items-center gap-1 mt-1">
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {idea.category}
              </span>
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {idea.status}
              </span>
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {idea.source}
              </span>
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => startFullEdit(idea)}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteConfirmId(idea.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-muted-foreground">Notes</p>
            {idea.note && (
              <>
                <MarkdownViewModal
                  content={idea.note}
                  title={idea.title}
                  triggerClassName="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => navigator.clipboard.writeText(richTextToPlainText(idea.note))}
                >
                  Copy
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                setEditingIdeaId(idea.id)
                setEditingIdeaNote(idea.note || "")
              }}
            >
              {idea.note ? "Edit" : "Add"}
            </Button>
          </div>
          {editingIdeaId === idea.id && (
            <div className="rounded-sm border border-border bg-card p-3 space-y-2">
              <RichTextEditor
                value={editingIdeaNote}
                onChange={setEditingIdeaNote}
                placeholder="Edit note..."
                minHeightClassName="min-h-24"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={updatingIdea}
                  onClick={() => handleSaveIdeaEdit(idea.id)}
                >
                  {updatingIdea ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setEditingIdeaId(null)
                    setEditingIdeaNote("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        {idea.imageUrl && (
          <div className="mt-2">
            <p className="text-[11px] text-muted-foreground mb-0.5">Image</p>
            <ImageFullScreen
              src={idea.imageUrl}
              alt={idea.title}
              className="mt-1 max-h-48 w-full"
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-5 h-px bg-accent" />
        <h2 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
          Ideas
        </h2>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col md:flex-row gap-6">
      <aside className="md:w-48 shrink-0 order-2 md:order-1">
        <nav className="flex flex-row flex-wrap md:flex-col gap-1">
          <button
            onClick={() => setViewFilter("journal")}
            className={`text-left px-3 py-1.5 rounded-sm text-sm transition-colors flex items-center gap-2 ${
              viewFilter === "journal"
                ? "border-l-2 border-l-accent text-foreground font-medium bg-secondary"
                : "border-l-2 border-l-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            Journal ({ideas.length})
          </button>
          <div className="w-full border-t border-border my-1 md:block hidden" />
          <span className="px-3 py-1 text-[11px] text-muted-foreground uppercase tracking-wider hidden md:block">
            By category
          </span>
          {categoryCounts.map(({ category: cat, count }) => (
            <button
              key={cat}
              onClick={() => setViewFilter({ type: "category", value: cat })}
              className={`text-left px-3 py-1.5 rounded-sm text-sm transition-colors flex items-center gap-2 ${
                viewFilter !== "journal" &&
                viewFilter.type === "category" &&
                viewFilter.value === cat
                  ? "border-l-2 border-l-accent text-foreground font-medium bg-secondary"
                  : "border-l-2 border-l-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <FolderOpen className="h-4 w-4 shrink-0 opacity-70" />
              {cat} ({count})
            </button>
          ))}
          <span className="px-3 py-1 text-[11px] text-muted-foreground uppercase tracking-wider hidden md:block mt-2">
            By status
          </span>
          {statusCounts.map(({ status: s, count }) => (
            <button
              key={s}
              onClick={() => setViewFilter({ type: "status", value: s })}
              className={`text-left px-3 py-1.5 rounded-sm text-sm transition-colors flex items-center gap-2 ${
                viewFilter !== "journal" &&
                viewFilter.type === "status" &&
                viewFilter.value === s
                  ? "border-l-2 border-l-accent text-foreground font-medium bg-secondary"
                  : "border-l-2 border-l-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {s} ({count})
            </button>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 order-1 md:order-2">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search ideas..."
          className="pl-9 text-sm"
        />
      </div>

      <Collapsible
        open={showNewIdeaForm}
        onOpenChange={(open) => {
          if (!open) cancelFullEdit()
          else setShowNewIdeaForm(true)
        }}
        className="mb-4"
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full md:w-auto border-foreground text-foreground hover:bg-foreground hover:text-background flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {editingFullIdeaId ? "Editing Idea" : "New Idea"}
            <ChevronDown className={`h-4 w-4 transition-transform ${showNewIdeaForm ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
      <div className="rounded-sm border border-border bg-card p-5 mt-3">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-4 h-px bg-accent" />
          <h3 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
            {editingFullIdeaId ? "Edit Idea" : "New Idea"}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idea-title" className="text-xs text-muted-foreground">
              Title
            </Label>
            <Input
              id="idea-title"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Idea title..."
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select
              value={form.category}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, category: val as IdeaCategory }))
              }
            >
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {IDEA_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={form.status}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, status: val as IdeaStatus }))
              }
            >
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Backlog, in discovery..." />
              </SelectTrigger>
              <SelectContent>
                {IDEA_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Source</Label>
            <Select
              value={form.source}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, source: val as IdeaSource }))
              }
            >
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="School, product, customer..." />
              </SelectTrigger>
              <SelectContent>
                {IDEA_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idea-tags" className="text-xs text-muted-foreground">
              Tags
            </Label>
            <Input
              id="idea-tags"
              value={form.tags}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tags: e.target.value }))
              }
              placeholder="onboarding, experimentation, pricing..."
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="idea-image"
              className="text-xs text-muted-foreground"
            >
              Image (optional)
            </Label>
            <Input
              id="idea-image"
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
              <ImageFullScreen
                src={imagePreview}
                alt="Selected idea"
                className="mt-2 max-h-48 w-full"
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="idea-note"
              className="text-xs text-muted-foreground"
            >
              Notes
            </Label>
            <RichTextEditor
              value={form.note}
              onChange={(note) =>
                setForm((prev) => ({ ...prev, note }))
              }
              placeholder="Describe the idea and how you might test it..."
              minHeightClassName="min-h-28"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={
              !form.title ||
              !form.category ||
              !form.status ||
              !form.source ||
              saving ||
              imageUploading
            }
            variant="outline"
            className="w-full md:w-auto border-foreground text-foreground hover:bg-foreground hover:text-background"
          >
            {saving || imageUploading
              ? "Saving…"
              : editingFullIdeaId
                ? "Update Idea"
                : "Save Idea"}
          </Button>
          {editingFullIdeaId && (
            <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={cancelFullEdit}>
              Cancel Edit
            </Button>
          )}
        </div>
      </div>
        </CollapsibleContent>
      </Collapsible>
      {filteredIdeas.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {ideas.length === 0
              ? "No ideas yet. Click New Idea to add one."
              : searchQuery
                ? "No ideas match your search."
                : "No ideas in this view."}
          </p>
        </div>
      ) : journalGroups ? (
        <div className="flex flex-col gap-6">
          {journalGroups.map(({ label, ideas: groupIdeas }) => (
            <div key={label} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1 py-1.5 border-b border-border">
                <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]">
                  {label} ({groupIdeas.length})
                </h4>
              </div>
              <div className="flex flex-col gap-2 pl-2 border-l-2 border-border/50">
                {groupIdeas.map((idea) => renderIdeaCard(idea))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1 py-1.5 border-b border-border mb-1">
            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]">
              {viewFilter.type === "category"
                ? `${viewFilter.value} (${filteredIdeas.length})`
                : `${viewFilter.value} (${filteredIdeas.length})`}
            </h4>
          </div>
          {filteredIdeas.map((idea) => renderIdeaCard(idea))}
        </div>
      )}
      </div>
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete idea?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this idea. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteIdea(deleteConfirmId)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
