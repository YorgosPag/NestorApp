/**
 * ADR-441 — Column-aware justification για περιμετρικά δοκάρια/τοίχους «από κάναβο».
 *
 * **Δομικός κανόνας (Revit/ETABS-grade):** ένα στηριζόμενο γραμμικό στοιχείο (δοκάρι/τοίχος)
 * ΔΕΝ πρέπει να προεξέχει της κολόνας στήριξης — πρέπει να πατά πλήρως (full bearing). Αν το
 * γραμμικό «διαλέγει» δική του έδραση στον άξονα (π.χ. center) ενώ η κολόνα είναι έκκεντρη
 * (inner/outer) και τα πλάτη διαφέρουν, οι παρειές αποκλίνουν → μερική/έκκεντρη στήριξη.
 *
 * Λύση: το περιμετρικό γραμμικό **κληρονομεί το justification της κολόνας** στον κοινό τους
 * (perpendicular) άξονα. Επειδή το `justifyGridSegment` εφαρμόζει το ΔΙΚΟ του πλάτος γύρω από
 * την ίδια αναφορά («παρειά στον άξονα»), οι εξωτερικές παρειές κολόνας & δοκαριού ΣΥΜΠΙΠΤΟΥΝ
 * και το στενότερο πατά ολόκληρο μέσα στο φαρδύτερο — flush όψη, full bearing, ανεξαρτήτως
 * πλατών. Χωρίς κολόνα-αναφορά → σέβεται το mode του χρήστη (fallback).
 *
 * @see ./grid-segment-justification.ts — εφαρμόζει το (κληρονομημένο) justification
 * @see ./grid-column-justification.ts — αντίστροφη χαρτογράφηση (justification → anchor)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { ColumnEntity } from '../types/column-types';
import { ANCHOR_OFFSETS } from '../types/column-types';
import type { StripJustification } from '../types/foundation-types';
import { hasGuideBindings, type GuideBinding } from '../hosting/guide-binding-types';

/** Πρόσημο μετατόπισης anchor → justification (αντίστροφο του `gridColumnJustification`). */
function signToJustification(sign: number): StripJustification {
  if (sign > 0) return 'left';
  if (sign < 0) return 'right';
  return 'center';
}

/** Ο perpendicular άξονας ενός γραμμικού segment + ποιο column-slot/anchor-component τον αφορά. */
function perpendicularAxis(
  bindings: readonly GuideBinding[],
): { guideId: string; columnSlot: 'center-x' | 'center-y'; component: 'dx' | 'dy' } | null {
  const find = (slot: GuideBinding['slot']) => bindings.find((b) => b.slot === slot);
  const sx = find('start-x'), ex = find('end-x'), sy = find('start-y'), ey = find('end-y');
  // Κατακόρυφο: start-x/end-x ίδιος X-guide → perpendicular = X.
  if (sx && ex && sx.guideId === ex.guideId) {
    return { guideId: sx.guideId, columnSlot: 'center-x', component: 'dx' };
  }
  // Οριζόντιο: start-y/end-y ίδιος Y-guide → perpendicular = Y.
  if (sy && ey && sy.guideId === ey.guideId) {
    return { guideId: sy.guideId, columnSlot: 'center-y', component: 'dy' };
  }
  return null;
}

/**
 * Επίλυσε το justification ενός γραμμικού grid-segment ώστε να ευθυγραμμίζεται με την κολόνα
 * στήριξης (full bearing). Επιστρέφει το justification της κολόνας στον κοινό perpendicular
 * άξονα· αν δεν υπάρχει κολόνα-αναφορά → `fallback` (το mode του χρήστη).
 */
export function resolveColumnAwareJustification(
  bindings: readonly GuideBinding[],
  columns: readonly ColumnEntity[],
  fallback: StripJustification,
): StripJustification {
  const perp = perpendicularAxis(bindings);
  if (!perp) return fallback;
  for (const col of columns) {
    if (!hasGuideBindings(col)) continue;
    const onAxis = col.guideBindings.some((b) => b.slot === perp.columnSlot && b.guideId === perp.guideId);
    if (!onAxis) continue;
    const anchor = col.params.anchor ?? 'center';
    const comp = ANCHOR_OFFSETS[anchor][perp.component];
    // Αντίστροφο του gridColumnJustification (canonical normals: V nx=−1 → +sign·
    // οριζόντιο ny=+1 → −sign). Η σχέση anchor↔justification ΔΙΑΦΕΡΕΙ ανά διεύθυνση.
    const justSign = perp.component === 'dx' ? Math.sign(comp) : -Math.sign(comp);
    return signToJustification(justSign);
  }
  return fallback;
}
