"use client"

import { useEffect, useState, useCallback } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { collection, getDocs, orderBy, query } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { richTextToPlainText } from "@/lib/render-rich"
import { FolderOpen, Lightbulb } from "lucide-react"

interface SearchResult {
  id: string
  title: string
  snippet: string
  type: "vault" | "idea"
}

export function CommandSearch({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const loadData = useCallback(async () => {
    if (!user || loaded) return
    try {
      const [vaultSnap, ideasSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user.uid, "vaultEntries"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "users", user.uid, "ideas"), orderBy("createdAt", "desc"))),
      ])
      const items: SearchResult[] = []
      vaultSnap.docs.forEach((d) => {
        const data = d.data()
        items.push({
          id: d.id,
          title: (data.title as string) ?? "",
          snippet: richTextToPlainText((data.note as string) ?? "").slice(0, 80),
          type: "vault",
        })
      })
      ideasSnap.docs.forEach((d) => {
        const data = d.data()
        items.push({
          id: d.id,
          title: (data.title as string) ?? "",
          snippet: richTextToPlainText((data.note as string) ?? "").slice(0, 80),
          type: "idea",
        })
      })
      setResults(items)
      setLoaded(true)
    } catch {
      /* silent — search is non-critical */
    }
  }, [user, loaded])

  useEffect(() => {
    if (open && !loaded) loadData()
  }, [open, loaded, loadData])

  const vaultResults = results.filter((r) => r.type === "vault")
  const ideaResults = results.filter((r) => r.type === "idea")

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search vault entries and ideas..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {vaultResults.length > 0 && (
          <CommandGroup heading="Knowledge Vault">
            {vaultResults.map((r) => (
              <CommandItem
                key={r.id}
                value={`vault-${r.title}-${r.snippet}`}
                onSelect={() => {
                  onNavigate("vault")
                  setOpen(false)
                }}
              >
                <FolderOpen className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm truncate">{r.title}</p>
                  {r.snippet && (
                    <p className="text-xs text-muted-foreground truncate">{r.snippet}</p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {ideaResults.length > 0 && (
          <CommandGroup heading="Ideas">
            {ideaResults.map((r) => (
              <CommandItem
                key={r.id}
                value={`idea-${r.title}-${r.snippet}`}
                onSelect={() => {
                  onNavigate("ideas")
                  setOpen(false)
                }}
              >
                <Lightbulb className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm truncate">{r.title}</p>
                  {r.snippet && (
                    <p className="text-xs text-muted-foreground truncate">{r.snippet}</p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
