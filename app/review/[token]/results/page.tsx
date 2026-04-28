"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore"
import {
  FeatureImageAnnotationEditor,
  type ReviewAnnotation,
} from "@/components/feature-image-annotation-editor"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MarkdownViewModal } from "@/components/markdown-view-modal"
import { db } from "@/lib/firebase"
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
  userId: string
  projectId: string
  featureId: string
  title: string
  status?: "open" | "closed"
  createdAt?: string
  deadline?: string
  payload?: FeatureReviewPayload
}

interface ScreenReviewState {
  screenId: string
  selectedVersionId: string
  selectionReason: string
  generalComment: string
  annotations: ReviewAnnotation[]
}

interface FeatureReviewSubmission {
  id: string
  reviewerName: string
  reviewerEmail?: string | null
  submittedAt: string
  screenReviews: ScreenReviewState[]
}

export default function FeatureReviewResultsPage() {
  const params = useParams()
  const token = typeof params.token === "string" ? params.token : ""
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [review, setReview] = useState<FeatureReviewDoc | null>(null)
  const [submissions, setSubmissions] = useState<FeatureReviewSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError("Invalid review link")
      return
    }
    if (authLoading) return
    if (!user) {
      router.replace("/login")
      return
    }

    let cancelled = false

    async function load() {
      try {
        const reviewSnap = await getDoc(doc(db, "featureReviews", token))
        if (cancelled) return
        if (!reviewSnap.exists()) {
          setError("Review not found")
          setLoading(false)
          return
        }

        const data = reviewSnap.data() as FeatureReviewDoc
        if (data.userId !== user.uid) {
          setError("You do not have access to these results.")
          setLoading(false)
          return
        }
        setReview(data)

        const submissionsRef = collection(db, "featureReviewSubmissions", token, "submissions")
        const submissionsSnap = await getDocs(submissionsRef)
        if (cancelled) return
        const list = submissionsSnap.docs.map((submissionDoc) => {
          const submissionData = submissionDoc.data()
          return {
            id: submissionDoc.id,
            reviewerName: (submissionData.reviewerName as string) ?? "Anonymous",
            reviewerEmail: (submissionData.reviewerEmail as string | null | undefined) ?? null,
            submittedAt: (submissionData.submittedAt as string) ?? "",
            screenReviews: ((submissionData.screenReviews as ScreenReviewState[] | undefined) ?? []).map(
              (screenReview) => ({
                screenId: screenReview.screenId,
                selectedVersionId: screenReview.selectedVersionId ?? "",
                selectionReason: screenReview.selectionReason ?? "",
                generalComment: screenReview.generalComment ?? "",
                annotations: screenReview.annotations ?? [],
              }),
            ),
          } satisfies FeatureReviewSubmission
        })
        list.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))
        setSubmissions(list)
      } catch {
        if (!cancelled) setError("Failed to load review results")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, router, token, user])

  async function handleToggleStatus() {
    if (!review || !token) return
    const nextStatus = review.status === "closed" ? "open" : "closed"
    setSavingStatus(true)
    try {
      await updateDoc(doc(db, "featureReviews", token), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      })
      setReview((prev) => (prev ? { ...prev, status: nextStatus } : prev))
    } finally {
      setSavingStatus(false)
    }
  }

  const reviewUrl = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/review/${token}` : `/review/${token}`),
    [token],
  )

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) return null

  if (error || !review?.payload) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">{error ?? "Results not found"}</p>
          <Link href="/">
            <Button variant="outline" size="sm">
              Back to projects
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const payload = review.payload

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Feature review results
            </h1>
            <p className="text-sm text-foreground mt-1">{payload.title}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link href={`/projects/${review.projectId}/features/${review.featureId}`}>
              <Button variant="outline" size="sm" className="text-xs">
                Open feature workspace
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-xs">
                Back to projects
              </Button>
            </Link>
          </div>
        </div>
        <div className="h-px bg-accent" />
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <section className="rounded-sm border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={review.status === "closed" ? "secondary" : "default"}
                className="text-[10px]"
              >
                {review.status === "closed" ? "Closed" : "Open"}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {submissions.length} submission{submissions.length === 1 ? "" : "s"}
              </span>
              {review.createdAt && (
                <span className="text-[11px] text-muted-foreground">
                  Created {new Date(review.createdAt).toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => navigator.clipboard.writeText(reviewUrl)}
              >
                Copy public link
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={savingStatus}
                onClick={handleToggleStatus}
              >
                {savingStatus
                  ? "Saving..."
                  : review.status === "closed"
                    ? "Reopen review"
                    : "Close review"}
              </Button>
            </div>
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
        </section>

        <section className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Attachments
            </h2>
          </div>
          {payload.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attachments were included.</p>
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

        <section className="space-y-4">
          {payload.screens.map((screen) => (
            <ScreenResultsSection
              key={screen.id}
              screen={screen}
              submissions={submissions}
            />
          ))}
        </section>
      </main>
    </div>
  )
}

function ScreenResultsSection({
  screen,
  submissions,
}: {
  screen: FeatureScreen
  submissions: FeatureReviewSubmission[]
}) {
  const screenSubmissions = submissions
    .map((submission) => ({
      submission,
      review: submission.screenReviews.find((item) => item.screenId === screen.id),
    }))
    .filter(
      (item): item is { submission: FeatureReviewSubmission; review: ScreenReviewState } =>
        Boolean(item.review),
    )

  const favoriteCounts = screen.versions.map((version) => ({
    versionId: version.id,
    label: version.label,
    count: screenSubmissions.filter((item) => item.review.selectedVersionId === version.id).length,
  }))

  return (
    <section className="rounded-sm border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-foreground">{screen.title}</p>
          {screen.description && (
            <p className="text-xs text-muted-foreground mt-1">{screen.description}</p>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {screenSubmissions.length} reviewer{screenSubmissions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {favoriteCounts.map((item) => (
          <div
            key={item.versionId}
            className="rounded-sm border border-border bg-secondary/20 px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">Version {item.label}</p>
            <p className="text-lg font-medium text-foreground mt-1">{item.count}</p>
            <p className="text-[11px] text-muted-foreground">favorite selections</p>
          </div>
        ))}
      </div>

      {screenSubmissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback for this screen yet.</p>
      ) : (
        <div className="space-y-4">
          {screenSubmissions.map(({ submission, review }) => {
            const selectedVersion = screen.versions.find(
              (version) => version.id === review.selectedVersionId,
            )
            const annotatedVersionIds = Array.from(
              new Set(review.annotations.map((annotation) => annotation.versionId).filter(Boolean)),
            )
            const versionIdsToShow = Array.from(
              new Set([
                ...(selectedVersion ? [selectedVersion.id] : []),
                ...annotatedVersionIds,
              ]),
            )
            const versionsToShow =
              versionIdsToShow.length > 0
                ? screen.versions.filter((version) => versionIdsToShow.includes(version.id))
                : selectedVersion
                  ? [selectedVersion]
                  : []

            return (
              <div
                key={submission.id}
                className="rounded-sm border border-border bg-secondary/20 p-4 space-y-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-foreground">{submission.reviewerName}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {submission.reviewerEmail && (
                        <span className="text-[11px] text-muted-foreground">
                          {submission.reviewerEmail}
                        </span>
                      )}
                      {submission.submittedAt && (
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(submission.submittedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedVersion && (
                    <Badge variant="secondary" className="text-[10px]">
                      Favorite: {selectedVersion.label}
                    </Badge>
                  )}
                </div>

                {(review.selectionReason || review.generalComment) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                        Why this version
                      </p>
                      <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                        {review.selectionReason || "No rationale provided."}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                        General comments
                      </p>
                      <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                        {review.generalComment || "No general comments provided."}
                      </p>
                    </div>
                  </div>
                )}

                {versionsToShow.length > 0 ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {versionsToShow.map((version) => {
                      const versionAnnotations = review.annotations.filter(
                        (annotation) => annotation.versionId === version.id,
                      )
                      return (
                        <div
                          key={version.id}
                          className="rounded-sm border border-border bg-card p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              Version {version.label}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {versionAnnotations.length} annotation
                              {versionAnnotations.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <FeatureImageAnnotationEditor
                            imageUrl={version.imageUrl}
                            alt={`${screen.title} version ${version.label}`}
                            versionId={version.id}
                            annotations={review.annotations}
                            disabled={true}
                            onChange={() => {}}
                          />
                          {version.notes && (
                            <p className="text-xs text-muted-foreground">{version.notes}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No version image was referenced in this submission.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
