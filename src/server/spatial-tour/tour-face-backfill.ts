import 'server-only';

/**
 * @fileoverview **ΣΑΡΩΣΗ ΠΡΟΣΩΠΩΝ ΣΕ ΛΗΨΕΙΣ ΠΟΥ ΗΔΗ ΔΗΜΟΣΙΕΥΤΗΚΑΝ** — όσες ψήθηκαν πριν το ζ4, ή από παλιότερη έκδοση ανιχνευτή
 * (ADR-884 Φ2ζ ζ4 · §4.15). Η Street View θόλωσε αναδρομικά· εδώ το ίδιο, **πιο έξυπνα**: ξαναψήνεται **μόνο** ό,τι έχει πρόσωπα.
 * @related `tour-face-scan.ts` (η σάρωση) · `tour-graph-write.ts` (`recordFaceScan` — ο ΕΝΑΣ γραφέας) · `tour-tileset-baker.ts`
 *   (`loadCaptureOriginal` · το ψήσιμο) · `scripts/migrations/backfill-tour-face-scan.ts` (ο καλών)
 * @module server/spatial-tour/tour-face-backfill
 *
 * 🏆 **0 πρόσωπα ⇒ γράφεται μόνο το ίχνος, κανένα ψήσιμο, μηδέν διακοπή.** Πρόσωπα ⇒ ο γραφέας περνά **εκείνη** τη λήψη σε
 *   `pending` με νέο κλειδί (το παλιό αποσύρεται — τα πλακίδιά του έδειχναν το πρόσωπο) και ψήνεται αμέσως.
 * 🔒 **Ξηρό = σάρωση χωρίς εγγραφή**: ο άνθρωπος βλέπει **πόσα πρόσωπα** βρέθηκαν πριν πει «ναι» — ποτέ «θα σαρώσω» στα τυφλά.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { TOUR_FACE_DETECTOR_VERSION } from '@/constants/spatial-tour-vocabulary';
import { getErrorMessage } from '@/lib/error-utils';
import { tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';

import { scanFaces } from './tour-face-scan';
import { recordFaceScan } from './tour-graph-write';
import { decodeEquirect } from './tour-tileset-render';
import { bakeTourTileset, loadCaptureOriginal, type TourTilesetBakeOutcome } from './tour-tileset-baker';

export type FaceBackfillOutcome =
  | { readonly kind: 'current' | 'not-ready' | 'missing' | 'superseded' }
  | { readonly kind: 'would-record'; readonly faces: number }
  | { readonly kind: 'recorded'; readonly faces: number; readonly added: number; readonly bake: TourTilesetBakeOutcome | null }
  | { readonly kind: 'error'; readonly error: string };

/** **Σάρωσε μία δημοσιευμένη λήψη** — `apply: false` ⇒ μόνο μέτρηση. Δεν πετά: κάθε αστοχία είναι αποτέλεσμα με όνομα. */
export async function backfillFaceScan(db: Firestore, captureRef: DocumentReference, apply: boolean): Promise<FaceBackfillOutcome> {
  try {
    const snap = await captureRef.get();
    const capture = snap.exists ? tourCaptureFromDocument(snap.data(), captureRef.id) : null;
    const tourRef = captureRef.parent.parent;
    if (capture === null || tourRef === null) return { kind: 'missing' };
    if (capture.faceScan?.version === TOUR_FACE_DETECTOR_VERSION) return { kind: 'current' };
    const key = capture.tileset.contentHash;
    if (capture.tileset.state !== 'ready' || key === null) return { kind: 'not-ready' };
    const faces = await scanFaces(await decodeEquirect(await loadCaptureOriginal(db, tourRef, capture)));
    if (!apply) return { kind: 'would-record', faces: faces.length };
    const outcome = await recordFaceScan(db, captureRef, { expectedKey: key, faces });
    if (outcome.kind === 'superseded') return { kind: 'superseded' };
    const bake = outcome.key === key ? null : await bakeTourTileset(db, captureRef);
    return { kind: 'recorded', faces: outcome.scan.faces, added: outcome.scan.added, bake };
  } catch (error: unknown) {
    return { kind: 'error', error: getErrorMessage(error) };
  }
}
