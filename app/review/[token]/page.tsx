"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { addDoc, collection, doc, getDoc } from "firebase/firestore"
import {
  FeatureImageAnnotationEditor,
  type ReviewAnnotation,
} from "@/components/feature-image-annotation-editor"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownViewModal } from "@/components/markdown-view-modal"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Link as LinkIcon, Paperclip } from "lucide-react"

type FeatureAttachmentType = "markdown" | "pdf" | "link" | "image" | "other"

interface FeatureAttachment {
  id: string
  title: string
  type: FeatureAttachmentType
  content?: string
  fileUrl?: string
  sourceName?: string
  linkUrl?: string
}

interface FeatureScreenVersion {
  id: string
  label: string
  imageUrl: string
  notes: string
  order: number
}

interface FeatureScreen {
  id: string
  title: string
  description: string
  order: number
  versions: FeatureScreenVersion[]
}

interface FeatureReviewPayload {
  featureId: string
  projectId: string
  title: string
  summary: string
  description: string
  attachments: FeatureAttachment[]
  screens: FeatureScreen[]
}

interface FeatureReviewDoc {
  title: string
  status?: "open" | "closed"
  payload?: FeatureReviewPayload
}

interface ScreenReviewState {
  screenId: string
  selectedVersionId: string
  selectionReason: string
  generalComment: string
  annotations: ReviewAnnotation[]
}

function emptyScreenReview(screenId: string, selectedVersionId = ""): ScreenReviewState {
  return {
    screenId,
    selectedVersionId,
    selectionReason: "",
    generalComment: "",
    annotations: [],
  }
}

function createInitialScreenReview(screen: FeatureScreen): ScreenReviewState {
  const defaultVersionId = screen.versions.length === 1 ? screen.versions[0]?.id ?? "" : ""
  return emptyScreenReview(screen.id, defaultVersionId)
}

export default function FeatureReviewPage() {
  const params = useParams()
  const token = typeof params.token === "string" ? params.token : ""
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [review, setReview] = useState<FeatureReviewDoc | null>(null)
  const [reviewerName, setReviewerName] = useState("")
  const [reviewerEmail, setReviewerEmail] = useState("")
  const [screenReviews, setScreenReviews] = useState<ScreenReviewState[]>([])
  const [activeScreenIndex, setActiveScreenIndex] = useState(0)
  const [activeVersionIds, setActiveVersionIds] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError("Invalid review link")
      return
    }
    getDoc(doc(db, "featureReviews", token))
      .then((snap) => {
        if (!snap.exists()) {
          setError("Review link not found or expired")
          return
        }
        setReview(snap.data() as FeatureReviewDoc)
      })
      .catch(() => setError("Failed to load review"))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!review?.payload || !token) return
    const draftKey = `feature_review_draft_${token}`
    const submittedKey = `feature_review_submitted_${token}`
    try {
      const submittedValue = localStorage.getItem(submittedKey)
      if (submittedValue === "1") {
        setSubmitted(true)
      }
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          reviewerName?: string
          reviewerEmail?: string
          screenReviews?: ScreenReviewState[]
          activeScreenIndex?: number
          activeVersionIds?: Record<string, string>
        }
        setReviewerName(parsed.reviewerName ?? "")
        setReviewerEmail(parsed.reviewerEmail ?? "")
        setScreenReviews(
          review.payload.screens.map((screen) => {
            const existing = parsed.screenReviews?.find((item) => item.screenId === screen.id)
            return {
              ...createInitialScreenReview(screen),
              ...existing,
              annotations: existing?.annotations ?? [],
            }
          }),
        )
        setActiveScreenIndex(
          Math.min(
            Math.max(parsed.activeScreenIndex ?? 0, 0),
            Math.max(review.payload.screens.length - 1, 0),
          ),
        )
        setActiveVersionIds(
          review.payload.screens.reduce<Record<string, string>>((acc, screen) => {
            const existing = parsed.screenReviews?.find((item) => item.screenId === screen.id)
            acc[screen.id] =
              parsed.activeVersionIds?.[screen.id] ??
              existing?.selectedVersionId ??
              screen.versions[0]?.id ??
              ""
            return acc
          }, {}),
        )
        return
      }
    } catch {
      // ignore local draft parsing issues
    }
    setScreenReviews(review.payload.screens.map((screen) => createInitialScreenReview(screen)))
    setActiveVersionIds(
      review.payload.screens.reduce<Record<string, string>>((acc, screen) => {
        acc[screen.id] = screen.versions[0]?.id ?? ""
        return acc
      }, {}),
    )
    setActiveScreenIndex(0)
  }, [review?.payload, token])

  useEffect(() => {
    if (!review?.payload || !token || submitted) return
    const draftKey = `feature_review_draft_${token}`
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          reviewerName,
          reviewerEmail,
          screenReviews,
          activeScreenIndex,
          activeVersionIds,
        }),
      )
    } catch {
      // ignore local persistence failures
    }
  }, [activeScreenIndex, activeVersionIds, reviewerEmail, reviewerName, review?.payload, screenReviews, submitted, token])

  function updateScreenReview(screenId: string, patch: Partial<ScreenReviewState>) {
    setScreenReviews((prev) =>
      prev.map((item) => (item.screenId === screenId ? { ...item, ...patch } : item)),
    )
  }

  function validateScreen(screen: FeatureScreen, screenReview: ScreenReviewState) {
    if (screen.versions.length > 1 && !screenReview.selectedVersionId) {
      setError(`Choose a version for "${screen.title}" before moving on.`)
      return false
    }
    return true
  }

  function handleNextScreen() {
    if (!review?.payload) return
    const currentScreen = review.payload.screens[activeScreenIndex]
    const currentReview =
      screenReviews.find((item) => item.screenId === currentScreen.id) ??
      createInitialScreenReview(currentScreen)
    if (!validateScreen(currentScreen, currentReview)) return
    setError(null)
    setActiveScreenIndex((prev) => Math.min(prev + 1, review.payload.screens.length - 1))
  }

  function handlePreviousScreen() {
    setError(null)
    setActiveScreenIndex((prev) => Math.max(prev - 1, 0))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!review?.payload || !token || !reviewerName.trim()) return

    const invalidScreen = review.payload.screens.find((screen) => {
      const screenReview =
        screenReviews.find((item) => item.screenId === screen.id) ?? createInitialScreenReview(screen)
      return screen.versions.length > 1 && !screenReview.selectedVersionId
    })

    if (invalidScreen) {
      setError(`Choose a version for "${invalidScreen.title}" before submitting.`)
      setActiveScreenIndex(review.payload.screens.findIndex((screen) => screen.id === invalidScreen.id))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await addDoc(collection(db, "featureReviewSubmissions", token, "submissions"), {
        reviewerName: reviewerName.trim(),
        reviewerEmail: reviewerEmail.trim() || null,
        screenReviews,
        submittedAt: new Date().toISOString(),
      })
      setSubmitted(true)
      try {
        localStorage.setItem(`feature_review_submitted_${token}`, "1")
        localStorage.removeItem(`feature_review_draft_${token}`)
      } catch {
        // ignore local storage failures
      }
    } catch {
      setError("Failed to submit review. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const payload = review?.payload
  const isClosed = review?.status === "closed"
  const screens = payload?.screens ?? []
  const currentScreen = screens[activeScreenIndex]
  const currentReview =
    currentScreen
      ? screenReviews.find((item) => item.screenId === currentScreen.id) ??
        createInitialScreenReview(currentScreen)
      : null
  const currentVersion = currentScreen
    ? currentScreen.versions.find((version) => version.id === activeVersionIds[currentScreen.id]) ??
      currentScreen.versions[0]
    : null
  const progressLabel =
    currentScreen && screens.length > 0 ? `${activeScreenIndex + 1} of ${screens.length}` : "0 of 0"
  const completionCount = screens.filter((screen) => {
    const item = screenReviews.find((reviewItem) => reviewItem.screenId === screen.id)
    return screen.versions.length === 1 || Boolean(item?.selectedVersionId)
  }).length

  const attachmentPreview = useMemo(() => (payload?.attachments ?? []).slice(0, 4), [payload?.attachments])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error && !payload) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-destructive">Nothing to review.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border">
          <div className="mx-auto max-w-3xl px-6 py-4">
            <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Review submitted
            </h1>
          </div>
          <div className="h-px bg-accent" />
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10 space-y-4">
          <p className="text-sm font-medium text-foreground">
            Thanks, {reviewerName || "reviewer"}. Your feedback was recorded.
          </p>
          <p className="text-sm text-muted-foreground">You can close this page.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="mx-auto max-w-[1700px] px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Feature review
            </h1>
            <p className="text-base md:text-lg font-medium text-foreground mt-1 truncate">
              {payload.title}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-muted-foreground">{completionCount}/{screens.length} ready</span>
            {isClosed && (
              <span className="text-xs font-medium text-destructive uppercase">
                Closed
              </span>
            )}
          </div>
        </div>
        <div className="h-px bg-accent" />
      </header>

      <main className="mx-auto max-w-[1700px] px-4 md:px-6 py-6 md:py-8 space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {isClosed ? (
          <section className="rounded-sm border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              This review is closed. New submissions are not being accepted.
            </p>
          </section>
        ) : (
          <section className="rounded-sm border border-border bg-card p-4 md:p-5 space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)] gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-px bg-accent" />
                  <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
                    Review context
                  </h2>
                </div>
                {payload.summary && <p className="text-sm text-foreground">{payload.summary}</p>}
                {payload.description && (
                  <MarkdownViewModal
                    content={payload.description}
                    title={`${payload.title} description`}
                    trigger={
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Open full description
                      </span>
                    }
                    triggerClassName="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                  />
                )}
                {attachmentPreview.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachmentPreview.map((attachment) => (
                      <AttachmentAction key={attachment.id} attachment={attachment} />
                    ))}
                  </div>
                )}
                <div className="rounded-sm border border-border bg-secondary/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    What to do
                  </p>
                  <div className="mt-2 space-y-1.5 text-sm text-foreground">
                    <p>1. Review the screen shown below.</p>
                    <p>2. Add short notes on the image or in the feedback panel.</p>
                    <p>3. Click next and continue until you submit.</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reviewer-name" className="text-xs text-muted-foreground">
                    Your name
                  </Label>
                  <Input
                    id="reviewer-name"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="Name"
                    className="text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reviewer-email" className="text-xs text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="reviewer-email"
                    type="email"
                    value={reviewerEmail}
                    onChange={(e) => setReviewerEmail(e.target.value)}
                    placeholder="Optional"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {screens.length === 0 || !currentScreen || !currentReview || !currentVersion ? (
          <section className="rounded-sm border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">No screens in this review yet.</p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="rounded-sm border border-border bg-card p-4 md:p-5 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    Screen {progressLabel}
                  </p>
                  <h2 className="text-xl md:text-2xl font-medium text-foreground mt-1">
                    {currentScreen.title}
                  </h2>
                  {currentScreen.description && (
                    <p className="text-base text-muted-foreground mt-2 max-w-4xl">
                      {currentScreen.description}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    Current view
                  </p>
                  <p className="text-sm text-foreground mt-1">Version {currentVersion.label}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,8.8fr)_380px] gap-4 items-start">
                <div className="rounded-sm border border-border bg-secondary/20 p-3 md:p-4 space-y-3">
                  <FeatureImageAnnotationEditor
                    imageUrl={currentVersion.imageUrl}
                    alt={`${currentScreen.title} version ${currentVersion.label}`}
                    versionId={currentVersion.id}
                    annotations={currentReview.annotations}
                    disabled={isClosed}
                    onChange={(annotations) =>
                      updateScreenReview(currentScreen.id, { annotations })
                    }
                  />
                  {currentVersion.notes && (
                    <p className="text-xs text-muted-foreground">{currentVersion.notes}</p>
                  )}
                </div>

                <aside className="rounded-sm border border-border bg-secondary/20 p-4 space-y-4 xl:sticky xl:top-4">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                      Your feedback
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Keep this lightweight. Leave a few direct notes, then move to the next screen.
                    </p>
                  </div>

                  {currentScreen.versions.length > 1 && !isClosed && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Which version works best?
                      </Label>
                      <div className="flex flex-col gap-2">
                        {currentScreen.versions.map((version) => (
                          <button
                            key={version.id}
                            type="button"
                            className={`rounded-sm border px-3 py-2 text-left text-sm ${
                              currentReview.selectedVersionId === version.id
                                ? "border-accent bg-background"
                                : "border-border bg-card"
                            }`}
                            onClick={() =>
                              updateScreenReview(currentScreen.id, {
                                selectedVersionId: version.id,
                              })
                            }
                          >
                            Version {version.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentScreen.versions.length > 1 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Viewing</Label>
                      <div className="flex flex-wrap gap-2">
                        {currentScreen.versions.map((version) => (
                          <button
                            key={version.id}
                            type="button"
                            className={`rounded-sm border px-2.5 py-1.5 text-xs ${
                              currentVersion.id === version.id
                                ? "border-accent bg-background text-foreground"
                                : "border-border bg-card text-muted-foreground"
                            }`}
                            onClick={() =>
                              setActiveVersionIds((prev) => ({
                                ...prev,
                                [currentScreen.id]: version.id,
                              }))
                            }
                          >
                            {version.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isClosed && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Why this works
                        </Label>
                        <Textarea
                          value={currentReview.selectionReason}
                          onChange={(e) =>
                            updateScreenReview(currentScreen.id, {
                              selectionReason: e.target.value,
                            })
                          }
                          placeholder="Short reasoning"
                          rows={5}
                          className="text-sm resize-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Extra notes
                        </Label>
                        <Textarea
                          value={currentReview.generalComment}
                          onChange={(e) =>
                            updateScreenReview(currentScreen.id, {
                              generalComment: e.target.value,
                            })
                          }
                          placeholder="Anything else?"
                          rows={5}
                          className="text-sm resize-none"
                        />
                      </div>
                    </>
                  )}
                </aside>
              </div>
            </section>

            <section className="rounded-sm border border-border bg-card px-4 py-3 md:px-5 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-[11px] text-muted-foreground">
                Draft changes stay in this browser until you submit.
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  disabled={activeScreenIndex === 0}
                  onClick={handlePreviousScreen}
                >
                  Previous
                </Button>
                {activeScreenIndex < screens.length - 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs border-foreground text-foreground hover:bg-foreground hover:text-background"
                    disabled={!reviewerName.trim() || isClosed}
                    onClick={handleNextScreen}
                  >
                    Next screen
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="outline"
                    className="text-xs border-foreground text-foreground hover:bg-foreground hover:text-background"
                    disabled={!reviewerName.trim() || submitting || isClosed}
                  >
                    {submitting ? "Submitting..." : "Submit review"}
                  </Button>
                )}
              </div>
            </section>
          </form>
        )}
      </main>
    </div>
  )
}

function AttachmentAction({ attachment }: { attachment: FeatureAttachment }) {
  if (attachment.type === "markdown" && attachment.content) {
    return (
      <MarkdownViewModal
        content={attachment.content}
        title={attachment.title}
        trigger={
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {attachment.title}
          </span>
        }
        triggerClassName="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
      />
    )
  }

  if (attachment.type === "link" && attachment.linkUrl) {
    return (
      <a
        href={attachment.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border bg-card px-3 text-xs text-muted-foreground hover:text-foreground"
      >
        <LinkIcon className="h-3.5 w-3.5" />
        {attachment.title}
      </a>
    )
  }

  if (attachment.fileUrl) {
    return (
      <a
        href={attachment.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border bg-card px-3 text-xs text-muted-foreground hover:text-foreground"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {attachment.title}
      </a>
    )
  }

  return null
}
