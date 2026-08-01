import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  memoryLocalCache,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ── Firestore cache strategy (ADR-367 — single-tab + recovery listener) ──
// Production: persistentLocalCache + single-tab manager → offline support, no multi-tab
//   lease race. Multi-tab was swapped on 2026-05-20 after Sentry caught
//   "FIRESTORE INTERNAL ASSERTION FAILED (ID: b815)" at /dxf/viewer — a known
//   firebase-js-sdk bug triggered by tab-lease swap during onSnapshot delivery.
//   DXF viewer is a single-tab workflow; multi-tab sync is not worth the SDK risk.
//   See src/lib/firestore-recovery.ts for the safety-net error listener.
// Development: memoryLocalCache → no IndexedDB lease, eliminates "Failed to obtain primary
//   lease for action 'Release target'" warnings caused by Turbopack HMR reinitializing
//   the Firestore module while the previous instance tries to release query targets.
// SSR / Node: plain getFirestore (no IndexedDB available).
const isClient = typeof window !== 'undefined';
const isDev = process.env.NODE_ENV === 'development';
function createDb(): Firestore {
  if (!isClient) return getFirestore(app);
  try {
    const localCache = isDev
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentSingleTabManager({ forceOwnership: false }) });
    return initializeFirestore(app, { localCache });
  } catch {
    // initializeFirestore already called (HMR / repeat import) — reuse existing.
    return getFirestore(app);
  }
}
export const db: Firestore = createDb();
export const auth = getAuth(app);
export const storage = getStorage(app);

// ── Firebase Emulator Connection (QA/Dev mode) ───────────────────────
// When NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true, client SDK connects to local emulators.
// This keeps production Firestore safe during QA test runs.
// The Admin SDK auto-detects FIRESTORE_EMULATOR_HOST — no code needed there.
// ⚠️ ADR-745 Φάση Γ: κάθε σύνδεση σε **δικό της** try, και η αποτυχία **μιλάει**.
// Πριν, οι τρεις κλήσεις ήταν σε ένα try με `catch {}` χωρίς κανένα log. Αν έσκαγε
// η πρώτη (Firestore), η δεύτερη (**Auth**) δεν εκτελούνταν ποτέ — και ο client
// συνέχιζε να μιλά στην **παραγωγή** ενώ το flag έλεγε «emulator». Το σύμπτωμα
// έφτανε στον χρήστη ως «Λάθος κωδικός πρόσβασης» (ο demo χρήστης υπάρχει μόνο
// στον emulator), δηλαδή ως λάθος **διαπιστευτηρίων** ενώ ήταν λάθος **προορισμού**.
// Ένα dev flag που σιωπηλά γράφει στην παραγωγή δεν είναι θέμα άνεσης· είναι κίνδυνος.
function connectEmulatorOrReport(label: string, connect: () => void): void {
  try {
    connect();
    console.log(`🔧 Firebase ${label} emulator connected`);
  } catch (error) {
    // Το `already-connected` σε HMR είναι αναμενόμενο και ακίνδυνο — αλλά τυπώνεται
    // κι αυτό. Καλύτερα ένας θόρυβος στο dev παρά μια σιωπή που δείχνει στην παραγωγή.
    console.warn(
      `⚠️ Firebase ${label} emulator NOT connected — ο client μιλά στην ΠΑΡΑΓΩΓΗ γι' αυτό το προϊόν.`,
      error,
    );
  }
}

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  connectEmulatorOrReport('Firestore', () => connectFirestoreEmulator(db, 'localhost', 8080));
  connectEmulatorOrReport('Auth', () =>
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true }),
  );
  connectEmulatorOrReport('Storage', () => connectStorageEmulator(storage, 'localhost', 9199));
}

export default app;
