"use client"

import { useEffect, useState } from "react"
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

type FeatureAttachmentType = "markdown" | "pdf" | "link" | "other"

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
        return
      }
    } catch {
      // ignore local draft parsing issues
    }
    setScreenReviews(review.payload.screens.map((screen) => createInitialScreenReview(screen)))
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
        }),
      )
    } catch {
      // ignore local persistence failures
    }
  }, [reviewerName, reviewerEmail, screenReviews, review?.payload, token, submitted])

  function updateScreenReview(
    screenId: string,
    patch: Partial<ScreenReviewState>,
  ) {
    setScreenReviews((prev) =>
      prev.map((item) =>
        item.screenId === screenId ? { ...item, ...patch } : item,
      ),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!review?.payload || !token || !reviewerName.trim()) return
    const multiVersionScreens = review.payload.screens.filter((screen) => screen.versions.length > 1)
    const missingChoice = multiVersionScreens.find((screen) => {
      const screenReview = screenReviews.find((item) => item.screenId === screen.id)
      return !screenReview?.selectedVersionId
    })
    if (missingChoice) {
      setError(`Choose a favorite version for "${missingChoice.title}".`)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await addDoc(
        collection(db, "featureReviewSubmissions", token, "submissions"),
        {
          reviewerName: reviewerName.trim(),
          reviewerEmail: reviewerEmail.trim() || null,
          screenReviews,
          submittedAt: new Date().toISOString(),
        },
      )
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error || !review?.payload) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-destructive">{error ?? "Nothing to review"}</p>
      </div>
    )
  }

  const payload = review.payload
  const isClosed = review.status === "closed"

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
          <p className="text-sm text-muted-foreground">
            You can close this page.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Feature review
            </h1>
            <p className="text-sm text-foreground mt-1">{payload.title}</p>
          </div>
          {isClosed && (
            <span className="text-xs font-medium text-destructive uppercase">
              Closed
            </span>
          )}
        </div>
        <div className="h-px bg-accent" />
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {isClosed ? (
          <section className="rounded-sm border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              This review is closed. New submissions are not being accepted.
            </p>
          </section>
        ) : (
          <section className="rounded-sm border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-px bg-accent" />
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
                Reviewer details
              </h2>
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
                  Email (optional)
                </Label>
                <Input
                  id="reviewer-email"
                  type="email"
                  value={reviewerEmail}
                  onChange={(e) => setReviewerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="text-sm"
                />
              </div>
            </div>
          </section>
        )}

        <section className="rounded-sm border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Feature summary
            </h2>
          </div>
          {payload.summary && (
            <p className="text-sm text-foreground">{payload.summary}</p>
          )}
          {payload.description && (
            <div className="flex items-center gap-2">
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
            </div>
          )}
        </section>

        <section className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Attachments
            </h2>
          </div>
          {payload.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attachments attached to this review.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {payload.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="rounded-sm border border-border bg-secondary/20 px-4 py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{attachment.title}</p>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {attachment.type}
                      </span>
                    </div>
                    {attachment.sourceName && (
                      <p className="text-[11px] text-muted-foreground mt-1">{attachment.sourceName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {attachment.type === "markdown" && attachment.content ? (
                      <MarkdownViewModal
                        content={attachment.content}
                        title={attachment.title}
                        trigger={
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            View
                          </span>
                        }
                        triggerClassName="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                      />
                    ) : attachment.type === "link" && attachment.linkUrl ? (
                      <a
                        href={attachment.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        Open
                      </a>
                    ) : attachment.fileUrl ? (
                      <a
                        href={attachment.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        Open file
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Screens
            </h2>
          </div>
          {payload.screens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No screens in this review yet.</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {payload.screens.map((screen) => (
                <section
                  key={screen.id}
                  className="rounded-sm border border-border bg-secondary/20 p-4 space-y-4"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{screen.title}</p>
                    {screen.description && (
                      <p className="text-xs text-muted-foreground mt-1">{screen.description}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {screen.versions.map((version) => {
                      const currentReview =
                        screenReviews.find((item) => item.screenId === screen.id) ??
                        createInitialScreenReview(screen)
                      return (
                      <label
                        key={version.id}
                        className={`rounded-sm border bg-card p-3 space-y-2 cursor-pointer ${
                          currentReview.selectedVersionId === version.id
                            ? "border-accent ring-1 ring-accent/30"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            Version {version.label}
                          </span>
                          {screen.versions.length > 1 && !isClosed && (
                            <input
                              type="radio"
                              name={`screen-${screen.id}-favorite`}
                              checked={currentReview.selectedVersionId === version.id}
                              onChange={() =>
                                updateScreenReview(screen.id, { selectedVersionId: version.id })
                              }
                              className="accent-accent h-3.5 w-3.5"
                            />
                          )}
                        </div>
                        <FeatureImageAnnotationEditor
                          imageUrl={version.imageUrl}
                          alt={`${screen.title} version ${version.label}`}
                          versionId={version.id}
                          annotations={currentReview.annotations}
                          disabled={isClosed}
                          onChange={(annotations) =>
                            updateScreenReview(screen.id, { annotations })
                          }
                        />
                        {version.notes && (
                          <p className="text-xs text-muted-foreground">{version.notes}</p>
                        )}
                      </label>
                    )})}
                  </div>
                  {!isClosed && (
                    <div className="space-y-3">
                      <p className="text-[11px] text-muted-foreground">
                        Add pins, boxes, arrows, or text directly on any version, then capture
                        your written feedback below.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Why this version?
                        </Label>
                        <Textarea
                          value={
                            screenReviews.find((item) => item.screenId === screen.id)
                              ?.selectionReason ?? ""
                          }
                          onChange={(e) =>
                            updateScreenReview(screen.id, {
                              selectionReason: e.target.value,
                            })
                          }
                          placeholder="Explain why this version works best..."
                          rows={4}
                          className="text-sm resize-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">
                          General comments
                        </Label>
                        <Textarea
                          value={
                            screenReviews.find((item) => item.screenId === screen.id)
                              ?.generalComment ?? ""
                          }
                          onChange={(e) =>
                            updateScreenReview(screen.id, {
                              generalComment: e.target.value,
                            })
                          }
                          placeholder="Additional feedback for this screen..."
                          rows={4}
                          className="text-sm resize-none"
                        />
                      </div>
                    </div>
                    </div>
                  )}
                </section>
              ))}
              {!isClosed && payload.screens.length > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="outline"
                    className="text-xs border-foreground text-foreground hover:bg-foreground hover:text-background"
                    disabled={!reviewerName.trim() || submitting}
                  >
                    {submitting ? "Submitting..." : "Submit review"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Draft changes are saved in this browser until you submit.
                  </p>
                </div>
              )}
            </form>
          )}
        </section>
      </main>
    </div>
  )
}
