"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { doc, getDoc, collection, addDoc, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StarRating } from "@/components/star-rating"
import { MarkdownViewModal } from "@/components/markdown-view-modal"
import { ComparisonView } from "@/components/comparison-view"

interface DesignVoteDoc {
  userId: string
  projectId: string
  title: string
  variations: { imageUrl: string; description?: string; label?: string }[]
  createdAt: string
  status?: "open" | "closed"
  deadline?: string
  showResultsToVoters?: boolean
}

interface AggregatedResults {
  pickCounts: number[]
  starAverages: number[]
  totalResponses: number
}

export default function VotePage() {
  const params = useParams()
  const token = typeof params.token === "string" ? params.token : ""
  const [vote, setVote] = useState<DesignVoteDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voterName, setVoterName] = useState("")
  const [chosenIndex, setChosenIndex] = useState<string>("")
  const [starRatings, setStarRatings] = useState<number[]>([])
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [aggregated, setAggregated] = useState<AggregatedResults | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError("Invalid link")
      return
    }
    getDoc(doc(db, "designVotes", token))
      .then((snap) => {
        if (!snap.exists()) {
          setError("Link not found or expired")
          return
        }
        const data = snap.data() as DesignVoteDoc
        setVote(data)
        setStarRatings(new Array(data.variations.length).fill(0))
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !voterName.trim()) return
    setSubmitting(true)
    try {
      const responsesRef = collection(db, "designVoteResponses", token, "responses")
      const payload: {
        voterName: string
        chosenIndex?: number
        starRatings?: number[]
        comment?: string
        createdAt: string
      } = {
        voterName: voterName.trim(),
        createdAt: new Date().toISOString(),
      }
      if (chosenIndex !== "") {
        payload.chosenIndex = Number(chosenIndex)
      }
      if (starRatings.some((s) => s > 0)) {
        payload.starRatings = starRatings
      }
      const trimmedComment = comment.trim()
      if (trimmedComment) {
        payload.comment = trimmedComment
      }
      await addDoc(responsesRef, payload)
      setSubmitted(true)
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`vote_${token}`, "1")
        } catch {
          // ignore
        }
      }
      if (vote?.showResultsToVoters) {
        try {
          const snap = await getDocs(
            collection(db, "designVoteResponses", token, "responses"),
          )
          const varCount = vote.variations.length
          const picks = new Array(varCount).fill(0)
          const starSums = new Array(varCount).fill(0)
          const starCounts = new Array(varCount).fill(0)
          snap.docs.forEach((d) => {
            const data = d.data()
            if (typeof data.chosenIndex === "number" && data.chosenIndex < varCount) {
              picks[data.chosenIndex]++
            }
            const ratings = data.starRatings as number[] | undefined
            if (ratings) {
              for (let vi = 0; vi < varCount; vi++) {
                if (ratings[vi] && ratings[vi] > 0) {
                  starSums[vi] += ratings[vi]
                  starCounts[vi]++
                }
              }
            }
          })
          setAggregated({
            pickCounts: picks,
            starAverages: starSums.map((s, i) =>
              starCounts[i] > 0 ? s / starCounts[i] : 0,
            ),
            totalResponses: snap.size,
          })
        } catch {
          // If rules block this read, silently skip
        }
      }
    } catch {
      setError("Failed to submit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (error || !vote) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-destructive">{error ?? "Nothing to show"}</p>
      </div>
    )
  }

  if (submitted) {
    const pickedLabel =
      chosenIndex !== "" && vote
        ? vote.variations[Number(chosenIndex)]?.label?.trim() ||
          `Variation ${Number(chosenIndex) + 1}`
        : null
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border">
          <div className="mx-auto max-w-2xl px-6 py-4">
            <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Vote submitted
            </h1>
          </div>
          <div className="h-px bg-accent" />
        </header>
        <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              Thanks, {voterName}! Your vote was recorded.
            </p>
            {pickedLabel && (
              <p className="text-xs text-muted-foreground">
                You picked: <strong className="text-foreground">{pickedLabel}</strong>
              </p>
            )}
          </div>

          {aggregated && vote && (
            <div className="rounded-sm border border-border bg-card p-4 space-y-3">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
                Results so far ({aggregated.totalResponses} response
                {aggregated.totalResponses !== 1 ? "s" : ""})
              </p>
              <div className="space-y-2">
                {vote.variations.map((v, i) => {
                  const label = v.label?.trim() || `Variation ${i + 1}`
                  const picks = aggregated.pickCounts[i]
                  const maxP = Math.max(...aggregated.pickCounts)
                  const pct =
                    aggregated.totalResponses > 0
                      ? Math.round((picks / aggregated.totalResponses) * 100)
                      : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                          {label}
                          {picks === maxP && maxP > 0 && (
                            <span className="text-accent ml-1.5 text-[10px] uppercase">
                              Leading
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {picks} pick{picks !== 1 ? "s" : ""} ({pct}%)
                          {aggregated.starAverages[i] > 0 &&
                            ` · ${aggregated.starAverages[i].toFixed(1)}★`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            You can close this page.
          </p>
        </main>
      </div>
    )
  }

  const alreadyVoted =
    typeof window !== "undefined" && localStorage.getItem(`vote_${token}`)

  const isClosed = vote.status === "closed"
  const isExpired = vote.deadline
    ? new Date(vote.deadline + "T23:59:59").getTime() < Date.now()
    : false
  const votingDisabled = isClosed || isExpired

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Design vote
          </h1>
          {votingDisabled && (
            <span className="text-xs font-medium text-destructive uppercase">
              {isClosed ? "Closed" : "Expired"}
            </span>
          )}
          {!votingDisabled && vote.deadline && (
            <span className="text-[11px] text-muted-foreground">
              Closes {new Date(vote.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="h-px bg-accent" />
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="text-sm font-medium text-foreground mb-6">{vote.title}</h2>

        {votingDisabled ? (
          <>
            <div className="mb-8">
              <ComparisonView
                variations={vote.variations.map((v, i) => ({
                  imageUrl: v.imageUrl,
                  label: v.label?.trim() || `Variation ${i + 1}`,
                }))}
                renderBelow={(i) => {
                  const v = vote.variations[i]
                  if (!v?.description) return null
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MarkdownViewModal
                        content={v.description}
                        title={`${v.label?.trim() || `Variation ${i + 1}`} description`}
                        triggerClassName="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                      />
                      <span>View description</span>
                    </div>
                  )
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This vote is {isClosed ? "closed" : "past its deadline"}. No more submissions accepted.
            </p>
          </>
        ) : alreadyVoted ? (
          <p className="text-sm text-muted-foreground">
            You have already voted. You can close this page.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col gap-1.5 max-w-xs">
              <Label htmlFor="voter-name" className="text-xs text-muted-foreground">
                Your name (required)
              </Label>
              <Input
                id="voter-name"
                value={voterName}
                onChange={(e) => setVoterName(e.target.value)}
                placeholder="Name"
                required
                className="text-sm"
              />
            </div>

            <ComparisonView
              variations={vote.variations.map((v, i) => ({
                imageUrl: v.imageUrl,
                label: v.label?.trim() || `Variation ${i + 1}`,
              }))}
              renderBelow={(i) => {
                const v = vote.variations[i]
                const label = v.label?.trim() || `Variation ${i + 1}`
                return (
                  <div className="space-y-3 pt-1">
                    {v.description && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MarkdownViewModal
                          content={v.description}
                          title={`${label} description`}
                          triggerClassName="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                        />
                        <span>View description</span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 rounded-sm border border-border/50 bg-muted/10 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="pick-best"
                          id={`pick-${i}`}
                          value={String(i)}
                          checked={chosenIndex === String(i)}
                          onChange={() => setChosenIndex(String(i))}
                          className="accent-accent h-3.5 w-3.5"
                        />
                        <Label htmlFor={`pick-${i}`} className="text-xs cursor-pointer text-muted-foreground">
                          Pick as best
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Rate:</span>
                        <StarRating
                          value={starRatings[i] ?? 0}
                          onChange={(val) =>
                            setStarRatings((prev) => {
                              const next = [...prev]
                              next[i] = val
                              return next
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )
              }}
            />

            <div className="max-w-xl space-y-6">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="comment" className="text-xs text-muted-foreground">
                  Overall comment (optional)
                </Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Any feedback for the team..."
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={!voterName.trim() || submitting}
                variant="outline"
                className="border-foreground text-foreground hover:bg-foreground hover:text-background"
              >
                {submitting ? "Submitting…" : "Submit vote"}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
