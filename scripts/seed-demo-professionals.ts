/**
 * seed-demo-professionals — **δοκιμαστικές βιτρίνες του τεχνικού/κατασκευαστικού χώρου**
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ΧΡΗΣΗ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ```
 * pnpm run seed:demo-professionals              # γράφει (idempotent)
 * pnpm run seed:demo-professionals -- --dry-run # δείχνει τι ΘΑ έγραφε, γράφει τίποτα
 * pnpm run seed:demo-professionals:purge        # σβήνει ό,τι έσπειρε, και μόνο αυτό
 * ```
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΙ **ΔΕΝ** ΚΑΝΕΙ ΑΥΤΟ ΤΟ ΣΚΡΙΠΤ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΤΟ ΣΗΜΑΝΤΙΚΟΤΕΡΟ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **Δεν αποφασίζει τίποτα για τον τομέα.** Κάθε κρίση την κάνει η ίδια συνάρτηση
 * που κάνει και ο αναγνώστης του καταλόγου:
 *
 * | Ερώτημα | Ποιος απαντά | Πού ζει |
 * |---|---|---|
 * | *«ποια αρχή κρατά μητρώο γι' αυτό;»* | `resolveRegistryAuthority` | `config/isco-registry-authority` |
 * | *«είναι έγκυρο credential, και ποιας στάθμης;»* | `asCredential` | `lib/agency/showcase-read` |
 * | *«τι σχήμα πάει στον δίσκο;»* | `toStoredShowcase` | `lib/agency/showcase-read` |
 * | *«ποια ετικέτα και ποιος `iscoCode`;»* | **η ταξινομία ESCO** | `system/esco_cache/occupations` |
 *
 * 🔑 Ένας seeder που **έγραφε μόνος του** το σχήμα θα ήταν **δεύτερος γραφέας**:
 * η Φ6-Β μέτρησε ακριβώς αυτή την αστοχία *(ADR-841, εύρημα #2 — ο γραφέας
 * αποθήκευε `standing`, πεδίο που **μπορεί να διαφωνήσει** με το περιεχόμενο)*.
 * Και η κεφαλίδα του `toStoredShowcase` το λέει με το όνομά του: μια απόκλιση
 * ανάμεσα στους δύο γραφείς παράγει **βιτρίνα που εξαφανίζεται τη στιγμή που
 * δημοσιεύεται**, με πράσινο τον γραφέα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔒 ΓΙΑΤΙ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΚΟΨΕΙ ΜΕΣΙΤΗ, ΑΚΟΜΗ ΚΑΙ ΑΝ ΚΑΠΟΙΟΣ ΤΟ ΖΗΤΗΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ρυθμιζόμενη μεσιτεία περνά από τον `gateShowcase`, που παράγει
 * `BrokerageAuthority` — τύπο με `unique symbol`, **ακατασκεύαστο** έξω από τον
 * κριτή του. Αυτό το σκριπτ δεν καλεί τον κριτή και δεν χτίζει τέτοια απόδειξη·
 * το μόνο που παράγει είναι credentials **μη ρυθμιζόμενα**, και ο `asCredential`
 * **επιστρέφει `null`** αν κάποιος βάλει ρυθμιζόμενο επάγγελμα χωρίς απόδειξη.
 * Το σκριπτ τότε **σταματά ονομαστικά** αντί να γράψει μισή αλήθεια.
 *
 * ⚠️ Οι δοκιμαστικές εταιρείες γράφονται με `capabilities: {}` — **καμία**
 * μεσιτική ικανότητα. Αυτό δεν είναι παράλειψη: είναι το ζωντανό στιγμιότυπο
 * του κανόνα Ε7/Β0α *(«υδραυλικός δημοσιεύεται από γραφείο **χωρίς** μεσιτική
 * ικανότητα»)*, που μέχρι τώρα υπήρχε **μόνο** σε test.
 *
 * @see ADR-841 Α9.5 · src/config/demo-professionals.ts
 * @module scripts/seed-demo-professionals
 */

// 🔑 **ΚΑΜΙΑ `dotenv`, ΕΠΙΤΗΔΕΣ.** Μετρήθηκε (2026-09-02) ότι ούτε το `dotenv`
//    ούτε το `tsx` υπάρχουν στο `node_modules` αυτού του checkout — δηλαδή κάθε
//    υπάρχον `seed:*` script που τα εισάγει είναι **σήμερα μη εκτελέσιμο**. Ο
//    Node 20.6+ φορτώνει `.env` μόνος του με `--env-file`, οπότε το σκριπτ δεν
//    χρωστά τίποτα σε κανένα πακέτο. Δες τη γραμμή στο `package.json`.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { DEMO_PROFESSIONALS, type DemoProfessional } from '@/config/demo-professionals';
import { resolveRegistryAuthority } from '@/config/isco-registry-authority';
import { asCredential, readShowcase, toStoredShowcase } from '@/lib/agency/showcase-read';
import { generateDeterministicCompanyId } from '@/services/enterprise-id-convenience';
import type { ClassifiedOccupation, PublicShowcase, ShowcaseCredential } from '@/types/agency-profile';
import type { ProfessionalAttestation } from '@/types/professional-identity';

// =============================================================================
// INIT
// =============================================================================

if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? (JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) as object)
    : undefined;
  initializeApp(serviceAccount ? { credential: cert(serviceAccount as Parameters<typeof cert>[0]) } : {});
}

const db = getFirestore();

/**
 * **Ο χώρος ονομάτων του σπόρου.**
 *
 * ⚠️ Μπαίνει μπροστά από κάθε `slug` ώστε δύο διαφορετικά μητρώα με το ίδιο
 * κείμενο *(π.χ. ένα μελλοντικό «demo-πελάτες»)* να **μην** παράγουν την ίδια
 * ταυτότητα. Αλλαγή του **ορφανεύει ό,τι έχει ήδη σπαρθεί** — σβήσε πρώτα.
 */
const SEED_NAMESPACE = 'nestor:demo:professional:v1:';

const DRY_RUN = process.argv.includes('--dry-run');
const PURGE = process.argv.includes('--purge');

// =============================================================================
// ΤΑΥΤΟΤΗΤΑ
// =============================================================================

/** Η **σταθερή** ταυτότητα ενός δοκιμαστικού επαγγελματία. Ίδιος σπόρος ⇒ ίδιο έγγραφο. */
function identityOf(demo: DemoProfessional): string {
  return generateDeterministicCompanyId(`${SEED_NAMESPACE}${demo.slug}`);
}

// =============================================================================
// ΑΝΑΓΝΩΣΕΙΣ — ΤΑΞΙΝΟΜΙΑ ΚΑΙ ΓΗ
// =============================================================================

/**
 * Το επάγγελμα **από την ταξινομία**, ποτέ από το μητρώο.
 *
 * 🔴 **Ελλιπές έγγραφο ⇒ ΣΤΑΜΑΤΑΜΕ**, με το ίδιο σκεπτικό που ο
 * `occupation-classification.reader` το λέει `unavailable` και **όχι** `absent`:
 * το επάγγελμα υπάρχει, η μνήμη μας είναι μισή. Μια σιωπηλή παράλειψη εδώ θα
 * έσπερνε κατάλογο με **τρύπες** που κανείς δεν παρήγγειλε.
 */
async function readOccupation(demo: DemoProfessional): Promise<ClassifiedOccupation> {
  const docId = demo.escoUri.split('/').pop() ?? '';
  const snapshot = await db.collection(COLLECTIONS.ESCO_CACHE).doc(docId).get();
  if (!snapshot.exists) {
    throw new Error(`[${demo.slug}] Η ταξινομία δεν έχει το ${demo.escoUri}. Έτρεξε ο import-esco-occupations;`);
  }

  const data = snapshot.data() as
    | { uri?: string; iscoCode?: string; preferredLabel?: { el?: string; en?: string } }
    | undefined;
  const { iscoCode, preferredLabel } = data ?? {};

  if (!iscoCode || !preferredLabel?.el || !preferredLabel?.en) {
    throw new Error(`[${demo.slug}] Έγγραφο ταξινομίας με ελλιπή πεδία (${docId}) — η γραφή ΔΕΝ προχωρά.`);
  }
  // 🔑 Η υπόσχεση του μητρώου **επαληθεύεται**, δεν αντιγράφεται: αν το ESCO
  //    ξαναεισαχθεί και ο κωδικός αλλάξει, το μητρώο ΔΕΝ παλιώνει σιωπηλά.
  if (iscoCode !== demo.expectedIscoCode) {
    throw new Error(
      `[${demo.slug}] Το μητρώο υπόσχεται ISCO ${demo.expectedIscoCode}, η ταξινομία λέει ${iscoCode}. ` +
        'Διόρθωσε το demo-professionals.ts — μην αλλάξεις την ταξινομία.',
    );
  }

  return { escoUri: data?.uri ?? demo.escoUri, iscoCode, label: { el: preferredLabel.el, en: preferredLabel.en } };
}

/**
 * Το σημείο **της γης**, ποτέ του μητρώου.
 *
 * 🔴 Ίδιο δόγμα με τον διακομιστή *(`showcase-wire.ts`)*: γραμμένο ζεύγος
 * lat/lng στο μητρώο θα επέτρεπε `place` Θεσσαλονίκη με σημείο Αθήνα — **σωστή
 * κάρτα, ψεύτικο φίλτρο**, δηλαδή προβολή σε αγορά που κανείς δεν υπηρετεί.
 */
async function readLandPoint(landId: string, slug: string): Promise<{ lat: number; lng: number }> {
  const snapshot = await db.collection(COLLECTIONS.PUBLIC_LANDS).doc(landId).get();
  if (!snapshot.exists) {
    throw new Error(`[${slug}] Η γη ${landId} δεν υπάρχει — καμία βιτρίνα με τόπο που δεν υπάρχει.`);
  }
  const position = (snapshot.data() as { position?: { kind?: string; point?: { lat?: number; lng?: number } } })
    ?.position;
  const point = position?.kind === 'known' ? position.point : undefined;
  if (typeof point?.lat !== 'number' || typeof point?.lng !== 'number') {
    throw new Error(`[${slug}] Η γη ${landId} δεν έχει γνωστό σημείο — δεν μαντεύουμε συντεταγμένες.`);
  }
  return { lat: point.lat, lng: point.lng };
}

// =============================================================================
// ΤΟ CREDENTIAL — Η ΜΟΝΗ ΘΕΣΗ ΠΟΥ ΤΟ ΜΗΤΡΩΟ ΣΥΝΑΝΤΑ ΤΟΝ ΤΟΜΕΑ
// =============================================================================

/**
 * Μετατρέπει τη **δήλωση** του μητρώου σε {@link ProfessionalAttestation},
 * **αφού** επαληθεύσει ότι συμφωνεί με το τι λέει το **επάγγελμα**.
 *
 * 🔴 Η επαλήθευση δεν είναι υπερβολή — είναι ο λόγος που το μητρώο επιτρέπεται
 * να γράφει `authority` με το χέρι. Χωρίς αυτήν, ένας ξυλουργός θα μπορούσε να
 * αποκτήσει αριθμό **ΤΕΕ**: η κάρτα θα έδειχνε αρχή που το επάγγελμα δεν έχει,
 * και το `readShowcase` θα την **δεχόταν** (ο `isRegistryAuthority` κοιτά μόνο
 * αν η αρχή υπάρχει, όχι αν ταιριάζει).
 */
function attestationOf(demo: DemoProfessional, occupation: ClassifiedOccupation): ProfessionalAttestation {
  const verdict = resolveRegistryAuthority(occupation.iscoCode);

  if (demo.attestation.kind === 'none') {
    // ⚠️ `no-registry` ΚΑΙ `unexamined` δίνουν και τα δύο «καμία δήλωση» — αλλά
    //    είναι **διαφορετικά** για τον τομέα, και η οθόνη τα λέει αλλιώς. Εδώ
    //    ελέγχουμε μόνο ότι δεν κρύβουμε αρχή που **υπάρχει**.
    if (verdict.kind === 'authority') {
      throw new Error(
        `[${demo.slug}] Το επάγγελμα έχει αρχή «${verdict.authority}» αλλά το μητρώο δηλώνει 'none'. ` +
          'Δήλωσε αριθμό, ή διάλεξε επάγγελμα χωρίς μητρώο.',
      );
    }
    return { state: 'unknown' };
  }

  if (verdict.kind !== 'authority' || verdict.authority !== demo.attestation.authority) {
    const found = verdict.kind === 'authority' ? verdict.authority : verdict.kind;
    throw new Error(
      `[${demo.slug}] Το μητρώο δηλώνει αρχή «${demo.attestation.authority}», το επάγγελμα λέει «${found}».`,
    );
  }

  return demo.attestation.kind === 'chapter'
    ? {
        state: 'declared',
        registration: {
          authorityKind: 'chapter',
          authority: demo.attestation.authority,
          chapter: demo.attestation.chapter,
          number: demo.attestation.number,
        },
      }
    : {
        state: 'declared',
        registration: {
          authorityKind: 'national',
          authority: demo.attestation.authority,
          number: demo.attestation.number,
        },
      };
}

/** Το credential — **από τον κριτή του αναγνώστη**, ποτέ χτισμένο με το χέρι. */
function credentialOf(demo: DemoProfessional, occupation: ClassifiedOccupation): ShowcaseCredential {
  const credential = asCredential(occupation, attestationOf(demo, occupation));
  if (credential === null) {
    // Δομικά απίθανο μετά τον έλεγχο του `attestationOf` — και **γι' αυτό**
    // δηλώνεται: μια σιωπηλή παράλειψη εδώ θα έσπερνε βιτρίνα χωρίς credentials,
    // που το `readShowcase` απορρίπτει ως `unreadable`. Αόρατη κάρτα.
    throw new Error(`[${demo.slug}] Ο asCredential αρνήθηκε το ζεύγος — ρυθμιζόμενο επάγγελμα χωρίς απόδειξη;`);
  }
  return credential;
}

// =============================================================================
// Η ΒΙΤΡΙΝΑ
// =============================================================================

/** Χτίζει τη βιτρίνα — **κάθε** πεδίο της από κάποιον που έχει δικαίωμα να το πει. */
async function showcaseOf(demo: DemoProfessional, companyId: string): Promise<PublicShowcase> {
  const occupation = await readOccupation(demo);
  const anchored = demo.anchor.kind === 'land';
  return {
    companyId,
    // 🔑 Το ψευδώνυμο **είναι** η ταυτότητα — δες `demo-professionals.ts`
    //    (`skeleton('demo-…') !== 'demo-…'`, μετρημένο).
    alias: companyId,
    displayName: demo.displayName,
    credentials: [credentialOf(demo, occupation)],
    place: anchored ? { landId: demo.anchor.landId, buildingId: null } : null,
    position: anchored ? await readLandPoint(demo.anchor.landId, demo.slug) : null,
    publishedAt: new Date().toISOString(),
  };
}

/**
 * **Η ΓΡΑΦΗ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΑΝΑΓΝΩΣΤΗ ΠΡΙΝ ΦΤΑΣΕΙ ΣΤΟΝ ΔΙΣΚΟ.**
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΠΡΟΛΗΠΤΙΚΟ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Μετάλλαξη *(2026-09-02)*: περιφερειακή αρχή με **κενό εκδότη** πέρασε από τον
 * `asCredential` **αθόρυβα**. Ο `asCredential` ρωτά *«ρυθμιζόμενο χωρίς
 * απόδειξη;»* — **δεν** ρωτά *«έχει εκδότη η αρχή που τον απαιτεί;»*. Εκείνο το
 * ρωτά ο `credentialFor` του διακομιστή *(Α9.1: «1234» χωρίς «ΔΣΘ» δεν
 * επαληθεύεται από κανέναν)*, που ζει πίσω από `server-only`.
 *
 * Το αποτέλεσμα θα ήταν **ακριβώς** η αστοχία που ονομάζει η κεφαλίδα του
 * `toStoredShowcase`: ο `readShowcase` απορρίπτει το credential *(κενός εκδότης
 * ⇒ `null`)*, τα credentials μένουν **μηδέν**, η βιτρίνα γίνεται `unreadable` —
 * **κάρτα που εξαφανίζεται τη στιγμή που γράφεται**, με πράσινο τον γραφέα.
 *
 * 🔑 **Η θεραπεία ΔΕΝ είναι να ξαναγραφτεί ο κανόνας** — θα ήταν τρίτο αντίγραφο
 * μιας κρίσης που έχει ήδη δύο. Είναι να **εκτελεστεί ο αναγνώστης**: ό,τι
 * επιβιώνει του `readShowcase` είναι ορατό, ό,τι όχι σταματά **εδώ**. Κλείνει
 * **ολόκληρη την κλάση**, όχι το δείγμα — κάθε μελλοντικός κανόνας του αναγνώστη
 * φυλάει αυτόματα και τον seeder.
 */
function assertReadable(showcase: PublicShowcase, slug: string): void {
  const read = readShowcase(toStoredShowcase(showcase), showcase.companyId);
  if (read.outcome !== 'showcase') {
    throw new Error(`[${slug}] Ο αναγνώστης ΔΕΝ διαβάζει ό,τι θα γράφαμε (${read.outcome}) — καμία αόρατη κάρτα.`);
  }
  if (read.showcase.credentials.length !== showcase.credentials.length) {
    throw new Error(
      `[${slug}] Ο αναγνώστης κράτησε ${read.showcase.credentials.length} από ${showcase.credentials.length} ` +
        'credentials — κάποιο απορρίφθηκε σιωπηλά (κενός εκδότης σε αρχή με παραρτήματα;).',
    );
  }
}

/** Η **ελάχιστη** δοκιμαστική εταιρεία: υπαρκτός κάτοχος, **καμία** ικανότητα. */
function companyDocOf(displayName: string): Record<string, unknown> {
  const now = new Date();
  return {
    name: displayName,
    contactId: null,
    status: 'active',
    plan: 'free',
    settings: { defaultLocale: 'el', timezone: 'Europe/Athens', features: {} },
    // 🔒 ΚΕΝΟ, ΕΠΙΤΗΔΕΣ — δες την κεφαλίδα: κανένας δοκιμαστικός δεν είναι μεσίτης.
    capabilities: {},
    createdBy: 'seed:demo-professionals',
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// ΕΚΤΕΛΕΣΗ
// =============================================================================

async function seed(): Promise<void> {
  console.log(`Σπορά ${DEMO_PROFESSIONALS.length} δοκιμαστικών επαγγελματιών${DRY_RUN ? ' (ΔΟΚΙΜΗ)' : ''}…\n`);

  for (const demo of DEMO_PROFESSIONALS) {
    const companyId = identityOf(demo);
    const showcase = await showcaseOf(demo, companyId);
    const credential = showcase.credentials[0];
    const where = showcase.position ? `${showcase.position.lat.toFixed(3)},${showcase.position.lng.toFixed(3)}` : '—';

    // ⚠️ Τυπώνεται η **απόδειξη**, όχι το `standing`: το `standing` ρωτά *«είναι
    //    ρυθμιζόμενη μεσιτεία;»* και είναι εξ ορισμού `self-declared` για κάθε
    //    γραμμή αυτού του μητρώου — μια στήλη που δεν ξεχωρίζει τίποτα δεν είναι
    //    έλεγχος, είναι διακόσμηση.
    const proof =
      credential.attestation.state === 'unknown'
        ? 'χωρίς μητρώο'
        : `${credential.attestation.registration.authority}:${credential.attestation.registration.number}`;

    console.log(
      `  ${demo.slug.padEnd(34)} ${proof.padEnd(26)} ` +
        `ISCO ${credential.occupation.iscoCode}  τόπος ${where.padEnd(16)} ${companyId}`,
    );

    // 🔒 Τρέχει **και σε δοκιμή**: μια πύλη που σιωπά στη δοκιμή δεν είναι πύλη.
    assertReadable(showcase, demo.slug);

    if (DRY_RUN) continue;
    const batch = db.batch();
    batch.set(db.collection(COLLECTIONS.COMPANIES).doc(companyId), companyDocOf(demo.displayName));
    batch.set(db.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId), toStoredShowcase(showcase));
    await batch.commit();
  }

  console.log(`\n${DRY_RUN ? 'Καμία εγγραφή (ΔΟΚΙΜΗ).' : '✅ Έγιναν.'} Δες: http://localhost:3000/pro`);
}

/**
 * Σβήνει **ακριβώς** ό,τι έσπειρε.
 *
 * 🔑 Δεν ψάχνει «έγγραφα που μοιάζουν δοκιμαστικά» — **ξαναϋπολογίζει** τις ίδιες
 * ντετερμινιστικές ταυτότητες. Ένα φίλτρο κατά όνομα θα μπορούσε να πάρει μαζί
 * του **αληθινό** γραφείο που τυχαίνει να λέγεται έτσι.
 */
async function purge(): Promise<void> {
  console.log(`Διαγραφή ${DEMO_PROFESSIONALS.length} δοκιμαστικών επαγγελματιών…\n`);
  for (const demo of DEMO_PROFESSIONALS) {
    const companyId = identityOf(demo);
    console.log(`  ${demo.slug.padEnd(34)} ${companyId}`);
    if (DRY_RUN) continue;
    const batch = db.batch();
    batch.delete(db.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId));
    batch.delete(db.collection(COLLECTIONS.COMPANIES).doc(companyId));
    await batch.commit();
  }
  console.log(`\n${DRY_RUN ? 'Καμία διαγραφή (ΔΟΚΙΜΗ).' : '✅ Σβήστηκαν.'}`);
}

(PURGE ? purge() : seed())
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('\n❌', error instanceof Error ? error.message : error);
    process.exit(1);
  });
