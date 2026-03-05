import { NextRequest, NextResponse } from "next/server"

const IMGBB_URL = "https://api.imgbb.com/1/upload"
const MAX_SIZE_BYTES = 32 * 1024 * 1024 // 32 MB

export async function POST(request: NextRequest) {
  const key = process.env.IMGBB_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: "Image upload not configured (IMGBB_API_KEY missing)" },
      { status: 503 },
    )
  }

  let imageBase64: string
  try {
    const formData = await request.formData()
    const file = formData.get("image") as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid image file" },
        { status: 400 },
      )
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image must be 32 MB or smaller" },
        { status: 400 },
      )
    }
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    imageBase64 = base64
  } catch {
    return NextResponse.json(
      { error: "Failed to read image" },
      { status: 400 },
    )
  }

  const params = new URLSearchParams()
  params.set("key", key)
  params.set("image", imageBase64)

  const res = await fetch(IMGBB_URL, {
    method: "POST",
    body: params,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    return NextResponse.json(
      { error: json?.error?.message || "Image upload failed" },
      { status: res.status >= 400 ? res.status : 502 },
    )
  }

  const url = json.data?.url ?? json.data?.image?.url
  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Upload succeeded but no URL returned" },
      { status: 502 },
    )
  }

  return NextResponse.json({ url })
}
