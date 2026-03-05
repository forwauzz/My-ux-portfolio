"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { DesignVoteForm } from "@/components/design-vote-form"
import { ChevronDown, Plus } from "lucide-react"
import { renderRichText } from "@/lib/render-rich"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ArtefactDoc {
  title: string
  note?: string
  imageUrl?: string
  createdAt?: string
  updatedAt?: string
  type?: string
  source?: string
  link?: string
  tags?: string[]
  state?: "draft" | "in_review" | "finalized"
  winnerVersionId?: string | null
}

interface ArtefactVersion {
  id: string
  versionNumber: number
  title: string
  markdown?: string
  imageUrl?: string
  status: "active" | "archived" | "winner"
  basedOnVersionId?: string
  createdAt: string
}

interface VoteListItem {
  id: string
  title: string
  createdAt: string
  versionId?: string
}

export default function ArtefactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const projectId = typeof params.projectId === "string" ? params.projectId : ""
  const artefactId = typeof params.artefactId === "string" ? params.artefactId : ""

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [artefact, setArtefact] = useState<ArtefactDoc | null>(null)
  const [versions, setVersions] = useState<ArtefactVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string>("")
  const [votes, setVotes] = useState<VoteListItem[]>([])
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [versionActionLoading, setVersionActionLoading] = useState(false)
  const [showNewDesignVoteForm, setShowNewDesignVoteForm] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (!projectId || !artefactId) {
      setError("Invalid artefact route")
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const artefactRef = doc(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "artefacts",
          artefactId,
        )
        const artefactSnap = await getDoc(artefactRef)
        if (cancelled) return
        if (!artefactSnap.exists()) {
          setError("Artefact not found")
          setLoading(false)
          return
        }
        const artefactData = artefactSnap.data() as ArtefactDoc
        setArtefact(artefactData)

        const versionRef = collection(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "artefacts",
          artefactId,
          "versions",
        )
        const versionSnap = await getDocs(query(versionRef, orderBy("versionNumber", "desc")))
        if (cancelled) return
        const versionItems: ArtefactVersion[] = versionSnap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            versionNumber: (data.versionNumber as number) ?? 1,
            title: (data.title as string) ?? artefactData.title,
            markdown: (data.markdown as string | undefined) ?? undefined,
            imageUrl: (data.imageUrl as string | undefined) ?? undefined,
            status: (data.status as ArtefactVersion["status"]) ?? "active",
            basedOnVersionId: (data.basedOnVersionId as string | undefined) ?? undefined,
            createdAt: (data.createdAt as string) ?? "",
          }
        })
        setVersions(versionItems)
        if (versionItems.length > 0) {
          const winner = versionItems.find((v) => v.status === "winner")
          const active = versionItems.find((v) => v.status === "active")
          setSelectedVersionId((prev) => prev || winner?.id || active?.id || versionItems[0].id)
        } else {
          setSelectedVersionId("")
        }

        const votesRef = collection(db, "designVotes")
        const voteSnap = await getDocs(query(votesRef, where("userId", "==", user.uid)))
        if (cancelled) return
        const related = voteSnap.docs
          .map((d) => {
            const data = d.data()
            return {
              id: d.id,
              title: (data.title as string) ?? "",
              createdAt: (data.createdAt as string) ?? "",
              projectId: (data.projectId as string) ?? "",
              artefactId: (data.artefactId as string | null) ?? "",
              versionId: (data.versionId as string | null) ?? undefined,
            }
          })
          .filter((v) => v.projectId === projectId && v.artefactId === artefactId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((v) => ({
            id: v.id,
            title: v.title,
            createdAt: v.createdAt,
            versionId: v.versionId,
          }))
        setVotes(related)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load artefact")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, router, projectId, artefactId, refreshVersion])

  async function handleCreateInitialVersion() {
    if (!user || !artefact) return
    setVersionActionLoading(true)
    setError(null)
    try {
      const versionRef = collection(
        db,
        "users",
        user.uid,
        "projects",
        projectId,
        "artefacts",
        artefactId,
        "versions",
      )
      const created = await addDoc(versionRef, {
        versionNumber: 1,
        title: artefact.title,
        markdown: artefact.note ?? "",
        imageUrl: artefact.imageUrl ?? null,
        status: "active",
        basedOnVersionId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdAtServer: serverTimestamp(),
      })
      await updateDoc(
        doc(db, "users", user.uid, "projects", projectId, "artefacts", artefactId),
        {
          state: "in_review",
          updatedAt: new Date().toISOString(),
          winnerVersionId: null,
        },
      )
      setSelectedVersionId(created.id)
      setRefreshVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create V1")
    } finally {
      setVersionActionLoading(false)
    }
  }

  async function handleCreateNextVersion() {
    if (!user || versions.length === 0) return
    const source = versions.find((v) => v.id === selectedVersionId) ?? versions[0]
    const nextVersionNumber = Math.max(...versions.map((v) => v.versionNumber), 0) + 1
    setVersionActionLoading(true)
    setError(null)
    try {
      const versionRef = collection(
        db,
        "users",
        user.uid,
        "projects",
        projectId,
        "artefacts",
        artefactId,
        "versions",
      )
      await addDoc(versionRef, {
        versionNumber: nextVersionNumber,
        title: source.title || artefact?.title || `Version ${nextVersionNumber}`,
        markdown: source.markdown ?? artefact?.note ?? "",
        imageUrl: source.imageUrl ?? artefact?.imageUrl ?? null,
        status: "active",
        basedOnVersionId: source.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdAtServer: serverTimestamp(),
      })
      if (source.status === "active") {
        await updateDoc(
          doc(
            db,
            "users",
            user.uid,
            "projects",
            projectId,
            "artefacts",
            artefactId,
            "versions",
            source.id,
          ),
          {
            status: "archived",
            updatedAt: new Date().toISOString(),
          },
        )
      }
      await updateDoc(
        doc(db, "users", user.uid, "projects", projectId, "artefacts", artefactId),
        {
          state: "in_review",
          updatedAt: new Date().toISOString(),
          winnerVersionId: null,
        },
      )
      setRefreshVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create next version")
    } finally {
      setVersionActionLoading(false)
    }
  }

  async function handleMarkWinner(versionId: string) {
    if (!user) return
    setVersionActionLoading(true)
    setError(null)
    try {
      const batch = writeBatch(db)
      versions.forEach((version) => {
        const versionDoc = doc(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "artefacts",
          artefactId,
          "versions",
          version.id,
        )
        batch.update(versionDoc, {
          status: version.id === versionId ? "winner" : "archived",
          updatedAt: new Date().toISOString(),
        })
      })
      batch.update(
        doc(db, "users", user.uid, "projects", projectId, "artefacts", artefactId),
        {
          state: "finalized",
          updatedAt: new Date().toISOString(),
          winnerVersionId: versionId,
        },
      )
      await batch.commit()
      setSelectedVersionId(versionId)
      setRefreshVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark winner")
    } finally {
      setVersionActionLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!user) return null

  if (error || !artefact) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">{error ?? "Not found"}</p>
          <Link href="/">
            <Button variant="outline" size="sm">
              Back to projects
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between gap-2">
          <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Artefact detail
          </h1>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-xs">
              Back to dashboard
            </Button>
          </Link>
        </div>
        <div className="h-px bg-accent" />
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
        <section className="rounded-sm border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">{artefact.title}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {artefact.type && (
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {artefact.type}
              </span>
            )}
            {artefact.source && (
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {artefact.source}
              </span>
            )}
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {artefact.state ?? "draft"}
            </span>
          </div>
          {artefact.imageUrl && (
            <img
              src={artefact.imageUrl}
              alt={artefact.title}
              className="mt-3 max-h-64 rounded-sm border border-border object-cover"
            />
          )}
          {artefact.note && (
            <div className="mt-3">
              <p className="text-[11px] text-muted-foreground mb-1">Markdown notes</p>
              <div className="flex flex-col gap-0.5">{renderRichText(artefact.note)}</div>
            </div>
          )}
          {artefact.link && (
            <a
              href={artefact.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs text-foreground underline decoration-accent underline-offset-2"
            >
              Open linked reference
            </a>
          )}
        </section>

        <section className="rounded-sm border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-px bg-accent" />
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
                Version chain
              </h3>
            </div>
            {versions.length === 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={versionActionLoading}
                onClick={handleCreateInitialVersion}
              >
                {versionActionLoading ? "Creating…" : "Create V1 from artefact"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={versionActionLoading}
                onClick={handleCreateNextVersion}
              >
                {versionActionLoading ? "Saving…" : "Create next version"}
              </Button>
            )}
          </div>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No versions yet. Create V1 to start vote/iteration.
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="rounded-sm border border-border px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      V{version.versionNumber} {version.title ? `— ${version.title}` : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {version.status}
                      </span>
                      {version.basedOnVersionId && (
                        <span className="text-[11px] text-muted-foreground">
                          Based on prior version
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedVersionId(version.id)}
                    >
                      Use for vote
                    </Button>
                    {version.status !== "winner" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={versionActionLoading}
                        onClick={() => handleMarkWinner(version.id)}
                      >
                        Mark winner
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-sm border border-border bg-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Design votes for this artefact
            </h3>
          </div>
          {votes.length > 0 && (
            <div className="mt-3 space-y-2">
              {votes.map((vote) => {
                const voteVersion = versions.find((v) => v.id === vote.versionId)
                return (
                  <div
                    key={vote.id}
                    className="rounded-sm border border-border px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm text-foreground">{vote.title}</p>
                      {voteVersion && (
                        <p className="text-[11px] text-muted-foreground">
                          Version: V{voteVersion.versionNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          const url =
                            typeof window !== "undefined"
                              ? `${window.location.origin}/vote/${vote.id}`
                              : `/vote/${vote.id}`
                          navigator.clipboard.writeText(url)
                        }}
                      >
                        Copy link
                      </Button>
                      <Link href={`/vote/${vote.id}/results`}>
                        <Button variant="ghost" size="sm" className="text-xs">
                          View results
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Collapsible open={showNewDesignVoteForm} onOpenChange={setShowNewDesignVoteForm} className="mt-3">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-foreground text-foreground hover:bg-foreground hover:text-background flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New design vote
                <ChevronDown className={`h-4 w-4 transition-transform ${showNewDesignVoteForm ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {versions.length > 0 && (
                <div className="mb-3 mt-3">
                  <Label className="text-xs text-muted-foreground">Version for this vote</Label>
                  <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                    <SelectTrigger className="w-full text-sm mt-1">
                      <SelectValue placeholder="Select a version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((version) => (
                        <SelectItem key={version.id} value={version.id}>
                          V{version.versionNumber} — {version.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DesignVoteForm
                projectId={projectId}
                artefactId={artefactId}
                versionId={selectedVersionId || undefined}
                onCreated={() => {
                  setRefreshVersion((v) => v + 1)
                  setShowNewDesignVoteForm(false)
                }}
              />
            </CollapsibleContent>
          </Collapsible>
        </section>
      </main>
    </div>
  )
}
