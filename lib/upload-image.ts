/**
 * Upload a file to ImgBB via our API route. Returns the public image URL.
 */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append("image", file)
  const res = await fetch("/api/upload-image", { method: "POST", body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (data?.error as string) || "Image upload failed",
    )
  }
  const url = data?.url
  if (!url || typeof url !== "string") {
    throw new Error("No image URL returned")
  }
  return url
}
