"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ImageFullScreenProps {
  src: string
  alt: string
  className?: string
  /** Optional: render custom trigger (e.g. thumbnail). If not provided, renders an img. */
  children?: React.ReactNode
}

/**
 * Renders an image that opens in a full-screen dialog on click.
 * Use for design vote variations, vault/ideas images, etc.
 */
export function ImageFullScreen({
  src,
  alt,
  className,
  children,
}: ImageFullScreenProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("cursor-pointer block text-left outline-none", !children && "w-full")}
        aria-label={`View ${alt} full screen`}
      >
        {children ?? (
          <img
            src={src}
            alt={alt}
            className={cn("w-full rounded-sm border border-border object-cover", className)}
          />
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={true}
          className="max-w-[calc(100%-2rem)] h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-full p-2 flex items-center justify-center bg-black/95 border-border"
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full w-auto h-auto object-contain rounded-sm"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
