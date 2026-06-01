import { initializeApp, getApps } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Verify if all required config items exist
export const isFirebaseEnabled = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.authDomain
);

let db: ReturnType<typeof getFirestore> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;

if (isFirebaseEnabled) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    
    // Enable offline persistence (SCALE-02)
    if (typeof window !== "undefined") {
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn("Firestore persistence failed-precondition: Multiple tabs open.");
        } else if (err.code === 'unimplemented') {
          console.warn("Firestore persistence unimplemented: Browser doesn't support it.");
        }
      });
    }
    console.log("Firebase initialized successfully in live mode with offline persistence.");
  } catch (error) {
    console.error("Failed to initialize Firebase live client:", error);
  }
} else {
  console.warn("⚠️ HMMS WARNING (FEAT-04): Firebase keys missing. Running in local MOCK mode. This is insecure and NOT suitable for production deployment!");
}

export { db, auth, storage };
