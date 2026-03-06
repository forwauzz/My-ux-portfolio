"use client"

import { useState, useMemo } from "react"
import { RichTextEditor } from "@/components/rich-text-editor"
import { StarRatingDisplay } from "@/components/star-rating"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MarkdownViewModal } from "@/components/markdown-view-modal"
import { richTextToPlainText } from "@/lib/render-rich"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ArrowUpDown, Download, ClipboardCopy } from "lucide-react"
import { ComparisonView } from "@/components/comparison-view"
import { cn } from "@/lib/utils"

export interface DesignVoteVariation {
  imageUrl: string
  description?: string
  label?: string
}

export interface DesignVoteResponse {
  id: string
  voterName: string
  chosenIndex?: number
  starRatings?: number[]
  comment?: string
  createdAt: string
}

interface DesignVoteResultsProps {
  title: string
  variations: DesignVoteVariation[]
  responses: DesignVoteResponse[]
  editableDescriptions?: boolean
  onSaveDescription?: (index: number, value: string) => Promise<void>
  onSaveLabel?: (index: number, value: string) => Promise<void>
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

type SortKey = "voter" | "picked" | "time" | `stars-${number}`
type SortDir = "asc" | "desc"

export function vLabel(v: DesignVoteVariation | undefined, i: number): string {
  return v?.label?.trim() || `Variation ${i + 1}`
}

export function DesignVoteResults({
  title,
  variations,
  responses,
  editableDescriptions = false,
  onSaveDescription,
  onSaveLabel,
}: DesignVoteResultsProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingDescription, setEditingDescription] = useState("")
  const [savingDescription, setSavingDescription] = useState(false)
  const [editingLabelIndex, setEditingLabelIndex] = useState<number | null>(null)
  const [editingLabelValue, setEditingLabelValue] = useState("")
  const [savingLabel, setSavingLabel] = useState(false)
  const [showResponses, setShowResponses] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("time")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set(),
  )

  const pickCounts = variations.map(
    (_, i) => responses.filter((r) => r.chosenIndex === i).length,
  )
  const maxPicks = Math.max(...pickCounts, 0)
  const starAverages = variations.map((_, i) => {
    const withStars = responses.filter(
      (r) => r.starRatings?.[i] != null && r.starRatings[i] > 0,
    )
    if (withStars.length === 0) return 0
    const sum = withStars.reduce((s, r) => s + (r.starRatings![i] ?? 0), 0)
    return sum / withStars.length
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sortedResponses = useMemo(() => {
    const arr = [...responses]
    const dir = sortDir === "asc" ? 1 : -1
    arr.sort((a, b) => {
      switch (sortKey) {
        case "voter":
          return dir * a.voterName.localeCompare(b.voterName)
        case "picked":
          return dir * ((a.chosenIndex ?? -1) - (b.chosenIndex ?? -1))
        case "time":
          return dir * (a.createdAt || "").localeCompare(b.createdAt || "")
        default: {
          if (sortKey.startsWith("stars-")) {
            const idx = Number(sortKey.split("-")[1])
            return (
              dir *
              ((a.starRatings?.[idx] ?? 0) - (b.starRatings?.[idx] ?? 0))
            )
          }
          return 0
        }
      }
    })
    return arr
  }, [responses, sortKey, sortDir])

  function exportCsv() {
    const escape = (s: string) =>
      `"${s.replace(/"/g, '""').replace(/\n/g, " ")}"`
    const headers = [
      "Voter",
      "Picked",
      ...variations.map((v, i) => `${vLabel(v, i)} Stars`),
      "Comment",
      "Submitted",
    ]
    const rows = sortedResponses.map((r) => [
      escape(r.voterName),
      r.chosenIndex != null && r.chosenIndex < variations.length
        ? escape(vLabel(variations[r.chosenIndex], r.chosenIndex))
        : "",
      ...variations.map((_, vi) =>
        r.starRatings?.[vi] && r.starRatings[vi] > 0
          ? String(r.starRatings[vi])
          : "",
      ),
      escape(r.comment?.trim() || ""),
      r.createdAt,
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_votes.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copySummary() {
    const best = pickCounts.indexOf(maxPicks)
    const bestLabel =
      maxPicks > 0 && best >= 0 ? vLabel(variations[best], best) : "N/A"
    const lines = [
      `${title} — ${responses.length} response${responses.length !== 1 ? "s" : ""}`,
      "",
      ...variations.map(
        (v, i) =>
          `${vLabel(v, i)}: picked ${pickCounts[i]}x${starAverages[i] > 0 ? `, avg ${starAverages[i].toFixed(1)}★` : ""}`,
      ),
      "",
      `Most picked: ${bestLabel} (${maxPicks} vote${maxPicks !== 1 ? "s" : ""})`,
    ]
    navigator.clipboard.writeText(lines.join("\n"))
  }

  async function handleSaveDescription(index: number) {
    if (!onSaveDescription) return
    setSavingDescription(true)
    try {
      await onSaveDescription(index, editingDescription)
      setEditingIndex(null)
      setEditingDescription("")
    } finally {
      setSavingDescription(false)
    }
  }

  async function handleSaveLabel(index: number) {
    if (!onSaveLabel) return
    const value = editingLabelValue.trim() || `Variation ${index + 1}`
    setSavingLabel(true)
    try {
      await onSaveLabel(index, value)
      setEditingLabelIndex(null)
      setEditingLabelValue("")
    } finally {
      setSavingLabel(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>

      <ComparisonView
        variations={variations.map((v, i) => ({
          imageUrl: v.imageUrl,
          label: vLabel(v, i),
        }))}
        cardClassName={(i) =>
          pickCounts[i] === maxPicks && maxPicks > 0
            ? "border-accent ring-1 ring-accent/30"
            : "border-border"
        }
        renderBadge={(i) =>
          pickCounts[i] === maxPicks && maxPicks > 0 ? (
            <span className="text-[11px] font-medium text-accent uppercase">
              Most picked
            </span>
          ) : null
        }
        renderBelow={(i) => {
          const v = variations[i]
          return (
            <div className="space-y-2">
              {editableDescriptions && onSaveLabel && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">Image title</p>
                  {editingLabelIndex === i ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={editingLabelValue}
                        onChange={(e) => setEditingLabelValue(e.target.value)}
                        placeholder={`Variation ${i + 1}`}
                        className="text-sm h-8"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveLabel(i)
                          if (e.key === "Escape") {
                            setEditingLabelIndex(null)
                            setEditingLabelValue("")
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          disabled={savingLabel}
                          onClick={() => handleSaveLabel(i)}
                        >
                          {savingLabel ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setEditingLabelIndex(null)
                            setEditingLabelValue("")
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground">
                        {vLabel(v, i)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => {
                          setEditingLabelIndex(i)
                          setEditingLabelValue(v?.label?.trim() || `Variation ${i + 1}`)
                        }}
                      >
                        Edit title
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                {v.description ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MarkdownViewModal
                      content={v.description}
                      title={`${vLabel(v, i)} description`}
                      triggerClassName="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                    />
                    <span>View description</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No description yet
                  </p>
                )}
                {editableDescriptions && (
                  <div className="flex items-center gap-1.5">
                    {v.description && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            richTextToPlainText(v.description || ""),
                          )
                        }
                      >
                        Copy
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        setEditingIndex(i)
                        setEditingDescription(v.description || "")
                      }}
                    >
                      {v.description ? "Edit" : "Add description"}
                    </Button>
                  </div>
                )}
                {editableDescriptions && editingIndex === i && (
                  <div className="rounded-sm border border-border bg-card p-3 space-y-2">
                    <RichTextEditor
                      value={editingDescription}
                      onChange={setEditingDescription}
                      placeholder="Add variation description..."
                      minHeightClassName="min-h-24"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={savingDescription}
                        onClick={() => handleSaveDescription(i)}
                      >
                        {savingDescription ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setEditingIndex(null)
                          setEditingDescription("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  Picked as best:{" "}
                  <strong className="text-foreground">
                    {pickCounts[i]}
                  </strong>
                </p>
                {starAverages[i] > 0 && (
                  <StarRatingDisplay value={starAverages[i]} />
                )}
              </div>
            </div>
          )
        }}
      />

      {responses.length > 0 ? (
        <>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={exportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5"
              onClick={copySummary}
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copy summary
            </Button>
          </div>
        </div>
        <Collapsible open={showResponses} onOpenChange={setShowResponses}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-[0.15em] hover:text-foreground transition-colors"
            >
              <span>Individual Responses</span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {responses.length}
              </Badge>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  showResponses && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-sm border border-border bg-card mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("voter")}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Voter
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("picked")}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Picked
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    {variations.map((v, i) => (
                      <TableHead key={i}>
                        <button
                          type="button"
                          onClick={() =>
                            toggleSort(`stars-${i}` as SortKey)
                          }
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          {vLabel(v, i).length > 14
                            ? `V${i + 1}`
                            : vLabel(v, i)}
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[150px]">Comment</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("time")}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Submitted
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResponses.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-xs">
                        {r.voterName}
                      </TableCell>
                      <TableCell>
                        {r.chosenIndex != null &&
                        r.chosenIndex < variations.length ? (
                          <Badge
                            variant={
                              pickCounts[r.chosenIndex] === maxPicks &&
                              maxPicks > 0
                                ? "default"
                                : "outline"
                            }
                            className="text-[10px]"
                          >
                            {vLabel(variations[r.chosenIndex], r.chosenIndex)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                      {variations.map((_, vi) => (
                        <TableCell key={vi}>
                          {r.starRatings?.[vi] && r.starRatings[vi] > 0 ? (
                            <span className="text-xs whitespace-nowrap">
                              <span className="text-accent">
                                {"★".repeat(r.starRatings[vi])}
                              </span>
                              <span className="text-muted-foreground/30">
                                {"★".repeat(5 - r.starRatings[vi])}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="max-w-[250px]">
                        {r.comment?.trim() ? (
                          r.comment.length > 80 &&
                          !expandedComments.has(r.id) ? (
                            <span className="text-xs whitespace-normal">
                              {r.comment.slice(0, 80)}…{" "}
                              <button
                                type="button"
                                className="text-accent hover:underline"
                                onClick={() =>
                                  setExpandedComments((prev) => {
                                    const next = new Set(prev)
                                    next.add(r.id)
                                    return next
                                  })
                                }
                              >
                                more
                              </button>
                            </span>
                          ) : (
                            <span className="text-xs whitespace-normal">
                              {r.comment}
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {relativeTime(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No responses yet</p>
      )}
    </div>
  )
}
