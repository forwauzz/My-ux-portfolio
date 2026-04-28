"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type ReviewAnnotationType = "point" | "box" | "arrow" | "text"

export interface ReviewAnnotation {
  id: string
  versionId: string
  type: ReviewAnnotationType
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  color: string
}

interface DraftShape {
  type: "box" | "arrow"
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface FeatureImageAnnotationEditorProps {
  imageUrl: string
  alt: string
  versionId: string
  annotations: ReviewAnnotation[]
  disabled?: boolean
  onChange: (annotations: ReviewAnnotation[]) => void
}

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6"]

export function FeatureImageAnnotationEditor({
  imageUrl,
  alt,
  versionId,
  annotations,
  disabled = false,
  onChange,
}: FeatureImageAnnotationEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [tool, setTool] = useState<ReviewAnnotationType>("point")
  const [color, setColor] = useState(COLORS[0])
  const [draftText, setDraftText] = useState("")
  const [draftShape, setDraftShape] = useState<DraftShape | null>(null)

  const versionAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.versionId === versionId),
    [annotations, versionId],
  )

  function clamp(value: number) {
    return Math.min(1, Math.max(0, value))
  }

  function getRelativePosition(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return {
      x: clamp((clientX - rect.left) / rect.width),
      y: clamp((clientY - rect.top) / rect.height),
    }
  }

  function replaceVersionAnnotations(nextVersionAnnotations: ReviewAnnotation[]) {
    onChange([
      ...annotations.filter((annotation) => annotation.versionId !== versionId),
      ...nextVersionAnnotations,
    ])
  }

  function appendAnnotation(annotation: ReviewAnnotation) {
    replaceVersionAnnotations([...versionAnnotations, annotation])
  }

  function removeAnnotation(annotationId: string) {
    replaceVersionAnnotations(
      versionAnnotations.filter((annotation) => annotation.id !== annotationId),
    )
  }

  function buildShapeAnnotation(shape: DraftShape): ReviewAnnotation {
    const left = Math.min(shape.startX, shape.currentX)
    const top = Math.min(shape.startY, shape.currentY)
    const width = Math.abs(shape.currentX - shape.startX)
    const height = Math.abs(shape.currentY - shape.startY)
    return {
      id: crypto.randomUUID(),
      versionId,
      type: shape.type,
      x: left,
      y: top,
      width,
      height,
      text: draftText.trim() || undefined,
      color,
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return
    const position = getRelativePosition(e.clientX, e.clientY)
    if (!position) return

    if (tool === "point" || tool === "text") {
      appendAnnotation({
        id: crypto.randomUUID(),
        versionId,
        type: tool,
        x: position.x,
        y: position.y,
        text: draftText.trim() || undefined,
        color,
      })
      if (tool === "text") {
        setDraftText("")
      }
      return
    }

    setDraftShape({
      type: tool,
      startX: position.x,
      startY: position.y,
      currentX: position.x,
      currentY: position.y,
    })
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !draftShape) return
    const position = getRelativePosition(e.clientX, e.clientY)
    if (!position) return
    setDraftShape((prev) =>
      prev
        ? {
            ...prev,
            currentX: position.x,
            currentY: position.y,
          }
        : prev,
    )
  }

  function handlePointerUp() {
    if (disabled || !draftShape) return
    const nextAnnotation = buildShapeAnnotation(draftShape)
    if ((nextAnnotation.width ?? 0) < 0.01 && (nextAnnotation.height ?? 0) < 0.01) {
      setDraftShape(null)
      return
    }
    appendAnnotation(nextAnnotation)
    setDraftShape(null)
  }

  return (
    <div className="space-y-3">
      {!disabled && (
        <div className="rounded-sm border border-border/70 bg-background/70 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["point", "box", "arrow", "text"] as ReviewAnnotationType[]).map((item) => (
              <Button
                key={item}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-[11px] capitalize",
                  tool === item && "bg-accent text-accent-foreground hover:bg-accent/90",
                )}
                onClick={() => setTool(item)}
              >
                {item}
              </Button>
            ))}
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`Use ${item} annotation color`}
                className={cn(
                  "h-6 w-6 rounded-full border",
                  color === item ? "border-foreground" : "border-border",
                )}
                style={{ backgroundColor: item }}
                onClick={() => setColor(item)}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">
                Optional note for the next annotation
              </span>
              <Input
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={
                  tool === "text"
                    ? "Label text"
                    : "Short note, rationale, or callout"
                }
                className="h-8 text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Click for pins and text. Drag for boxes and arrows.
            </p>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={cn(
          "relative aspect-[4/3] rounded-sm border border-border/60 bg-muted/20 overflow-hidden touch-none",
          disabled ? "cursor-default" : tool === "point" || tool === "text" ? "cursor-crosshair" : "cursor-cell",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img src={imageUrl} alt={alt} className="h-full w-full object-contain select-none" draggable={false} />

        <div className="absolute inset-0">
          {versionAnnotations.map((annotation, index) => (
            <AnnotationShape
              key={annotation.id}
              annotation={annotation}
              index={index}
              disabled={disabled}
              onRemove={() => removeAnnotation(annotation.id)}
            />
          ))}
          {draftShape && <AnnotationShape annotation={buildShapeAnnotation(draftShape)} disabled />}
        </div>
      </div>
    </div>
  )
}

function AnnotationShape({
  annotation,
  index,
  disabled = false,
  onRemove,
}: {
  annotation: ReviewAnnotation
  index?: number
  disabled?: boolean
  onRemove?: () => void
}) {
  if (annotation.type === "point") {
    return (
      <div
        className="absolute"
        style={{
          left: `${annotation.x * 100}%`,
          top: `${annotation.y * 100}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="relative">
          <div
            className="h-4 w-4 rounded-full border-2 border-white shadow-sm"
            style={{ backgroundColor: annotation.color }}
          />
          {typeof index === "number" && (
            <span className="absolute -top-2.5 left-4 text-[10px] font-medium text-foreground bg-background/90 px-1 rounded-sm">
              {index + 1}
            </span>
          )}
          {annotation.text && (
            <div className="absolute left-5 top-1/2 -translate-y-1/2 rounded-sm bg-background/95 px-2 py-1 text-[11px] text-foreground shadow-sm max-w-40">
              {annotation.text}
            </div>
          )}
          {!disabled && onRemove && (
            <button
              type="button"
              className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-background text-[10px] text-foreground shadow-sm"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>
    )
  }

  if (annotation.type === "text") {
    return (
      <div
        className="absolute"
        style={{
          left: `${annotation.x * 100}%`,
          top: `${annotation.y * 100}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          className="rounded-sm border border-white/70 px-2 py-1 text-[11px] font-medium shadow-sm"
          style={{ backgroundColor: annotation.color, color: "#111827" }}
        >
          {annotation.text || "Text"}
        </div>
        {!disabled && onRemove && (
          <button
            type="button"
            className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-background text-[10px] text-foreground shadow-sm"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            ×
          </button>
        )}
      </div>
    )
  }

  if (annotation.type === "box") {
    return (
      <div
        className="absolute border-2 shadow-sm"
        style={{
          left: `${annotation.x * 100}%`,
          top: `${annotation.y * 100}%`,
          width: `${(annotation.width ?? 0) * 100}%`,
          height: `${(annotation.height ?? 0) * 100}%`,
          borderColor: annotation.color,
          backgroundColor: `${annotation.color}1f`,
        }}
      >
        {annotation.text && (
          <div className="absolute left-0 top-0 -translate-y-full rounded-sm bg-background/95 px-2 py-1 text-[11px] text-foreground shadow-sm max-w-40">
            {annotation.text}
          </div>
        )}
        {!disabled && onRemove && (
          <button
            type="button"
            className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-background text-[10px] text-foreground shadow-sm"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            ×
          </button>
        )}
      </div>
    )
  }

  const width = annotation.width ?? 0
  const height = annotation.height ?? 0
  const length = Math.sqrt(width * width + height * height)
  const angle = Math.atan2(height, width)

  return (
    <div
      className="absolute"
      style={{
        left: `${annotation.x * 100}%`,
        top: `${annotation.y * 100}%`,
        width: `${length * 100}%`,
        transform: `rotate(${angle}rad)`,
        transformOrigin: "left center",
      }}
    >
      <div className="relative h-0.5" style={{ backgroundColor: annotation.color }}>
        <div
          className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[5px] border-l-[8px] border-y-transparent"
          style={{ borderLeftColor: annotation.color }}
        />
      </div>
      {annotation.text && (
        <div className="absolute left-0 top-2 rounded-sm bg-background/95 px-2 py-1 text-[11px] text-foreground shadow-sm max-w-40">
          {annotation.text}
        </div>
      )}
      {!disabled && onRemove && (
        <button
          type="button"
          className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-background text-[10px] text-foreground shadow-sm"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
