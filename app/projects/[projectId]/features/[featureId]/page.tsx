"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MarkdownViewModal } from "@/components/markdown-view-modal"
import { uploadStorageFile } from "@/lib/upload-storage-file"
import { uploadImage } from "@/lib/upload-image"
import { ArrowDown, ArrowUp, FileText, ImageIcon, Link as LinkIcon, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react"

const FEATURE_STATUSES = [
  "Draft",
  "In Review",
  "Ready for Review",
  "Archived",
] as const

type FeatureStatus = (typeof FEATURE_STATUSES)[number]
type FeatureAttachmentType = "markdown" | "pdf" | "link" | "image" | "other"

interface FeatureDoc {
  title: string
  summary?: string
  description?: string
  status?: FeatureStatus
  createdAt?: string
  updatedAt?: string
}

interface FeatureAttachment {
  id: string
  title: string
  type: FeatureAttachmentType
  content?: string
  fileUrl?: string
  filePath?: string
  mimeType?: string
  sourceName?: string
  linkUrl?: string
  uploadedAt?: string
}

interface UploadedScreenVersion {
  label: string
  notes: string
  imageUrl: string
}

interface ScreenVersionDraft {
  id: string
  label: string
  notes: string
  imageFile: File | null
}

interface FeatureScreenVersion {
  id: string
  label: string
  imageUrl: string
  notes: string
  order: number
}

interface FeatureScreen {
  id: string
  title: string
  description: string
  order: number
  versions: FeatureScreenVersion[]
}

interface FeatureReviewSnapshot {
  featureId: string
  projectId: string
  title: string
  summary: string
  description: string
  attachments: FeatureAttachment[]
  screens: FeatureScreen[]
}

interface FeatureReviewListItem {
  id: string
  title: string
  status: "open" | "closed"
  createdAt?: string
}

interface EditableScreenVersion {
  id: string
  label: string
  notes: string
}

function emptyVersionDraft(label: string): ScreenVersionDraft {
  return {
    id: crypto.randomUUID(),
    label,
    notes: "",
    imageFile: null,
  }
}

export default function FeatureDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const projectId = typeof params.projectId === "string" ? params.projectId : ""
  const featureId = typeof params.featureId === "string" ? params.featureId : ""

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feature, setFeature] = useState<FeatureDoc | null>(null)
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<FeatureStatus>("Draft")
  const [attachments, setAttachments] = useState<FeatureAttachment[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(true)
  const [attachmentTitle, setAttachmentTitle] = useState("")
  const [attachmentType, setAttachmentType] = useState<FeatureAttachmentType>("markdown")
  const [attachmentContent, setAttachmentContent] = useState("")
  const [attachmentLinkUrl, setAttachmentLinkUrl] = useState("")
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentSaving, setAttachmentSaving] = useState(false)
  const [screens, setScreens] = useState<FeatureScreen[]>([])
  const [screensLoading, setScreensLoading] = useState(true)
  const [screenSaving, setScreenSaving] = useState(false)
  const [screenTitle, setScreenTitle] = useState("")
  const [screenDescription, setScreenDescription] = useState("")
  const [screenVersions, setScreenVersions] = useState<ScreenVersionDraft[]>([
    emptyVersionDraft("A"),
  ])
  const [screenHasAlternatives, setScreenHasAlternatives] = useState(false)
  const [editScreenId, setEditScreenId] = useState<string | null>(null)
  const [editScreenTitle, setEditScreenTitle] = useState("")
  const [editScreenDescription, setEditScreenDescription] = useState("")
  const [editScreenVersions, setEditScreenVersions] = useState<EditableScreenVersion[]>([])
  const [editScreenSaving, setEditScreenSaving] = useState(false)
  const [reviewLink, setReviewLink] = useState<string | null>(null)
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewHistory, setReviewHistory] = useState<FeatureReviewListItem[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewRecipientName, setReviewRecipientName] = useState("")
  const [reviewRecipientEmail, setReviewRecipientEmail] = useState("")
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [showReviewHistory, setShowReviewHistory] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (!projectId || !featureId) {
      setLoading(false)
      setError("Invalid feature route")
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const ref = doc(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "features",
          featureId,
        )
        const snap = await getDoc(ref)
        if (cancelled) return
        if (!snap.exists()) {
          setError("Feature not found")
          setLoading(false)
          return
        }
        const data = snap.data() as FeatureDoc
        setFeature(data)
        setTitle(data.title ?? "")
        setSummary(data.summary ?? "")
        setDescription(data.description ?? "")
        setStatus(data.status ?? "Draft")
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load feature")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, router, projectId, featureId])

  async function handleSave() {
    if (!user || !projectId || !featureId || !title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      await updateDoc(
        doc(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "features",
          featureId,
        ),
        {
          title: title.trim(),
          summary: summary.trim(),
          description,
          status,
          updatedAt: now,
          updatedAtServer: serverTimestamp(),
        },
      )
      setFeature((prev) =>
        prev
          ? {
              ...prev,
              title: title.trim(),
              summary: summary.trim(),
              description,
              status,
              updatedAt: now,
            }
          : prev,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feature")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (authLoading || !user || !projectId || !featureId) return
    let cancelled = false

    async function loadAttachments() {
      setAttachmentsLoading(true)
      try {
        const col = collection(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "features",
          featureId,
          "attachments",
        )
        const snap = await getDocs(query(col, orderBy("uploadedAt", "desc")))
        if (cancelled) return
        setAttachments(
          snap.docs.map((item) => {
            const data = item.data()
            return {
              id: item.id,
              title: (data.title as string) ?? "",
              type: (data.type as FeatureAttachmentType) ?? "other",
              content: (data.content as string | undefined) ?? undefined,
              fileUrl: (data.fileUrl as string | undefined) ?? undefined,
              filePath: (data.filePath as string | undefined) ?? undefined,
              mimeType: (data.mimeType as string | undefined) ?? undefined,
              sourceName: (data.sourceName as string | undefined) ?? undefined,
              linkUrl: (data.linkUrl as string | undefined) ?? undefined,
              uploadedAt: (data.uploadedAt as string | undefined) ?? undefined,
            }
          }),
        )
      } catch {
        if (!cancelled) setAttachments([])
      } finally {
        if (!cancelled) setAttachmentsLoading(false)
      }
    }

    loadAttachments()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, projectId, featureId])

  async function refreshAttachments() {
    if (!user || !projectId || !featureId) return
    const col = collection(
      db,
      "users",
      user.uid,
      "projects",
      projectId,
      "features",
      featureId,
      "attachments",
    )
    const snap = await getDocs(query(col, orderBy("uploadedAt", "desc")))
    setAttachments(
      snap.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          title: (data.title as string) ?? "",
          type: (data.type as FeatureAttachmentType) ?? "other",
          content: (data.content as string | undefined) ?? undefined,
          fileUrl: (data.fileUrl as string | undefined) ?? undefined,
          filePath: (data.filePath as string | undefined) ?? undefined,
          mimeType: (data.mimeType as string | undefined) ?? undefined,
          sourceName: (data.sourceName as string | undefined) ?? undefined,
          linkUrl: (data.linkUrl as string | undefined) ?? undefined,
          uploadedAt: (data.uploadedAt as string | undefined) ?? undefined,
        }
      }),
    )
  }

  useEffect(() => {
    if (authLoading || !user || !projectId || !featureId) return
    let cancelled = false

    async function loadScreens() {
      setScreensLoading(true)
      try {
        const screensCol = collection(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "features",
          featureId,
          "screens",
        )
        const screenSnap = await getDocs(query(screensCol, orderBy("order", "asc")))
        const screenItems = await Promise.all(
          screenSnap.docs.map(async (screenDoc) => {
            const screenData = screenDoc.data()
            const versionsCol = collection(
              db,
              "users",
              user.uid,
              "projects",
              projectId,
              "features",
              featureId,
              "screens",
              screenDoc.id,
              "versions",
            )
            const versionSnap = await getDocs(query(versionsCol, orderBy("order", "asc")))
            return {
              id: screenDoc.id,
              title: (screenData.title as string) ?? "",
              description: (screenData.description as string) ?? "",
              order: Number(screenData.order) || 1,
              versions: versionSnap.docs.map((versionDoc) => {
                const versionData = versionDoc.data()
                return {
                  id: versionDoc.id,
                  label: (versionData.label as string) ?? "",
                  imageUrl: (versionData.imageUrl as string) ?? "",
                  notes: (versionData.notes as string) ?? "",
                  order: Number(versionData.order) || 1,
                }
              }),
            } satisfies FeatureScreen
          }),
        )
        if (cancelled) return
        setScreens(screenItems)
      } catch {
        if (!cancelled) setScreens([])
      } finally {
        if (!cancelled) setScreensLoading(false)
      }
    }

    loadScreens()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, projectId, featureId])

  async function refreshScreens() {
    if (!user || !projectId || !featureId) return
    const screensCol = collection(
      db,
      "users",
      user.uid,
      "projects",
      projectId,
      "features",
      featureId,
      "screens",
    )
    const screenSnap = await getDocs(query(screensCol, orderBy("order", "asc")))
    const screenItems = await Promise.all(
      screenSnap.docs.map(async (screenDoc) => {
        const screenData = screenDoc.data()
        const versionsCol = collection(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "features",
          featureId,
          "screens",
          screenDoc.id,
          "versions",
        )
        const versionSnap = await getDocs(query(versionsCol, orderBy("order", "asc")))
        return {
          id: screenDoc.id,
          title: (screenData.title as string) ?? "",
          description: (screenData.description as string) ?? "",
          order: Number(screenData.order) || 1,
          versions: versionSnap.docs.map((versionDoc) => {
            const versionData = versionDoc.data()
            return {
              id: versionDoc.id,
              label: (versionData.label as string) ?? "",
              imageUrl: (versionData.imageUrl as string) ?? "",
              notes: (versionData.notes as string) ?? "",
              order: Number(versionData.order) || 1,
            }
          }),
        } satisfies FeatureScreen
      }),
    )
    setScreens(screenItems)
  }

  function openEditScreen(screen: FeatureScreen) {
    setEditScreenId(screen.id)
    setEditScreenTitle(screen.title)
    setEditScreenDescription(screen.description)
    setEditScreenVersions(
      screen.versions.map((version) => ({
        id: version.id,
        label: version.label,
        notes: version.notes,
      })),
    )
  }

  function closeEditScreen() {
    setEditScreenId(null)
    setEditScreenTitle("")
    setEditScreenDescription("")
    setEditScreenVersions([])
  }

  function updateEditScreenVersion(id: string, patch: Partial<EditableScreenVersion>) {
    setEditScreenVersions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  function addScreenVersionDraft() {
    if (screenVersions.length >= 3) return
    const nextLabel = ["A", "B", "C"][screenVersions.length] ?? `V${screenVersions.length + 1}`
    setScreenVersions((prev) => [...prev, emptyVersionDraft(nextLabel)])
  }

  function removeScreenVersionDraft(id: string) {
    if (screenVersions.length <= 1) return
    setScreenVersions((prev) => prev.filter((item) => item.id !== id))
  }

  function updateScreenVersionDraft(
    id: string,
    patch: Partial<ScreenVersionDraft>,
  ) {
    setScreenVersions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  async function handleAddScreen() {
    if (!user || !projectId || !featureId || !screenTitle.trim()) return
    const usableVersions = screenVersions.filter((version) => version.imageFile)
    if (usableVersions.length === 0) {
      setError("Add at least one screen version image.")
      return
    }

    setScreenSaving(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      const uploadedVersions: UploadedScreenVersion[] = []

      for (let index = 0; index < usableVersions.length; index++) {
        const version = usableVersions[index]
        try {
          const imageUrl = await uploadImage(version.imageFile!)
          uploadedVersions.push({
            label: version.label.trim() || String.fromCharCode(65 + index),
            notes: version.notes.trim(),
            imageUrl,
          })
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error("Image upload failed. Check IMGBB_API_KEY and try again.")
        }
      }

      const screensCol = collection(
        db,
        "users",
        user.uid,
        "projects",
        projectId,
        "features",
        featureId,
        "screens",
      )
      const nextOrder = screens.length + 1
      const screenDoc = await addDoc(screensCol, {
        title: screenTitle.trim(),
        description: screenDescription.trim(),
        order: nextOrder,
        createdAt: now,
        updatedAt: now,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      })

      const versionsCol = collection(
        db,
        "users",
        user.uid,
        "projects",
        projectId,
        "features",
        featureId,
        "screens",
        screenDoc.id,
        "versions",
      )

      for (let index = 0; index < uploadedVersions.length; index++) {
        const version = uploadedVersions[index]
        await addDoc(versionsCol, {
          label: version.label,
          notes: version.notes,
          imageUrl: version.imageUrl,
          order: index + 1,
          createdAt: now,
          createdAtServer: serverTimestamp(),
        })
      }

      setScreenTitle("")
      setScreenDescription("")
      setScreenVersions([emptyVersionDraft("A")])
      setScreenHasAlternatives(false)
      await refreshScreens()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add screen")
    } finally {
      setScreenSaving(false)
    }
  }

  async function handleSaveScreenEdit() {
    if (!user || !projectId || !featureId || !editScreenId || !editScreenTitle.trim()) return
    setEditScreenSaving(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      await updateDoc(
        doc(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "features",
          featureId,
          "screens",
          editScreenId,
        ),
        {
          title: editScreenTitle.trim(),
          description: editScreenDescription.trim(),
          updatedAt: now,
          updatedAtServer: serverTimestamp(),
        },
      )

      await Promise.all(
        editScreenVersions.map((version) =>
          updateDoc(
            doc(
              db,
              "users",
              user.uid,
              "projects",
              projectId,
              "features",
              featureId,
              "screens",
              editScreenId,
              "versions",
              version.id,
            ),
            {
              label: version.label.trim(),
              notes: version.notes.trim(),
              updatedAt: now,
              updatedAtServer: serverTimestamp(),
            },
          ),
        ),
      )

      closeEditScreen()
      await refreshScreens()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update screen")
    } finally {
      setEditScreenSaving(false)
    }
  }

  async function handleDeleteScreen(screenId: string) {
    if (!user || !projectId || !featureId) return
    setError(null)
    try {
      const batch = writeBatch(db)
      const versionsCol = collection(
        db,
        "users",
        user.uid,
        "projects",
        projectId,
        "features",
        featureId,
        "screens",
        screenId,
        "versions",
      )
      const versionSnap = await getDocs(versionsCol)
      versionSnap.docs.forEach((versionDoc) => batch.delete(versionDoc.ref))
      batch.delete(
        doc(
          db,
          "users",
          user.uid,
          "projects",
          projectId,
          "features",
          featureId,
          "screens",
          screenId,
        ),
      )
      await batch.commit()

      const remainingScreens = screens
        .filter((screen) => screen.id !== screenId)
        .map((screen, index) => ({ ...screen, order: index + 1 }))
      if (remainingScreens.length > 0) {
        const reorderBatch = writeBatch(db)
        remainingScreens.forEach((screen) => {
          reorderBatch.update(
            doc(
              db,
              "users",
              user.uid,
              "projects",
              projectId,
              "features",
              featureId,
              "screens",
              screen.id,
            ),
            {
              order: screen.order,
              updatedAt: new Date().toISOString(),
              updatedAtServer: serverTimestamp(),
            },
          )
        })
        await reorderBatch.commit()
      }

      if (editScreenId === screenId) {
        closeEditScreen()
      }
      await refreshScreens()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete screen")
    }
  }

  async function handleMoveScreen(screenId: string, direction: "up" | "down") {
    if (!user || !projectId || !featureId) return
    const currentIndex = screens.findIndex((screen) => screen.id === screenId)
    if (currentIndex === -1) return
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= screens.length) return

    const reordered = [...screens]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    try {
      const batch = writeBatch(db)
      reordered.forEach((screen, index) => {
        batch.update(
          doc(
            db,
            "users",
            user.uid,
            "projects",
            projectId,
            "features",
            featureId,
            "screens",
            screen.id,
          ),
          {
            order: index + 1,
            updatedAt: new Date().toISOString(),
            updatedAtServer: serverTimestamp(),
          },
        )
      })
      await batch.commit()
      await refreshScreens()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder screens")
    }
  }

  async function handleAddAttachment() {
    if (!user || !projectId || !featureId || !attachmentTitle.trim()) return
    setAttachmentSaving(true)
    setError(null)
    try {
      const attachmentRef = collection(
        db,
        "users",
        user.uid,
        "projects",
        projectId,
        "features",
        featureId,
        "attachments",
      )
      const now = new Date().toISOString()
      const baseData: Record<string, unknown> = {
        title: attachmentTitle.trim(),
        type: attachmentType,
        uploadedAt: now,
        uploadedAtServer: serverTimestamp(),
      }

      if (attachmentType === "markdown") {
        if (!attachmentContent.trim() && !attachmentFile) {
          throw new Error("Add markdown content or upload a .md file.")
        }
        let content = attachmentContent
        let sourceName = ""
        if (attachmentFile) {
          content = await attachmentFile.text()
          sourceName = attachmentFile.name
        }
        baseData.content = content
        if (sourceName) baseData.sourceName = sourceName
      } else if (attachmentType === "link") {
        if (!attachmentLinkUrl.trim()) {
          throw new Error("Add a link URL.")
        }
        baseData.linkUrl = attachmentLinkUrl.trim()
      } else if (attachmentType === "image") {
        if (!attachmentFile) {
          throw new Error("Choose an image to upload.")
        }
        const fileUrl = await uploadImage(attachmentFile)
        baseData.fileUrl = fileUrl
        baseData.mimeType = attachmentFile.type || undefined
        baseData.sourceName = attachmentFile.name
      } else {
        if (!attachmentFile) {
          throw new Error("Choose a file to upload.")
        }
        const uploaded = await uploadStorageFile(attachmentFile, [
          "feature-attachments",
          user.uid,
          projectId,
          featureId,
        ])
        baseData.fileUrl = uploaded.url
        baseData.filePath = uploaded.fullPath
        baseData.mimeType = attachmentFile.type || undefined
        baseData.sourceName = attachmentFile.name
      }

      await addDoc(attachmentRef, baseData)
      setAttachmentTitle("")
      setAttachmentContent("")
      setAttachmentLinkUrl("")
      setAttachmentFile(null)
      setAttachmentType("markdown")
      await refreshAttachments()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add attachment")
    } finally {
      setAttachmentSaving(false)
    }
  }

  async function handleCreateReviewLink() {
    if (!user || !projectId || !featureId || !title.trim()) return
    setReviewSaving(true)
    setError(null)
    setReviewLink(null)
    try {
      const reviewId = crypto.randomUUID()
      const now = new Date().toISOString()
      const payload: FeatureReviewSnapshot = {
        featureId,
        projectId,
        title: title.trim(),
        summary: summary.trim(),
        description,
        attachments,
        screens,
      }
      await setDoc(
        doc(db, "featureReviews", reviewId),
        {
          userId: user.uid,
          projectId,
          featureId,
          title: title.trim(),
          status: "open",
          includeAttachments: true,
          createdAt: now,
          updatedAt: now,
          payload,
        },
      )
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}/review/${reviewId}`
          : `/review/${reviewId}`
      setReviewLink(url)
      await refreshReviewHistory()
      if (typeof navigator !== "undefined") {
        await navigator.clipboard.writeText(url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create review link")
    } finally {
      setReviewSaving(false)
    }
  }

  useEffect(() => {
    if (authLoading || !user || !projectId || !featureId) return
    let cancelled = false

    async function loadReviewHistory() {
      setReviewsLoading(true)
      try {
        const reviewSnap = await getDocs(
          query(
            collection(db, "featureReviews"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
          ),
        )
        if (cancelled) return
        const items = reviewSnap.docs
          .map((reviewDoc) => {
            const data = reviewDoc.data()
            return {
              id: reviewDoc.id,
              title: (data.title as string) ?? "",
              status: ((data.status as "open" | "closed" | undefined) ?? "open"),
              createdAt: (data.createdAt as string | undefined) ?? undefined,
              projectId: (data.projectId as string | undefined) ?? "",
              featureId: (data.featureId as string | undefined) ?? "",
            }
          })
          .filter((item) => item.projectId === projectId && item.featureId === featureId)
          .map(({ projectId: _projectId, featureId: _featureId, ...item }) => item)
        setReviewHistory(items)
      } catch {
        if (!cancelled) setReviewHistory([])
      } finally {
        if (!cancelled) setReviewsLoading(false)
      }
    }

    loadReviewHistory()
    return () => {
      cancelled = true
    }
  }, [authLoading, featureId, projectId, user])

  async function refreshReviewHistory() {
    if (!user || !projectId || !featureId) return
    const reviewSnap = await getDocs(
      query(
        collection(db, "featureReviews"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
      ),
    )
    const items = reviewSnap.docs
      .map((reviewDoc) => {
        const data = reviewDoc.data()
        return {
          id: reviewDoc.id,
          title: (data.title as string) ?? "",
          status: ((data.status as "open" | "closed" | undefined) ?? "open"),
          createdAt: (data.createdAt as string | undefined) ?? undefined,
          projectId: (data.projectId as string | undefined) ?? "",
          featureId: (data.featureId as string | undefined) ?? "",
        }
      })
      .filter((item) => item.projectId === projectId && item.featureId === featureId)
      .map(({ projectId: _projectId, featureId: _featureId, ...item }) => item)
    setReviewHistory(items)
  }

  function buildReviewInviteMessage(link: string) {
    const recipient = reviewRecipientName.trim() || "team"
    const screenCount = screens.length
    return `Hi ${recipient},

Could you review this feature for me?

Feature: ${title.trim() || "Untitled feature"}
${summary.trim() ? `Summary: ${summary.trim()}` : ""}
Screens to review: ${screenCount}

Open review:
${link}

Please go screen by screen, leave short notes directly on the UI if needed, and click next until you're done.

Thanks.`
  }

  const isReviewReady = title.trim().length > 0 && screens.length > 0
  const latestReview = reviewHistory[0] ?? null

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) return null

  if (error || !feature) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">{error ?? "Feature not found"}</p>
          <Link href="/">
            <Button variant="outline" size="sm">
              Back to projects
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Feature workspace
            </h1>
            <p className="text-sm text-foreground mt-1">{title || "Untitled feature"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={saving || !title.trim()}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save feature"}
            </Button>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="text-xs">
                Back to projects
              </Button>
            </Link>
          </div>
        </div>
        <div className="h-px bg-accent" />
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <section id="feature-screens" className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Review workflow
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-sm border border-border bg-secondary/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">1. Prepare</p>
              <p className="text-sm text-foreground mt-2">
                {isReviewReady
                  ? `${screens.length} screen${screens.length === 1 ? "" : "s"} ready to review`
                  : "Add a title and at least one screen"}
              </p>
              <div className="flex gap-3 mt-3 text-[11px]">
                <a href="#feature-foundation" className="text-muted-foreground hover:text-foreground">
                  Edit details
                </a>
                <a href="#feature-screens" className="text-muted-foreground hover:text-foreground">
                  Manage screens
                </a>
              </div>
            </div>
            <div className="rounded-sm border border-border bg-secondary/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">2. Send</p>
              <p className="text-sm text-foreground mt-2">
                {reviewLink
                  ? "Review link created. Send it to your teammate."
                  : isReviewReady
                    ? "Create a public review link from this feature snapshot"
                    : "Complete setup first"}
              </p>
              <div className="mt-3">
                {reviewLink ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 text-xs"
                    onClick={() => setSendDialogOpen(true)}
                  >
                    Send to teammate
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 text-xs"
                    disabled={reviewSaving || !isReviewReady}
                    onClick={handleCreateReviewLink}
                  >
                    {reviewSaving ? "Creating..." : "Create review link"}
                  </Button>
                )}
              </div>
            </div>
            <div className="rounded-sm border border-border bg-secondary/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">3. Results</p>
              <p className="text-sm text-foreground mt-2">
                {latestReview
                  ? "Open the latest review results once feedback starts coming in"
                  : "Results will appear here after you create a review"}
              </p>
              <div className="mt-3">
                {latestReview ? (
                  <Link href={`/review/${latestReview.id}/results`}>
                    <Button variant="ghost" size="sm" className="px-0 text-xs">
                      View latest results
                    </Button>
                  </Link>
                ) : (
                  <span className="text-[11px] text-muted-foreground">No review yet</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="feature-foundation" className="rounded-sm border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Feature foundation
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_220px] gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="feature-title" className="text-xs text-muted-foreground">
                Title
              </Label>
              <Input
                id="feature-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Feature title"
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as FeatureStatus)}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEATURE_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feature-summary" className="text-xs text-muted-foreground">
              Summary
            </Label>
            <Input
              id="feature-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short summary for future reviewers"
              className="text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Document the feature intent, target user, and review context."
              minHeightClassName="min-h-40"
            />
          </div>
        </section>

        <section className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Send for review
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4 max-w-3xl">
            Create a review link from the current feature snapshot, then send it to a teammate. Keep past links hidden unless you need them.
          </p>
          <div className="rounded-sm border border-border bg-secondary/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={reviewSaving || !isReviewReady}
                onClick={handleCreateReviewLink}
              >
                {reviewSaving ? "Creating link..." : "Create public review link"}
              </Button>
              {!isReviewReady && (
                <p className="text-[11px] text-muted-foreground self-center">
                  Add a feature title and at least one screen before generating a review link.
                </p>
              )}
            </div>
            {reviewLink && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Latest review link</Label>
                <div className="flex flex-col md:flex-row gap-2">
                  <Input value={reviewLink} readOnly className="text-xs font-mono" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => navigator.clipboard.writeText(reviewLink)}
                  >
                    Copy again
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The link was copied to the clipboard when it was created.
                </p>
              </div>
            )}

            {reviewLink && (
              <div className="flex flex-wrap gap-2">
                <Dialog
                  open={sendDialogOpen}
                  onOpenChange={(open) => {
                    if (reviewLink) {
                      setSendDialogOpen(open)
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="text-xs">
                      Send to teammate
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Send review</DialogTitle>
                      <DialogDescription>
                        Keep this simple. Add the teammate details, then copy the invite or open an email draft.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="rounded-sm border border-border bg-secondary/20 p-4">
                        <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">This review includes</p>
                        <p className="text-sm text-foreground mt-2">
                          {screens.length} screen{screens.length === 1 ? "" : "s"} with notes and review instructions.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="review-recipient-name" className="text-xs text-muted-foreground">
                            Teammate name
                          </Label>
                          <Input
                            id="review-recipient-name"
                            value={reviewRecipientName}
                            onChange={(e) => setReviewRecipientName(e.target.value)}
                            placeholder="E.g. Sarah"
                            className="text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="review-recipient-email" className="text-xs text-muted-foreground">
                            Teammate email
                          </Label>
                          <Input
                            id="review-recipient-email"
                            type="email"
                            value={reviewRecipientEmail}
                            onChange={(e) => setReviewRecipientEmail(e.target.value)}
                            placeholder="Optional"
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => navigator.clipboard.writeText(buildReviewInviteMessage(reviewLink))}
                        >
                          Copy invite message
                        </Button>
                        {reviewRecipientEmail.trim() && (
                          <a
                            href={`mailto:${encodeURIComponent(reviewRecipientEmail.trim())}?subject=${encodeURIComponent(`Review request: ${title.trim() || "Feature review"}`)}&body=${encodeURIComponent(buildReviewInviteMessage(reviewLink))}`}
                          >
                            <Button type="button" variant="ghost" size="sm" className="text-xs">
                              Open email draft
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowReviewHistory((prev) => !prev)}
                >
                  {showReviewHistory ? "Hide review history" : "Show review history"}
                </Button>
              </div>
            )}

            <div className="pt-2 border-t border-border/60">
              <Label className="text-xs text-muted-foreground">Review history</Label>
              {!showReviewHistory ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Past review links are hidden by default to keep this workspace focused.
                </p>
              ) : reviewsLoading ? (
                <p className="text-sm text-muted-foreground mt-2">Loading reviews...</p>
              ) : reviewHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">
                  No review links have been created for this feature yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  {reviewHistory.map((reviewItem) => {
                    const publicLink =
                      typeof window !== "undefined"
                        ? `${window.location.origin}/review/${reviewItem.id}`
                        : `/review/${reviewItem.id}`
                    return (
                      <div
                        key={reviewItem.id}
                        className="rounded-sm border border-border bg-card px-4 py-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">
                              {reviewItem.title || "Untitled review"}
                            </p>
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground uppercase">
                              {reviewItem.status}
                            </span>
                          </div>
                          {reviewItem.createdAt && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {new Date(reviewItem.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => navigator.clipboard.writeText(publicLink)}
                          >
                            Copy link
                          </Button>
                          <Link href={`/review/${reviewItem.id}`} target="_blank">
                            <Button variant="ghost" size="sm" className="text-xs">
                              Open review
                            </Button>
                          </Link>
                          <Link href={`/review/${reviewItem.id}/results`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              View results
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Screens and versions
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4 max-w-3xl">
            Keep this simple: add one screen per UI you want reviewed, give it a clear
            description, and upload one image. Add extra versions only when you want
            reviewers to compare alternatives.
          </p>

          <div className="rounded-sm border border-border bg-secondary/20 p-4 space-y-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="screen-title" className="text-xs text-muted-foreground">
                  Screen title
                </Label>
                <Input
                  id="screen-title"
                  value={screenTitle}
                  onChange={(e) => setScreenTitle(e.target.value)}
                  placeholder="E.g. Candidate dashboard"
                  className="text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="screen-description" className="text-xs text-muted-foreground">
                  Screen description
                </Label>
                <Input
                  id="screen-description"
                  value={screenDescription}
                  onChange={(e) => setScreenDescription(e.target.value)}
                  placeholder="What should the reviewer look for on this screen?"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="rounded-sm border border-border bg-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Review a single image by default</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Turn on alternatives only if you want the team to compare multiple versions of the same screen.
                </p>
              </div>
              <Button
                type="button"
                variant={screenHasAlternatives ? "outline" : "ghost"}
                size="sm"
                className="text-xs"
                onClick={() => {
                  if (screenHasAlternatives) {
                    setScreenHasAlternatives(false)
                    setScreenVersions((prev) => [prev[0] ?? emptyVersionDraft("A")])
                    return
                  }
                  setScreenHasAlternatives(true)
                  if (screenVersions.length === 1) {
                    setScreenVersions((prev) => [...prev, emptyVersionDraft("B")])
                  }
                }}
              >
                {screenHasAlternatives ? "Remove alternatives" : "Compare alternatives"}
              </Button>
            </div>

            <div className="space-y-3">
              {screenVersions.map((version, index) => (
                <div
                  key={version.id}
                  className="rounded-sm border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {screenHasAlternatives ? `Version ${version.label || index + 1}` : "Screen image"}
                      </span>
                    </div>
                    {screenHasAlternatives && screenVersions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => removeScreenVersionDraft(version.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {screenHasAlternatives && (
                    <div className="grid grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)] gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">Label</Label>
                        <Input
                          value={version.label}
                          onChange={(e) =>
                            updateScreenVersionDraft(version.id, { label: e.target.value })
                          }
                          placeholder="A"
                          className="text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">Notes</Label>
                        <Input
                          value={version.notes}
                          onChange={(e) =>
                            updateScreenVersionDraft(version.id, { notes: e.target.value })
                          }
                          placeholder="Optional notes for this version"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Upload UI image</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        updateScreenVersionDraft(version.id, {
                          imageFile: e.target.files ? e.target.files[0] ?? null : null,
                        })
                      }
                      className="text-sm"
                    />
                    {version.imageFile && (
                      <p className="text-[11px] text-muted-foreground">{version.imageFile.name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {screenHasAlternatives && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5"
                  disabled={screenVersions.length >= 3}
                  onClick={addScreenVersionDraft}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add version
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={screenSaving || !screenTitle.trim()}
                onClick={handleAddScreen}
              >
                {screenSaving ? "Saving..." : "Add screen"}
              </Button>
            </div>
          </div>

          {screensLoading ? (
            <p className="text-sm text-muted-foreground">Loading screens...</p>
          ) : screens.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-card/50 p-6 text-center">
              <p className="text-sm font-medium text-foreground">
                No screens yet.
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
                Start with one screen, one image, and one clear description. You only need extra versions if you want reviewers to compare alternatives.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {screens.map((screen) => (
                <div
                  key={screen.id}
                  className="rounded-sm border border-border bg-card px-4 py-4 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{screen.title}</p>
                      {screen.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {screen.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {screen.versions.length} version{screen.versions.length === 1 ? "" : "s"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        disabled={screen.order === 1}
                        onClick={() => handleMoveScreen(screen.id, "up")}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        disabled={screen.order === screens.length}
                        onClick={() => handleMoveScreen(screen.id, "down")}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => openEditScreen(screen)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                        onClick={() => handleDeleteScreen(screen.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {screen.versions.map((version) => (
                      <div
                        key={version.id}
                        className="rounded-sm border border-border bg-secondary/20 p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                            Version {version.label}
                          </span>
                        </div>
                        <div className="aspect-[4/3] rounded-sm border border-border/60 bg-muted/20 overflow-hidden flex items-center justify-center">
                          {version.imageUrl ? (
                            <img
                              src={version.imageUrl}
                              alt={`${screen.title} version ${version.label}`}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="text-muted-foreground">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        {version.notes && (
                          <p className="text-xs text-muted-foreground">{version.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Attachments
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4 max-w-3xl">
            Add PRDs, markdown notes, reference links, and PDFs that reviewers should
            read before they comment on screens.
          </p>

          <div className="rounded-sm border border-border bg-secondary/20 p-4 space-y-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_220px] gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attachment-title" className="text-xs text-muted-foreground">
                  Attachment title
                </Label>
                <Input
                  id="attachment-title"
                  value={attachmentTitle}
                  onChange={(e) => setAttachmentTitle(e.target.value)}
                  placeholder="E.g. Candidate onboarding PRD"
                  className="text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Attachment type</Label>
                <Select
                  value={attachmentType}
                  onValueChange={(val) => {
                    setAttachmentType(val as FeatureAttachmentType)
                    setAttachmentContent("")
                    setAttachmentLinkUrl("")
                    setAttachmentFile(null)
                  }}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="other">Other file</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {attachmentType === "markdown" && (
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="attachment-markdown" className="text-xs text-muted-foreground">
                    Markdown content
                  </Label>
                  <Textarea
                    id="attachment-markdown"
                    value={attachmentContent}
                    onChange={(e) => setAttachmentContent(e.target.value)}
                    placeholder="Paste the PRD or markdown notes here..."
                    rows={8}
                    className="text-sm resize-y"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="attachment-markdown-file" className="text-xs text-muted-foreground">
                    Or upload a markdown file
                  </Label>
                  <Input
                    id="attachment-markdown-file"
                    type="file"
                    accept=".md,text/markdown,text/plain"
                    onChange={(e) =>
                      setAttachmentFile(e.target.files ? e.target.files[0] ?? null : null)
                    }
                    className="text-sm"
                  />
                  {attachmentFile && (
                    <p className="text-[11px] text-muted-foreground">{attachmentFile.name}</p>
                  )}
                </div>
              </div>
            )}

            {attachmentType === "link" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attachment-link" className="text-xs text-muted-foreground">
                  Link URL
                </Label>
                <Input
                  id="attachment-link"
                  type="url"
                  value={attachmentLinkUrl}
                  onChange={(e) => setAttachmentLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="text-sm"
                />
              </div>
            )}

            {(attachmentType === "pdf" || attachmentType === "image" || attachmentType === "other") && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attachment-file" className="text-xs text-muted-foreground">
                  Upload file
                </Label>
                <Input
                  id="attachment-file"
                  type="file"
                  accept={
                    attachmentType === "pdf"
                      ? ".pdf,application/pdf"
                      : attachmentType === "image"
                        ? "image/*"
                        : undefined
                  }
                  onChange={(e) =>
                    setAttachmentFile(e.target.files ? e.target.files[0] ?? null : null)
                  }
                  className="text-sm"
                />
                {attachmentFile && (
                  <p className="text-[11px] text-muted-foreground">{attachmentFile.name}</p>
                )}
              </div>
            )}

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={attachmentSaving || !attachmentTitle.trim()}
                onClick={handleAddAttachment}
              >
                {attachmentSaving ? "Saving..." : "Add attachment"}
              </Button>
            </div>
          </div>

          {attachmentsLoading ? (
            <p className="text-sm text-muted-foreground">Loading attachments...</p>
          ) : attachments.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-card/50 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No attachments yet. Add PRD material before sending the feature for review.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="rounded-sm border border-border bg-card px-4 py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {attachment.title}
                      </p>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {attachment.type}
                      </span>
                      {attachment.sourceName && (
                        <span className="text-[11px] text-muted-foreground truncate">
                          {attachment.sourceName}
                        </span>
                      )}
                    </div>
                    {attachment.type === "markdown" && attachment.content && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-2xl line-clamp-2">
                        {attachment.content}
                      </p>
                    )}
                    {attachment.type === "link" && attachment.linkUrl && (
                      <a
                        href={attachment.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-foreground underline decoration-accent underline-offset-2 break-all mt-1 inline-block"
                      >
                        {attachment.linkUrl}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {attachment.type === "markdown" && attachment.content ? (
                      <MarkdownViewModal
                        content={attachment.content}
                        title={attachment.title}
                        trigger={
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            View
                          </span>
                        }
                        triggerClassName="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                      />
                    ) : attachment.type === "link" && attachment.linkUrl ? (
                      <a
                        href={attachment.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        Open
                      </a>
                    ) : attachment.fileUrl ? (
                      <a
                        href={attachment.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        Open file
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Dialog open={editScreenId !== null} onOpenChange={(open) => !open && closeEditScreen()}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit screen</DialogTitle>
              <DialogDescription>
                Update the screen title, description, and version notes without rebuilding the review.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-screen-title" className="text-xs text-muted-foreground">
                    Screen title
                  </Label>
                  <Input
                    id="edit-screen-title"
                    value={editScreenTitle}
                    onChange={(e) => setEditScreenTitle(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-screen-description" className="text-xs text-muted-foreground">
                    Screen description
                  </Label>
                  <Input
                    id="edit-screen-description"
                    value={editScreenDescription}
                    onChange={(e) => setEditScreenDescription(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {editScreenVersions.length > 0 && (
                <div className="space-y-3">
                  {editScreenVersions.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-sm border border-border bg-secondary/20 p-4 space-y-3"
                    >
                      <p className="text-xs font-medium text-foreground">
                        Version {version.label}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)] gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs text-muted-foreground">Label</Label>
                          <Input
                            value={version.label}
                            onChange={(e) =>
                              updateEditScreenVersion(version.id, { label: e.target.value })
                            }
                            className="text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs text-muted-foreground">Notes</Label>
                          <Input
                            value={version.notes}
                            onChange={(e) =>
                              updateEditScreenVersion(version.id, { notes: e.target.value })
                            }
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={closeEditScreen}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={editScreenSaving || !editScreenTitle.trim()}
                  onClick={handleSaveScreenEdit}
                >
                  {editScreenSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <section className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-px bg-accent" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
              Next chunks
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-sm border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium text-foreground">Attachments</p>
              <p className="text-xs text-muted-foreground mt-1">
                PRD, markdown, PDF, and supporting links will live here.
              </p>
            </div>
            <div className="rounded-sm border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium text-foreground">Screens and versions</p>
              <p className="text-xs text-muted-foreground mt-1">
                Group UI screens and add up to three versions per screen.
              </p>
            </div>
            <div className="rounded-sm border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium text-foreground">External review</p>
              <p className="text-xs text-muted-foreground mt-1">
                Public review links, annotations, and reviewer submissions come next.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
