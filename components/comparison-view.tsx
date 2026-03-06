"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, Download, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { downloadImage, slugify } from "@/lib/download-image"

interface ComparisonVariation {
  imageUrl: string
  label: string
}

interface ComparisonViewProps {
  variations: ComparisonVariation[]
  renderBelow?: (index: number) => React.ReactNode
  renderBadge?: (index: number) => React.ReactNode
  cardClassName?: (index: number) => string
}

export function ComparisonView({
  variations,
  renderBelow,
  renderBadge,
  cardClassName,
}: ComparisonViewProps) {
  const [mode, setMode] = useState<"side-by-side" | "stacked">("stacked")
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const openLightbox = useCallback((i: number) => setLightboxIndex(i), [])
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const prevLightbox = useCallback(
    () => setLightboxIndex((i) => (i != null && i > 0 ? i - 1 : i)),
    [],
  )
  const nextLightbox = useCallback(
    () =>
      setLightboxIndex((i) =>
        i != null && i < variations.length - 1 ? i + 1 : i,
      ),
    [variations.length],
  )

  useEffect(() => {
    if (lightboxIndex == null) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prevLightbox()
      else if (e.key === "ArrowRight") nextLightbox()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [lightboxIndex, prevLightbox, nextLightbox])

  if (variations.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as typeof mode)}
        >
          <TabsList>
            <TabsTrigger value="stacked" className="text-xs">
              Stacked
            </TabsTrigger>
            <TabsTrigger value="side-by-side" className="text-xs">
              Side by side
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* --- SIDE-BY-SIDE: thumbnail grid --- */}
      {mode === "side-by-side" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {variations.map((v, i) => (
            <div
              key={i}
              className={cn(
                "rounded-sm border bg-card p-3 space-y-2",
                cardClassName?.(i) ?? "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase truncate">
                  {v.label}
                </p>
                {renderBadge?.(i)}
              </div>
              <button
                type="button"
                className="relative w-full aspect-[4/3] rounded-sm border border-border/50 bg-muted/20 flex items-center justify-center overflow-hidden group cursor-pointer"
                onClick={() => openLightbox(i)}
                aria-label={`View ${v.label} full size`}
              >
                <img
                  src={v.imageUrl}
                  alt={v.label}
                  className="max-w-full max-h-full object-contain"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground w-full justify-start"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadImage(v.imageUrl, `${slugify(v.label)}.jpg`)
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Download image
              </Button>
              {renderBelow?.(i)}
            </div>
          ))}
        </div>
      )}

      {/* --- STACKED: all designs vertically --- */}
      {mode === "stacked" && (
        <div className="space-y-6">
          {variations.map((v, i) => (
            <div
              key={i}
              className={cn(
                "rounded-sm border bg-card p-3 space-y-2",
                cardClassName?.(i) ?? "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  {v.label}
                  <span className="ml-2 normal-case text-muted-foreground/60">
                    ({i + 1} of {variations.length})
                  </span>
                </p>
                {renderBadge?.(i)}
              </div>
              <button
                type="button"
                className="relative w-full h-[calc(100vh-18rem)] min-h-[300px] max-h-[700px] rounded-sm border border-border/50 bg-muted/20 flex items-center justify-center overflow-hidden group cursor-pointer"
                onClick={() => openLightbox(i)}
                aria-label={`View ${v.label} full size`}
              >
                <img
                  src={v.imageUrl}
                  alt={v.label}
                  className="max-w-full max-h-full object-contain"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadImage(v.imageUrl, `${slugify(v.label)}.jpg`)
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Download image
              </Button>
              {renderBelow?.(i)}
            </div>
          ))}
        </div>
      )}

      {/* --- LIGHTBOX: single-image with prev/next --- */}
      <Dialog
        open={lightboxIndex != null}
        onOpenChange={(open) => {
          if (!open) closeLightbox()
        }}
      >
        <DialogContent
          showCloseButton={true}
          className="max-w-[95vw] sm:max-w-[95vw] h-[90vh] max-h-[90vh] w-full p-0 bg-black/95 border-border flex flex-col"
        >
          <DialogTitle className="sr-only">
            {lightboxIndex != null
              ? variations[lightboxIndex]?.label
              : "Image preview"}
          </DialogTitle>

          {lightboxIndex != null && (
            <>
              <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-center gap-3">
                <p className="text-xs font-medium text-white/70 uppercase">
                  {variations[lightboxIndex].label}
                </p>
                <span className="text-xs text-white/40">
                  ({lightboxIndex + 1} of {variations.length})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() =>
                    downloadImage(
                      variations[lightboxIndex].imageUrl,
                      `${slugify(variations[lightboxIndex].label)}.jpg`,
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>

              <div className="flex-1 relative min-h-0 flex items-center justify-center px-12 pb-4">
                {variations.length > 1 && lightboxIndex > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                    onClick={prevLightbox}
                    aria-label="Previous variation"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}

                <img
                  src={variations[lightboxIndex].imageUrl}
                  alt={variations[lightboxIndex].label}
                  className="max-w-full max-h-full object-contain rounded-sm"
                />

                {variations.length > 1 &&
                  lightboxIndex < variations.length - 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                      onClick={nextLightbox}
                      aria-label="Next variation"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
