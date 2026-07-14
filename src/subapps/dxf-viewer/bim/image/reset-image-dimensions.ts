/**
 * ADR-654 — «Επαναφορά Διαστάσεων» εικόνας (pure geometry SSoT).
 *
 * Ο ΜΟΝΟΣ υπολογισμός πίσω από το κουμπί «Επαναφορά Διαστάσεων» του contextual tab «Εικόνα»
 * (PowerPoint «Reset Size» / ArchiCAD «fit to original proportions»). Ο χρήστης μπορεί αθελά
 * του να παραμορφώσει ένα entourage sprite με τις μεσοπλευρικές λαβές (μη-ομοιόμορφο stretch,
 * `image-grips.ts` `applyRectEdgeDrag`) → σπάει ο λόγος πλευρών. Αυτό το επαναφέρει.
 *
 * Δύο δρόμοι, με σαφή προτεραιότητα (Giorgio 2026-07-15 — «πλήρης επαναφορά μεγέθους»):
 *   - **A (native size)** — αν η εικόνα κρατά `intrinsicWidth`/`intrinsicHeight` (τα γεμίζει το
 *     `place-entourage.ts` στην τοποθέτηση), επαναφέρει το ΑΠΟΛΥΤΟ εργοστασιακό μέγεθος.
 *   - **C (aspect-only fallback)** — legacy/μη-entourage εικόνες χωρίς intrinsic: κρατά τη
 *     ΦΥΣΙΚΑ ΜΕΓΑΛΥΤΕΡΗ τρέχουσα πλευρά και ξαναϋπολογίζει την άλλη από το decoded pixel-aspect
 *     ⇒ un-deform χωρίς επαναφορά απόλυτου μεγέθους.
 *
 * Και στους δύο δρόμους το **κέντρο του κουτιού μένει σταθερό** (big-player: το αντικείμενο δεν
 * «πηδάει») και η **περιστροφή μένει ανέγγιχτη**. Καθαρή γεωμετρία — μηδέν DOM/store/decode εδώ
 * (το decode το κάνει ο caller και περνά το pixel μέγεθος), ώστε να είναι testable ως math.
 *
 * ΜΗΔΕΝ νέα γεωμετρία: το κέντρο/γωνία διαβάζονται από το ΚΟΙΝΟ `RectFrame` (`imageRectFrame` +
 * `rectCornerWorld`), ΙΔΙΟ SSoT με τις λαβές — reposition ≡ grip semantics εξ ορισμού.
 *
 * @see ./image-grips.ts — imageRectFrame (rotation-aware center/corner reader)
 * @see ../grips/rect-frame.ts — rectCornerWorld (bottom-left = position, y-up)
 * @see ../entourage/place-entourage.ts — γεμίζει τα intrinsic πεδία (Δρόμος A)
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

import type { ImageEntity } from '../../types/image';
import { imageRectFrame } from './image-grips';
import { rectCornerWorld, type RectFrame } from '../grips/rect-frame';

/** Decoded pixel μέγεθος της εικόνας (naturalWidth/Height) — για τον aspect fallback (Δρόμος C). */
export interface DecodedPixelSize {
  readonly w: number;
  readonly h: number;
}

/** Το reset patch: νέα κάτω-αριστερή γωνία + διαστάσεις (ό,τι πατά το `UpdateEntityCommand`). */
export type ImageResetPatch = Pick<ImageEntity, 'position' | 'width' | 'height'>;

/** Θετικός, πεπερασμένος αριθμός (φιλτράρει `0`/`NaN`/`Infinity`/undefined). */
function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Ίσα μέσα σε ανοχή float — «ήδη στο σωστό μέγεθος» → μηδενικό patch (idempotent). */
function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6;
}

/**
 * Έχει η εικόνα αποθηκευμένο έγκυρο εργοστασιακό μέγεθος (Δρόμος A); Ο caller το χρησιμοποιεί ως
 * **decode-gate**: μόνο εικόνες ΧΩΡΙΣ intrinsic χρειάζονται async decode για τον aspect fallback.
 */
export function hasStoredIntrinsicSize(
  entity: Pick<ImageEntity, 'intrinsicWidth' | 'intrinsicHeight'>,
): boolean {
  return isPositiveFinite(entity.intrinsicWidth) && isPositiveFinite(entity.intrinsicHeight);
}

/**
 * Το μέγεθος-στόχος της επαναφοράς (μονάδες σχεδίου), ή `null` όταν δεν μπορεί να προσδιοριστεί
 * (ούτε intrinsic, ούτε έγκυρο decoded pixel μέγεθος). Καθαρή συνάρτηση — Δρόμος A προηγείται.
 */
export function resolveImageResetSize(
  entity: Pick<ImageEntity, 'width' | 'height' | 'intrinsicWidth' | 'intrinsicHeight'>,
  decoded?: DecodedPixelSize | null,
): { width: number; height: number } | null {
  // Δρόμος A — αποθηκευμένο απόλυτο εργοστασιακό μέγεθος (PowerPoint «Reset Size»).
  if (isPositiveFinite(entity.intrinsicWidth) && isPositiveFinite(entity.intrinsicHeight)) {
    return { width: entity.intrinsicWidth, height: entity.intrinsicHeight };
  }
  // Δρόμος C — aspect-only από decoded pixels: κράτα τη μεγαλύτερη τρέχουσα πλευρά, διόρθωσε την
  // άλλη ώστε ο λόγος πλευρών να ταιριάξει με το pixel-aspect (ArchiCAD «fit to proportions»).
  if (decoded && isPositiveFinite(decoded.w) && isPositiveFinite(decoded.h)) {
    const pixelAspect = decoded.w / decoded.h;
    return entity.width >= entity.height
      ? { width: entity.width, height: entity.width / pixelAspect }
      : { width: entity.height * pixelAspect, height: entity.height };
  }
  return null;
}

/**
 * Το reset patch μιας εικόνας — νέο μέγεθος (Δρόμος A ή C) με ΣΤΑΘΕΡΟ κέντρο & ΑΝΕΓΓΙΧΤΗ
 * περιστροφή. `null` όταν (α) δεν προσδιορίζεται μέγεθος-στόχος ή (β) η εικόνα είναι ήδη στο
 * σωστό μέγεθος (μηδενικό patch → ο caller την παραλείπει).
 */
export function resetImageDimensions(
  entity: ImageEntity,
  decoded?: DecodedPixelSize | null,
): ImageResetPatch | null {
  const target = resolveImageResetSize(entity, decoded);
  if (!target) return null;
  // Ήδη στο σωστό μέγεθος → no-op (idempotent: δεύτερο κλικ δεν κάνει τίποτα).
  if (approxEqual(entity.width, target.width) && approxEqual(entity.height, target.height)) {
    return null;
  }
  // Κέντρο σταθερό: κράτα το ΙΔΙΟ center/rotation του τρέχοντος frame, άλλαξε μόνο τις ημι-διαστάσεις.
  const current = imageRectFrame(entity);
  const resized: RectFrame = {
    center: current.center,
    rotationDeg: current.rotationDeg,
    halfWidth: target.width / 2,
    halfLength: target.height / 2,
  };
  // Το `position` της εικόνας είναι η κάτω-αριστερή γωνία (y-up) — ΙΔΙΟ SSoT με τις λαβές.
  return {
    position: rectCornerWorld(resized, { sx: -1, sy: -1 }),
    width: target.width,
    height: target.height,
  };
}
