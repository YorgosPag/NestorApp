#!/usr/bin/env tsx
/**
 * **ΜΕΤΑΒΑΣΗ ΠΕΡΙΗΓΗΣΗΣ ΣΤΗΝ ΕΕ — ΟΛΟΚΛΗΡΗΣ** — ADR-884 Φ2ζ ζ5 (πλακίδια) · ADR-895 Φ4 §7.5 (πρωτότυπα).
 *
 * Οι περιηγήσεις που γεννήθηκαν **πριν** το ζ5α / τη Φ3 έχουν πλακίδια **και** πρωτότυπα στον κανονικό κάδο (US-EAST1).
 * Μονάδα τοποθεσίας = η περιήγηση ⇒ αυτό το script τα περνά **όλα**, με τη σειρά πλακίδια → πρωτότυπα, μέσω της ΜΙΑΣ
 * ορχήστρωσης (`tour-residency-migration`). Καμία λογική εδώ — μόνο επιλογή και αναφορά.
 *
 * 🏆 **Ξηρό εξ ορισμού, και το ξηρό ΜΕΤΡΑ**: κλειδιά, αρχεία, bytes, πόσα λείπουν ήδη στον EU, και πόσο θα μείνουν τα σβησμένα
 *    bytes soft-deleted στις ΗΠΑ — τίποτα δεν γράφεται.
 * 🔴 **`--apply`** = αντιγραφή (GCS rewrite) → επαλήθευση crc32c → CAS → (πλακίδια: δίχτυ). Ο παλιός κάδος **μένει ανέπαφος**.
 * 🔴 **`--cleanup`** = σβήσιμο των πηγών — πλακίδια ≥15′, πρωτότυπα ≥24 ώρες μετά το `--apply`, με νέα επαλήθευση.
 * 🔴 **`--only=tiles|originals`** = ένα σκέλος τη φορά (χωριστό «ναι» ανά σκέλος). Χωρίς αυτό: και τα δύο, με τη σειρά.
 * 🔴 Σε πραγματικά δεδομένα **μόνο με «ναι» του Giorgio**, από τον ίδιο (`! npm run …`).
 *
 * ΕΚΤΕΛΕΣΗ
 *   npm run migrate:tour-media                                             # ξηρό — σχέδιο + μέτρηση
 *   npm run migrate:tour-media -- --apply --id=stour_xxx                   # μετάβαση μίας περιήγησης (πλακίδια → πρωτότυπα)
 *   npm run migrate:tour-media -- --apply --only=tiles --id=stour_xxx      # μόνο τα πλακίδια
 *   npm run migrate:tour-media -- --cleanup --id=stour_xxx                 # σβήσιμο πηγών (όσων πέρασε η χάρη)
 *
 * Το `NODE_OPTIONS=--conditions=react-server` είναι ο δηλωμένος μηχανισμός του `server-only` (βλ. `backfill-tour-face-scan.ts`).
 */

import type { DocumentReference } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { TourMediaCleanupOutcome, TourMediaMigrationOutcome } from '@/server/spatial-tour/tour-media-migration';
import type { OriginalCleanupOutcome, OriginalMigrationOutcome, TourOriginalsOutcome } from '@/server/spatial-tour/tour-original-migration';
import {
  cleanupTourResidency,
  migrateTourResidency,
  sourceSoftDeleteSeconds,
  type ResidencyPart,
} from '@/server/spatial-tour/tour-residency-migration';

import { applyEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από την πρώτη κλήση Admin SDK (αρχικοποιείται οκνηρά).
applyEnvLocal();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const CLEANUP = args.includes('--cleanup');
const ONLY_ID = (args.find((a) => a.startsWith('--id=')) ?? '').slice('--id='.length) || null;
const ONLY_RAW = (args.find((a) => a.startsWith('--only=')) ?? '').slice('--only='.length) || null;

function parseOnly(raw: string | null): ResidencyPart | undefined {
  if (raw === null) return undefined;
  if (raw === 'tiles' || raw === 'originals') return raw;
  throw new Error(`--only=${raw}: επιτρέπεται μόνο tiles ή originals.`);
}
const ONLY = parseOnly(ONLY_RAW);

/** Όλες οι περιηγήσεις (ή μία) και των δύο διαμερισμάτων. */
async function tourRefs(): Promise<readonly DocumentReference[]> {
  const db = getAdminFirestore();
  // tenant-scope-exempt: εργασία χειριστή σε ΚΑΘΕ κάτοχο με την ίδια πολιτική (όπως το backfill σάρωσης προσώπων, ADR-884 ζ4).
  const snapshots = await Promise.all([COLLECTIONS.SPATIAL_TOURS, COLLECTIONS.SPATIAL_TOURS_PERSONAL].map((name) => db.collection(name).get()));
  return snapshots.flatMap((snapshot) => snapshot.docs).filter((doc) => ONLY_ID === null || doc.id === ONLY_ID).map((doc) => doc.ref);
}

const mb = (bytes: number): string => `${(bytes / 1_048_576).toFixed(1)} MB`;

function describeTiles(outcome: TourMediaMigrationOutcome | TourMediaCleanupOutcome): string {
  switch (outcome.kind) {
    case 'planned': case 'migrated': {
      const { tileKeys, planHashes, unservable } = outcome.manifest;
      const head = outcome.kind === 'planned' ? 'σχέδιο' : '✅ μετακινήθηκαν';
      return `${head} · κλειδιά ${tileKeys.length} · κατόψεις ${planHashes.length} · αντικείμενα ${outcome.objects} (${mb(outcome.bytes)})`
        + ` · ${outcome.kind === 'planned' ? 'θα αντιγραφούν' : 'αντιγράφηκαν'} ${outcome.copied}`
        + (unservable.length > 0 ? ` · ⚠️ μη σερβιρίσιμες (παλιά διάταξη, μένουν έξω): ${unservable.join(', ')}` : '');
    }
    case 'refused': return `🔴 ΑΡΝΗΣΗ (${outcome.reason})${outcome.missing.length > 0 ? ` · λείπουν ${outcome.missing.length}: ${outcome.missing.slice(0, 3).join(', ')}` : ''}`;
    case 'cleaned': return `🧹 σβήστηκαν ${outcome.deleted} αντικείμενα από τον παλιό κάδο`;
    case 'skipped': return `— (${outcome.reason})`;
  }
}

function describeFile(outcome: OriginalMigrationOutcome | OriginalCleanupOutcome): string {
  switch (outcome.kind) {
    case 'planned': return `σχέδιο · ${mb(outcome.bytes)} · ${outcome.copied > 0 ? 'θα αντιγραφεί' : 'υπάρχει ήδη πανομοιότυπο στον EU'}`;
    case 'migrated': return `✅ μετακινήθηκε · ${mb(outcome.bytes)}`;
    case 'cleaned': return `🧹 σβήστηκαν ${outcome.deleted} από τον παλιό κάδο`;
    case 'refused': return `🔴 ΑΡΝΗΣΗ (${outcome.reason})`;
    case 'busy': return '— (busy: η εγγραφή δεν είναι ready)';
    case 'skipped': return `— (${outcome.reason})`;
  }
}

function describeOriginals(outcome: TourOriginalsOutcome<OriginalMigrationOutcome | OriginalCleanupOutcome>): string[] {
  if (outcome.kind === 'skipped') return [`    πρωτότυπα — (${outcome.reason})`];
  const lines = outcome.files.map(({ fileId, outcome: file }) => `    πρωτότυπο ${fileId} — ${describeFile(file)}`);
  if (outcome.unreadableCaptures.length > 0) lines.push(`    ⚠️ λήψεις που δεν διαβάστηκαν (πρωτότυπο ΔΕΝ κρίθηκε): ${outcome.unreadableCaptures.join(', ')}`);
  return lines.length > 0 ? lines : ['    πρωτότυπα — κανένα'];
}

/** Άρνηση οπουδήποτε ⇒ exit code 1 (ό,τι δεν πέρασε φαίνεται και στον κωδικό εξόδου, όχι μόνο στο κείμενο). */
function hasRefusal(report: { tiles?: { kind: string }; originals?: TourOriginalsOutcome<{ kind: string }> }): boolean {
  const originals = report.originals?.kind === 'done' ? report.originals.files.some(({ outcome }) => outcome.kind === 'refused') : false;
  return report.tiles?.kind === 'refused' || originals;
}

async function reportSoftDelete(): Promise<void> {
  const seconds = await sourceSoftDeleteSeconds();
  console.log(seconds === null
    ? '  ℹ️ κάδος-πηγή χωρίς soft delete: το --cleanup σβήνει οριστικά.'
    : `  ⚠️ κάδος-πηγή με soft delete ${(seconds / 86_400).toFixed(1)} ημ.: μετά το --cleanup τα bytes μένουν soft-deleted στις ΗΠΑ ως τότε.`);
}

async function main(): Promise<void> {
  if (APPLY && CLEANUP) throw new Error('--apply και --cleanup είναι χωριστές εκτελέσεις (ο καθαρισμός θέλει χάρη μετά).');
  if ((APPLY || CLEANUP) && ONLY_ID === null) throw new Error('--apply/--cleanup απαιτούν --id=stour_… (μία περιήγηση τη φορά).');
  const db = getAdminFirestore();
  const refs = await tourRefs();
  const mode = CLEANUP ? 'ΚΑΘΑΡΙΣΜΟΣ' : APPLY ? 'ΓΡΑΦΗ' : 'ΞΗΡΟ (σχέδιο χωρίς εγγραφή)';
  console.log(`[TOUR → EU] ${mode}${ONLY ? ` · μόνο ${ONLY}` : ''} · περιηγήσεις: ${refs.length}`);
  if (!APPLY) await reportSoftDelete();
  let refused = false;
  for (const ref of refs) {
    const report = CLEANUP ? await cleanupTourResidency(db, ref, { only: ONLY }) : await migrateTourResidency(db, ref, { apply: APPLY, only: ONLY });
    refused = hasRefusal(report) || refused;
    console.log(`  ${ref.path}`);
    if (report.tiles) console.log(`    πλακίδια — ${describeTiles(report.tiles)}`);
    if (report.originals) describeOriginals(report.originals).forEach((line) => console.log(line));
  }
  if (refused) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('[TOUR → EU] απέτυχε', error);
  process.exitCode = 1;
});
