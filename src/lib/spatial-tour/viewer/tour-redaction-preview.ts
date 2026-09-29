/**
 * @fileoverview **Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΘΟΛΩΜΑΤΟΣ ΓΙΑ ΤΗ GPU** — οι κύκλοι του προχείρου ⇒ πίνακας uniform του shader, και το μέγεθος του
 * κελιού θολώματος (ADR-884 Φ2ζ ζ3 · §4.15). Καθαρό: η άγκυρα εκτελεί τον ίδιο συσκευαστή που διαβάζει ο shader.
 * @related `components/spatial-tour/viewer/tour-panorama-shader.ts` (`redactionCover` — ο αποσυσκευαστής) ·
 *   `lib/spatial-tour/tour-redaction-draft.ts` (`redactionPreviewOf`) · `tileset/tour-redaction-mask.ts` (`redactionProxyWidth`)
 * @module lib/spatial-tour/viewer/tour-redaction-preview
 *
 * 🔑 **Μία περιοχή = ένα `vec4`**: `xyz` = μοναδιαία κατεύθυνση του κέντρου (συντεταγμένες πανοράματος, `yawPitchToDirection` — η
 *   ΙΔΙΑ σύμβαση με τον ψήστη), `w` = `κατάσταση × STRIDE + ακτίνα`. Η ακτίνα είναι ≤ π/4 < STRIDE, άρα η αποσυσκευασία
 *   (`floor(w / STRIDE)`) είναι ακριβής. Ένα `vec4` ανά περιοχή κρατά τον shader κάτω από το ελάχιστο όριο uniform του WebGL2.
 * 🔑 **Όριο** = `MAX_TOUR_REDACTIONS`: πάνω από αυτό (μόνο αν ο άνθρωπος αφαιρεί και προσθέτει ταυτόχρονα) φεύγουν πρώτα οι «υπό
 *   αφαίρεση» (μόνο περίγραμμα) — ποτέ ένας πρόχειρος κύκλος που πρέπει να φαίνεται θολωμένος.
 */

import { MAX_TOUR_REDACTIONS, TOUR_REDACTION_MAX_RADIUS_RAD } from '@/constants/spatial-tour-vocabulary';

import type { TourRedactionPreview, TourRedactionPreviewState } from '../tour-redaction-draft';
import { redactionProxyWidth } from '../tileset/tour-redaction-mask';
import { equirectWidthOfFace } from '../tileset/tour-tileset-layout';
import { yawPitchToDirection } from './tour-cube-faces';

/** Πόσες περιοχές χωρά ο shader. */
export const TOUR_REDACTION_PREVIEW_MAX = MAX_TOUR_REDACTIONS;
/** Το βήμα της κατάστασης μέσα στο `w` — πρέπει να είναι μεγαλύτερο από κάθε έγκυρη ακτίνα. */
export const TOUR_REDACTION_PREVIEW_STRIDE = 4;
/** Κατάσταση ⇒ αριθμός (ο shader θολώνει **μόνο** `draft`/`selected`: τα εφαρμοσμένα είναι ήδη θολωμένα στα πλακίδια). */
export const TOUR_REDACTION_PREVIEW_STATE: Readonly<Record<TourRedactionPreviewState, number>> = {
  applied: 0,
  draft: 1,
  selected: 2,
  removing: 3,
};

/**
 * **Το περίγραμμα σε pixel οθόνης** — σταθερό σε κάθε ζουμ (Figma/Photoshop: η επιλογή δεν «λεπταίνει» όταν απομακρύνεσαι).
 * Λευκός πυρήνας + σκούρα άλως ⇒ ορατό σε κάθε φωτογραφία (ζωντανά: 1 px σκέτο λευκό χανόταν σε ανοιχτά στόρια).
 */
export const TOUR_REDACTION_RING_PX = { normal: 2, selected: 3, halo: 1 } as const;

if (TOUR_REDACTION_MAX_RADIUS_RAD >= TOUR_REDACTION_PREVIEW_STRIDE) {
  throw new Error('tour-redaction-preview: STRIDE must exceed the maximum redaction radius');
}

/** Σειρά προτεραιότητας όταν ξεπεραστεί το όριο — πρώτα ό,τι πρέπει να **θολώσει**. */
const PRIORITY: readonly TourRedactionPreviewState[] = ['selected', 'draft', 'applied', 'removing'];

export interface PackedRedactionPreview {
  /** `4 × TOUR_REDACTION_PREVIEW_MAX` αριθμοί — ό,τι παίρνει το uniform `redactions`. */
  readonly data: Float32Array;
  readonly count: number;
}

/** **Συσκευασία** για τον shader — σειρά προτεραιότητας, αποκοπή στο όριο. */
export function packRedactionPreview(previews: readonly TourRedactionPreview[]): PackedRedactionPreview {
  const ordered = PRIORITY.flatMap((state) => previews.filter((p) => p.state === state)).slice(0, TOUR_REDACTION_PREVIEW_MAX);
  const data = new Float32Array(4 * TOUR_REDACTION_PREVIEW_MAX);
  ordered.forEach((p, i) => {
    const d = yawPitchToDirection(p.yawRad, p.pitchRad);
    data.set([d.x, d.y, d.z, TOUR_REDACTION_PREVIEW_STATE[p.state] * TOUR_REDACTION_PREVIEW_STRIDE + p.radiusRad], 4 * i);
  });
  return { data, count: ordered.length };
}

/** Το αντίστροφο του `w` — ό,τι κάνει ο shader (`floor(w / STRIDE)`), εκτελέσιμο στην άγκυρα. */
export function unpackRedactionW(w: number): { readonly state: number; readonly radiusRad: number } {
  const state = Math.floor(w / TOUR_REDACTION_PREVIEW_STRIDE);
  return { state, radiusRad: w - state * TOUR_REDACTION_PREVIEW_STRIDE };
}

/**
 * **Η γωνία ενός κελιού θολώματος** για λήψη με όψη `faceSize` — ίδια με του ψήστη: το equirect σμικρύνεται σε
 * `redactionProxyWidth(πλάτος)` κελιά γύρω από τους 2π. Το πλάτος εκτιμάται από την όψη (`equirectWidthOfFace`).
 */
export function redactionCellRad(faceSize: number): number {
  return (2 * Math.PI) / redactionProxyWidth(equirectWidthOfFace(faceSize));
}
