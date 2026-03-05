"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const [mode, setMode] = useState<"side-by-side" | "stacked">("side-by-side")
  const [stackedIndex, setStackedIndex] = useState(0)
  const [fullScreen, setFullScreen] = useState(false)

  if (variations.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as typeof mode)}
        >
          <TabsList>
            <TabsTrigger value="side-by-side" className="text-xs">
              Side by side
            </TabsTrigger>
            <TabsTrigger value="stacked" className="text-xs">
              Stacked
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setFullScreen(true)}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Compare full screen
        </Button>
      </div>

      {mode === "side-by-side" && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {variations.map((v, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 min-w-[280px] rounded-sm border bg-card p-3 space-y-2",
                cardClassName?.(i) ?? "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  {v.label}
                </p>
                {renderBadge?.(i)}
              </div>
              <div className="h-[400px] md:h-[480px] rounded-sm border border-border/50 bg-muted/20 flex items-center justify-center overflow-hidden">
                <img
                  src={v.imageUrl}
                  alt={v.label}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              {renderBelow?.(i)}
            </div>
          ))}
        </div>
      )}

      {mode === "stacked" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              disabled={stackedIndex === 0}
              onClick={() => setStackedIndex((idx) => idx - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              {variations[stackedIndex].label} ({stackedIndex + 1} of{" "}
              {variations.length})
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              disabled={stackedIndex === variations.length - 1}
              onClick={() => setStackedIndex((idx) => idx + 1)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div
            className={cn(
              "rounded-sm border bg-card p-3 space-y-2",
              cardClassName?.(stackedIndex) ?? "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                {variations[stackedIndex].label}
              </p>
              {renderBadge?.(stackedIndex)}
            </div>
            <div className="h-[500px] md:h-[600px] rounded-sm border border-border/50 bg-muted/20 flex items-center justify-center overflow-hidden">
              <img
                src={variations[stackedIndex].imageUrl}
                alt={variations[stackedIndex].label}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            {renderBelow?.(stackedIndex)}
          </div>
        </div>
      )}

      <Dialog open={fullScreen} onOpenChange={setFullScreen}>
        <DialogContent
          showCloseButton={true}
          className="max-w-[calc(100%-2rem)] h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-full p-4 bg-black/95 border-border"
        >
          <DialogTitle className="sr-only">
            Full-screen comparison
          </DialogTitle>
          <div className="flex gap-4 h-full overflow-x-auto items-stretch">
            {variations.map((v, i) => (
              <div
                key={i}
                className="flex-1 min-w-[300px] flex flex-col gap-2"
              >
                <p className="text-xs font-medium text-white/70 uppercase text-center shrink-0">
                  {v.label}
                </p>
                <div className="flex-1 flex items-center justify-center min-h-0">
                  <img
                    src={v.imageUrl}
                    alt={v.label}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
