"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { DesignVoteResults, type DesignVoteResponse } from "@/components/design-vote-results"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface DesignVoteDoc {
  userId: string
  projectId: string
  artefactId?: string | null
  versionId?: string | null
  title: string
  variations: { imageUrl: string; description?: string; label?: string }[]
  createdAt: string
  status?: "open" | "closed"
  deadline?: string
}

export default function VoteResultsPage() {
  const params = useParams()
  const token = typeof params.token === "string" ? params.token : ""
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [vote, setVote] = useState<DesignVoteDoc | null>(null)
  const [responses, setResponses] = useState<DesignVoteResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function handleToggleStatus() {
    if (!vote || !token) return
    const next = vote.status === "closed" ? "open" : "closed"
    await updateDoc(doc(db, "designVotes", token), {
      status: next,
      updatedAt: new Date().toISOString(),
    })
    setVote((prev) => (prev ? { ...prev, status: next } : prev))
  }

  async function handleSaveDescription(index: number, value: string) {
    if (!vote || !token) return
    const nextVariations = vote.variations.map((variation, i) =>
      i === index ? { ...variation, description: value } : variation,
    )
    await updateDoc(doc(db, "designVotes", token), {
      variations: nextVariations,
      updatedAt: new Date().toISOString(),
    })
    setVote((prev) => (prev ? { ...prev, variations: nextVariations } : prev))
  }

  async function handleSaveLabel(index: number, value: string) {
    if (!vote || !token) return
    const nextVariations = vote.variations.map((variation, i) =>
      i === index ? { ...variation, label: value.trim() } : variation,
    )
    await updateDoc(doc(db, "designVotes", token), {
      variations: nextVariations,
      updatedAt: new Date().toISOString(),
    })
    setVote((prev) => (prev ? { ...prev, variations: nextVariations } : prev))
  }

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError("Invalid link")
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
        const voteSnap = await getDoc(doc(db, "designVotes", token))
        if (cancelled) return
        if (!voteSnap.exists()) {
          setError("Vote not found")
          setLoading(false)
          return
        }
        const data = voteSnap.data() as DesignVoteDoc
        if (data.userId !== user.uid) {
          setError("You don’t have access to these results.")
          setLoading(false)
          return
        }
        setVote(data)

        const responsesRef = collection(db, "designVoteResponses", token, "responses")
        const responsesSnap = await getDocs(responsesRef)
        if (cancelled) return
        const list = responsesSnap.docs.map((d) => ({
          id: d.id,
          voterName: (d.data().voterName as string) ?? "",
          chosenIndex: d.data().chosenIndex as number | undefined,
          starRatings: d.data().starRatings as number[] | undefined,
          comment: d.data().comment as string | undefined,
          createdAt: (d.data().createdAt as string) ?? "",
        }))
        list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        setResponses(list)
      } catch {
        if (!cancelled) setError("Failed to load results")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token, user, authLoading, router])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!user) return null

  if (error || !vote) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">{error ?? "Not found"}</p>
          <Link href="/">
            <Button variant="outline" size="sm">
              Back to portfolio
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Design vote – results
          </h1>
          <div className="flex items-center gap-2">
            {vote.artefactId ? (
              <Link href={`/projects/${vote.projectId}/artefacts/${vote.artefactId}`}>
                <Button variant="outline" size="sm" className="text-xs">
                  Open artefact workflow
                </Button>
              </Link>
            ) : null}
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-xs">
                Back to portfolio
              </Button>
            </Link>
          </div>
        </div>
        <div className="h-px bg-accent" />
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge
              variant={vote.status === "closed" ? "secondary" : "default"}
              className="text-[10px]"
            >
              {vote.status === "closed" ? "Closed" : "Open"}
            </Badge>
            {vote.deadline && (
              <span className="text-[11px] text-muted-foreground">
                Deadline: {new Date(vote.deadline).toLocaleDateString()}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {responses.length} response{responses.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={handleToggleStatus}
          >
            {vote.status === "closed" ? "Reopen vote" : "Close vote"}
          </Button>
        </div>
        <DesignVoteResults
          title={vote.title}
          variations={vote.variations}
          responses={responses}
          editableDescriptions={true}
          onSaveDescription={handleSaveDescription}
          onSaveLabel={handleSaveLabel}
        />
      </main>
    </div>
  )
}
