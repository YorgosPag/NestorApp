/**
 * ADR-798 Φάση 6 — **ΟΙ ΟΚΤΩ ΑΝΘΡΩΠΟΙ**, μόνο στον emulator.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ΤΙ ΑΠΑΝΤΑ, ΚΑΙ ΤΙ **ΔΕΝ** ΑΠΑΝΤΑ
 *
 * Ρωτά *«βλέπει ο καθένας το δικό του;»*. Είναι **άλλο** ερώτημα από τον αδελφό
 * του `emulator-seed-demo-tenant.ts`, που ρωτά *«γράφει το κουμπί σωστό
 * `companyId`;»* — εκείνος σπέρνει **ΕΝΑΝ** μισθωτή με έργο και επαφή· αυτός
 * σπέρνει **ΟΚΤΩ ταυτότητες** και **μηδέν** δεδομένα τομέα.
 *
 * ⚠️ **Δεν είναι δεύτερη αυθεντία**: η μηχανή είναι **μία** (`lib/emulator/identity`).
 * Εδώ ζουν μόνο τα **δεδομένα** των ανθρώπων.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΧΙ ΠΡΑΓΜΑΤΙΚΑ GMAIL — ΜΕΤΡΗΜΕΝΟ 2026-08-25
 *
 * Τρεις ανεξάρτητοι λόγοι, ο καθένας αρκετός μόνος του:
 *   1. Ο Auth emulator δέχεται **οποιοδήποτε** email με `emailVerified: true`.
 *   2. Η προσγείωση (`landing.ts:104`) κρίνει **ένα μπιτ** (`companyId`), οπότε
 *      14 πραγματικοί λογαριασμοί θα έδιναν **ΔΥΟ** οθόνες.
 *   3. Κάθε Gmail θέλει τηλέφωνο επαλήθευσης και η Google μπλοκάρει μαζικές
 *      δημιουργίες από την ίδια IP.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Η ΣΥΜΒΑΣΗ ΟΝΟΜΑΤΩΝ: `<ρόλος>.<επάγγελμα>@<χώρος>.local`
 *
 * Κωδικοποιεί τους **τρεις άξονες που το σύστημα κρατά χωριστά** (ADR-798 §0.1):
 * τι **δικαιούσαι** (globalRole) · τι **είσαι** (επάγγελμα) · πού **ανήκεις**
 * (χώρος, στο domain).
 *
 * 🔑 **Το κρίσιμο ζεύγος είναι το `ext.architect@solo` έναντι του
 * `int.architect@alpha`**: *ίδιο* επάγγελμα, *άλλος* χώρος. Είναι η μόνη διαφορά
 * που η σημερινή προσγείωση **βλέπει** — και ακριβώς η διάκριση «αυτόνομοι
 * μηχανικοί ή μηχανικοί εταιρειών» που γέννησε το ADR-798.
 *
 * Usage: `npm run emulator:seed-personas`  (με τον emulator ήδη σε λειτουργία)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

import {
  SEED_CREDENTIAL,
  runSeeder,
  seedIdentity,
  type SeedIdentity,
} from './lib/emulator/identity';

const COMPANY_ID = 'comp_alpha_emulator';
const COMPANY_NAME = 'Άλφα Τεχνική (DEMO)';

/**
 * ⚠️ **Οι κωδικοί ISCO ΔΕΝ είναι διακοσμητικοί** — τους διαβάζει το
 * `ISCO_JOB_AFFINITY` (`config/isco-job-affinity.ts`) και **σπάει την ισοβαθμία**
 * της πρότασης δουλειάς. Γι' αυτό οι οκτώ καλύπτουν **τέσσερις** διαφορετικές
 * δουλειές: αν όλοι έδιναν την ίδια, το rig θα ήταν οκτώ αντίγραφα ενός σεναρίου.
 *
 * ⛔ **ΜΗΝ επινοήσεις κωδικό.** Κάθε τιμή εδώ υπάρχει στον χάρτη ή είναι πρόθεμά
 * του (`2142` ⇒ `214`). Άγνωστος κωδικός δεν σπάει τίποτα — απλώς **δεν κάνει
 * τίποτα**, και η προσωπικότητα γίνεται σιωπηλά ισοδύναμη με «χωρίς επάγγελμα».
 */
const PERSONAS: readonly SeedIdentity[] = [
  // ── Ο ΠΟΛΙΤΗΣ — κανένα επάγγελμα, ιδιωτικός χώρος ─────────────────────────
  {
    email: 'ext.seeker@solo.local',
    displayName: 'Ελένη Ζητούσα',
    globalRole: 'external_user',
  },
  {
    email: 'ext.owner@solo.local',
    displayName: 'Κώστας Ιδιοκτήτης',
    globalRole: 'external_user',
  },

  // ── Ο ΑΥΤΟΝΟΜΟΣ ΕΠΑΓΓΕΛΜΑΤΙΑΣ — επάγγελμα ΧΩΡΙΣ οργανισμό ─────────────────
  {
    email: 'ext.architect@solo.local',
    displayName: 'Μαρία Αρχιτεκτονίδου',
    globalRole: 'external_user',
    occupation: { profession: 'Αρχιτέκτονας', escoLabel: 'Αρχιτέκτονας', iscoCode: '2161' },
  },
  {
    email: 'ext.lawyer@solo.local',
    displayName: 'Νίκος Δικηγόρου',
    globalRole: 'external_user',
    occupation: { profession: 'Δικηγόρος', escoLabel: 'Δικηγόρος', iscoCode: '2611' },
  },

  // ── Ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ ΣΕ ΟΡΓΑΝΙΣΜΟ ─────────────────────────────────────────
  {
    email: 'int.architect@alpha.local',
    displayName: 'Άννα Αρχιτεκτονίδη',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: { profession: 'Αρχιτέκτονας', escoLabel: 'Αρχιτέκτονας', iscoCode: '2161' },
  },
  {
    email: 'int.surveyor@alpha.local',
    displayName: 'Πέτρος Τοπογράφου',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: { profession: 'Τοπογράφος Μηχανικός', escoLabel: 'Τοπογράφος', iscoCode: '2165' },
  },
  {
    email: 'int.accountant@alpha.local',
    displayName: 'Σοφία Λογιστού',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: { profession: 'Λογιστής', escoLabel: 'Λογιστής', iscoCode: '241' },
  },
  {
    email: 'admin.civil@alpha.local',
    displayName: 'Δημήτρης Πολιτικός',
    companyId: COMPANY_ID,
    globalRole: 'company_admin',
    occupation: { profession: 'Πολιτικός Μηχανικός', escoLabel: 'Πολιτικός μηχανικός', iscoCode: '2142' },
  },
] as const;

/** Ο χώρος στον οποίο δείχνουν οι τέσσερις `@alpha.local`. */
async function ensureCompany(db: Firestore): Promise<void> {
  await db.collection('companies').doc(COMPANY_ID).set(
    { name: COMPANY_NAME, status: 'active', createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

function describe(person: SeedIdentity): string {
  const where = person.companyId ? '🏢 οργανισμός' : '👤 ιδιωτικός';
  const what = person.occupation?.profession ?? '—';
  return `${where.padEnd(14)} ${person.globalRole.padEnd(14)} ${what}`;
}

function printNextSteps(): void {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`✅ ${PERSONAS.length} ταυτότητες έτοιμες · κοινό password: ${SEED_CREDENTIAL}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('   Επόμενα:');
  console.log('   1. npm run dev:emulator   → http://localhost:3000/login');
  console.log('   2. Σύνδεση με οποιοδήποτε από τα παραπάνω email.');
  console.log('');
  console.log('   🔑 Το κρίσιμο πείραμα — ΙΔΙΟ επάγγελμα, ΑΛΛΟΣ χώρος:');
  console.log('      ext.architect@solo.local   → ιδιωτικός χώρος (οι προσφορές μου)');
  console.log('      int.architect@alpha.local  → χώρος εργασίας (dashboard)');
  console.log('');
}

async function main(auth: Auth, db: Firestore): Promise<void> {
  await ensureCompany(db);
  console.log(`🏢 Χώρος: ${COMPANY_NAME} (${COMPANY_ID})`);
  console.log('');

  for (const person of PERSONAS) {
    const uid = await seedIdentity(auth, db, person);
    console.log(`   ✚ ${person.email.padEnd(28)} ${describe(person)}  [${uid.slice(0, 8)}…]`);
  }

  printNextSteps();
}

runSeeder(main);
