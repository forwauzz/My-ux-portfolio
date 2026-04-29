"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

type TicketStatus = "open" | "in_progress" | "done" | "verified"
type TicketSeverity = "low" | "medium" | "high"

const DEFAULT_PROJECTS = [
  {
    id: "alie",
    name: "ALIE",
    tagline: "Applied learning, insights, and experiments for ALIE.",
  },
  {
    id: "vision",
    name: "VISION",
    tagline: "Longer-horizon product bets and vision work.",
  },
] as const

interface ProjectRecord {
  id: string
  name: string
  tagline?: string
}

interface TicketRecord {
  id: string
  projectId: string
  projectName: string
  title: string
  description: string
  status: TicketStatus
  severity: TicketSeverity
  assigneeName?: string
  featureId?: string
  featureTitle?: string
}

export function TicketsOverview() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [projectFilter, setProjectFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all")
  const [showCreate, setShowCreate] = useState(false)
  const [createProjectId, setCreateProjectId] = useState("")
  const [createTitle, setCreateTitle] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [createStatus, setCreateStatus] = useState<TicketStatus>("open")
  const [createSeverity, setCreateSeverity] = useState<TicketSeverity>("medium")
  const [createAssigneeName, setCreateAssigneeName] = useState("")
  const [createFeatureId, setCreateFeatureId] = useState("none")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [projectFeatures, setProjectFeatures] = useState<Record<string, { id: string; title: string }[]>>({})

  useEffect(() => {
    const projectParam = searchParams.get("project")
    const statusParam = searchParams.get("status")
    const newParam = searchParams.get("new")
    setProjectFilter(projectParam || "all")
    setShowCreate(newParam === "1")
    if (
      statusParam === "open" ||
      statusParam === "in_progress" ||
      statusParam === "done" ||
      statusParam === "verified"
    ) {
      setStatusFilter(statusParam)
      return
    }
    setStatusFilter("all")
  }, [searchParams])

  useEffect(() => {
    if (createProjectId) return
    if (projectFilter !== "all") {
      setCreateProjectId(projectFilter)
      return
    }
    if (projects.length === 1) {
      setCreateProjectId(projects[0].id)
    }
  }, [createProjectId, projectFilter, projects])

  useEffect(() => {
    if (!user || !db) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      const projectSnap = await getDocs(
        query(collection(db, "users", user.uid, "projects"), orderBy("createdAt", "asc")),
      )
      const loadedProjects = projectSnap.docs.map((docItem) => ({
        id: docItem.id,
        name: (docItem.data().name as string) ?? docItem.id,
        tagline: (docItem.data().tagline as string | undefined) ?? undefined,
      }))
      DEFAULT_PROJECTS.forEach((base) => {
        if (!loadedProjects.some((project) => project.id === base.id)) {
          loadedProjects.push(base)
        }
      })

      const featureEntries: [string, { id: string; title: string }[]][] = []
      const ticketResults = await Promise.all(
        loadedProjects.map(async (project) => {
          const [ticketSnap, featureSnap] = await Promise.all([
            getDocs(
              query(
                collection(db, "users", user.uid, "projects", project.id, "tickets"),
                orderBy("createdAt", "desc"),
              ),
            ),
            getDocs(
              query(
                collection(db, "users", user.uid, "projects", project.id, "features"),
                orderBy("createdAt", "desc"),
              ),
            ),
          ])
          const featureOptions = featureSnap.docs.map((featureDoc) => ({
            id: featureDoc.id,
            title: ((featureDoc.data().title as string | undefined) ?? featureDoc.id),
          }))
          const featureTitleById = new Map(
            featureOptions.map((feature) => [feature.id, feature.title]),
          )
          featureEntries.push([project.id, featureOptions])
          return ticketSnap.docs.map((ticketDoc) => {
            const data = ticketDoc.data()
            const featureId = (data.featureId as string | undefined) ?? undefined
            return {
              id: ticketDoc.id,
              projectId: project.id,
              projectName: project.name,
              title: (data.title as string) ?? "",
              description: (data.description as string) ?? "",
              status: (data.status as TicketStatus) ?? "open",
              severity: (data.severity as TicketSeverity) ?? "medium",
              assigneeName: (data.assigneeName as string | undefined) ?? undefined,
              featureId,
              featureTitle: featureId ? featureTitleById.get(featureId) : undefined,
            } satisfies TicketRecord
          })
        }),
      )

      if (cancelled) return
      setProjects(loadedProjects)
      setProjectFeatures(Object.fromEntries(featureEntries))
      setTickets(ticketResults.flat())
      setLoading(false)
    }

    load().catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (projectFilter !== "all" && ticket.projectId !== projectFilter) return false
        if (statusFilter !== "all" && ticket.status !== statusFilter) return false
        return true
      }),
    [tickets, projectFilter, statusFilter],
  )

  const groupedTickets = useMemo(
    () =>
      projects
        .map((project) => ({
          project,
          items: filteredTickets.filter((ticket) => ticket.projectId === project.id),
        }))
        .filter((group) => group.items.length > 0),
    [filteredTickets, projects],
  )

  async function handleCreateTicket() {
    if (!user || !db || !createProjectId || !createTitle.trim() || !createDescription.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const now = new Date().toISOString()
      const created = await addDoc(
        collection(db, "users", user.uid, "projects", createProjectId, "tickets"),
        {
          title: createTitle.trim(),
          description: createDescription.trim(),
          featureId: createFeatureId !== "none" ? createFeatureId : null,
          status: createStatus,
          severity: createSeverity,
          assigneeName: createAssigneeName.trim() || null,
          source: null,
          screenshotUrls: [],
          createdAt: now,
          updatedAt: now,
          createdAtServer: serverTimestamp(),
          updatedAtServer: serverTimestamp(),
        },
      )
      setCreateTitle("")
      setCreateDescription("")
      setCreateStatus("open")
      setCreateSeverity("medium")
      setCreateAssigneeName("")
      setCreateFeatureId("none")
      setShowCreate(false)
      window.location.href = `/projects/${createProjectId}/tickets/${created.id}`
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create ticket")
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading tickets...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[200px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as "all" | TicketStatus)}>
          <SelectTrigger className="w-[200px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">open</SelectItem>
            <SelectItem value="in_progress">in_progress</SelectItem>
            <SelectItem value="done">done</SelectItem>
            <SelectItem value="verified">verified</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={showCreate ? "secondary" : "outline"}
          size="sm"
          className="text-xs"
          onClick={() => {
            setShowCreate((prev) => !prev)
            setCreateError(null)
          }}
        >
          {showCreate ? "Hide create" : "New ticket"}
        </Button>
      </div>

      {showCreate && (
        <div className="workspace-panel p-4 space-y-4">
          <div>
            <p className="workspace-section-label">Create ticket</p>
            <p className="text-sm text-foreground mt-1">
              Pick the project, capture the issue, and open the ticket detail page.
            </p>
          </div>
          {createError && <p className="text-sm text-destructive">{createError}</p>}
          <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_180px_180px] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Project</Label>
              <Select
                value={createProjectId}
                onValueChange={(value) => {
                  setCreateProjectId(value)
                  setCreateFeatureId("none")
                }}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-ticket-title" className="text-xs text-muted-foreground">
                Title
              </Label>
              <Input
                id="create-ticket-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="E.g. Save button fails on mobile"
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={createStatus} onValueChange={(val) => setCreateStatus(val as TicketStatus)}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">open</SelectItem>
                  <SelectItem value="in_progress">in_progress</SelectItem>
                  <SelectItem value="done">done</SelectItem>
                  <SelectItem value="verified">verified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Severity</Label>
              <Select value={createSeverity} onValueChange={(val) => setCreateSeverity(val as TicketSeverity)}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">low</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="high">high</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Feature</Label>
              <Select value={createFeatureId} onValueChange={setCreateFeatureId}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No feature</SelectItem>
                  {(projectFeatures[createProjectId] ?? []).map((feature) => (
                    <SelectItem key={feature.id} value={feature.id}>
                      {feature.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-ticket-assignee" className="text-xs text-muted-foreground">
                Assignee
              </Label>
              <Input
                id="create-ticket-assignee"
                value={createAssigneeName}
                onChange={(e) => setCreateAssigneeName(e.target.value)}
                placeholder="Optional"
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-ticket-description" className="text-xs text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="create-ticket-description"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Describe what broke and what should happen instead."
              rows={4}
              className="text-sm resize-y"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={creating || !createProjectId || !createTitle.trim() || !createDescription.trim()}
            onClick={handleCreateTicket}
          >
            {creating ? "Creating..." : "Create and open ticket"}
          </Button>
        </div>
      )}

      <div className="workspace-stat">
        <p className="text-sm text-foreground">
          {filteredTickets.length} ticket{filteredTickets.length === 1 ? "" : "s"}
          {groupedTickets.length > 0 ? ` across ${groupedTickets.length} project${groupedTickets.length === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="workspace-panel rounded-sm border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No tickets match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTickets.map(({ project, items }) => (
            <section key={project.id} className="workspace-panel p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="workspace-section-label">{project.name}</p>
                  {project.tagline && (
                    <p className="text-sm text-foreground mt-1">{project.tagline}</p>
                  )}
                </div>
                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  {items.length} ticket{items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((ticket) => (
                  <div
                    key={`${ticket.projectId}-${ticket.id}`}
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
                        <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                        <Badge variant={ticket.status === "verified" ? "default" : "secondary"} className="text-[9px] px-1.5 py-0">
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
                        {ticket.featureTitle && (
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            Feature: {ticket.featureTitle}
                          </span>
                        )}
                        {ticket.assigneeName && (
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            Assignee: {ticket.assigneeName}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href={`/projects/${ticket.projectId}/tickets/${ticket.id}`}>
                      <Button size="sm" variant="ghost" className="text-xs">
                        Open
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
