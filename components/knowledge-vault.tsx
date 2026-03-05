"use client"

import { useState, useEffect, useMemo } from "react"
import {
  collection,
  addDoc,
  doc,
  getDocs,
  deleteDoc as firestoreDeleteDoc,
  query,
  orderBy,
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
import { ChevronDown, FolderOpen, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { ImageFullScreen } from "@/components/image-fullscreen"
import { MarkdownViewModal } from "@/components/markdown-view-modal"
import { richTextToPlainText } from "@/lib/render-rich"
import { toast } from "sonner"

const CATEGORIES = [
  "Research",
  "Wireframes",
  "Design System",
  "Insights",
  "Interviews",
  "Notes",
  "Case Study",
] as const

type Category = (typeof CATEGORIES)[number]

interface VaultEntry {
  id: string
  title: string
  category: Category
  linkedCourse: string
  linkedProject: string
  date: string
  url: string
  note: string
  imageUrl?: string
}

interface ProjectOption {
  id: string
  name: string
}

const DEFAULT_PROJECTS = [
  {
    id: "alie",
    name: "ALIE",
  },
  {
    id: "vision",
    name: "VISION",
  },
] as const

function getEmptyForm() {
  return {
    title: "",
    category: "" as Category | "",
    linkedCourse: "",
    linkedProject: "",
    date: "",
    url: "",
    note: "",
  }
}

export function KnowledgeVault() {
  const { user } = useAuth()
  const [form, setForm] = useState(getEmptyForm)
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All")
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showNewEntryForm, setShowNewEntryForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingEntryNote, setEditingEntryNote] = useState("")
  const [updatingEntry, setUpdatingEntry] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingFullEntryId, setEditingFullEntryId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      date: new Date().toISOString().split("T")[0],
    }))
  }, [])

  useEffect(() => {
    if (!user) return
    const projectsRef = collection(db, "users", user.uid, "projects")
    getDocs(query(projectsRef, orderBy("createdAt", "asc")))
      .then((snap) => {
        const fromDb: ProjectOption[] = snap.docs.map((d) => ({
          id: d.id,
          name: (d.data().name as string) ?? d.id,
        }))
        const merged: ProjectOption[] = [...fromDb]
        DEFAULT_PROJECTS.forEach((base) => {
          if (!merged.some((p) => p.id === base.id)) {
            merged.push({ id: base.id, name: base.name })
          }
        })
        setProjects(merged)
      })
      .catch(() => {
        // If projects collection is missing, fall back to defaults
        setProjects(DEFAULT_PROJECTS.map((p) => ({ id: p.id, name: p.name })))
      })
  }, [user?.uid])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    const col = collection(db, "users", user.uid, "vaultEntries")
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
              title: (data.title as string) ?? "",
              category: (data.category as Category) ?? "Notes",
              linkedCourse: (data.linkedCourse as string) ?? "",
              linkedProject: (data.linkedProject as string) ?? "",
              date: (data.date as string) ?? "",
              url: (data.url as string) ?? "",
              note: (data.note as string) ?? "",
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

  function startFullEdit(entry: VaultEntry) {
    setForm({
      title: entry.title,
      category: entry.category,
      linkedCourse: entry.linkedCourse,
      linkedProject: entry.linkedProject || "",
      date: entry.date,
      url: entry.url,
      note: entry.note,
    })
    setEditingFullEntryId(entry.id)
    setShowNewEntryForm(true)
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  function cancelFullEdit() {
    setEditingFullEntryId(null)
    setForm({
      ...getEmptyForm(),
      date: new Date().toISOString().split("T")[0],
    })
    setShowNewEntryForm(false)
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  async function handleDeleteEntry(entryId: string) {
    if (!user) return
    try {
      await firestoreDeleteDoc(doc(db, "users", user.uid, "vaultEntries", entryId))
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
      setDeleteConfirmId(null)
      toast.success("Entry deleted")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  async function handleSave() {
    if (!form.title || !form.category || !user) return
    setSaving(true)
    setError(null)
    try {
      let imageUrl: string | undefined
      if (imageFile) {
        setImageUploading(true)
        try {
          imageUrl = await uploadImage(imageFile)
        } finally {
          setImageUploading(false)
        }
      }

      if (editingFullEntryId) {
        const ref = doc(db, "users", user.uid, "vaultEntries", editingFullEntryId)
        const updateData: Record<string, unknown> = {
          title: form.title,
          category: form.category,
          linkedCourse: form.linkedCourse,
          linkedProject: form.linkedProject,
          date: form.date || new Date().toISOString().split("T")[0],
          url: form.url,
          note: form.note,
          updatedAt: new Date().toISOString(),
          updatedAtServer: serverTimestamp(),
        }
        if (imageUrl) updateData.imageUrl = imageUrl
        await updateDoc(ref, updateData)
        setEntries((prev) =>
          prev.map((e) =>
            e.id === editingFullEntryId
              ? {
                  ...e,
                  title: form.title,
                  category: form.category as Category,
                  linkedCourse: form.linkedCourse,
                  linkedProject: form.linkedProject,
                  date: form.date || e.date,
                  url: form.url,
                  note: form.note,
                  imageUrl: imageUrl || e.imageUrl,
                }
              : e
          )
        )
        setEditingFullEntryId(null)
        toast.success("Entry updated")
      } else {
        const col = collection(db, "users", user.uid, "vaultEntries")
        const docData: Record<string, unknown> = {
          title: form.title,
          category: form.category,
          linkedCourse: form.linkedCourse,
          linkedProject: form.linkedProject,
          date: form.date || new Date().toISOString().split("T")[0],
          url: form.url,
          note: form.note,
          createdAt: serverTimestamp(),
        }
        if (imageUrl) {
          docData.imageUrl = imageUrl
        }
        await addDoc(col, docData)
        const q = query(col, orderBy("createdAt", "desc"))
        const snap = await getDocs(q)
        setEntries(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              title: (data.title as string) ?? "",
              category: (data.category as Category) ?? "Notes",
              linkedCourse: (data.linkedCourse as string) ?? "",
              linkedProject: (data.linkedProject as string) ?? "",
              date: (data.date as string) ?? "",
              url: (data.url as string) ?? "",
              note: (data.note as string) ?? "",
              imageUrl: (data.imageUrl as string | undefined) || undefined,
            }
          })
        )
        toast.success("Entry saved")
      }

      setForm({
        ...getEmptyForm(),
        date: new Date().toISOString().split("T")[0],
      })
      setImageFile(null)
      setImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setShowNewEntryForm(false)
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

  const categoryFiltered =
    activeCategory === "All"
      ? entries
      : entries.filter((e) => e.category === activeCategory)

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return categoryFiltered
    const q = searchQuery.toLowerCase()
    return categoryFiltered.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        richTextToPlainText(e.note).toLowerCase().includes(q) ||
        e.linkedCourse.toLowerCase().includes(q)
    )
  }, [categoryFiltered, searchQuery])

  const categoryCounts = CATEGORIES.map((cat) => ({
    category: cat,
    count: entries.filter((e) => e.category === cat).length,
  }))

  const entriesByCategory =
    activeCategory === "All"
      ? (CATEGORIES.map((cat) => ({
          category: cat,
          entries: filteredEntries.filter((e) => e.category === cat),
        })).filter((g) => g.entries.length > 0) as { category: Category; entries: VaultEntry[] }[])
      : null

  async function handleSaveEntryEdit(entryId: string) {
    if (!user) return
    setUpdatingEntry(true)
    setError(null)
    try {
      const ref = doc(db, "users", user.uid, "vaultEntries", entryId)
      await updateDoc(ref, {
        note: editingEntryNote,
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp(),
      })
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, note: editingEntryNote } : entry,
        ),
      )
      setEditingEntryId(null)
      setEditingEntryNote("")
      toast.success("Note updated")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update note")
    } finally {
      setUpdatingEntry(false)
    }
  }

  function renderEntryCard(entry: VaultEntry) {
    return (
      <Collapsible
        key={entry.id}
        open={openIds.has(entry.id)}
        onOpenChange={() => toggleOpen(entry.id)}
      >
        <div className="flex items-center gap-1">
          <CollapsibleTrigger className="flex flex-1 items-center justify-between rounded-sm border-l-2 border-l-accent border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-secondary">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-medium text-foreground truncate">
                {entry.title}
              </span>
              {entry.linkedCourse && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.linkedCourse}
                </span>
              )}
              {entry.linkedProject && (
                <span className="shrink-0 text-xs text-accent">
                  {projects.find((p) => p.id === entry.linkedProject)?.name ?? ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-2">
              {entry.date && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(entry.date), "MMM d")}
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  openIds.has(entry.id) ? "rotate-180" : ""
                }`}
              />
            </div>
          </CollapsibleTrigger>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => startFullEdit(entry)}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteConfirmId(entry.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CollapsibleContent>
          <div className="mx-1 mt-1 rounded-b-sm border border-t-0 border-border bg-card px-4 py-3">
            <div className="flex flex-col gap-3">
              {entry.url && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Link</p>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground underline decoration-accent underline-offset-2 break-all hover:decoration-foreground transition-colors"
                  >
                    {entry.url}
                  </a>
                </div>
              )}
              {entry.imageUrl && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Image</p>
                  <ImageFullScreen
                    src={entry.imageUrl}
                    alt={entry.title}
                    className="mt-1 max-h-48 w-full"
                  />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Notes</p>
                  {entry.note && (
                    <>
                      <MarkdownViewModal
                        content={entry.note}
                        title={entry.title}
                        triggerClassName="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => navigator.clipboard.writeText(richTextToPlainText(entry.note))}
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
                      setEditingEntryId(entry.id)
                      setEditingEntryNote(entry.note || "")
                    }}
                  >
                    {entry.note ? "Edit" : "Add"}
                  </Button>
                </div>
                {editingEntryId === entry.id && (
                  <div className="rounded-sm border border-border bg-card p-3 space-y-2">
                    <RichTextEditor
                      value={editingEntryNote}
                      onChange={setEditingEntryNote}
                      placeholder="Edit note..."
                      minHeightClassName="min-h-24"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={updatingEntry}
                        onClick={() => handleSaveEntryEdit(entry.id)}
                      >
                        {updatingEntry ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setEditingEntryId(null)
                          setEditingEntryNote("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row gap-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}

      <aside className="md:w-48 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-4 h-px bg-accent" />
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
            Categories
          </h3>
        </div>
        <nav className="flex flex-row flex-wrap md:flex-col gap-1">
          <button
            onClick={() => setActiveCategory("All")}
            className={`text-left px-3 py-1.5 rounded-sm text-sm transition-colors flex items-center gap-2 ${
              activeCategory === "All"
                ? "border-l-2 border-l-accent text-foreground font-medium bg-secondary"
                : "border-l-2 border-l-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            All ({entries.length})
          </button>
          {categoryCounts.map(({ category: cat, count }) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-left px-3 py-1.5 rounded-sm text-sm transition-colors flex items-center gap-2 ${
                activeCategory === cat
                  ? "border-l-2 border-l-accent text-foreground font-medium bg-secondary"
                  : "border-l-2 border-l-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <FolderOpen className="h-4 w-4 shrink-0 opacity-70" />
              {cat} ({count})
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries..."
            className="pl-9 text-sm"
          />
        </div>

        <Collapsible
          open={showNewEntryForm}
          onOpenChange={(open) => {
            if (!open) cancelFullEdit()
            else setShowNewEntryForm(true)
          }}
          className="mb-6"
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-foreground text-foreground hover:bg-foreground hover:text-background flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {editingFullEntryId ? "Editing Entry" : "New Entry"}
              <ChevronDown className={`h-4 w-4 transition-transform ${showNewEntryForm ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-sm border border-border bg-card p-5 mt-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-4 h-px bg-accent" />
                <h3 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
                  {editingFullEntryId ? "Edit Entry" : "New Entry"}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vault-title" className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    id="vault-title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Entry title..."
                    className="text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(val) => setForm((prev) => ({ ...prev, category: val as Category }))}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vault-source" className="text-xs text-muted-foreground">
                    Source (course, book, article)
                  </Label>
                  <Input
                    id="vault-source"
                    value={form.linkedCourse}
                    onChange={(e) => setForm((prev) => ({ ...prev, linkedCourse: e.target.value }))}
                    placeholder="e.g. Google UX Design Course - Week 3"
                    className="text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vault-date" className="text-xs text-muted-foreground">Date</Label>
                  <Input
                    id="vault-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 mb-4">
                {projects.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Linked Project (optional)</Label>
                    <Select
                      value={form.linkedProject || "none"}
                      onValueChange={(val) => setForm((prev) => ({ ...prev, linkedProject: val === "none" ? "" : val }))}
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Link to a project..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vault-url" className="text-xs text-muted-foreground">URL (Figma, docs, links)</Label>
                  <Input
                    id="vault-url"
                    type="url"
                    value={form.url}
                    onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                    placeholder="https://..."
                    className="text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vault-image" className="text-xs text-muted-foreground">Image (screenshots, UX snippets)</Label>
                  <Input
                    id="vault-image"
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
                    <p className="text-[11px] text-muted-foreground mt-0.5">{imageFile.name}</p>
                  )}
                  {imagePreview && (
                    <ImageFullScreen src={imagePreview} alt="Selected vault entry" className="mt-2 max-h-48 w-full" />
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vault-note" className="text-xs text-muted-foreground">Notes</Label>
                  <RichTextEditor
                    value={form.note}
                    onChange={(note) => setForm((prev) => ({ ...prev, note }))}
                    placeholder="Your notes..."
                    minHeightClassName="min-h-28"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSave}
                  disabled={!form.title || !form.category || saving || imageUploading}
                  variant="outline"
                  className="w-full md:w-auto border-foreground text-foreground hover:bg-foreground hover:text-background"
                >
                  {saving || imageUploading
                    ? "Saving…"
                    : editingFullEntryId
                      ? "Update Entry"
                      : "Save Entry"}
                </Button>
                {editingFullEntryId && (
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={cancelFullEdit}>
                    Cancel Edit
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {filteredEntries.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {entries.length === 0
                ? "No entries yet. Click New Entry to add one."
                : searchQuery
                  ? "No entries match your search."
                  : `No entries in "${activeCategory}".`}
            </p>
          </div>
        ) : entriesByCategory ? (
          <div className="flex flex-col gap-6">
            {entriesByCategory.map(({ category: cat, entries: catEntries }) => (
              <div key={cat} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1 py-1.5 border-b border-border">
                  <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]">
                    {cat} ({catEntries.length})
                  </h4>
                </div>
                <div className="flex flex-col gap-2 pl-2 border-l-2 border-border/50">
                  {catEntries.map((entry) => renderEntryCard(entry))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredEntries.map((entry) => renderEntryCard(entry))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this vault entry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteEntry(deleteConfirmId)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
