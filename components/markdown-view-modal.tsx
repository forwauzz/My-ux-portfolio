"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { renderRichText, richTextToPlainText } from "@/lib/render-rich"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye } from "lucide-react"

interface MarkdownViewModalProps {
  /** Markdown/rich text content to show in full screen */
  content: string
  /** Optional title for the modal and aria */
  title?: string
  /** Optional: custom trigger (e.g. "Notes" label + icon). If not provided, renders a view icon button. */
  trigger?: React.ReactNode
  /** Optional class for the trigger wrapper */
  triggerClassName?: string
}

/**
 * Renders a view icon (or custom trigger) that opens a full-screen modal with markdown content.
 * Use for variation descriptions, vault/idea notes, etc.
 */
export function MarkdownViewModal({
  content,
  title = "View",
  trigger,
  triggerClassName,
}: MarkdownViewModalProps) {
  const [open, setOpen] = useState(false)

  if (!content?.trim()) return null

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={triggerClassName ?? "h-8 w-8 p-0 text-muted-foreground hover:text-foreground"}
        onClick={() => setOpen(true)}
        aria-label={`View ${title} full screen`}
      >
        {trigger ?? <Eye className="h-4 w-4" />}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={true}
          className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] p-0 flex flex-col gap-0"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
            <DialogTitle className="text-sm font-medium text-foreground">
              {title}
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => navigator.clipboard.writeText(richTextToPlainText(content))}
            >
              Copy
            </Button>
          </div>
          <ScrollArea className="flex-1 bg-muted/20 px-5 py-4 min-h-[200px]">
            <div className="text-sm text-foreground leading-relaxed space-y-2 pr-6">
              {renderRichText(content)}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
