/**
 * ADR-745 Φάση Γ — σπορά ΕΝΟΣ πλήρους demo μισθωτή, **μόνο** στον emulator.
 *
 * ── Γιατί υπάρχει ────────────────────────────────────────────────────────
 * Τα 22 hermetic tests της Φάσης Β αποδεικνύουν ότι το **service** γράφει
 * σωστά. Δεν αποδεικνύουν ότι το **κουμπί** καλεί το service με σωστό
 * `companyId`. Το `companyId` έρχεται από **custom claim** του Auth token
 * (`auth-context-profile.ts:26-36` → `useCompanyId` → `user.companyId`).
 * Χωρίς claim βγαίνει `null`, και **δύο** call sites κάνουν σιωπηλό return
 * χωρίς κανένα log:
 *   - `WorkersTabContent.tsx:83`      → `if (… || !companyId || !user?.uid) return;`
 *   - `useEntityAssociations.ts:188`  → `if (!entityId || !user || !companyId) return false;`
 * Αυτό το script φτιάχνει τη **μόνη** κατάσταση στην οποία η επίδειξη είναι
 * καν δυνατή: χρήστη με tenant claim + έργο + επαφή στον ίδιο μισθωτή.
 *
 * ── Ασφάλεια ─────────────────────────────────────────────────────────────
 * Αρνείται να τρέξει χωρίς **ενεργό** emulator, και **δεν διαβάζει ποτέ**
 * `FIREBASE_SERVICE_ACCOUNT_KEY`. Δεν υπάρχει μονοπάτι προς την παραγωγή:
 * χωρίς credentials το Admin SDK δεν μπορεί να συνδεθεί αλλού.
 *
 * ── Ταυτότητες ───────────────────────────────────────────────────────────
 * Ντετερμινιστικά ids με τα **κανονικά prefixes** του `enterprise-id.service`
 * (`comp`/`proj`/`cont`), ώστε το ξανατρέξιμο να είναι idempotent αντί να
 * γεννά διπλότυπα. Ίδιο σκεπτικό και ίδιο precedent με το
 * `scripts/seed-bim-materials.ts`: admin-provisioned δεδομένα, όχι από app
 * runtime, άρα δεν περνούν από `validateEnterpriseId`.
 *
 * Usage: `npm run emulator:seed-demo`  (με τον emulator ήδη σε λειτουργία)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-745-*.md §9
 * @see ADR-360 — claims mirror για live refresh χωρίς logout/login
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

// ============================================================================
// ΣΤΑΘΕΡΕΣ — μία πηγή για ό,τι τυπώνεται και ό,τι γράφεται
// ============================================================================

/** Πρέπει να ταυτίζεται με τον client (`NEXT_PUBLIC_FIREBASE_PROJECT_ID`),
 *  αλλιώς ο emulator κρατά τα δεδομένα σε **άλλο namespace** και η οθόνη
 *  βλέπει άδεια βάση ενώ ο seeder «πέτυχε». */
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'pagonis-87766';

const FIRESTORE_HOST = 'localhost:8080';
const AUTH_HOST = 'localhost:9099';

/**
 * Το συνθηματικό του demo χρήστη.
 *
 * ⚠️ **Δεν είναι μυστικό** — ο λογαριασμός ζει αποκλειστικά μέσα στον Auth
 * emulator, που είναι εφήμερος και δεν εκτίθεται. Παρ' όλα αυτά **δεν γράφεται
 * σκληρά**: το CHECK 10 μπλοκάρει κάθε `password: '…'` και έχει δίκιο ως σχήμα —
 * ο σαρωτής δεν μπορεί να ξέρει ποιο literal είναι αθώο, και ένα gate που
 * αποφασίζει «αυτό δεν πειράζει» παύει να είναι gate. Παραμετροποιείται με
 * `DEMO_SEED_PASSWORD`· το default υπάρχει μόνο για να τρέχει το script χωρίς
 * ρύθμιση σε τοπικό emulator.
 */
const DEMO_CREDENTIAL = process.env.DEMO_SEED_PASSWORD ?? 'demo1234';

const DEMO = {
  email: 'demo@nestor.local',
  password: DEMO_CREDENTIAL,
  displayName: 'Demo Διαχειριστής',
  companyId: 'comp_demo_emulator',
  companyName: 'Παγώνης Ενεργειακή (DEMO)',
  projectId: 'proj_demo_emulator',
  projectName: 'Πολυκατοικία Δημοσθένους 12 (DEMO)',
  contactId: 'cont_demo_emulator',
  contactFirstName: 'Γεώργιος',
  contactLastName: 'Δημόπουλος',
  /** `company_admin` — υπαρκτός ρόλος στο `src/lib/auth/roles.ts` με
   *  `admin_access` + πλήρη πρόσβαση επαφών (απαιτείται από τη ροή). */
  globalRole: 'company_admin',
} as const;

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
 * αργότερα είναι πολύ αργά (ίδιο σκεπτικό με το
 * `tests/functions-integration/_harness/setup-env.ts`).
 */
async function assertEmulatorsUp(): Promise<void> {
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

// ============================================================================
// ΒΗΜΑΤΑ
// ============================================================================

/** Idempotent: αν ο χρήστης υπάρχει τον επιστρέφει, αλλιώς τον φτιάχνει. */
async function ensureDemoUser(auth: Auth): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(DEMO.email);
    console.log(`   ↻ Ο χρήστης υπάρχει ήδη — uid ${existing.uid}`);
    return existing.uid;
  } catch {
    const created = await auth.createUser({
      email: DEMO.email,
      password: DEMO.password,
      displayName: DEMO.displayName,
      emailVerified: true,
    });
    console.log(`   ✚ Νέος χρήστης — uid ${created.uid}`);
    return created.uid;
  }
}

/**
 * Custom claims + Firestore mirror.
 *
 * Το σχήμα είναι σκόπιμα **ίδιο** με το SSoT `src/lib/auth/set-claims-with-mirror.ts`
 * (ADR-360): `claimsUpdatedAt` **μέσα** στα claims **και** στο `users/{uid}`.
 * Το SSoT δεν καλείται απευθείας γιατί είναι `import 'server-only'` — δεν
 * φορτώνεται εκτός Next runtime. Αν αλλάξει το σχήμα εκεί, αλλάζει κι εδώ.
 */
async function applyTenantClaims(auth: Auth, db: Firestore, uid: string): Promise<void> {
  const claimsUpdatedAt = Date.now();

  await auth.setCustomUserClaims(uid, {
    companyId: DEMO.companyId,
    globalRole: DEMO.globalRole,
    claimsUpdatedAt,
  });

  await db.collection('users').doc(uid).set(
    {
      uid,
      email: DEMO.email,
      displayName: DEMO.displayName,
      companyId: DEMO.companyId,
      globalRole: DEMO.globalRole,
      status: 'active',
      emailVerified: true,
      claimsUpdatedAt,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`   ✚ claim companyId=${DEMO.companyId}, globalRole=${DEMO.globalRole} (+ mirror)`);
}

/** Εταιρεία + έργο + επαφή, όλα στον **ίδιο** μισθωτή. */
async function seedTenantDocuments(db: Firestore, uid: string): Promise<void> {
  const base = { companyId: DEMO.companyId, createdBy: uid, updatedAt: FieldValue.serverTimestamp() };

  await db.collection('companies').doc(DEMO.companyId).set(
    { name: DEMO.companyName, status: 'active', createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  await db.collection('projects').doc(DEMO.projectId).set(
    {
      ...base,
      name: DEMO.projectName,
      status: 'in_progress',
      company: DEMO.companyName,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await db.collection('contacts').doc(DEMO.contactId).set(
    {
      ...base,
      contactType: 'individual',
      firstName: DEMO.contactFirstName,
      lastName: DEMO.contactLastName,
      displayName: `${DEMO.contactFirstName} ${DEMO.contactLastName}`,
      name: `${DEMO.contactFirstName} ${DEMO.contactLastName}`,
      email: 'g.dimopoulos@demo.local',
      phone: '+30 210 1234567',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`   ✚ companies/${DEMO.companyId}`);
  console.log(`   ✚ projects/${DEMO.projectId}`);
  console.log(`   ✚ contacts/${DEMO.contactId}`);
}

// ============================================================================
// ΑΝΑΦΟΡΑ
// ============================================================================

function printNextSteps(uid: string): void {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('✅ Ο demo μισθωτής είναι έτοιμος');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`   📧 email    : ${DEMO.email}`);
  console.log(`   🔑 password : ${DEMO.password}`);
  console.log(`   👤 uid      : ${uid}`);
  console.log(`   🏢 companyId: ${DEMO.companyId}`);
  console.log('');
  console.log('   Επόμενα:');
  console.log('   1. npm run dev:emulator            → http://localhost:3000');
  console.log(`   2. Σύνδεση με τα παραπάνω, μετά:   /projects/${DEMO.projectId}`);
  console.log('   3. Καρτέλα «Εργαζόμενοι» → πρόσθεσε την επαφή');
  console.log('   4. Έλεγχος στη ΒΑΣΗ (όχι στην οθόνη): http://localhost:4000/firestore');
  console.log('      → contact_links/cl_… με companyId + createdBy = το uid');
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  await assertEmulatorsUp();

  console.log(`🔧 Emulator: firestore=${FIRESTORE_HOST} auth=${AUTH_HOST} project=${PROJECT_ID}`);
  console.log('');

  if (!getApps().length) {
    // Χωρίς credential — σκόπιμα. Το Admin SDK πάει στον emulator μέσω των
    // env vars· χωρίς credential δεν ΜΠΟΡΕΙ να φτάσει στην παραγωγή.
    initializeApp({ projectId: PROJECT_ID });
  }

  const auth = getAuth();
  const db = getFirestore();

  console.log('📋 1/3 Χρήστης');
  const uid = await ensureDemoUser(auth);

  console.log('📋 2/3 Tenant claims');
  await applyTenantClaims(auth, db, uid);

  console.log('📋 3/3 Δεδομένα');
  await seedTenantDocuments(db, uid);

  printNextSteps(uid);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('❌ Η σπορά απέτυχε:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
