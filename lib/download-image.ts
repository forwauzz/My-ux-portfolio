/**
 * Trigger download of an image from URL. Uses fetch+blob when CORS allows;
 * otherwise opens URL in a new tab so user can save manually.
 */
export async function downloadImage(
  url: string,
  filename?: string,
): Promise<void> {
  const ext = extensionFromUrl(url) || "jpg"
  const name =
    filename ||
    `${slugFromUrl(url)}.${ext}` ||
    `image-${Date.now()}.${ext}`

  try {
    const res = await fetch(url, { mode: "cors" })
    if (!res.ok) throw new Error("Fetch failed")
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = name
    a.rel = "noopener noreferrer"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname
    const base = path.split("/").filter(Boolean).pop() || "image"
    const withoutExt = base.replace(/\.[a-z0-9]+$/i, "")
    return slugify(withoutExt) || "image"
  } catch {
    return "image"
  }
}

function extensionFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname
    const match = path.match(/\.([a-z0-9]+)$/i)
    return match ? match[1].toLowerCase() : null
  } catch {
    return null
  }
}

/** Safe filename slug: alphanumeric and hyphens only. */
export function slugify(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "image"
}
