"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadImage } from "@/lib/upload-image"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const TICKET_STATUSES = ["open", "in_progress", "done", "verified"] as const
const TICKET_SEVERITIES = ["low", "medium", "high"] as const

type TicketStatus = (typeof TICKET_STATUSES)[number]
type TicketSeverity = (typeof TICKET_SEVERITIES)[number]

interface FeatureRecord {
  id: string
  title: string
}

interface TicketDoc {
  title: string
  description?: string
  featureId?: string | null
  status?: TicketStatus
  severity?: TicketSeverity
  assigneeName?: string | null
  source?: string | null
  screenshotUrls?: string[]
  devUpdateNote?: string | null
  createdAt?: string
  updatedAt?: string
  verifiedAt?: string | null
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const projectId = typeof params.projectId === "string" ? params.projectId : ""
  const ticketId = typeof params.ticketId === "string" ? params.ticketId : ""

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [features, setFeatures] = useState<FeatureRecord[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [featureId, setFeatureId] = useState("none")
  const [status, setStatus] = useState<TicketStatus>("open")
  const [severity, setSeverity] = useState<TicketSeverity>("medium")
  const [assigneeName, setAssigneeName] = useState("")
  const [source, setSource] = useState("")
  const [devUpdateNote, setDevUpdateNote] = useState("")
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([])
  const [newScreenshotFile, setNewScreenshotFile] = useState<File | null>(null)
  const [newScreenshotUploading, setNewScreenshotUploading] = useState(false)
  const [createdAt, setCreatedAt] = useState("")
  const [updatedAt, setUpdatedAt] = useState("")
  const [verifiedAt, setVerifiedAt] = useState("")

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (!projectId || !ticketId) {
      setLoading(false)
      setError("Invalid ticket route")
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [ticketSnap, featuresSnap] = await Promise.all([
          getDoc(
            doc(
              db,
              "users",
              user.uid,
              "projects",
              projectId,
              "tickets",
              ticketId,
            ),
          ),
          getDocs(
            query(
              collection(db, "users", user.uid, "projects", projectId, "features"),
              orderBy("createdAt", "desc"),
            ),
          ),
        ])

        if (cancelled) return
        if (!ticketSnap.exists()) {
          setError("Ticket not found")
          setLoading(false)
          return
        }

        const data = ticketSnap.data() as TicketDoc
        setTitle(data.title ?? "")
        setDescription(data.description ?? "")
        setFeatureId((data.featureId as string | null | undefined) ?? "none")
        setStatus(data.status ?? "open")
        setSeverity(data.severity ?? "medium")
        setAssigneeName((data.assigneeName as string | null | undefined) ?? "")
        setSource((data.source as string | null | undefined) ?? "")
        setDevUpdateNote((data.devUpdateNote as string | null | undefined) ?? "")
        setScreenshotUrls(Array.isArray(data.screenshotUrls) ? data.screenshotUrls : [])
        setCreatedAt(data.createdAt ?? "")
        setUpdatedAt(data.updatedAt ?? "")
        setVerifiedAt((data.verifiedAt as string | null | undefined) ?? "")

        setFeatures(
          featuresSnap.docs.map((featureDoc) => ({
            id: featureDoc.id,
            title: (featureDoc.data().title as string) ?? "",
          })),
        )
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load ticket")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, projectId, router, ticketId, user])

  async function handleSave() {
    if (!user || !projectId || !ticketId || !title.trim() || !description.trim()) return
    setSaving(true)
    setError(null)
    try {
      let nextScreenshotUrls = screenshotUrls
      if (newScreenshotFile) {
        setNewScreenshotUploading(true)
        try {
          const uploadedUrl = await uploadImage(newScreenshotFile)
          nextScreenshotUrls = [...screenshotUrls, uploadedUrl]
        } catch {
          throw new Error("Ticket screenshot upload failed. Check IMGBB_API_KEY and try again.")
        } finally {
          setNewScreenshotUploading(false)
        }
      }

      const now = new Date().toISOString()
      const nextVerifiedAt =
        status === "verified" ? verifiedAt || now : ""

      await updateDoc(
        doc(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "tickets",
          ticketId,
        ),
        {
          title: title.trim(),
          description: description.trim(),
          featureId: featureId !== "none" ? featureId : null,
          status,
          severity,
          assigneeName: assigneeName.trim() || null,
          source: source.trim() || null,
          devUpdateNote: devUpdateNote.trim() || null,
          screenshotUrls: nextScreenshotUrls,
          updatedAt: now,
          updatedAtServer: serverTimestamp(),
          verifiedAt: nextVerifiedAt || null,
        },
      )

      setScreenshotUrls(nextScreenshotUrls)
      setNewScreenshotFile(null)
      setUpdatedAt(now)
      setVerifiedAt(nextVerifiedAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save ticket")
    } finally {
      setSaving(false)
      setNewScreenshotUploading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) return null

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">{error}</p>
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
          <div>
            <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Ticket detail
            </h1>
            <p className="text-sm text-foreground mt-1">{title || "Untitled ticket"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={saving || newScreenshotUploading || !title.trim() || !description.trim()}
              onClick={handleSave}
            >
              {saving || newScreenshotUploading ? "Saving..." : "Save ticket"}
            </Button>
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-xs">
                Back to projects
              </Button>
            </Link>
          </div>
        </div>
        <div className="h-px bg-accent" />
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
        <section className="rounded-sm border border-border bg-card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ticket-title" className="text-xs text-muted-foreground">
                Title
              </Label>
              <Input
                id="ticket-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Linked feature</Label>
              <Select value={featureId} onValueChange={setFeatureId}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No feature</SelectItem>
                  {features.map((feature) => (
                    <SelectItem key={feature.id} value={feature.id}>
                      {feature.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as TicketStatus)}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Severity</Label>
              <Select value={severity} onValueChange={(val) => setSeverity(val as TicketSeverity)}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_SEVERITIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assignee-name" className="text-xs text-muted-foreground">
                Assignee name
              </Label>
              <Input
                id="assignee-name"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ticket-source" className="text-xs text-muted-foreground">
                Source
              </Label>
              <Input
                id="ticket-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="E.g. WhatsApp user test"
                className="text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticket-description" className="text-xs text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="text-sm resize-y"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dev-update" className="text-xs text-muted-foreground">
              Dev update note
            </Label>
            <Textarea
              id="dev-update"
              value={devUpdateNote}
              onChange={(e) => setDevUpdateNote(e.target.value)}
              placeholder="What came back from the developer, what changed, or what still needs checking."
              rows={4}
              className="text-sm resize-y"
            />
          </div>
        </section>

        <section className="rounded-sm border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Screenshot evidence
            </h2>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-screenshot" className="text-xs text-muted-foreground">
              Add screenshot
            </Label>
            <Input
              id="new-screenshot"
              type="file"
              accept="image/*"
              onChange={(e) => setNewScreenshotFile(e.target.files ? e.target.files[0] ?? null : null)}
              className="text-sm"
            />
            {newScreenshotFile && (
              <p className="text-[11px] text-muted-foreground">{newScreenshotFile.name}</p>
            )}
          </div>

          {screenshotUrls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No screenshots attached yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {screenshotUrls.map((url, index) => (
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`Ticket screenshot ${index + 1}`}
                  className="w-full rounded-sm border border-border object-cover"
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-sm border border-border bg-card p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
            <div>
              <p className="uppercase tracking-[0.15em]">Created</p>
              <p className="mt-1 text-sm text-foreground">{createdAt || "Unknown"}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.15em]">Last updated</p>
              <p className="mt-1 text-sm text-foreground">{updatedAt || "Unknown"}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.15em]">Verified</p>
              <p className="mt-1 text-sm text-foreground">{verifiedAt || "Not verified yet"}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
