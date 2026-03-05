"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type AuthError,
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function authErrorMessage(err: AuthError): string {
  switch (err.code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Sign in instead."
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password."
    case "auth/weak-password":
      return "Password should be at least 6 characters."
    case "auth/invalid-email":
      return "Please enter a valid email."
    default:
      return err.message || "Something went wrong. Try again."
  }
}

export default function LoginPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/")
    }
  }, [authLoading, user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError("Please enter email and password.")
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
      router.replace("/")
    } catch (err) {
      setError(authErrorMessage(err as AuthError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Learning Portfolio
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? "Create an account" : "Sign in to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Please wait…" : isSignUp ? "Sign up" : "Sign in"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsSignUp((v) => !v)
            setError(null)
          }}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isSignUp
            ? "Already have an account? Sign in"
            : "No account? Sign up"}
        </button>
      </div>
    </div>
  )
}
