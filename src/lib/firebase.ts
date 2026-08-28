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
import { getAuth, connectAuthEmulator, onAuthStateChanged } from 'firebase/auth';
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

/**
 * Περιμένει να **λυθεί** η αρχική ταυτότητα του Firebase.
 *
 * During SSR hydration, `auth.currentUser` is null even for logged-in users because
 * Firebase hasn't restored the session yet. This helper resolves once the first
 * `onAuthStateChanged` callback fires — at that point the auth state is authoritative
 * (user or null).
 *
 * @returns `true` if a user is authenticated, `false` otherwise
 *
 * ⚠️ **«Περίμενε να ΜΑΘΕΙΣ» ≠ «περίμενε να ΣΥΝΔΕΘΕΙ»**: επιλύεται στην **πρώτη** απάντηση,
 * **και όταν αυτή είναι `null`**. Ο αποσυνδεδεμένος δεν κρεμάει ποτέ.
 *
 * 🔑 **ΓΙΑΤΙ ΖΕΙ ΕΔΩ (μετακινήθηκε 2026-08-28)**: γεννήθηκε στο
 * `services/firestore/auth-context.ts` για τη διαδρομή Firestore. Όταν την ίδια απάντηση
 * χρειάστηκε και η διαδρομή **HTTP** (`lib/api/enterprise-api-client`), το `lib/` θα
 * εισήγαγε από το `services/` — **ανάποδο στρώμα**, και μετρημένα **έσπασε τρεις σουίτες
 * στο import** (`ReferenceError: fetch is not defined`: η αλυσίδα τραβούσε το node build
 * του `firebase/auth`, που τα διπλά του `@/lib/firebase` δεν κόβουν). Η συνάρτηση δεν έχει
 * **τίποτα** από Firestore: είναι καθαρά Auth, και ζει δίπλα στο `auth` που ρωτά.
 * Το `auth-context` το **ξανα-εξάγει**, ώστε οι τρεις υπάρχοντες καλούντες να μην αγγιχτούν.
 *
 * ⛔ **ΜΗΝ το ξαναγράψεις πάνω στο `auth.authStateReady()`.** Ναι, υπάρχει
 * (`@firebase/auth 1.12.0`). Αλλά είναι **σημασιολογικά ισοδύναμο**, όχι καλύτερο: η ίδια η
 * πηγή του SDK το υλοποιεί με `onAuthStateChanged`, και το `registerStateListener` καλεί το
 * πρώτο callback **μετά** το `_initializationPromise` — ακριβώς η εγγύηση που δίνει και το
 * παρακάτω. Αλλαγή ⇒ μηδέν παρατηρήσιμο κέρδος, ρίσκο σε **τέσσερις** ζωντανούς καλούντες.
 */
export function waitForAuthReady(): Promise<boolean> {
  // Already initialized — resolve immediately
  if (auth.currentUser) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(!!user);
    });
  });
}

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

// ══════════════════════════════════════════════════════════════════════════════
// 🔴 Ο ΦΡΟΥΡΟΣ ΤΟΥ ΠΡΟΟΡΙΣΜΟΥ — ΓΙΑΤΙ Ο ΠΡΟΗΓΟΥΜΕΝΟΣ ΗΤΑΝ **ΑΔΡΑΝΗΣ**
//
// Το `connectEmulatorOrReport` παραπάνω τυπώνει ✅/⚠️ **ΜΕΣΑ** στο `if`. Στις
// 2026-08-25 μετρήθηκε ότι το `if` **δεν αλήθευε ποτέ**: το Turbopack άφηνε το
// `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` ως runtime lookup πάνω στο polyfill του
// `process`, που στον browser είναι κενό ⇒ `undefined === 'true'` ⇒ false.
// **Δεν σιωπούσε επειδή πέτυχε· σιωπούσε επειδή δεν εκτελέστηκε** — φρουρός
// δομικά ανίκανος να πυροδοτήσει (ADR-749 §5).
//
// Το σύμπτωμα έφτασε στον άνθρωπο ως «**Μη έγκυρα στοιχεία σύνδεσης**»: λάθος
// **προορισμού** μεταμφιεσμένο σε λάθος **διαπιστευτηρίων**.
//
// 🔑 ΑΥΤΟΣ Ο ΕΛΕΓΧΟΣ ΖΕΙ **ΕΞΩ** ΑΠΟ ΤΟ `if`, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ.
// Δεν ρωτά «τι λέει το flag;» — ρωτά «**τρέχει emulator ενώ εμείς μιλάμε αλλού;**».
// Είναι η μόνη ερώτηση που πιάνει τη διαφορά ανάμεσα στη **δήλωση** και στον
// **προορισμό**, και γι' αυτό δεν επιτρέπεται να εξαρτάται από τη δήλωση.
//
// ⚠️ Μόνο σε development και μόνο στον browser: σε production δεν υπάρχει emulator
// να απαντήσει, και το αίτημα θα ήταν καθαρός θόρυβος.
// ⚠️ Δεν διορθώνει τίποτα μόνος του — **σκόπιμα**. Η σύνδεση στον emulator πρέπει
// να γίνει **πριν** την πρώτη χρήση του `auth`· ένα async fetch δεν προλαβαίνει.
// Η δουλειά του είναι να μη μείνει η βλάβη **αόρατη**.
// ══════════════════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const usingEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
  if (!usingEmulator) {
    void fetch('http://localhost:9099/', { mode: 'no-cors', signal: AbortSignal.timeout(1500) })
      .then(() => {
        console.error(
          '🔴 ΤΡΕΧΕΙ Firebase Auth emulator στο :9099, ΑΛΛΑ ο client μιλά στην ΠΑΡΑΓΩΓΗ.\n' +
            '   Το σύμπτωμα θα φτάσει ως «Μη έγκυρα στοιχεία σύνδεσης» — λάθος ΠΡΟΟΡΙΣΜΟΥ.\n' +
            '   Αιτία: το NEXT_PUBLIC_USE_FIREBASE_EMULATOR δεν έφτασε στο client bundle.\n' +
            '   Λύση: `npm run dev:emulator` (το next.config.js παράγει το flag από το\n' +
            '   FIREBASE_AUTH_EMULATOR_HOST) — και ΚΑΘΑΡΟ restart του dev server.',
        );
      })
      .catch(() => {
        // Κανένας emulator — φυσιολογικό `npm run dev`. Καμία σιωπή να εξηγηθεί.
      });
  }
}

export default app;
