#!/usr/bin/env tsx
/**
 * **BACKFILL ΣΑΡΩΣΗΣ ΠΡΟΣΩΠΩΝ** — ADR-884 Φ2ζ ζ4 · §4.15 · §12 Δ10.
 *
 * Οι λήψεις που ψήθηκαν **πριν** το ζ4 (ή από παλιότερη `TOUR_FACE_DETECTOR_VERSION`) σερβίρονται χωρίς αυτόματο θόλωμα. Ο ψήστης
 * σαρώνει κάθε **νέα** λήψη πριν τη δημοσιεύσει· αυτό το script κάνει το ίδιο στις **παλιές**, με τον ΙΔΙΟ δρόμο
 * (`backfillFaceScan` → `scanFaces` → `recordFaceScan` → `bakeTourTileset`). Καμία λογική εδώ — μόνο επιλογή και αναφορά.
 *
 * 🏆 **Ξηρό εξ ορισμού, και το ξηρό ΜΕΤΡΑ**: σαρώνει πραγματικά και λέει **πόσα πρόσωπα** έχει κάθε λήψη, χωρίς να γράψει.
 * 🏆 **Με `--apply`**: 0 πρόσωπα ⇒ μόνο το ίχνος (καμία επανα-ψήση, καμία διακοπή)· πρόσωπα ⇒ **εκείνη** η λήψη ξαναψήνεται
 *   (fail-closed ανά σημείο: δεν σερβίρεται ως να ψηθεί), τα παλιά πλακίδια διαγράφονται.
 * 🔴 **Σε πραγματικά δεδομένα μόνο με «ναι» του Giorgio** (handoff §5 ΜΗΝ).
 *
 * ΕΚΤΕΛΕΣΗ
 *   npm run backfill:tour-face-scan                      # ξηρό — σάρωση + αναφορά
 *   npm run backfill:tour-face-scan -- --apply           # γραφή
 *   npm run backfill:tour-face-scan -- --apply --id=tcap_xxx
 *
 * Το `NODE_OPTIONS=--conditions=react-server` είναι ο δηλωμένος μηχανισμός του `server-only` (βλ. `backfill-first-contact-offerer.ts`).
 */

import type { DocumentReference } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { disposeFaceDetector } from '@/server/spatial-tour/face-detection/yunet-session';
import { backfillFaceScan, type FaceBackfillOutcome } from '@/server/spatial-tour/tour-face-backfill';

import { applyEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από την πρώτη κλήση Admin SDK (αρχικοποιείται οκνηρά).
applyEnvLocal();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY_ID = (args.find((a) => a.startsWith('--id=')) ?? '').slice('--id='.length) || null;

/** Όλες οι λήψεις (ή μία) — πλήρης σάρωση: τρέχει μία φορά ανά έκδοση ανιχνευτή, και ψάχνει **απουσία** πεδίου. */
async function captureRefs(): Promise<readonly DocumentReference[]> {
  // tenant-scope-exempt: εργασία χειριστή σε ΚΑΘΕ κάτοχο με την ίδια πολιτική (όπως το δίχτυ του ψήστη, ADR-884 Φ2α).
  const snapshot = await getAdminFirestore().collectionGroup(SUBCOLLECTIONS.TOUR_CAPTURES).get();
  return snapshot.docs.filter((doc) => ONLY_ID === null || doc.id === ONLY_ID).map((doc) => doc.ref);
}

function describe(outcome: FaceBackfillOutcome): string {
  switch (outcome.kind) {
    case 'would-record': return `θα γραφτεί · πρόσωπα ${outcome.faces}${outcome.faces > 0 ? ' ⇒ επανα-ψήση' : ' ⇒ μόνο ίχνος'}`;
    case 'recorded': return `γράφτηκε · πρόσωπα ${outcome.faces}, νέες περιοχές ${outcome.added} · ψήσιμο ${outcome.bake?.kind ?? '—'}`;
    case 'error': return `🔴 ΣΦΑΛΜΑ: ${outcome.error}`;
    default: return outcome.kind;
  }
}

async function main(): Promise<void> {
  const refs = await captureRefs();
  console.log(`[FACE SCAN BACKFILL] ${APPLY ? 'ΓΡΑΦΗ' : 'ΞΗΡΟ (σάρωση χωρίς εγγραφή)'} · λήψεις: ${refs.length}`);
  let errors = 0;
  for (const ref of refs) {
    const outcome = await backfillFaceScan(getAdminFirestore(), ref, APPLY);
    if (outcome.kind === 'error') errors += 1;
    console.log(`  ${ref.path} — ${describe(outcome)}`);
  }
  await disposeFaceDetector();
  if (errors > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('[FACE SCAN BACKFILL] απέτυχε', error);
  process.exitCode = 1;
});
