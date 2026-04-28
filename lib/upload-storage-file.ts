import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { storage } from "@/lib/firebase"

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-")
}

export async function uploadStorageFile(
  file: File,
  pathSegments: string[],
): Promise<{ url: string; fullPath: string }> {
  const safeName = `${Date.now()}-${sanitizePathSegment(file.name)}`
  const fullPath = [...pathSegments.map(sanitizePathSegment), safeName].join("/")
  const storageRef = ref(storage, fullPath)
  await uploadBytes(storageRef, file, {
    contentType: file.type || undefined,
  })
  const url = await getDownloadURL(storageRef)
  return { url, fullPath }
}
