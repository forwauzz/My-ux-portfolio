"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { collection, getDocs, orderBy, query } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
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

  useEffect(() => {
    const projectParam = searchParams.get("project")
    const statusParam = searchParams.get("status")
    setProjectFilter(projectParam || "all")
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
          const featureTitleById = new Map(
            featureSnap.docs.map((featureDoc) => [
              featureDoc.id,
              ((featureDoc.data().title as string | undefined) ?? featureDoc.id),
            ]),
          )
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
      </div>

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
