"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { uploadStorageFile } from "@/lib/upload-storage-file"
import { uploadImage } from "@/lib/upload-image"
import { ImageFullScreen } from "@/components/image-fullscreen"
import { ChevronLeft, ChevronRight } from "lucide-react"

type FeatureStatus = "Draft" | "In Review" | "Ready for Review" | "Archived"
type AttachmentType = "markdown" | "file" | "link"
type ScreenSection = "A" | "B" | "C" | "D"

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

interface FeatureRecord {
  id: string
  projectId: string
  projectName: string
  title: string
  summary: string
  status: FeatureStatus
}

interface AttachmentDraft {
  id: string
  title: string
  type: AttachmentType
  content: string
  linkUrl: string
  file: File | null
}

interface ScreenDraft {
  id: string
  title: string
  description: string
  imageFile: File | null
  imagePreview: string | null
  section: ScreenSection
}

const REVIEW_SECTIONS: { id: ScreenSection; label: string; subtitle: string }[] = [
  { id: "A", label: "A", subtitle: "Start here" },
  { id: "B", label: "B", subtitle: "Next" },
  { id: "C", label: "C", subtitle: "Then" },
  { id: "D", label: "D", subtitle: "Final" },
]

function emptyAttachmentDraft(): AttachmentDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    type: "file",
    content: "",
    linkUrl: "",
    file: null,
  }
}

function emptyScreenDraft(): ScreenDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    imageFile: null,
    imagePreview: null,
    section: "A",
  }
}

export function FeaturesOverview() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [features, setFeatures] = useState<FeatureRecord[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [createStep, setCreateStep] = useState(1)
  const [createTitle, setCreateTitle] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([])
  const [screenDrafts, setScreenDrafts] = useState<ScreenDraft[]>([])
  const [activeScreenDraftId, setActiveScreenDraftId] = useState<string | null>(null)
  const [draggedScreenId, setDraggedScreenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [projectsCollapsed, setProjectsCollapsed] = useState(false)

  useEffect(() => {
    const projectParam = searchParams.get("project")
    const newParam = searchParams.get("new")
    if (projectParam) {
      setSelectedProjectId(projectParam)
    }
    if (newParam === "1") {
      setShowCreate(true)
    }
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
      DEFAULT_PROJECTS.forEach((base) => {
        if (!loadedProjects.some((project) => project.id === base.id)) {
          loadedProjects.push(base)
        }
      })

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
      if (!selectedProjectId) {
        setSelectedProjectId(loadedProjects[0]?.id ?? "")
      }
      setLoading(false)
    }

    load().catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (screenDrafts.length > 0) return
    if (showCreate) {
      const nextDraft = emptyScreenDraft()
      setScreenDrafts([nextDraft])
      setActiveScreenDraftId(nextDraft.id)
    }
  }, [screenDrafts.length, showCreate])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const selectedProjectFeatures = useMemo(
    () => features.filter((feature) => feature.projectId === selectedProjectId),
    [features, selectedProjectId],
  )

  const groupedScreenDrafts = useMemo(
    () =>
      REVIEW_SECTIONS.map((section) => ({
        ...section,
        items: screenDrafts.filter((screen) => screen.section === section.id),
      })),
    [screenDrafts],
  )

  const activeScreenDraft = useMemo(
    () => screenDrafts.find((screen) => screen.id === activeScreenDraftId) ?? screenDrafts[0] ?? null,
    [activeScreenDraftId, screenDrafts],
  )

  function resetCreateFlow() {
    setShowCreate(false)
    setCreateStep(1)
    setCreateTitle("")
    setCreateDescription("")
    setAttachmentDrafts([])
    setScreenDrafts([])
    setActiveScreenDraftId(null)
    setDraggedScreenId(null)
    setCreateError(null)
  }

  function addAttachmentDraft() {
    setAttachmentDrafts((prev) => [...prev, emptyAttachmentDraft()])
  }

  function updateAttachmentDraft(id: string, patch: Partial<AttachmentDraft>) {
    setAttachmentDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  function removeAttachmentDraft(id: string) {
    setAttachmentDrafts((prev) => prev.filter((item) => item.id !== id))
  }

  function addScreenDraft() {
    const nextDraft = emptyScreenDraft()
    setScreenDrafts((prev) => [...prev, nextDraft])
    setActiveScreenDraftId(nextDraft.id)
  }

  function updateScreenDraft(id: string, patch: Partial<ScreenDraft>) {
    setScreenDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  function removeScreenDraft(id: string) {
    const next = screenDrafts.filter((item) => item.id !== id)
    if (next.length === 0) {
      const replacement = emptyScreenDraft()
      setScreenDrafts([replacement])
      setActiveScreenDraftId(replacement.id)
      return
    }
    setScreenDrafts(next)
    if (activeScreenDraftId === id) {
      setActiveScreenDraftId(next[0].id)
    }
  }

  function moveScreenDraft(draggedId: string, targetId: string) {
    if (draggedId === targetId) return
    setScreenDrafts((prev) => {
      const draggedIndex = prev.findIndex((item) => item.id === draggedId)
      const targetIndex = prev.findIndex((item) => item.id === targetId)
      if (draggedIndex === -1 || targetIndex === -1) return prev
      const next = [...prev]
      const [dragged] = next.splice(draggedIndex, 1)
      next.splice(targetIndex, 0, dragged)
      return next
    })
  }

  function moveScreenDraftToSection(
    draggedId: string,
    targetSection: ScreenSection,
    targetId?: string,
  ) {
    setScreenDrafts((prev) => {
      const draggedIndex = prev.findIndex((item) => item.id === draggedId)
      if (draggedIndex === -1) return prev
      const next = [...prev]
      const [dragged] = next.splice(draggedIndex, 1)
      const updatedDragged = { ...dragged, section: targetSection }

      if (!targetId) {
        const sectionIndexes = next
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.section === targetSection)
        if (sectionIndexes.length === 0) {
          next.push(updatedDragged)
          return next
        }
        const insertIndex = sectionIndexes[sectionIndexes.length - 1].index + 1
        next.splice(insertIndex, 0, updatedDragged)
        return next
      }

      const targetIndex = next.findIndex((item) => item.id === targetId)
      if (targetIndex === -1) {
        next.push(updatedDragged)
        return next
      }
      next.splice(targetIndex, 0, updatedDragged)
      return next
    })
  }

  async function handleCreateFeature() {
    if (!user || !db || !selectedProjectId || !createTitle.trim()) return
    const usableScreens = screenDrafts.filter((screen) => screen.title.trim() && screen.imageFile)
    if (usableScreens.length === 0) {
      setCreateError("Add at least one screen with a title and image.")
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      const now = new Date().toISOString()
      const createdFeature = await addDoc(
        collection(db, "users", user.uid, "projects", selectedProjectId, "features"),
        {
          projectId: selectedProjectId,
          title: createTitle.trim(),
          summary: "",
          description: createDescription,
          status: "Draft",
          createdAt: now,
          updatedAt: now,
          createdAtServer: serverTimestamp(),
          updatedAtServer: serverTimestamp(),
        },
      )

      for (const draft of attachmentDrafts) {
        if (!draft.title.trim()) continue
        const baseData: Record<string, unknown> = {
          title: draft.title.trim(),
          uploadedAt: now,
          uploadedAtServer: serverTimestamp(),
        }

        if (draft.type === "markdown") {
          if (!draft.content.trim() && !draft.file) continue
          let content = draft.content
          let sourceName = ""
          if (draft.file) {
            content = await draft.file.text()
            sourceName = draft.file.name
          }
          baseData.type = "markdown"
          baseData.content = content
          if (sourceName) baseData.sourceName = sourceName
        } else if (draft.type === "link") {
          if (!draft.linkUrl.trim()) continue
          baseData.type = "link"
          baseData.linkUrl = draft.linkUrl.trim()
        } else {
          if (!draft.file) continue
          const uploaded = await uploadStorageFile(draft.file, [
            "feature-attachments",
            user.uid,
            selectedProjectId,
            createdFeature.id,
          ])
          baseData.type = draft.file.type === "application/pdf" ? "pdf" : "other"
          baseData.fileUrl = uploaded.url
          baseData.filePath = uploaded.fullPath
          baseData.mimeType = draft.file.type || undefined
          baseData.sourceName = draft.file.name
        }

        await addDoc(
          collection(
            db,
            "users",
            user.uid,
            "projects",
            selectedProjectId,
            "features",
            createdFeature.id,
            "attachments",
          ),
          baseData,
        )
      }

      for (let index = 0; index < usableScreens.length; index++) {
        const screen = usableScreens[index]
        const screenDoc = await addDoc(
          collection(
            db,
            "users",
            user.uid,
            "projects",
            selectedProjectId,
            "features",
            createdFeature.id,
            "screens",
          ),
          {
            title: screen.title.trim(),
            description: screen.description.trim(),
            section: screen.section,
            order: index + 1,
            createdAt: now,
            updatedAt: now,
            createdAtServer: serverTimestamp(),
            updatedAtServer: serverTimestamp(),
          },
        )

        const imageUrl = await uploadImage(screen.imageFile!)
        await addDoc(
          collection(
            db,
            "users",
            user.uid,
            "projects",
            selectedProjectId,
            "features",
            createdFeature.id,
            "screens",
            screenDoc.id,
            "versions",
          ),
          {
            label: "A",
            notes: "",
            imageUrl,
            order: 1,
            createdAt: now,
            createdAtServer: serverTimestamp(),
          },
        )
      }

      router.push(`/projects/${selectedProjectId}/features/${createdFeature.id}`)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create feature")
      setCreating(false)
      return
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading features...</p>
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className={`${projectsCollapsed ? "lg:w-14" : "lg:w-56"} shrink-0 transition-all`}>
        <div className="workspace-panel p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {!projectsCollapsed && <p className="workspace-section-label px-2">Projects</p>}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0"
              onClick={() => setProjectsCollapsed((prev) => !prev)}
            >
              {projectsCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  setSelectedProjectId(project.id)
                  setCreateError(null)
                }}
                className={`rounded-sm ${projectsCollapsed ? "px-2 py-3 text-center text-xs" : "px-3 py-2 text-left text-sm"} transition-colors ${
                  selectedProjectId === project.id
                    ? "bg-secondary text-foreground border border-border font-medium"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground border border-transparent"
                }`}
                title={project.name}
              >
                {projectsCollapsed ? project.name.charAt(0) : project.name}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {!selectedProject ? (
          <div className="workspace-panel p-8 text-center">
            <p className="text-sm text-muted-foreground">Select a project to start.</p>
          </div>
        ) : showCreate ? (
          <div className="workspace-panel p-8 md:p-10 space-y-8 min-h-[70vh]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="workspace-section-label">{selectedProject.name}</p>
                <p className="text-3xl font-medium text-foreground mt-2">Create feature</p>
                <p className="text-base text-muted-foreground mt-2 max-w-2xl leading-7">
                  One decision at a time. Add the basics, add the UI, then set the order your team should review.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={resetCreateFlow}>
                Cancel
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { step: 1, label: "Basics" },
                { step: 2, label: "Screens" },
                { step: 3, label: "Order and save" },
              ].map((item) => (
                <div
                  key={item.step}
                  className={`rounded-sm border-2 px-4 py-3 text-base ${
                    createStep === item.step
                      ? "border-accent bg-secondary text-foreground"
                      : "border-border/90 bg-card text-muted-foreground"
                  }`}
                >
                  {item.step}. {item.label}
                </div>
              ))}
            </div>

            {createError && <p className="text-sm text-destructive">{createError}</p>}

            {createStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="feature-title" className="text-xs text-muted-foreground">
                        Name of the feature
                      </Label>
                      <Input
                        id="feature-title"
                        value={createTitle}
                        onChange={(e) => setCreateTitle(e.target.value)}
                        placeholder="E.g. Candidate onboarding"
                        className="h-14 rounded-[1.75rem] px-6 text-base"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="feature-description" className="text-xs text-muted-foreground">
                        What should the team understand?
                      </Label>
                      <Textarea
                        id="feature-description"
                        value={createDescription}
                        onChange={(e) => setCreateDescription(e.target.value)}
                        placeholder="Describe the goal and any context the reviewer needs before looking at the UI."
                        rows={6}
                        className="text-sm resize-y"
                      />
                    </div>
                  </div>

                  <div className="workspace-panel-soft p-4 space-y-4">
                    <div>
                      <p className="workspace-section-label">Docs and specs</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Optional. Add a PRD, markdown, PDF, or link only if the team needs more context.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {attachmentDrafts.map((draft) => (
                        <div key={draft.id} className="workspace-panel p-3 space-y-3">
                          <Input
                            value={draft.title}
                            onChange={(e) => updateAttachmentDraft(draft.id, { title: e.target.value })}
                            placeholder="Attachment title"
                            className="text-sm"
                          />
                          <Select
                            value={draft.type}
                            onValueChange={(value) =>
                              updateAttachmentDraft(draft.id, {
                                type: value as AttachmentType,
                                content: "",
                                linkUrl: "",
                                file: null,
                              })
                            }
                          >
                            <SelectTrigger className="w-full text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="file">File upload</SelectItem>
                              <SelectItem value="markdown">Markdown</SelectItem>
                              <SelectItem value="link">Link</SelectItem>
                            </SelectContent>
                          </Select>
                          {draft.type === "markdown" ? (
                            <div className="space-y-2">
                              <Textarea
                                value={draft.content}
                                onChange={(e) => updateAttachmentDraft(draft.id, { content: e.target.value })}
                                placeholder="Paste markdown or upload a .md file below"
                                rows={4}
                                className="text-sm resize-y"
                              />
                              <Input
                                type="file"
                                accept=".md,text/markdown"
                                onChange={(e) =>
                                  updateAttachmentDraft(draft.id, {
                                    file: e.target.files ? e.target.files[0] ?? null : null,
                                  })
                                }
                                className="text-sm"
                              />
                            </div>
                          ) : draft.type === "link" ? (
                            <Input
                              value={draft.linkUrl}
                              onChange={(e) => updateAttachmentDraft(draft.id, { linkUrl: e.target.value })}
                              placeholder="https://..."
                              className="text-sm"
                            />
                          ) : (
                            <Input
                              type="file"
                              accept=".pdf,.doc,.docx,.txt,.md"
                              onChange={(e) =>
                                updateAttachmentDraft(draft.id, {
                                  file: e.target.files ? e.target.files[0] ?? null : null,
                                })
                              }
                              className="text-sm"
                            />
                          )}
                          <div className="flex justify-end">
                            <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => removeAttachmentDraft(draft.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={addAttachmentDraft}>
                      Add document or link
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full px-6 text-xs"
                    disabled={!createTitle.trim()}
                    onClick={() => setCreateStep(2)}
                  >
                    Continue to screens
                  </Button>
                </div>
              </div>
            )}

            {createStep === 2 && (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-foreground">Work on one UI at a time.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Give it a name, a short note, and upload the image.
                  </p>
                </div>
                {activeScreenDraft && (
                  <div className="workspace-panel p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="workspace-section-label">
                        Screen {screenDrafts.findIndex((screen) => screen.id === activeScreenDraft.id) + 1}
                      </p>
                      {screenDrafts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => removeScreenDraft(activeScreenDraft.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">UI name</Label>
                          <Input
                            value={activeScreenDraft.title}
                            onChange={(e) => updateScreenDraft(activeScreenDraft.id, { title: e.target.value })}
                            placeholder="E.g. Home dashboard"
                            className="h-12 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">What should they notice?</Label>
                          <Textarea
                            value={activeScreenDraft.description}
                            onChange={(e) =>
                              updateScreenDraft(activeScreenDraft.id, { description: e.target.value })
                            }
                            placeholder="Point the reviewer to what matters on this screen."
                            rows={4}
                            className="text-sm resize-y"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Upload image</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files ? e.target.files[0] ?? null : null
                              updateScreenDraft(activeScreenDraft.id, {
                                imageFile: file,
                                imagePreview: file ? URL.createObjectURL(file) : null,
                              })
                            }}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <div className="workspace-panel-soft p-3 flex items-center justify-center min-h-[280px] border-2">
                        {activeScreenDraft.imagePreview ? (
                          <ImageFullScreen
                            src={activeScreenDraft.imagePreview}
                            alt={activeScreenDraft.title || "Screen preview"}
                          >
                            <img
                              src={activeScreenDraft.imagePreview}
                              alt={activeScreenDraft.title || "Screen preview"}
                              className="max-h-[260px] w-auto rounded-sm object-contain cursor-zoom-in"
                            />
                          </ImageFullScreen>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center">
                            Upload an image to preview it here.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="workspace-panel-soft p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="workspace-section-label">Added images</p>
                    <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={addScreenDraft}>
                      Add another image
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {screenDrafts.map((screen, index) => {
                      const isActive = screen.id === activeScreenDraft?.id
                      return (
                        <button
                          key={screen.id}
                          type="button"
                          onClick={() => setActiveScreenDraftId(screen.id)}
                          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                            isActive
                              ? "border-foreground bg-secondary text-foreground"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {screen.title.trim() || `Screen ${index + 1}`}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setCreateStep(1)}>
                      Back
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-full px-6 text-xs" onClick={() => setCreateStep(3)}>
                      Continue to order
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {createStep === 3 && (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-foreground">Set the review order.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Drag the UI cards into sections `A` to `D`. This becomes the exact order your team sees.
                  </p>
                </div>

                <div className="workspace-panel-soft p-5 md:p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {groupedScreenDrafts.map((section) => (
                      <div
                        key={section.id}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (draggedScreenId) {
                            moveScreenDraftToSection(draggedScreenId, section.id)
                          }
                          setDraggedScreenId(null)
                        }}
                        className="workspace-panel min-h-[460px] p-4 space-y-3 border-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="workspace-section-label">Section {section.label}</p>
                            <p className="text-sm text-muted-foreground mt-1">{section.subtitle}</p>
                          </div>
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            {section.items.length}
                          </span>
                        </div>

                        {section.items.length === 0 ? (
                          <div className="h-[360px] rounded-sm border border-dashed border-border flex items-center justify-center p-4 text-center">
                            <p className="text-sm text-muted-foreground">
                              Drop images here to place them in section {section.label}.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {section.items.map((screen) => {
                              const absoluteOrder = screenDrafts.findIndex((item) => item.id === screen.id) + 1
                              return (
                                <div
                                  key={screen.id}
                                  draggable
                                  onDragStart={() => setDraggedScreenId(screen.id)}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={() => {
                                    if (draggedScreenId) {
                                      moveScreenDraftToSection(draggedScreenId, section.id, screen.id)
                                    }
                                    setDraggedScreenId(null)
                                  }}
                                  className="workspace-panel-soft border-2 border-accent p-3 space-y-3 cursor-move"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-foreground">Order {absoluteOrder}</p>
                                    <Select
                                      value={screen.section}
                                      onValueChange={(value) =>
                                        updateScreenDraft(screen.id, { section: value as ScreenSection })
                                      }
                                    >
                                      <SelectTrigger className="h-8 w-[84px] text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {REVIEW_SECTIONS.map((item) => (
                                          <SelectItem key={item.id} value={item.id}>
                                            {item.id}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="workspace-panel p-3 min-h-[180px] flex items-center justify-center border-2">
                                    {screen.imagePreview ? (
                                      <ImageFullScreen
                                        src={screen.imagePreview}
                                        alt={screen.title || "Screen preview"}
                                      >
                                        <img
                                          src={screen.imagePreview}
                                          alt={screen.title || "Screen preview"}
                                          className="max-h-[160px] w-auto rounded-sm object-contain cursor-zoom-in"
                                        />
                                      </ImageFullScreen>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No image yet</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-base font-medium text-foreground">
                                      {screen.title || "Untitled screen"}
                                    </p>
                                    {screen.description && (
                                      <p className="text-sm text-muted-foreground mt-1 leading-6">
                                        {screen.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="workspace-panel-soft p-4">
                  <p className="text-sm text-foreground">
                    {screenDrafts.filter((screen) => screen.imageFile).length} UI image
                    {screenDrafts.filter((screen) => screen.imageFile).length === 1 ? "" : "s"} ready.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Save this feature when the section order feels right. You can still send it for review and fine-tune later inside the feature workspace.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setCreateStep(2)}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full px-6 text-xs"
                    disabled={creating}
                    onClick={handleCreateFeature}
                  >
                    {creating ? "Saving feature..." : "Save feature and open workspace"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="workspace-panel p-8 md:p-10 min-h-[70vh] flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <p className="workspace-section-label">{selectedProject.name}</p>
                <p className="text-3xl font-medium text-foreground mt-3">
                  Build and send features from one wide workspace.
                </p>
                {selectedProject.tagline && (
                  <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
                    {selectedProject.tagline}
                  </p>
                )}
              </div>

              <div className="rounded-[2rem] border-2 border-foreground/90 p-10 text-center min-h-[280px] flex items-center justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="rounded-full px-10 py-7 text-base"
                  onClick={() => {
                    setShowCreate(true)
                    setCreateStep(1)
                    setCreateError(null)
                  }}
                >
                  Create a feature
                </Button>
              </div>
            </div>

            <div className="space-y-3 mt-8">
              <div className="flex items-center justify-between gap-3">
                <p className="workspace-section-label">Existing features</p>
                <span className="text-xs text-muted-foreground">
                  {selectedProjectFeatures.length} feature{selectedProjectFeatures.length === 1 ? "" : "s"}
                </span>
              </div>
              {selectedProjectFeatures.length === 0 ? (
                <div className="workspace-panel-soft p-4">
                  <p className="text-sm text-muted-foreground">
                    No features yet for this project. Start with the button above.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {selectedProjectFeatures.map((feature) => (
                    <Link key={feature.id} href={`/projects/${feature.projectId}/features/${feature.id}`}>
                      <div className="workspace-panel-soft h-full p-4 space-y-2 hover:bg-secondary/35 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{feature.title}</p>
                          <span className="text-[11px] text-muted-foreground">{feature.status}</span>
                        </div>
                        {feature.summary && (
                          <p className="text-xs text-muted-foreground">{feature.summary}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
