/**
 * ADR-798 Φάση 6 — **ΜΙΑ** μηχανή για «φτιάξε ταυτότητα στον emulator».
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ MODULE, ΚΑΙ ΓΙΑΤΙ ΤΩΡΑ
 *
 * Το `emulator-seed-demo-tenant.ts` (ADR-745 Φάση Γ) έφτιαχνε **έναν** χρήστη με
 * τον φρουρό, το `ensureUser` και τα claims **μέσα** του. Τη στιγμή που
 * χρειάστηκε **δεύτερος** σπορέας (οι προσωπικότητες του ADR-798), η επιλογή
 * ήταν είτε αντιγραφή ~80 γραμμών — που το **CHECK 3.28** (jscpd) πιάνει, και
 * σωστά — είτε εξαγωγή. Εξήχθη.
 *
 * ⚠️ **ΔΕΝ είναι δεύτερη αυθεντία δίπλα στο `lib/auth/set-claims-with-mirror.ts`.**
 * Εκείνο είναι `import 'server-only'` και **δεν φορτώνεται** εκτός Next runtime.
 * Το σχήμα εδώ είναι σκόπιμα **ταυτόσημο** (ADR-360: `claimsUpdatedAt` **μέσα**
 * στα claims **και** στο `users/{uid}`) — αν αλλάξει εκεί, αλλάζει κι εδώ.
 *
 * 🔴 **ΚΑΜΙΑ ΔΙΑΔΡΟΜΗ ΠΡΟΣ ΤΗΝ ΠΑΡΑΓΩΓΗ.** Ο φρουρός αρνείται χωρίς **ενεργό**
 * emulator, και το Admin SDK αρχικοποιείται **χωρίς credential**: χωρίς αυτό δεν
 * *μπορεί* να φτάσει αλλού, ό,τι env vars κι αν βρει.
 *
 * @module scripts/lib/emulator/identity
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';

/** Πρέπει να ταυτίζεται με τον client (`NEXT_PUBLIC_FIREBASE_PROJECT_ID`), αλλιώς
 *  ο emulator κρατά τα δεδομένα σε **άλλο namespace** και η οθόνη βλέπει άδεια
 *  βάση ενώ ο σπορέας «πέτυχε». */
export const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'pagonis-87766';
export const FIRESTORE_HOST = 'localhost:8080';
export const AUTH_HOST = 'localhost:9099';

/**
 * ⚠️ **ΔΕΝ γράφεται σκληρά.** Το CHECK 10 μπλοκάρει κάθε `password: '…'` και έχει
 * δίκιο ως σχήμα — ο σαρωτής δεν μπορεί να ξέρει ποιο literal είναι αθώο, και ένα
 * gate που αποφασίζει «αυτό δεν πειράζει» παύει να είναι gate.
 */
export const SEED_CREDENTIAL = process.env.DEMO_SEED_PASSWORD ?? 'demo1234';

/**
 * Η **επαγγελματική ιδιότητα** — τα τέσσερα **επίπεδα** πεδία του ADR-798 Ο-1.
 *
 * ⚠️ Επίπεδα και όχι υπο-αντικείμενο, γιατί το `firestore.rules` κρίνει με
 * `diff().affectedKeys()`, που επιστρέφει **κορυφαία** κλειδιά μόνο.
 */
export interface SeedOccupation {
  readonly profession: string;
  readonly escoLabel?: string;
  readonly iscoCode?: string;
  readonly escoUri?: string;
}

/** Μία ταυτότητα προς σπορά — **δεδομένα**, καμία απόφαση. */
export interface SeedIdentity {
  readonly email: string;
  readonly displayName: string;
  /** `undefined` ⇒ ο άνθρωπος ενεργεί στον **δικό του** χώρο (ADR-787 Ε-3). */
  readonly companyId?: string;
  readonly globalRole: 'super_admin' | 'company_admin' | 'internal_user' | 'external_user';
  readonly occupation?: SeedOccupation;
}

// ============================================================================
// ΦΡΟΥΡΟΣ — καμία εκτέλεση χωρίς emulator
// ============================================================================

async function isReachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Επιβεβαιώνει ότι **και οι δύο** emulators απαντούν, και θέτει τις env vars
 * **πριν** αρχικοποιηθεί το Admin SDK — το SDK τις διαβάζει στο init, οπότε
 * αργότερα είναι πολύ αργά.
 */
export async function assertEmulatorsUp(): Promise<void> {
  const [firestoreUp, authUp] = await Promise.all([
    isReachable(`http://${FIRESTORE_HOST}/`),
    isReachable(`http://${AUTH_HOST}/`),
  ]);

  if (!firestoreUp || !authUp) {
    console.error('❌ Ο emulator δεν απαντά — το script σταματά ΠΡΙΝ αγγίξει οτιδήποτε.');
    console.error(`   Firestore ${FIRESTORE_HOST}: ${firestoreUp ? '✅' : '❌'}`);
    console.error(`   Auth      ${AUTH_HOST}: ${authUp ? '✅' : '❌'}`);
    console.error('');
    console.error('💡 Σήκωσέ τον σε άλλο τερματικό:  npm run emulator');
    process.exit(1);
  }

  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
  process.env.GCLOUD_PROJECT = PROJECT_ID;
}

/** Admin SDK **χωρίς credential** — σκόπιμα: δεν ΜΠΟΡΕΙ να φτάσει στην παραγωγή. */
export function connectAdmin(): { auth: Auth; db: Firestore } {
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  return { auth: getAuth(), db: getFirestore() };
}

// ============================================================================
// Η ΣΠΟΡΑ ΜΙΑΣ ΤΑΥΤΟΤΗΤΑΣ
// ============================================================================

/** Idempotent: αν ο χρήστης υπάρχει τον επιστρέφει, αλλιώς τον φτιάχνει. */
export async function ensureUser(auth: Auth, identity: SeedIdentity): Promise<string> {
  try {
    return (await auth.getUserByEmail(identity.email)).uid;
  } catch {
    const created = await auth.createUser({
      email: identity.email,
      password: SEED_CREDENTIAL,
      displayName: identity.displayName,
      emailVerified: true,
    });
    return created.uid;
  }
}

/**
 * Custom claims + Firestore mirror + **επαγγελματική ιδιότητα**.
 *
 * ⚠️ **Το επάγγελμα ΔΕΝ μπαίνει στα claims** (ADR-798 Α4): δύο ανεξάρτητοι λόγοι
 * — δεν είναι εξουσιοδότηση, και τα claims έχουν όριο 1.000 bytes. Ζει **μόνο**
 * στο `users/{uid}`, απ' όπου το διαβάζει το `syncUserProfileToFirestore`.
 */
export async function applyIdentity(
  auth: Auth,
  db: Firestore,
  uid: string,
  identity: SeedIdentity,
): Promise<void> {
  const claimsUpdatedAt = Date.now();
  const tenant = identity.companyId ? { companyId: identity.companyId } : {};

  await auth.setCustomUserClaims(uid, {
    ...tenant,
    globalRole: identity.globalRole,
    claimsUpdatedAt,
  });

  await db.collection('users').doc(uid).set(
    {
      uid,
      email: identity.email,
      displayName: identity.displayName,
      ...tenant,
      ...(identity.occupation ?? {}),
      globalRole: identity.globalRole,
      status: 'active',
      emailVerified: true,
      claimsUpdatedAt,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/** Ο συνδυασμός των δύο — μία ταυτότητα, από την αρχή ως το τέλος. */
export async function seedIdentity(
  auth: Auth,
  db: Firestore,
  identity: SeedIdentity,
): Promise<string> {
  const uid = await ensureUser(auth, identity);
  await applyIdentity(auth, db, uid, identity);
  return uid;
}

/**
 * Ο κοινός εκτελεστής των σπορέων — **φρουρός, σύνδεση, αναφορά σφάλματος**.
 *
 * ⚠️ Υπάρχει επειδή το **CHECK 3.28** τον έπιασε ως κλώνο ανάμεσα στους δύο
 * σπορείς, **δύο φορές**: πρώτα το `process.exit(1)` που είναι ο λόγος που η
 * αποτυχία δεν περνά για επιτυχία, και μετά η ίδια η **ακολουθία εκκίνησης**.
 *
 * 🔑 Ο σπορέας δέχεται `auth`/`db` **έτοιμα**: έτσι δεν μπορεί να ξεχάσει τον
 * φρουρό — δεν έχει τρόπο να συνδεθεί χωρίς αυτόν.
 */
export function runSeeder(seed: (auth: Auth, db: Firestore) => Promise<void>): void {
  (async () => {
    await assertEmulatorsUp();
    console.log(`🔧 Emulator: firestore=${FIRESTORE_HOST} auth=${AUTH_HOST} project=${PROJECT_ID}`);
    console.log('');
    const { auth, db } = connectAdmin();
    await seed(auth, db);
  })()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error('❌ Η σπορά απέτυχε:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
