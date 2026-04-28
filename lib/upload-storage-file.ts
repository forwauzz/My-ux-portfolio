import { FirebaseError } from "firebase/app"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { firebaseConfigError, storage } from "@/lib/firebase"

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-")
}

export async function uploadStorageFile(
  file: File,
  pathSegments: string[],
): Promise<{ url: string; fullPath: string }> {
  if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || !storage) {
    throw new Error(
      `${firebaseConfigError} File uploads also require NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.`,
    )
  }

  const safeName = `${Date.now()}-${sanitizePathSegment(file.name)}`
  const fullPath = [...pathSegments.map(sanitizePathSegment), safeName].join("/")
  const storageRef = ref(storage, fullPath)

  try {
    await uploadBytes(storageRef, file, {
      contentType: file.type || undefined,
    })
    const url = await getDownloadURL(storageRef)
    return { url, fullPath }
  } catch (error) {
    if (error instanceof FirebaseError) {
      if (error.code === "storage/unauthorized") {
        throw new Error(
          "File upload was denied by Firebase Storage. Check Storage rules for the signed-in user.",
        )
      }

      if (error.code === "storage/unknown") {
        throw new Error(
          "File upload failed. Check NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, ensure the Storage bucket exists, and apply Storage CORS for this app origin.",
        )
      }
    }

    throw error instanceof Error
      ? error
      : new Error("File upload failed. Check Firebase Storage setup and try again.")
  }
}
