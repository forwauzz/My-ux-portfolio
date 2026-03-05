import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"

const storageBucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "").replace(
  /^gs:\/\//,
  "",
)

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: storageBucket || undefined,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
const auth: Auth = getAuth(app)
const db: Firestore = getFirestore(app)
const storage: FirebaseStorage = getStorage(app)

export { app, auth, db, storage }
