"use client"

import { useEffect, useMemo, useState } from "react"
import {
  doc,
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadImage } from "@/lib/upload-image"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Textarea } from "@/components/ui/textarea"
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
import { MarkdownViewModal } from "@/components/markdown-view-modal"
import { Badge } from "@/components/ui/badge"
import { DesignVoteForm } from "@/components/design-vote-form"
import Link from "next/link"
import { ChevronDown, Download, FileStack, Plus } from "lucide-react"
import { downloadImage, slugify } from "@/lib/download-image"
import { renderRichText, richTextToPlainText } from "@/lib/render-rich"

const DEFAULT_PROJECTS = [
  {
    id: "alie",
    name: "ALIE",
    tagline: "Applied learning, insights, and experiments for ALIE.",
  },
  {
    id: "vision",
    name: "VISION",
    tagline: "Longer–horizon product bets and vision work.",
  },
] as const

const ARTEFACT_TYPES = [
  "Screenshot",
  "Notes",
  "User Flow",
  "Design System",
  "UX Pattern",
] as const

const SOURCES = ["School", "Real Product", "Customer", "Other"] as const
const FEATURE_STATUSES = [
  "Draft",
  "In Review",
  "Ready for Review",
  "Archived",
] as const
const TICKET_STATUSES = ["open", "in_progress", "done", "verified"] as const
const TICKET_SEVERITIES = ["low", "medium", "high"] as const

type ArtefactType = (typeof ARTEFACT_TYPES)[number]
type SourceType = (typeof SOURCES)[number]
type FeatureStatus = (typeof FEATURE_STATUSES)[number]
type TicketStatus = (typeof TICKET_STATUSES)[number]
type TicketSeverity = (typeof TICKET_SEVERITIES)[number]

interface Artefact {
  id: string
  title: string
  projectId: string
  type: ArtefactType
  source: SourceType
  link: string
  tags: string[]
  note: string
  createdAt: string
  imageUrl?: string
}

interface ArtefactFormState {
  title: string
  type: ArtefactType | ""
  source: SourceType | ""
  link: string
  tags: string
  note: string
}

const emptyForm: ArtefactFormState = {
  title: "",
  type: "",
  source: "",
  link: "",
  tags: "",
  note: "",
}

interface ProjectRecord {
  id: string
  name: string
  tagline: string
  createdAt: string
}

interface FeatureRecord {
  id: string
  title: string
  summary: string
  status: FeatureStatus
  createdAt: string
  updatedAt: string
}

interface TicketRecord {
  id: string
  title: string
  description: string
  featureId?: string
  status: TicketStatus
  severity: TicketSeverity
  assigneeName?: string
  source?: string
  screenshotUrls: string[]
  createdAt: string
  updatedAt: string
}

export function ProjectDashboard() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [projectName, setProjectName] = useState("")
  const [projectTagline, setProjectTagline] = useState("")
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectRefreshVersion, setProjectRefreshVersion] = useState(0)
  const [features, setFeatures] = useState<FeatureRecord[]>([])
  const [featuresLoading, setFeaturesLoading] = useState(true)
  const [featureTitle, setFeatureTitle] = useState("")
  const [featureSummary, setFeatureSummary] = useState("")
  const [featureStatus, setFeatureStatus] = useState<FeatureStatus>("Draft")
  const [featureSaving, setFeatureSaving] = useState(false)
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [ticketTitle, setTicketTitle] = useState("")
  const [ticketDescription, setTicketDescription] = useState("")
  const [ticketFeatureId, setTicketFeatureId] = useState("none")
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>("open")
  const [ticketSeverity, setTicketSeverity] = useState<TicketSeverity>("medium")
  const [ticketAssigneeName, setTicketAssigneeName] = useState("")
  const [ticketSource, setTicketSource] = useState("")
  const [ticketSaving, setTicketSaving] = useState(false)
  const [ticketImageFile, setTicketImageFile] = useState<File | null>(null)
  const [ticketImageUploading, setTicketImageUploading] = useState(false)
  const [ticketImagePreview, setTicketImagePreview] = useState<string | null>(null)
  const [ticketStatusFilter, setTicketStatusFilter] = useState<"all" | TicketStatus>("all")
  const [showNewTicketForm, setShowNewTicketForm] = useState(false)
  const [form, setForm] = useState<ArtefactFormState>(emptyForm)
  const [artefacts, setArtefacts] = useState<Artefact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [designVotes, setDesignVotes] = useState<
    { id: string; title: string; createdAt: string; artefactId?: string; status?: string; deadline?: string }[]
  >([])
  const [designVotesLoading, setDesignVotesLoading] = useState(true)
  const [designVotesVersion, setDesignVotesVersion] = useState(0)
  const [selectedArtefactForVote, setSelectedArtefactForVote] = useState<string>("")
  const [showNewArtefactForm, setShowNewArtefactForm] = useState(false)
  const [showNewDesignVoteForm, setShowNewDesignVoteForm] = useState(false)
  const [editingArtefactId, setEditingArtefactId] = useState<string | null>(null)
  const [editingArtefactNote, setEditingArtefactNote] = useState("")
  const [updatingArtefact, setUpdatingArtefact] = useState(false)

  const selectedProject = useMemo(
    () =>
      projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  )

  useEffect(() => {
    if (!user) {
      return
    }
    let cancelled = false
    const projectsRef = collection(db, "users", user.uid, "projects")
    getDocs(query(projectsRef, orderBy("createdAt", "asc")))
      .then((snap) => {
        if (cancelled) return
        const fromDb: ProjectRecord[] = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: (data.name as string) ?? "",
            tagline: (data.tagline as string) ?? "",
            createdAt: (data.createdAt as string) ?? "",
          }
        })
        const merged = [...fromDb]
        DEFAULT_PROJECTS.forEach((base) => {
          if (!merged.some((p) => p.id === base.id)) {
            merged.push({
              ...base,
              createdAt: "",
            })
          }
        })
        setProjects(merged)
        if (!selectedProjectId || !merged.some((p) => p.id === selectedProjectId)) {
          setSelectedProjectId(merged[0]?.id ?? "")
        }
      })
      .catch(() => {
        if (cancelled) return
        const fallback: ProjectRecord[] = DEFAULT_PROJECTS.map((p) => ({
          ...p,
          createdAt: "",
        }))
        setProjects(fallback)
        if (!selectedProjectId) setSelectedProjectId(fallback[0]?.id ?? "")
      })
    return () => {
      cancelled = true
    }
  }, [user?.uid, projectRefreshVersion, selectedProjectId])

  useEffect(() => {
    if (!user || !selectedProjectId) {
      setFeatures([])
      setFeaturesLoading(false)
      return
    }
    let cancelled = false

    async function loadFeatures() {
      setFeaturesLoading(true)
      try {
        const col = collection(
          db,
          "users",
          user.uid,
          "projects",
          selectedProjectId,
          "features",
        )
        const snap = await getDocs(query(col, orderBy("createdAt", "desc")))
        if (cancelled) return
        setFeatures(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              title: (data.title as string) ?? "",
              summary: (data.summary as string) ?? "",
              status: (data.status as FeatureStatus) ?? "Draft",
              createdAt: (data.createdAt as string) ?? "",
              updatedAt: (data.updatedAt as string) ?? "",
            }
          }),
        )
      } catch {
        if (!cancelled) setFeatures([])
      } finally {
        if (!cancelled) setFeaturesLoading(false)
      }
    }

    loadFeatures()
    return () => {
      cancelled = true
    }
  }, [user?.uid, selectedProjectId, projectRefreshVersion])

  useEffect(() => {
    if (!user || !selectedProjectId) {
      setTickets([])
      setTicketsLoading(false)
      return
    }
    let cancelled = false

    async function loadTickets() {
      setTicketsLoading(true)
      try {
        const col = collection(
          db,
          "users",
          user.uid,
          "projects",
          selectedProjectId,
          "tickets",
        )
        const snap = await getDocs(query(col, orderBy("createdAt", "desc")))
        if (cancelled) return
        setTickets(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              title: (data.title as string) ?? "",
              description: (data.description as string) ?? "",
              featureId: (data.featureId as string | undefined) ?? undefined,
              status: (data.status as TicketStatus) ?? "open",
              severity: (data.severity as TicketSeverity) ?? "medium",
              assigneeName: (data.assigneeName as string | undefined) ?? undefined,
              source: (data.source as string | undefined) ?? undefined,
              screenshotUrls: Array.isArray(data.screenshotUrls)
                ? (data.screenshotUrls as string[])
                : [],
              createdAt: (data.createdAt as string) ?? "",
              updatedAt: (data.updatedAt as string) ?? "",
            }
          }),
        )
      } catch {
        if (!cancelled) setTickets([])
      } finally {
        if (!cancelled) setTicketsLoading(false)
      }
    }

    loadTickets()
    return () => {
      cancelled = true
    }
  }, [user?.uid, selectedProjectId, projectRefreshVersion])

  useEffect(() => {
    if (!user || !selectedProjectId) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const col = collection(
          db,
          "users",
          user.uid,
          "projects",
          selectedProjectId,
          "artefacts",
        )
        const q = query(col, orderBy("createdAt", "desc"))
        const snap = await getDocs(q)
        if (cancelled) return
        setArtefacts(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              title: (data.title as string) ?? "",
              projectId: selectedProjectId,
              type: (data.type as ArtefactType) ?? "Notes",
              source: (data.source as SourceType) ?? "School",
              link: (data.link as string) ?? "",
              tags:
                Array.isArray(data.tags) && data.tags.length > 0
                  ? (data.tags as string[])
                  : [],
              note: (data.note as string) ?? "",
              createdAt: (data.createdAt as string) ?? "",
              imageUrl: (data.imageUrl as string | undefined) || undefined,
            }
          }),
        )
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user?.uid, selectedProjectId])

  useEffect(() => {
    if (!selectedArtefactForVote && artefacts.length > 0) {
      setSelectedArtefactForVote(artefacts[0].id)
    }
    if (artefacts.length === 0) {
      setSelectedArtefactForVote("")
    }
  }, [artefacts, selectedArtefactForVote])

  useEffect(() => {
    if (!user || !selectedProjectId) {
      setDesignVotesLoading(false)
      return
    }
    let cancelled = false
    const designVotesRef = collection(db, "designVotes")
    getDocs(query(designVotesRef, where("userId", "==", user.uid)))
      .then((snap) => {
        if (cancelled) return
        const all = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            title: (data.title as string) ?? "",
            projectId: (data.projectId as string) ?? "",
            artefactId: (data.artefactId as string | null) ?? undefined,
            status: (data.status as string) ?? "open",
            deadline: (data.deadline as string | null) ?? undefined,
            createdAt: (data.createdAt as string) ?? "",
          }
        })
        setDesignVotes(
          all
            .filter((v) => v.projectId === selectedProjectId)
            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
        )
      })
      .catch(() => {
        if (!cancelled) setDesignVotes([])
      })
      .finally(() => {
        if (!cancelled) setDesignVotesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.uid, selectedProjectId, designVotesVersion])

  async function handleCreateProject() {
    if (!user || !projectName.trim()) return
    setProjectSaving(true)
    setError(null)
    try {
      const projectsRef = collection(db, "users", user.uid, "projects")
      const created = await addDoc(projectsRef, {
        name: projectName.trim(),
        tagline: projectTagline.trim(),
        createdAt: new Date().toISOString(),
        createdAtServer: serverTimestamp(),
      })
      setProjectName("")
      setProjectTagline("")
      setSelectedProjectId(created.id)
      setProjectRefreshVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setProjectSaving(false)
    }
  }

  async function handleCreateFeature() {
    if (!user || !selectedProjectId || !featureTitle.trim()) return
    setFeatureSaving(true)
    setError(null)
    try {
      const col = collection(
        db,
        "users",
        user.uid,
        "projects",
        selectedProjectId,
        "features",
      )
      const now = new Date().toISOString()
      await addDoc(col, {
        projectId: selectedProjectId,
        title: featureTitle.trim(),
        summary: featureSummary.trim(),
        description: "",
        status: featureStatus,
        createdAt: now,
        updatedAt: now,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      })
      setFeatureTitle("")
      setFeatureSummary("")
      setFeatureStatus("Draft")
      setProjectRefreshVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create feature")
    } finally {
      setFeatureSaving(false)
    }
  }

  async function handleCreateTicket() {
    if (!user || !selectedProjectId || !ticketTitle.trim() || !ticketDescription.trim()) return
    setTicketSaving(true)
    setError(null)
    try {
      const col = collection(
        db,
        "users",
        user.uid,
        "projects",
        selectedProjectId,
        "tickets",
      )
      const now = new Date().toISOString()
      const screenshotUrls: string[] = []

      if (ticketImageFile) {
        setTicketImageUploading(true)
        try {
          screenshotUrls.push(await uploadImage(ticketImageFile))
        } catch {
          throw new Error("Ticket screenshot upload failed. Check IMGBB_API_KEY and try again.")
        }
      }

      await addDoc(col, {
        title: ticketTitle.trim(),
        description: ticketDescription.trim(),
        featureId: ticketFeatureId !== "none" ? ticketFeatureId : null,
        status: ticketStatus,
        severity: ticketSeverity,
        assigneeName: ticketAssigneeName.trim() || null,
        source: ticketSource.trim() || null,
        screenshotUrls,
        createdAt: now,
        updatedAt: now,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      })

      setTicketTitle("")
      setTicketDescription("")
      setTicketFeatureId("none")
      setTicketStatus("open")
      setTicketSeverity("medium")
      setTicketAssigneeName("")
      setTicketSource("")
      setTicketImageFile(null)
      setTicketImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setShowNewTicketForm(false)
      setProjectRefreshVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket")
    } finally {
      setTicketImageUploading(false)
      setTicketSaving(false)
    }
  }

  async function handleSave() {
    if (!user || !selectedProjectId || !form.title || !form.type || !form.source) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const col = collection(
        db,
        "users",
        user.uid,
        "projects",
        selectedProjectId,
        "artefacts",
      )
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

      await addDoc(col, {
        title: form.title,
        projectId: selectedProjectId,
        type: form.type,
        source: form.source,
        link: form.link,
        tags: tagsArray,
        note: form.note,
        imageUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdAtServer: serverTimestamp(),
      })

      const q = query(col, orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      setArtefacts(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            title: (data.title as string) ?? "",
            projectId: selectedProjectId,
            type: (data.type as ArtefactType) ?? "Notes",
            source: (data.source as SourceType) ?? "School",
            link: (data.link as string) ?? "",
            tags:
              Array.isArray(data.tags) && data.tags.length > 0
                ? (data.tags as string[])
                : [],
            note: (data.note as string) ?? "",
            createdAt: (data.createdAt as string) ?? "",
            imageUrl: (data.imageUrl as string | undefined) || undefined,
          }
        }),
      )

      setForm(emptyForm)
      setImageFile(null)
      setImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setShowNewArtefactForm(false)
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
      if (ticketImagePreview) {
        URL.revokeObjectURL(ticketImagePreview)
      }
    }
  }, [imagePreview, ticketImagePreview])

  const renderRich = (text: string) => {
    return renderRichText(text)
  }

  const filteredTickets = useMemo(
    () =>
      ticketStatusFilter === "all"
        ? tickets
        : tickets.filter((ticket) => ticket.status === ticketStatusFilter),
    [ticketStatusFilter, tickets],
  )

  async function handleQuickTicketStatusUpdate(ticketId: string, nextStatus: TicketStatus) {
    if (!user || !selectedProjectId) return
    setError(null)
    try {
      const now = new Date().toISOString()
      await updateDoc(
        doc(db, "users", user.uid, "projects", selectedProjectId, "tickets", ticketId),
        {
          status: nextStatus,
          updatedAt: now,
          updatedAtServer: serverTimestamp(),
          verifiedAt: nextStatus === "verified" ? now : null,
        },
      )
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                status: nextStatus,
                updatedAt: now,
              }
            : ticket,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ticket status")
    }
  }

  async function handleSaveArtefactEdit(artefactId: string) {
    if (!user || !selectedProjectId) return
    setUpdatingArtefact(true)
    setError(null)
    try {
      const ref = doc(
        db,
        "users",
        user.uid,
        "projects",
        selectedProjectId,
        "artefacts",
        artefactId,
      )
      await updateDoc(ref, {
        note: editingArtefactNote,
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp(),
      })
      setArtefacts((prev) =>
        prev.map((a) =>
          a.id === artefactId ? { ...a, note: editingArtefactNote } : a,
        ),
      )
      setEditingArtefactId(null)
      setEditingArtefactNote("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update artefact note")
    } finally {
      setUpdatingArtefact(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <aside className="md:w-52 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-4 h-px bg-accent" />
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
            Projects
          </h3>
        </div>
        <nav className="flex flex-row flex-wrap md:flex-col gap-1">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setSelectedProjectId(project.id)}
              className={`text-left px-3 py-1.5 rounded-sm text-sm transition-colors ${
                selectedProjectId === project.id
                  ? "border-l-2 border-l-accent text-foreground font-medium bg-secondary"
                  : "border-l-2 border-l-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {project.name}
            </button>
          ))}
        </nav>
        <div className="mt-4 space-y-2">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="New project name"
            className="text-xs h-8"
          />
          <Input
            value={projectTagline}
            onChange={(e) => setProjectTagline(e.target.value)}
            placeholder="Tagline (optional)"
            className="text-xs h-8"
          />
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            disabled={projectSaving || !projectName.trim()}
            onClick={handleCreateProject}
          >
            {projectSaving ? "Creating…" : "Create project"}
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="mb-5">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            {selectedProject?.name ?? "Project"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            {selectedProject?.tagline || "Select or create a project."}
          </p>
        </div>

        {error && <p className="text-sm text-destructive mb-2">{error}</p>}

        <section className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Features
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3 max-w-2xl">
            Features are the new home for PRDs, grouped UI screens, version comparison,
            and external review links.
          </p>
          <div className="rounded-sm border border-border bg-card p-4 mb-3 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_180px_auto] gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="feature-title" className="text-xs text-muted-foreground">
                  Feature title
                </Label>
                <Input
                  id="feature-title"
                  value={featureTitle}
                  onChange={(e) => setFeatureTitle(e.target.value)}
                  placeholder="E.g. Candidate onboarding"
                  className="text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="feature-summary" className="text-xs text-muted-foreground">
                  Summary
                </Label>
                <Input
                  id="feature-summary"
                  value={featureSummary}
                  onChange={(e) => setFeatureSummary(e.target.value)}
                  placeholder="Short overview for reviewers"
                  className="text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={featureStatus}
                  onValueChange={(val) => setFeatureStatus(val as FeatureStatus)}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEATURE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full md:w-auto text-xs"
                  disabled={featureSaving || !featureTitle.trim()}
                  onClick={handleCreateFeature}
                >
                  {featureSaving ? "Creatingâ€¦" : "Create feature"}
                </Button>
              </div>
            </div>
          </div>

          {featuresLoading ? (
            <p className="text-sm text-muted-foreground">Loading featuresâ€¦</p>
          ) : features.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-card/50 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No features yet for this project. Create one to start the new review workflow.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {features.map((feature) => (
                <div
                  key={feature.id}
                  className="rounded-sm border-l-2 border-l-accent border border-border bg-card px-4 py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {feature.title}
                      </p>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {feature.status}
                      </span>
                    </div>
                    {feature.summary && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                        {feature.summary}
                      </p>
                    )}
                  </div>
                  <Link href={`/projects/${selectedProjectId}/features/${feature.id}`}>
                    <Button size="sm" variant="ghost" className="text-xs gap-1.5">
                      <FileStack className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Tickets
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3 max-w-2xl">
            Track bugs and issues for this project, link them to features when needed,
            assign them by name, and mark them through open, in progress, done, and verified.
          </p>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Select
              value={ticketStatusFilter}
              onValueChange={(val) => setTicketStatusFilter(val as "all" | TicketStatus)}
            >
              <SelectTrigger className="w-[180px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {TICKET_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Collapsible open={showNewTicketForm} onOpenChange={setShowNewTicketForm}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-foreground text-foreground hover:bg-foreground hover:text-background flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New ticket
                  <ChevronDown className={`h-4 w-4 transition-transform ${showNewTicketForm ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="rounded-sm border border-border bg-card p-5 mt-3 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ticket-title" className="text-xs text-muted-foreground">
                        Ticket title
                      </Label>
                      <Input
                        id="ticket-title"
                        value={ticketTitle}
                        onChange={(e) => setTicketTitle(e.target.value)}
                        placeholder="E.g. Save button fails on mobile"
                        className="text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Link to feature</Label>
                      <Select value={ticketFeatureId} onValueChange={setTicketFeatureId}>
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No feature</SelectItem>
                          {features.map((feature) => (
                            <SelectItem key={feature.id} value={feature.id}>
                              {feature.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={ticketStatus} onValueChange={(val) => setTicketStatus(val as TicketStatus)}>
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Severity</Label>
                      <Select value={ticketSeverity} onValueChange={(val) => setTicketSeverity(val as TicketSeverity)}>
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_SEVERITIES.map((severity) => (
                            <SelectItem key={severity} value={severity}>
                              {severity}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ticket-assignee" className="text-xs text-muted-foreground">
                        Assignee name
                      </Label>
                      <Input
                        id="ticket-assignee"
                        value={ticketAssigneeName}
                        onChange={(e) => setTicketAssigneeName(e.target.value)}
                        placeholder="E.g. John"
                        className="text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ticket-source" className="text-xs text-muted-foreground">
                        Source
                      </Label>
                      <Input
                        id="ticket-source"
                        value={ticketSource}
                        onChange={(e) => setTicketSource(e.target.value)}
                        placeholder="E.g. WhatsApp user test"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ticket-description" className="text-xs text-muted-foreground">
                      Description
                    </Label>
                    <Textarea
                      id="ticket-description"
                      value={ticketDescription}
                      onChange={(e) => setTicketDescription(e.target.value)}
                      placeholder="Describe what broke, how to reproduce it, and what should happen instead."
                      rows={5}
                      className="text-sm resize-y"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ticket-screenshot" className="text-xs text-muted-foreground">
                      Screenshot (optional)
                    </Label>
                    <Input
                      id="ticket-screenshot"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files ? e.target.files[0] ?? null : null
                        setTicketImageFile(file)
                        setTicketImagePreview((prev) => {
                          if (prev) URL.revokeObjectURL(prev)
                          return file ? URL.createObjectURL(file) : null
                        })
                      }}
                      className="text-sm"
                    />
                    {ticketImageFile && (
                      <p className="text-[11px] text-muted-foreground">{ticketImageFile.name}</p>
                    )}
                    {ticketImagePreview && (
                      <img
                        src={ticketImagePreview}
                        alt="Selected ticket screenshot"
                        className="mt-2 max-h-40 rounded-sm border border-border object-cover"
                      />
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full md:w-auto border-foreground text-foreground hover:bg-foreground hover:text-background"
                    disabled={!ticketTitle.trim() || !ticketDescription.trim() || ticketSaving || ticketImageUploading}
                    onClick={handleCreateTicket}
                  >
                    {ticketSaving || ticketImageUploading ? "Saving..." : "Save ticket"}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {ticketsLoading ? (
            <p className="text-sm text-muted-foreground">Loading tickets...</p>
          ) : filteredTickets.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-card/50 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No tickets yet for this project. Create one to start tracking issues.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredTickets.map((ticket) => {
                const linkedFeature = features.find((feature) => feature.id === ticket.featureId)
                return (
                  <div
                    key={ticket.id}
                    className={`rounded-sm border-l-2 border border-border px-4 py-3 flex items-start justify-between gap-3 ${
                      ticket.status === "verified"
                        ? "border-l-emerald-500 bg-emerald-50/40"
                        : ticket.status === "done"
                          ? "border-l-amber-500 bg-amber-50/30"
                          : "border-l-accent bg-card"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {ticket.title}
                        </p>
                        <Badge
                          variant={ticket.status === "verified" ? "default" : "secondary"}
                          className="text-[9px] px-1.5 py-0"
                        >
                          {ticket.status}
                        </Badge>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {ticket.severity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 max-w-2xl line-clamp-2">
                        {ticket.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {linkedFeature && (
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            Feature: {linkedFeature.title}
                          </span>
                        )}
                        {ticket.assigneeName && (
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            Assignee: {ticket.assigneeName}
                          </span>
                        )}
                        {ticket.source && (
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            Source: {ticket.source}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                      {ticket.status === "open" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => handleQuickTicketStatusUpdate(ticket.id, "in_progress")}
                        >
                          Start
                        </Button>
                      )}
                      {ticket.status === "in_progress" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => handleQuickTicketStatusUpdate(ticket.id, "done")}
                        >
                          Mark done
                        </Button>
                      )}
                      {ticket.status === "done" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => handleQuickTicketStatusUpdate(ticket.id, "verified")}
                        >
                          Verify
                        </Button>
                      )}
                      <Link href={`/projects/${selectedProjectId}/tickets/${ticket.id}`}>
                        <Button size="sm" variant="ghost" className="text-xs">
                          Open
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <Collapsible open={showNewArtefactForm} onOpenChange={setShowNewArtefactForm} className="mb-6">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-foreground text-foreground hover:bg-foreground hover:text-background flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Artefact / Idea
              <ChevronDown className={`h-4 w-4 transition-transform ${showNewArtefactForm ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
        <div className="rounded-sm border border-border bg-card p-5 mt-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-px bg-accent" />
            <h3 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
              New Artefact / Idea
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="artefact-title"
                className="text-xs text-muted-foreground"
              >
                Title
              </Label>
              <Input
                id="artefact-title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="E.g. Onboarding checklist pattern"
                className="text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select
                value={form.type}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, type: val as ArtefactType }))
                }
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Screenshot, notes, flow..." />
                </SelectTrigger>
                <SelectContent>
                  {ARTEFACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Source of Idea
              </Label>
              <Select
                value={form.source}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, source: val as SourceType }))
                }
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="School, product, customer..." />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="artefact-link"
                className="text-xs text-muted-foreground"
              >
                Link (Stitch, Figma, doc, etc.)
              </Label>
              <Input
                id="artefact-link"
                type="url"
                value={form.link}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, link: e.target.value }))
                }
                placeholder="https://..."
                className="text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="artefact-tags"
                className="text-xs text-muted-foreground"
              >
                Tags
              </Label>
              <Input
                id="artefact-tags"
                value={form.tags}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, tags: e.target.value }))
                }
                placeholder="onboarding, retention, mobile..."
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground/70">
                Comma-separated; use for quick filters when you review with
                your CTO or team.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="artefact-note"
                className="text-xs text-muted-foreground"
              >
                How you want to apply this to the project
              </Label>
              <RichTextEditor
                value={form.note}
                onChange={(note) =>
                  setForm((prev) => ({ ...prev, note }))
                }
                placeholder="Capture the UX idea or design insight, and how you want your team to implement it."
                minHeightClassName="min-h-28"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="artefact-image"
                className="text-xs text-muted-foreground"
              >
                Image (screenshots, mockups)
              </Label>
              <Input
                id="artefact-image"
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
                  alt="Selected artefact"
                  className="mt-2 max-h-40 rounded-sm border border-border object-cover"
                />
              )}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={
              !form.title || !form.type || !form.source || saving || imageUploading
            }
            variant="outline"
            className="w-full md:w-auto border-foreground text-foreground hover:bg-foreground hover:text-background"
          >
            {saving || imageUploading ? "Saving…" : "Save Artefact"}
          </Button>
        </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Design votes
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Create 3 design variations and send a link for your team to vote (pick best, rate with stars, add comments).
          </p>
          {designVotesLoading ? (
            <p className="text-sm text-muted-foreground mt-3">Loading design votes…</p>
          ) : designVotes.length > 0 ? (
            <div className="flex flex-col gap-2 mt-3">
              {designVotes.map((dv) => (
                <div
                  key={dv.id}
                  className="rounded-sm border border-border bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant={dv.status === "closed" ? "secondary" : "default"}
                      className="text-[9px] px-1.5 py-0 shrink-0"
                    >
                      {dv.status === "closed" ? "Closed" : "Open"}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {dv.title}
                      </p>
                      {dv.artefactId && (
                        <p className="text-[11px] text-muted-foreground">
                          Artefact:{" "}
                          {artefacts.find((a) => a.id === dv.artefactId)?.title ??
                            "Linked artefact"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        const url =
                          typeof window !== "undefined"
                            ? `${window.location.origin}/vote/${dv.id}`
                            : `/vote/${dv.id}`
                        navigator.clipboard.writeText(url)
                      }}
                    >
                      Copy link
                    </Button>
                    <Link href={`/vote/${dv.id}/results`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        View results
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <Collapsible open={showNewDesignVoteForm} onOpenChange={setShowNewDesignVoteForm} className="mt-3">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-foreground text-foreground hover:bg-foreground hover:text-background flex items-center gap-2 mt-3"
              >
                <Plus className="h-4 w-4" />
                New design vote
                <ChevronDown className={`h-4 w-4 transition-transform ${showNewDesignVoteForm ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mb-3 mt-3">
                <Label className="text-xs text-muted-foreground">
                  Artefact to evaluate
                </Label>
                <Select
                  value={selectedArtefactForVote}
                  onValueChange={setSelectedArtefactForVote}
                  disabled={artefacts.length === 0}
                >
                  <SelectTrigger className="w-full text-sm mt-1">
                    <SelectValue placeholder="Select an artefact" />
                  </SelectTrigger>
                  <SelectContent>
                    {artefacts.map((artefact) => (
                      <SelectItem key={artefact.id} value={artefact.id}>
                        {artefact.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DesignVoteForm
                projectId={selectedProjectId}
                artefactId={selectedArtefactForVote || undefined}
                onCreated={() => {
                  setDesignVotesVersion((v) => v + 1)
                  setShowNewDesignVoteForm(false)
                }}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading artefacts…</p>
        ) : artefacts.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No artefacts yet for this project. Click New Artefact / Idea to add one.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {artefacts.map((artefact) => (
              <div
                key={artefact.id}
                className="rounded-sm border-l-2 border-l-accent border border-border bg-card px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {artefact.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {artefact.type}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {artefact.source}
                      </span>
                      {artefact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link
                    href={`/projects/${selectedProjectId}/artefacts/${artefact.id}`}
                  >
                    <Button size="sm" variant="ghost" className="text-xs">
                      Open
                    </Button>
                  </Link>
                </div>
                {artefact.link && (
                  <div className="mt-2">
                    <p className="text-[11px] text-muted-foreground mb-0.5">
                      Link
                    </p>
                    <a
                      href={artefact.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-foreground underline decoration-accent underline-offset-2 break-all hover:decoration-foreground transition-colors"
                    >
                      {artefact.link}
                    </a>
                  </div>
                )}
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      How to apply
                    </p>
                    {artefact.note && (
                      <>
                        <MarkdownViewModal
                          content={artefact.note}
                          title={artefact.title}
                          triggerClassName="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => navigator.clipboard.writeText(richTextToPlainText(artefact.note))}
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
                        setEditingArtefactId(artefact.id)
                        setEditingArtefactNote(artefact.note || "")
                      }}
                    >
                      {artefact.note ? "Edit" : "Add"}
                    </Button>
                  </div>
                  {editingArtefactId === artefact.id ? (
                    <div className="rounded-sm border border-border bg-card p-3 space-y-2">
                      <RichTextEditor
                        value={editingArtefactNote}
                        onChange={setEditingArtefactNote}
                        placeholder="Edit note..."
                        minHeightClassName="min-h-24"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          disabled={updatingArtefact}
                          onClick={() => handleSaveArtefactEdit(artefact.id)}
                        >
                          {updatingArtefact ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setEditingArtefactId(null)
                            setEditingArtefactNote("")
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : artefact.note ? (
                    <div className="flex flex-col gap-0.5">
                      {renderRich(artefact.note)}
                    </div>
                  ) : null}
                </div>
                {artefact.imageUrl && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-[11px] text-muted-foreground">
                        Image
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          downloadImage(
                            artefact.imageUrl!,
                            `artefact-${slugify(artefact.title)}.jpg`,
                          )
                        }
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                    </div>
                    <img
                      src={artefact.imageUrl}
                      alt={artefact.title}
                      className="mt-1 max-h-48 rounded-sm border border-border object-cover"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

