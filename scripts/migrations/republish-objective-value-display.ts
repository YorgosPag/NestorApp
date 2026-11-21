/**
 * **ΕΠΑΝΑΠΡΟΒΟΛΗ — η δημόσια αγγελία ξεχνά το `shown` που δεν επέλεξε κανείς** — ADR-898 §23.2.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ως τις 2026-11-21 ο κρίκος 15 των μεταπτώσεων διάβαζε την **απουσία** του πεδίου ως «εμφάνιση», και έγραφε ρητό
 * `display: 'shown'` σε δημόσιες αγγελίες των οποίων η **πηγή** δεν το είχε ποτέ. Ο κρίκος διορθώθηκε, αλλά είναι
 * (σωστά) ιδιοδύναμος: ρητό `shown` το αφήνει αυτούσιο. Άρα το `shown` αυτό **δεν το έγραψε ποτέ άνθρωπος** — και η
 * αναφορά `objective-value-display-consent.report.ts` μέτρησε 13 τέτοιες αγγελίες, ορατές στο κοινό.
 *
 * 🔑 **Η θεραπεία είναι ΕΠΑΝΑΠΡΟΒΟΛΗ, όχι γραφή στο ακίνητο.** Η πηγή λέει ήδη την αλήθεια· μπαγιάτικο είναι μόνο το
 * παράγωγο. Καμία πλαστή συναίνεση, κανένας δρώντας «σύστημα» στη θεματοφυλακή (CHECK 3.56): γράφουν οι **ίδιοι**
 * γραφείς της αποθήκευσης και της επανασύνθεσης (`republishOwnerProperty` ⇄ `republishListing`).
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Ξηρό τρέξιμο εξ ορισμού· γραφή ΜΟΝΟ με `--apply`.                        │
 * │ 🔒 Η κρίση «τι θα έλεγε η προβολή» = οι ΙΔΙΕΣ καθαρές συναρτήσεις του       │
 * │    προβολέα (`offersObjectiveValue` + `projectObjectiveValueDeclarations`). │
 * │ 🔒 Αγγίζει ΜΟΝΟ αγγελίες με `shown` που η πηγή τους ΔΕΝ στηρίζει.          │
 * │    Ιδεμποτητικό: 2η εκτέλεση ⇒ 0.                                          │
 * │ ⛔ Πηγή με ρητό `shown` σε πώληση ⇒ ΑΝΑΦΟΡΑ: η απόφαση είναι του κατόχου.  │
 * │ ⛔ Αγγελία που ο κριτής θα ΑΠΕΣΥΡΕ ⇒ ΑΝΑΦΟΡΑ, ποτέ γραφή.                  │
 * │ 🔒 Μετά τη γραφή ΞΑΝΑΔΙΑΒΑΖΕΙ: «έγραψε» ≠ «λέει αυτό που έπρεπε».         │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```bash
 * npx cross-env NODE_OPTIONS=--conditions=react-server tsx scripts/migrations/republish-objective-value-display.ts
 * npx cross-env NODE_OPTIONS=--conditions=react-server tsx scripts/migrations/republish-objective-value-display.ts --apply
 * ```
 *
 * @see docs/centralized-systems/reference/adrs/ADR-898-objective-value-calculator.md §23.2
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import type { ObjectiveValueDisplay } from '@/lib/objective-value/objective-value-declarations';
import { offersObjectiveValue } from '@/lib/objective-value/objective-value-offer-kinds';
import { readStoredOwnerProperty } from '@/lib/owner-property/owner-property-from-document';
import {
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import { projectObjectiveValueDeclarations } from '@/services/listings/public-listing-objective-value';
import { buildPublicListing, isPubliclyListed } from '@/services/listings/public-listing-projection';
import { republishListing, type ListingSourceProperty } from '@/services/listings/publish-public-listing';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import type { OwnerProperty } from '@/types/owner-property';

import { offerKindsOf } from './objective-value-display-consent.report';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initAdminApp } = require('../_shared/firebaseAdminOps');

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');
const SHOWN_FIELD = 'objectiveValueDeclarations.display';
const MEDIA_FIELDS = ['gallery', 'floorplans', 'videos', 'models'] as const;

/**
 * 🔴 **ΦΡΕΝΟ (περιστατικό 2026-11-21)**: η επαναπροβολή ξαναχτίζει ΟΛΗ την αγγελία, μαζί με τα μέσα. Χωρίς
 * `FIREBASE_STORAGE_BUCKET` κάθε πηγή μέσου «δεν διαβάζεται» ⇒ η αγγελία γράφεται ΧΩΡΙΣ φωτογραφίες, κατόψεις,
 * βίντεο, μοντέλα — και ο γραφέας το αναφέρει μόνο ως `warn`. Έτσι άδειασαν 19 αγγελίες. Ποτέ ξανά γραφή χωρίς κάδο.
 */
function assertStorageConfigured(): void {
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error('Λείπει το FIREBASE_STORAGE_BUCKET — η επαναπροβολή θα έγραφε την αγγελία ΧΩΡΙΣ μέσα. Καμία γραφή.');
  }
}

/** Οι ταυτότητες της λειτουργίας αποκατάστασης (`--republish-ids a,b,c`) — ή `null` αν δεν ζητήθηκε. */
function republishIdsArg(): readonly string[] | null {
  const at = ARGS.indexOf('--republish-ids');
  if (at === -1) return null;
  const ids = (ARGS[at + 1] ?? '').split(',').map((id) => id.trim()).filter((id) => id.length > 0);
  if (ids.length === 0) throw new Error('Το --republish-ids θέλει λίστα ταυτοτήτων χωρισμένων με κόμμα.');
  return ids;
}

/** **Καθαρό**: πόσα μέσα κρατά μια αποθηκευμένη αγγελία, ανά είδος — π.χ. `gallery 9 · floorplans 1 · videos 0 · models 0`. */
export function mediaCountsOf(listing: Readonly<Record<string, unknown>> | undefined): string {
  return MEDIA_FIELDS.map((field) => {
    const value = listing?.[field];
    return `${field} ${Array.isArray(value) ? value.length : '—'}`;
  }).join(' · ');
}

/** Η απόφαση για μία αγγελία — **ονομασμένη**, ποτέ `boolean`. */
export type DisplayRepairPlan =
  | { readonly kind: 'republish' }
  | { readonly kind: 'consented' }
  | { readonly kind: 'would-withdraw' }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'orphan' };

const PLAN_KINDS: readonly DisplayRepairPlan['kind'][] = ['republish', 'consented', 'would-withdraw', 'unreadable', 'orphan'];

/** Η πηγή μιας αγγελίας, με τον γραφέα της οικογένειάς της. */
type ListingSource =
  | { readonly family: 'owner'; readonly owner: OwnerProperty }
  | { readonly family: 'company'; readonly data: ListingSourceProperty };

/**
 * **Καθαρό**: τι θα έγραφε η προβολή στο `display`, για αυτές τις διαθέσεις και αυτές τις ωμές δηλώσεις της πηγής.
 * Οι ΙΔΙΕΣ συναρτήσεις με το `projectObjectiveValueBasis` — καμία δεύτερη ερμηνεία του πεδίου.
 */
export function expectedDisplayOf(
  id: string,
  offerKinds: Parameters<typeof offersObjectiveValue>[0],
  sourceDeclarations: unknown,
): ObjectiveValueDisplay {
  if (!offersObjectiveValue(offerKinds)) return 'hidden';
  return projectObjectiveValueDeclarations({ id, objectiveValueDeclarations: sourceDeclarations }).display;
}

/** **Καθαρό**: αγγελία με `shown` + η κρίση της πηγής → σχέδιο. */
export function planDisplayRepair(expected: ObjectiveValueDisplay, publishable: boolean): DisplayRepairPlan {
  if (expected === 'shown') return { kind: 'consented' };
  return publishable ? { kind: 'republish' } : { kind: 'would-withdraw' };
}

/** Βρίσκει την πηγή: πρώτα ιδιώτης, μετά εταιρεία — ίδια σειρά με την επανασύνθεση. */
async function sourceOf(db: AdminFirestore, id: string): Promise<ListingSource | 'unreadable' | 'orphan'> {
  const ownerDoc = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(id).get();
  if (ownerDoc.exists) {
    const owner = readStoredOwnerProperty(ownerDoc.data(), id)?.property ?? null;
    return owner === null ? 'unreadable' : { family: 'owner', owner };
  }
  const companyDoc = await db.collection(COLLECTIONS.PROPERTIES).doc(id).get();
  if (!companyDoc.exists) return 'orphan';
  return { family: 'company', data: companyDoc.data() as ListingSourceProperty };
}

/** Η πηγή → σχέδιο, με τις ΙΔΙΕΣ διαθέσεις και τον ΙΔΙΟ κριτή δημοσίευσης που θα έτρεχε η επαναπροβολή. */
function planOf(id: string, source: ListingSource, at: string): DisplayRepairPlan {
  if (source.family === 'owner') {
    const projectable = projectableFromOwnerProperty(source.owner, at);
    const projected = buildPublicListing(projectable, placeKnowledgeFromOwnerProperty(source.owner, at), at);
    if (projected === null) return { kind: 'would-withdraw' };
    return planDisplayRepair(projected.objectiveValueDeclarations.display, true);
  }
  const data = { ...source.data, id };
  const offerKinds = offerKindsOf(data as unknown as Record<string, unknown>);
  return planDisplayRepair(expectedDisplayOf(id, offerKinds, data.objectiveValueDeclarations), isPubliclyListed(data));
}

/** Γράφει μέσω του γραφέα της οικογένειας και ξαναδιαβάζει. */
async function applyAndVerify(db: AdminFirestore, id: string, source: ListingSource): Promise<boolean> {
  if ((await republishSource(db, id, source)) !== 'published') return false;
  const after = await db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(id).get();
  return (after.get(SHOWN_FIELD) ?? null) !== 'shown';
}

function describe(id: string, plan: DisplayRepairPlan): string {
  switch (plan.kind) {
    case 'republish': return `   ✍️  ${id}: shown → hidden (η προβολή από την πηγή βγάζει hidden: χωρίς ρητό shown ή χωρίς πώληση)`;
    case 'consented': return `   ✋ ${id}: η πηγή λέει ρητά shown σε πώληση — απόφαση του κατόχου, καμία γραφή`;
    case 'would-withdraw': return `   ⚠️  ${id}: ο κριτής θα την ΑΠΕΣΥΡΕ — καμία γραφή, θέλει απόφαση`;
    case 'unreadable': return `   ⚠️  ${id}: το ακίνητο κατόχου δεν διαβάζεται — καμία γραφή`;
    case 'orphan': return `   ⚠️  ${id}: αγγελία χωρίς πηγή — καμία γραφή (δουλειά του rebuild)`;
  }
}

/** Γράφει μέσω του γραφέα της οικογένειας — χωρίς κρίση `display`. */
async function republishSource(db: AdminFirestore, id: string, source: ListingSource): Promise<string> {
  return source.family === 'owner'
    ? (await republishOwnerProperty(db, source.owner)).publish
    : await republishListing(db, id, source.data);
}

/**
 * **ΑΠΟΚΑΤΑΣΤΑΣΗ** (`--republish-ids`): ξαναπροβάλλει τις δοσμένες αγγελίες με τους ΙΔΙΟΥΣ γραφείς και μετρά τα μέσα
 * πριν και μετά. Χωριστή λειτουργία, γιατί μετά την 1η εκτέλεση οι αγγελίες είναι `hidden` και το ερώτημα `shown`
 * δεν τις ξαναβρίσκει. Ιδεμποτητική: μια ξαναπροβολή από την πηγή δεν αλλάζει τίποτα αν η αγγελία είναι ήδη σωστή.
 */
async function restore(db: AdminFirestore, ids: readonly string[]): Promise<boolean> {
  let failed = false;
  for (const id of ids) {
    const before = (await db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(id).get()).data();
    const source = await sourceOf(db, id);
    console.log(`   ${id}: πριν  ${mediaCountsOf(before)}`);
    if (typeof source === 'string') { console.log(`      ⚠️  ${source} — καμία γραφή`); failed = true; continue; }
    if (!APPLY) continue;
    const outcome = await republishSource(db, id, source);
    const after = (await db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(id).get()).data();
    console.log(`      ${outcome === 'published' ? '✔' : '❌'} ${outcome} · μετά ${mediaCountsOf(after)} · display ${String(after?.objectiveValueDeclarations?.display)}`);
    failed = failed || outcome !== 'published';
  }
  return !failed;
}

async function main(): Promise<void> {
  if (APPLY) assertStorageConfigured();
  const { db, projectId } = initAdminApp(admin) as { db: AdminFirestore; projectId: string };
  const ids = republishIdsArg();
  if (ids !== null) {
    console.log(`\n🩹 ΑΠΟΚΑΤΑΣΤΑΣΗ μέσων — ${ids.length} αγγελίες · έργο: ${projectId} · ${APPLY ? '✍️  ΓΡΑΦΗ' : '👁️  ΞΗΡΟ'}`);
    console.log(`   κάδος: ${process.env.FIREBASE_STORAGE_BUCKET ?? '❌ ΛΕΙΠΕΙ'}`);
    process.exit((await restore(db, ids)) ? 0 : 1);
  }
  console.log('\n🔁 ΕΠΑΝΑΠΡΟΒΟΛΗ «display: shown» χωρίς επιλογή — ADR-898 §23.2');
  console.log(`   έργο: ${projectId} · τρόπος: ${APPLY ? '✍️  ΓΡΑΦΗ (--apply)' : '👁️  ΞΗΡΟ ΤΡΕΞΙΜΟ'}`);

  const at = nowISO();
  const snapshot = await db.collection(COLLECTIONS.PUBLIC_LISTINGS).where(SHOWN_FIELD, '==', 'shown').get();
  const tally = new Map<DisplayRepairPlan['kind'], number>();
  let failed = false;

  for (const doc of snapshot.docs) {
    const source = await sourceOf(db, doc.id);
    const plan: DisplayRepairPlan = typeof source === 'string' ? { kind: source } : planOf(doc.id, source, at);
    tally.set(plan.kind, (tally.get(plan.kind) ?? 0) + 1);
    console.log(describe(doc.id, plan));
    if (APPLY && plan.kind === 'republish' && typeof source !== 'string') {
      const ok = await applyAndVerify(db, doc.id, source);
      console.log(ok ? '      ✔ γράφτηκε και διαβάζεται hidden' : '      ❌ ΔΕΝ επιβεβαιώθηκε');
      failed = failed || !ok;
    }
  }

  console.log(`\n   αγγελίες με shown: ${snapshot.size}`);
  for (const kind of PLAN_KINDS) console.log(`   ${kind.padEnd(16)} ${tally.get(kind) ?? 0}`);
  if (!APPLY) console.log('\n   (ξηρό τρέξιμο — ξανατρέξε με --apply για γραφή)');
  process.exit(failed ? 1 : 0);
}

// Εκτελείται μόνο ως script — τα καθαρά μέρη εισάγονται χωρίς παρενέργειες.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('\n❌ Η επαναπροβολή απέτυχε:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
