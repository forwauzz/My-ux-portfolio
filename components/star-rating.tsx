"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

const MAX_STARS = 5

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
  className?: string
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  className,
}: StarRatingProps) {
  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role={readonly ? "img" : "slider"}
      aria-label={readonly ? `Rating: ${value} out of ${MAX_STARS}` : "Star rating"}
      aria-valuemin={readonly ? undefined : 0}
      aria-valuemax={readonly ? undefined : MAX_STARS}
      aria-valuenow={value}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={cn(
            "p-0.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            readonly ? "cursor-default" : "cursor-pointer hover:opacity-80",
          )}
          aria-label={readonly ? undefined : `Rate ${star} stars`}
        >
          <Star
            className={cn(
              "size-5 transition-colors",
              star <= value
                ? "fill-accent text-accent"
                : "fill-transparent text-muted-foreground/50",
            )}
          />
        </button>
      ))}
    </div>
  )
}

/** Display-only average rating (e.g. 3.7 → 3 filled, 1 half, 1 empty). */
export function StarRatingDisplay({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const clamped = Math.max(0, Math.min(MAX_STARS, value))
  const full = Math.floor(clamped)
  const hasHalf = clamped - full >= 0.5
  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={`Rating: ${value.toFixed(1)} out of ${MAX_STARS}`}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const star = i + 1
        const filled = star <= full
        const half = star === full + 1 && hasHalf
        return (
          <span key={star} className="p-0.5">
            <Star
              className={cn(
                "size-5",
                filled
                  ? "fill-accent text-accent"
                  : half
                    ? "fill-accent/50 text-accent/50"
                    : "fill-transparent text-muted-foreground/50",
              )}
            />
          </span>
        )
      })}
      <span className="text-xs text-muted-foreground ml-1">
        {value.toFixed(1)}
      </span>
    </div>
  )
}
