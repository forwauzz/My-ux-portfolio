"use client"

import { useState, useRef, useCallback } from "react"
import { doc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadImage } from "@/lib/upload-image"
import { useAuth } from "@/components/auth-provider"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, X, Upload, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

const MIN_VARIATIONS = 2
const MAX_VARIATIONS = 5

interface DesignVoteFormProps {
  projectId: string
  artefactId?: string
  versionId?: string
  onCreated?: (voteId: string, shareUrl: string) => void
}

interface VariationState {
  label: string
  imageFile: File | null
  imagePreview: string | null
  description: string
  showDescription: boolean
}

function emptyVariation(): VariationState {
  return {
    label: "",
    imageFile: null,
    imagePreview: null,
    description: "",
    showDescription: false,
  }
}

export function DesignVoteForm({
  projectId,
  artefactId,
  versionId,
  onCreated,
}: DesignVoteFormProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState("")
  const [variations, setVariations] = useState<VariationState[]>(() => [
    emptyVariation(),
    emptyVariation(),
  ])
  const [deadline, setDeadline] = useState("")
  const [showResultsToVoters, setShowResultsToVoters] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdShareUrl, setCreatedShareUrl] = useState<string | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])

  function setVariation(index: number, patch: Partial<VariationState>) {
    setVariations((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  function handleImageChange(index: number, file: File | null) {
    const oldPreview = variations[index]?.imagePreview
    if (oldPreview) URL.revokeObjectURL(oldPreview)
    setVariation(index, {
      imageFile: file,
      imagePreview: file ? URL.createObjectURL(file) : null,
    })
  }

  function addVariation() {
    if (variations.length >= MAX_VARIATIONS) return
    setVariations((prev) => [...prev, emptyVariation()])
  }

  function removeVariation(index: number) {
    if (variations.length <= MIN_VARIATIONS) return
    setVariations((prev) => {
      const v = prev[index]
      if (v.imagePreview) URL.revokeObjectURL(v.imagePreview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleDrop = useCallback(
    (index: number, e: React.DragEvent) => {
      e.preventDefault()
      setDraggingIndex(null)
      const file = e.dataTransfer.files?.[0]
      if (file && file.type.startsWith("image/")) {
        handleImageChange(index, file)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variations],
  )

  async function handleSubmit() {
    if (!user) {
      setError("You must be signed in to create a design vote.")
      return
    }
    if (!projectId.trim()) {
      setError("Please select a project first.")
      return
    }
    const missing = variations.findIndex((v) => !v.imageFile)
    if (missing >= 0 || !title.trim()) {
      setError(
        `Please add a title and an image for each variation (${variations.length} total).`,
      )
      return
    }
    setError(null)
    setSaving(true)
    try {
      const voteId = crypto.randomUUID()
      const variationUrls: {
        imageUrl: string
        description: string | null
        label: string
      }[] = []

      for (let i = 0; i < variations.length; i++) {
        const file = variations[i].imageFile!
        const imageUrl = await uploadImage(file)
        const rawDesc = variations[i].description
        const description =
          typeof rawDesc === "string" && rawDesc.trim() ? rawDesc.trim() : null
        const label = variations[i].label.trim() || `Variation ${i + 1}`
        variationUrls.push({ imageUrl, description, label })
      }

      const payload = {
        userId: user.uid,
        projectId: projectId.trim(),
        artefactId: artefactId != null ? artefactId : null,
        versionId: versionId != null ? versionId : null,
        title: title.trim(),
        variations: variationUrls,
        status: "open" as const,
        deadline: deadline || null,
        showResultsToVoters,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await setDoc(doc(db, "designVotes", voteId), payload)

      const shareUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/vote/${voteId}`
          : `/vote/${voteId}`
      setCreatedShareUrl(shareUrl)
      await navigator.clipboard.writeText(shareUrl)
      onCreated?.(voteId, shareUrl)

      setTitle("")
      setDeadline("")
      variations.forEach((v) => {
        if (v.imagePreview) URL.revokeObjectURL(v.imagePreview)
      })
      setVariations([emptyVariation(), emptyVariation()])
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create design vote"
      const isPermissionDenied =
        typeof msg === "string" &&
        (msg.toLowerCase().includes("permission") ||
          (err as { code?: string })?.code === "permission-denied")
      setError(
        isPermissionDenied
          ? "Missing or insufficient permissions. Ensure you're signed in and that Firestore rules are deployed (firebase deploy --only firestore:rules)."
          : msg,
      )
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  if (createdShareUrl) {
    return (
      <div className="rounded-sm border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground mb-1">
          Design vote created
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          Share this link with your team. Copied to clipboard.
        </p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={createdShareUrl}
            className="text-xs font-mono"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(createdShareUrl)}
          >
            Copy again
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => setCreatedShareUrl(null)}
        >
          Create another
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-sm border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-4 h-px bg-accent" />
        <h3 className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">
          New design vote
        </h3>
      </div>
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}

      <div className="flex flex-col gap-1.5 mb-4">
        <Label
          htmlFor="design-vote-title"
          className="text-xs text-muted-foreground"
        >
          Title (e.g. Home page)
        </Label>
        <Input
          id="design-vote-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="E.g. Home page"
          className="text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        <Label
          htmlFor="design-vote-deadline"
          className="text-xs text-muted-foreground"
        >
          Closes on (optional)
        </Label>
        <Input
          id="design-vote-deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
          className="text-sm w-48"
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          id="show-results-to-voters"
          checked={showResultsToVoters}
          onChange={(e) => setShowResultsToVoters(e.target.checked)}
          className="rounded border-border"
        />
        <Label
          htmlFor="show-results-to-voters"
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Show results to voters after they submit
        </Label>
      </div>

      <div className="space-y-3 mb-4">
        {variations.map((v, i) => (
          <div
            key={i}
            className="rounded-sm border border-border bg-secondary/30 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Input
                value={v.label}
                onChange={(e) => setVariation(i, { label: e.target.value })}
                placeholder={`Variation ${i + 1}`}
                className="text-xs font-medium h-7 flex-1"
              />
              {variations.length > MIN_VARIATIONS && (
                <button
                  type="button"
                  onClick={() => removeVariation(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                  aria-label="Remove variation"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Drop zone / image preview */}
            <div
              className={cn(
                "relative rounded-sm border-2 border-dashed transition-colors cursor-pointer overflow-hidden",
                v.imagePreview
                  ? "border-border bg-muted/10"
                  : draggingIndex === i
                    ? "border-accent bg-accent/5"
                    : "border-border/60 bg-muted/20 hover:border-border",
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setDraggingIndex(i)
              }}
              onDragEnter={() => setDraggingIndex(i)}
              onDragLeave={() => {
                if (draggingIndex === i) setDraggingIndex(null)
              }}
              onDrop={(e) => handleDrop(i, e)}
              onClick={() => fileInputRefs.current[i]?.click()}
            >
              <input
                ref={(el) => {
                  fileInputRefs.current[i] = el
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  if (file) handleImageChange(i, file)
                }}
              />
              {v.imagePreview ? (
                <div className="flex items-center justify-center p-2">
                  <img
                    src={v.imagePreview}
                    alt={v.label || `Variation ${i + 1}`}
                    className="max-h-48 w-auto object-contain rounded-sm"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Upload className="h-6 w-6" />
                  <span className="text-xs">
                    Drop image or click to browse
                  </span>
                </div>
              )}
            </div>

            {/* Collapsed notes toggle */}
            {v.showDescription ? (
              <div className="space-y-1">
                <RichTextEditor
                  value={v.description}
                  onChange={(description) => setVariation(i, { description })}
                  placeholder="Optional description"
                  minHeightClassName="min-h-20"
                />
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setVariation(i, { showDescription: false })}
                >
                  Hide notes
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setVariation(i, { showDescription: true })}
              >
                <FileText className="h-3 w-3" />
                Add notes
              </button>
            )}
          </div>
        ))}

        {variations.length < MAX_VARIATIONS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={addVariation}
          >
            <Plus className="h-3.5 w-3.5" />
            Add variation ({variations.length}/{MAX_VARIATIONS})
          </Button>
        )}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={
          saving || !title.trim() || variations.some((v) => !v.imageFile)
        }
        variant="outline"
        className="border-foreground text-foreground hover:bg-foreground hover:text-background"
      >
        {saving ? "Creating…" : "Create & get share link"}
      </Button>
    </div>
  )
}
