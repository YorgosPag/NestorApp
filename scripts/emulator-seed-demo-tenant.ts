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

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

// 🔑 ADR-798 Φάση 6 — Η ΜΗΧΑΝΗ ΕΙΝΑΙ **ΜΙΑ**, ΚΑΙ ΤΟ ΕΠΙΒΑΛΕ ΤΟ CHECK 3.28.
// Ο φρουρός του emulator, το `ensureUser` και τα claims ζούσαν εδώ. Τη στιγμή που
// γεννήθηκε δεύτερος σπορέας (`emulator-seed-personas.ts`) το jscpd τα ανέφερε ως
// κλώνους — σωστά. Εδώ μένουν **μόνο** τα δεδομένα ΑΥΤΟΥ του σεναρίου.
import {
  SEED_CREDENTIAL,
  runSeeder,
  seedIdentity,
  type SeedIdentity,
} from './lib/emulator/identity';

// ============================================================================
// ΣΤΑΘΕΡΕΣ — μία πηγή για ό,τι τυπώνεται και ό,τι γράφεται
// ============================================================================

/** Πρέπει να ταυτίζεται με τον client (`NEXT_PUBLIC_FIREBASE_PROJECT_ID`),
 *  αλλιώς ο emulator κρατά τα δεδομένα σε **άλλο namespace** και η οθόνη
 *  βλέπει άδεια βάση ενώ ο seeder «πέτυχε». */

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

const DEMO = {
  email: 'demo@nestor.local',
  password: SEED_CREDENTIAL,
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

// ============================================================================
// ΒΗΜΑΤΑ
// ============================================================================

/**
 * Η ταυτότητα αυτού του σεναρίου, στη μορφή που δέχεται το SSoT.
 *
 * ⚠️ Το σχήμα claims + mirror (ADR-360: `claimsUpdatedAt` **μέσα** στα claims
 * **και** στο `users/{uid}`) ζει πλέον στο `lib/emulator/identity` — μία θέση για
 * δύο σπορείς. Αν αλλάξει το `lib/auth/set-claims-with-mirror.ts`, αλλάζει εκεί.
 */
const DEMO_IDENTITY: SeedIdentity = {
  email: DEMO.email,
  displayName: DEMO.displayName,
  companyId: DEMO.companyId,
  globalRole: DEMO.globalRole,
};

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
      /**
       * 🔴 `type`, ΟΧΙ `contactType` — μετρημένο 2026-08-02 (ADR-745 Δουλειά Α).
       *
       * Ο `Contact` είναι **discriminated union** και ο διαχωριστής του δηλώνεται
       * στο `src/types/contacts/contracts.ts:13` ως `type: ContactType`.
       *
       * Ο seeder έγραφε `contactType` και η επαφή ήταν **αόρατη στην αναζήτηση
       * εργαζομένων**, χωρίς κανένα μήνυμα λάθους. Η αλυσίδα σιωπής:
       *
       *   WorkersTabContent → allowedContactTypes={['individual']}
       *   ContactSearchManager:176 → allowedContactTypes.includes(contact.type)
       *   contact-name-resolver-mapper:146 → type: contact.type
       *   toContact() → {...raw}  ⇒  raw.type === undefined
       *   ['individual'].includes(undefined) === false  ⇒  σιωπηλή απόρριψη
       *
       * Το έγγραφο **έφτανε** στον client (το tenant φίλτρο δούλευε), απλώς
       * κοβόταν στο τελευταίο βήμα — γι' αυτό η οθόνη έλεγε «Δεν βρέθηκαν
       * αποτελέσματα» αντί για σφάλμα.
       *
       * ⚠️ Το `contactType` **υπάρχει** στον κώδικα ~114 φορές — αλλά ως όνομα
       * παραμέτρου/πεδίου interface (ai-pipeline), **ποτέ** ως πεδίο εγγράφου
       * Firestore. Μην ξαναμπερδευτείς από το πλήθος.
       */
      type: 'individual',
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

async function main(auth: Auth, db: Firestore): Promise<void> {


  console.log('📋 1/2 Ταυτότητα + tenant claims');
  const uid = await seedIdentity(auth, db, DEMO_IDENTITY);
  console.log(`   ✚ uid ${uid} · companyId=${DEMO.companyId} · globalRole=${DEMO.globalRole}`);

  console.log('📋 2/2 Δεδομένα');
  await seedTenantDocuments(db, uid);

  printNextSteps(uid);
}

runSeeder(main);
