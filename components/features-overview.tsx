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

type FeatureStatus = "Draft" | "In Review" | "Ready for Review" | "Archived"

interface ProjectRecord {
  id: string
  name: string
  tagline?: string
}

interface FeatureRecord {
  id: string
  projectId: string
  projectName: string
  title: string
  summary: string
  status: FeatureStatus
}

export function FeaturesOverview() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [features, setFeatures] = useState<FeatureRecord[]>([])
  const [projectFilter, setProjectFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<"all" | FeatureStatus>("all")

  useEffect(() => {
    const projectParam = searchParams.get("project")
    const statusParam = searchParams.get("status")
    setProjectFilter(projectParam || "all")
    if (
      statusParam === "Draft" ||
      statusParam === "In Review" ||
      statusParam === "Ready for Review" ||
      statusParam === "Archived"
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

      const featureResults = await Promise.all(
        loadedProjects.map(async (project) => {
          const featureSnap = await getDocs(
            query(
              collection(db, "users", user.uid, "projects", project.id, "features"),
              orderBy("createdAt", "desc"),
            ),
          )
          return featureSnap.docs.map((featureDoc) => {
            const data = featureDoc.data()
            return {
              id: featureDoc.id,
              projectId: project.id,
              projectName: project.name,
              title: (data.title as string) ?? "",
              summary: (data.summary as string) ?? "",
              status: (data.status as FeatureStatus) ?? "Draft",
            } satisfies FeatureRecord
          })
        }),
      )

      if (cancelled) return
      setProjects(loadedProjects)
      setFeatures(featureResults.flat())
      setLoading(false)
    }

    load().catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const filteredFeatures = useMemo(
    () =>
      features.filter((feature) => {
        if (projectFilter !== "all" && feature.projectId !== projectFilter) return false
        if (statusFilter !== "all" && feature.status !== statusFilter) return false
        return true
      }),
    [features, projectFilter, statusFilter],
  )

  const groupedFeatures = useMemo(
    () =>
      projects
        .map((project) => ({
          project,
          items: filteredFeatures.filter((feature) => feature.projectId === project.id),
        }))
        .filter((group) => group.items.length > 0),
    [filteredFeatures, projects],
  )

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading features...</p>
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
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as "all" | FeatureStatus)}>
          <SelectTrigger className="w-[200px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="In Review">In Review</SelectItem>
            <SelectItem value="Ready for Review">Ready for Review</SelectItem>
            <SelectItem value="Archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="workspace-stat">
        <p className="text-sm text-foreground">
          {filteredFeatures.length} feature{filteredFeatures.length === 1 ? "" : "s"}
          {groupedFeatures.length > 0 ? ` across ${groupedFeatures.length} project${groupedFeatures.length === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      {filteredFeatures.length === 0 ? (
        <div className="workspace-panel rounded-sm border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No features match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedFeatures.map(({ project, items }) => (
            <section key={project.id} className="workspace-panel p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="workspace-section-label">{project.name}</p>
                  {project.tagline && (
                    <p className="text-sm text-foreground mt-1">{project.tagline}</p>
                  )}
                </div>
                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  {items.length} feature{items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((feature) => (
                  <div
                    key={`${feature.projectId}-${feature.id}`}
                    className="workspace-panel-soft border-l-2 border-l-accent px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{feature.title}</p>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {feature.status}
                        </span>
                      </div>
                      {feature.summary && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{feature.summary}</p>
                      )}
                    </div>
                    <Link href={`/projects/${feature.projectId}/features/${feature.id}`}>
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
