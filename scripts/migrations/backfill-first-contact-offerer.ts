#!/usr/bin/env tsx
/**
 * **BACKFILL `FirstContact.offerer`** — ADR-843 §10.17 / Στάδιο ΣΤ.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΓΙΝΕΙ «ΜΟΝΟ ΤΟΥ»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Το §10.16 έκανε την πράξη να **κουβαλά τον παραλήπτη της** (`offerer`), ώστε το
 * εισερχόμενο να είναι **δύο ισότητες** αντί για σάρωση εκατοντάδων αγγελιών. Τα
 * έγγραφα που γεννήθηκαν **πριν** από εκείνη την αλλαγή δεν το έχουν.
 *
 * 🔴 **ΚΑΙ ΕΙΝΑΙ ΔΟΜΙΚΑ ΑΟΡΑΤΑ, ΟΧΙ ΑΠΛΩΣ ΕΛΛΙΠΗ.** Αυτό αποκλείει τη λύση που θα
 * ήταν αλλιώς η καλύτερη: το **read-repair** *(Cassandra/DynamoDB: «διόρθωσέ το τη
 * στιγμή που κάποιος το διαβάζει»)*. Εκεί δουλεύει επειδή η ανάγνωση **βρίσκει** τη
 * γραμμή και μετά ανακαλύπτει ότι είναι μπαγιάτικη. **Εδώ το ερώτημα ΕΙΝΑΙ πάνω στο
 * πεδίο που λείπει** — `where('offerer.userId','==',…)` — άρα το έγγραφο δεν
 * επιστρέφεται **ποτέ**, από **κανέναν**, και δεν υπάρχει στιγμή στην οποία θα
 * μπορούσε να θεραπευτεί. Ένα lazy backfill εδώ θα ήταν κώδικας που **δεν εκτελείται
 * ποτέ** ενώ φαίνεται να καλύπτει την περίπτωση: ο χειρότερος αδρανής φρουρός
 * (ADR-749). ⇒ Η **μία** διαδρομή είναι ρητή, εφάπαξ επανασύνθεση — αυτό το αρχείο.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΙ ΔΕΝ ΥΠΟΛΟΓΙΖΕΙ ΑΥΤΟ ΤΟ SCRIPT — ΤΙΠΟΤΑ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ο παραλήπτης παράγεται από τον {@link locateTarget}, τον **ίδιο** που τον παράγει
 * στη **γέννηση** της πράξης (`first-contact.service.ts` μέσω `resolveTarget`). Δεν
 * υπάρχει εδώ ούτε μία γραμμή που να αποφασίζει *«ποιανού είναι»*, *«ποια οικογένεια
 * αγγελίας»*, ή *«ποιο πεδίο κρατά την εταιρεία»*.
 *
 * ⛔ **ΑΝ ΒΡΕΘΕΙΣ ΝΑ ΓΡΑΦΕΙΣ ΕΔΩ `custodyOf`, `startsWith('prop_')` Ή
 * `{ kind: 'company', … }` — ΣΤΑΜΑΤΑ.** Ξαναφτιάχνεις τον κριτή, και το αποτέλεσμα
 * θα είναι **δύο** απαντήσεις στο *«ποιον φτάνει η πράξη;»*: μία στη γέννηση, μία στη
 * θεραπεία. Η μέρα που θα διαφωνήσουν είναι η μέρα που ένα μήνυμα πάει σε **λάθος
 * γραφείο** — και κανένα test δεν το βλέπει, γιατί και τα δύο θα είναι «σωστά».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 ΙΔΕΜΠΟΤΕΝΤ, ΞΗΡΟ ΤΡΕΞΙΜΟ, ΚΑΙ ΕΠΑΛΗΘΕΥΣΗ ΑΠΟ ΤΗ ΔΙΑΔΡΟΜΗ ΤΟΥ ΑΝΘΡΩΠΟΥ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * - **Ξηρό εξ ορισμού** (`--apply` για γραφή) — πρότυπο `fireway` / Sanity migrations.
 * - **Ιδεμποτεντ με προϋπόθεση ΜΕΣΑ στη συναλλαγή**, όχι με έλεγχο πριν: ένα
 *   `if (!offerer)` έξω από τη συναλλαγή είναι **αγώνας**, και δεύτερο ταυτόχρονο
 *   τρέξιμο θα ξαναέγραφε πάνω σε τιμή που μόλις μπήκε.
 * - **`update` με ΕΝΑ πεδίο, ποτέ `set`**: ένα `set` χωρίς `merge` θα έσβηνε την
 *   πράξη· ένα `set({...contact, offerer})` θα ξαναέγραφε **όλο** το έγγραφο από
 *   μνήμη που διαβάστηκε νωρίτερα — δηλαδή θα ακύρωνε ό,τι έγραψε άλλος στο ενδιάμεσο
 *   *(π.χ. τη σφραγίδα `seenAt`, ή μια απόσυρση)*.
 * - 🏆 **Η ΕΠΑΛΗΘΕΥΣΗ ΔΕΝ ΡΩΤΑ «ΕΓΡΑΨΑ;» ΑΛΛΑ «ΦΑΙΝΕΤΑΙ;»**: μετά τη γραφή ξανατρέχει
 *   **τις ίδιες δύο ισότητες** που τρέχει το εισερχόμενο (`collectAddressedContacts`).
 *   Μια επιβεβαίωση «το πεδίο γράφτηκε» θα ήταν πράσινο που **δεν αποδεικνύει** αυτό
 *   που μας νοιάζει — ότι ο άνθρωπος **θα το δει**.
 *
 * ⚠️ **Η ζωντάνια ΔΕΝ ρωτιέται, επίτηδες**: η πράξη έγινε **τότε**. Αγγελία που
 * αποσύρθηκε **μετά** εξακολουθεί να έχει παραλήπτη — δες `first-contact-target-locator.ts`.
 *
 * ⚠️ **Το `nowISO` ταξιδεύει μόνο επειδή το απαιτεί η υπογραφή του εντοπιστή.** Το
 * μόνο που διαβάζεται από την απάντησή του είναι το `custody`, που **δεν εξαρτάται
 * από ρολόι**. Το `facts` —που εξαρτάται— **αγνοείται ρητά**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΕΚΤΕΛΕΣΗ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   npm run backfill:first-contact-offerer            # ξηρό, όλα
 *   npm run backfill:first-contact-offerer -- --apply # γραφή
 *   npm run backfill:first-contact-offerer -- --apply --id=fcon_xxx
 *
 * 🔴 **Το `NODE_OPTIONS=--conditions=react-server` ΔΕΝ είναι κόλπο** — είναι ο
 * **δηλωμένος από τον κατασκευαστή** μηχανισμός του πακέτου `server-only`, του οποίου
 * το `exports` map ορίζει `"react-server": "./empty.js"`. Χωρίς τη σημαία, ο φρουρός
 * **εξακολουθεί να πετά** κανονικά· δεν απενεργοποιήθηκε πουθενά αλλού.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-843-first-contact-act.md §10.17
 * @see ADR-813 — ο ΕΝΑΣ εκκινητής firebase-admin των ops scripts
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { locateTarget } from '@/services/contact/first-contact-target-locator';
import type { FirstContact } from '@/types/first-contact';

import {
  reportOutcome,
  verifyVisibleToOfferers,
  type BackfillOutcome,
} from './backfill-first-contact-offerer.report';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initAdminApp } = require('../_shared/firebaseAdminOps');

/**
 * 🔑 **Το όνομα της συλλογής ΔΕΝ γράφεται εδώ.** Έρχεται από το `COLLECTIONS` — το
 * ίδιο που διαβάζει ο γραφέας και η προβολή. Ένα ωμό `'first_contacts'` θα ήταν
 * τέταρτη διατύπωση, και μια μετονομασία θα άφηνε αυτό το script να «τρέχει καθαρά»
 * πάνω σε συλλογή που δεν υπάρχει.
 */
import { COLLECTIONS } from '@/config/firestore-collections';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY_ID = (args.find((a) => a.startsWith('--id=')) ?? '').split('=')[1] ?? null;

// =============================================================================
// 1. Η ΜΙΑ ΠΡΑΞΗ — εντοπισμός, κρίση, γραφή υπό προϋπόθεση
// =============================================================================

/**
 * **Θεραπεύει μία πράξη** — και επιστρέφει **τι έγινε**, ποτέ `void`.
 *
 * ⚠️ **Τα πέντε αποτελέσματα είναι πέντε ΔΙΑΦΟΡΕΤΙΚΕΣ ιστορίες** και δεν ισοπεδώνονται:
 * *ήδη εντάξει* ≠ *θεραπεύτηκε* ≠ *θα θεραπευόταν* ≠ *ο στόχος χάθηκε* ≠ **βλάβη**.
 * Μόνο η τελευταία είναι λόγος να **αποτύχει** η εκτέλεση (N.12: άγνωστο ≠ κενό).
 */
async function healContact(
  db: AdminFirestore,
  contact: FirstContact,
  nowISO: string,
): Promise<BackfillOutcome> {
  if (contact.offerer !== undefined && contact.offerer !== null) {
    return { id: contact.id, kind: 'already-present', custody: contact.offerer };
  }

  const located = await locateTarget(db, contact.target, nowISO);

  // 🔴 **ΒΛΑΒΗ ⇒ ΣΤΑΜΑΤΑ, ΠΟΤΕ ΕΙΚΑΣΙΑ.** Μια αστοχία Firestore που γραφόταν ως
  //    «δεν βρέθηκε παραλήπτης» θα κληρονομούνταν **μόνιμα** στο έγγραφο.
  if (located === null) return { id: contact.id, kind: 'unavailable' };
  if (located === 'absent') return { id: contact.id, kind: 'target-absent' };

  if (!APPLY) return { id: contact.id, kind: 'would-heal', custody: located.custody };

  const wrote = await writeOffererIfAbsent(db, contact.id, located.custody);
  return {
    id: contact.id,
    kind: wrote ? 'healed' : 'already-present',
    custody: located.custody,
  };
}

/**
 * **Γράφει ΜΟΝΟ αν λείπει — και η ερώτηση γίνεται ΜΕΣΑ στη συναλλαγή.**
 *
 * 🔑 **Εκεί ζει η ιδεμποτεντικότητα.** Ο έλεγχος στο {@link healContact} είναι
 * **φίλτρο θορύβου** *(για να μη θεωρηθεί «θεραπεία» ό,τι ήταν ήδη εντάξει)*· ο
 * έλεγχος **εδώ** είναι η **εγγύηση**. Δύο ταυτόχρονες εκτελέσεις καταλήγουν στην
 * ίδια τιμή, και η δεύτερη το **αναφέρει** ως «ήδη παρόν» αντί να το κρύψει.
 *
 * @returns `true` αν αυτή η εκτέλεση έγραψε· `false` αν πρόλαβε άλλος.
 */
async function writeOffererIfAbsent(
  db: AdminFirestore,
  contactId: string,
  custody: FirstContact['offerer'],
): Promise<boolean> {
  const ref = db.collection(COLLECTIONS.FIRST_CONTACTS).doc(contactId);

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return false;

    const current = (snapshot.data() as Partial<FirstContact>).offerer;
    if (current !== undefined && current !== null) return false;

    // ⚠️ **ΕΝΑ πεδίο.** Δες την κεφαλίδα: ένα `set` θα έσβηνε ή θα ξαναέγραφε ό,τι
    //    άλλαξε στο ενδιάμεσο — π.χ. τη σφραγίδα `seenAt` ή μια απόσυρση.
    tx.update(ref, { offerer: custody });
    return true;
  });
}

// =============================================================================
// 2. Η ΣΑΡΩΣΗ — και το ΤΙ διαβάζεται
// =============================================================================

/**
 * **Οι πράξεις προς θεραπεία.**
 *
 * ⚠️ **ΚΑΜΙΑ συνθήκη `where` πάνω στο `offerer`, και είναι ΑΝΑΓΚΑΙΟ**: η Firestore
 * **δεν μπορεί** να ρωτήσει *«πού λείπει αυτό το πεδίο»* — ένα έγγραφο χωρίς το πεδίο
 * δεν έχει καταχώρηση στο ευρετήριό του, άρα **κανένα** ερώτημα δεν το επιστρέφει.
 * Είναι το ίδιο δομικό γεγονός που κάνει το read-repair αδύνατο *(δες κεφαλίδα)*. Η
 * πλήρης σάρωση είναι η **μόνη** διαδρομή, και είναι αποδεκτή επειδή τρέχει **μία φορά**.
 */
async function loadContacts(db: AdminFirestore): Promise<readonly FirstContact[]> {
  const collection = db.collection(COLLECTIONS.FIRST_CONTACTS);

  if (ONLY_ID !== null) {
    const snapshot = await collection.doc(ONLY_ID).get();
    if (!snapshot.exists) return [];
    return [{ ...(snapshot.data() as FirstContact), id: snapshot.id }];
  }

  const snapshot = await collection.get();
  return snapshot.docs.map((doc) => ({ ...(doc.data() as FirstContact), id: doc.id }));
}

// =============================================================================
// 3. Ο ΔΡΟΜΟΛΟΓΗΤΗΣ
// =============================================================================

async function main(): Promise<void> {
  const { db, projectId } = initAdminApp(admin) as { db: AdminFirestore; projectId: string };
  const nowISO = new Date().toISOString();

  console.log(`\n🔁 BACKFILL offerer — ADR-843 §10.17`);
  console.log(`   έργο: ${projectId}`);
  console.log(`   τρόπος: ${APPLY ? '✍️  ΓΡΑΦΗ (--apply)' : '👁️  ΞΗΡΟ ΤΡΕΞΙΜΟ'}`);
  if (ONLY_ID !== null) console.log(`   φίλτρο: ${ONLY_ID}`);

  const contacts = await loadContacts(db);
  console.log(`   πράξεις προς εξέταση: ${contacts.length}\n`);

  const outcomes: BackfillOutcome[] = [];
  for (const contact of contacts) {
    outcomes.push(await healContact(db, contact, nowISO));
  }

  const failed = reportOutcome(outcomes, APPLY);

  if (APPLY) await verifyVisibleToOfferers(db, outcomes);

  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error('\n❌ Το backfill απέτυχε:', error instanceof Error ? error.message : error);
  process.exit(1);
});
