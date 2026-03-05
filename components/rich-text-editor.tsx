"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import { Button } from "@/components/ui/button"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeightClassName?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write notes...",
  minHeightClassName = "min-h-32",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: true,
        autolink: true,
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          `rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none ${minHeightClassName}`,
      },
    },
    onUpdate({ editor: current }) {
      onChange(current.getHTML())
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    if (!editor) return
    const next = value || ""
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) return null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().toggleItalic().run()}>
          Italic
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          Bullet
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          Numbered
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            const current = editor.getAttributes("link").href as string | undefined
            const href = window.prompt("Enter link URL", current || "https://")
            if (href === null) return
            if (!href.trim()) {
              editor.chain().focus().unsetLink().run()
              return
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
          }}
        >
          Link
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          Clear
        </Button>
      </div>
      <EditorContent editor={editor} />
      {!value?.trim() && (
        <p className="text-[11px] text-muted-foreground">{placeholder}</p>
      )}
    </div>
  )
}
