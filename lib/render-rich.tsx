"use client"

import type { ReactNode } from "react"

function looksLikeHtml(text: string) {
  return /<\/?[a-z][\s\S]*>/i.test(text)
}

export function richTextToPlainText(text: string): string {
  if (!text) return ""
  if (!looksLikeHtml(text)) return text
  if (typeof window === "undefined") {
    return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  }
  const doc = new DOMParser().parseFromString(text, "text/html")
  return doc.body.textContent?.trim() ?? ""
}

export function renderRichText(text: string): ReactNode[] {
  if (looksLikeHtml(text)) {
    return [
      <div
        key="html"
        className="text-sm text-foreground leading-relaxed [&_p]:mb-2 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal"
        dangerouslySetInnerHTML={{ __html: text }}
      />,
    ]
  }

  return text.split("\n").map((line, i) => {
    const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("* ")
    if (isBullet) {
      const bulletContent = boldProcessed.replace(/^[\s]*[-*]\s/, "")
      return (
        <li
          key={i}
          className="ml-4 list-disc text-sm text-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ __html: bulletContent }}
        />
      )
    }
    return (
      <p
        key={i}
        className="text-sm text-foreground leading-relaxed"
        dangerouslySetInnerHTML={{ __html: boldProcessed }}
      />
    )
  })
}
