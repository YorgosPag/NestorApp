/**
 * ADR-654 — Διαστάσεις εικόνας: «Επαναφορά Διαστάσεων» + «Κλείδωμα Αναλογιών» (pure geometry SSoT).
 *
 * Ο χρήστης μπορεί αθελά του να παραμορφώσει ένα entourage sprite με τις μεσοπλευρικές λαβές
 * (μη-ομοιόμορφο stretch, `image-grips.ts` `applyRectEdgeDrag`) → σπάει ο λόγος πλευρών. Δύο
 * ΞΕΧΩΡΙΣΤΕΣ ενέργειες (Giorgio 2026-07-15), όπως στους μεγάλους (PowerPoint/ArchiCAD):
 *
 *   - **Επαναφορά Διαστάσεων** (`resetImageToOriginalSize`) — επαναφέρει το **ΑΠΟΛΥΤΟ αρχικό
 *     μέγεθος**, όπως τη στιγμή της πρώτης τοποθέτησης (PowerPoint «Reset Size»). Πηγή = τα
 *     αποθηκευμένα `intrinsicWidth`/`intrinsicHeight` (τα γεμίζει το `place-entourage.ts`). Για
 *     legacy/μη-entourage χωρίς intrinsic → fallback στον aspect-only υπολογισμό από decoded pixels.
 *
 *   - **Κλείδωμα Αναλογιών** (`lockImageAspect`) — **un-deform** ΧΩΡΙΣ αλλαγή κλίμακας: κρατά τη
 *     ΦΥΣΙΚΑ ΜΕΓΑΛΥΤΕΡΗ τρέχουσα πλευρά και διορθώνει την άλλη ώστε ο λόγος πλευρών να ταιριάξει
 *     με τον «αληθινό» (intrinsic αν υπάρχει, αλλιώς decoded pixel-aspect) — ArchiCAD «fit to
 *     original proportions». Ο χρήστης κρατά όποιο μέγεθος διάλεξε, φεύγει μόνο η παραμόρφωση.
 *
 * Και στις δύο: **σταθερό κέντρο** (το αντικείμενο δεν «πηδάει»), **ανέγγιχτη περιστροφή**,
 * **idempotent** (ήδη-σωστό → μηδενικό patch). Καθαρή γεωμετρία — μηδέν DOM/store/decode εδώ
 * (το decode το κάνει ο caller και περνά το pixel μέγεθος), ώστε να είναι testable ως math.
 *
 * ΜΗΔΕΝ νέα γεωμετρία: το κέντρο/γωνία διαβάζονται από το ΚΟΙΝΟ `RectFrame` (`imageRectFrame` +
 * `rectCornerWorld`), ΙΔΙΟ SSoT με τις λαβές — reposition ≡ grip semantics εξ ορισμού.
 *
 * @see ./image-grips.ts — imageRectFrame (rotation-aware center/corner reader)
 * @see ../grips/rect-frame.ts — rectCornerWorld (bottom-left = position, y-up)
 * @see ../entourage/place-entourage.ts — γεμίζει τα intrinsic πεδία (πηγή του αρχικού μεγέθους)
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

import type { ImageEntity } from '../../types/image';
import { imageRectFrame } from './image-grips';
import { rectCornerWorld, type RectFrame } from '../grips/rect-frame';

/** Decoded pixel μέγεθος της εικόνας (naturalWidth/Height) — για τον aspect υπολογισμό. */
export interface DecodedPixelSize {
  readonly w: number;
  readonly h: number;
}

/** Το patch: νέα κάτω-αριστερή γωνία + διαστάσεις (ό,τι πατά το `UpdateEntityCommand`). */
export type ImageResetPatch = Pick<ImageEntity, 'position' | 'width' | 'height'>;

type SizedImage = Pick<ImageEntity, 'width' | 'height' | 'intrinsicWidth' | 'intrinsicHeight'>;

/** Θετικός, πεπερασμένος αριθμός (φιλτράρει `0`/`NaN`/`Infinity`/undefined). */
function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Ίσα μέσα σε ανοχή float — «ήδη στο σωστό μέγεθος» → μηδενικό patch (idempotent). */
function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6;
}

/**
 * Έχει η εικόνα αποθηκευμένο έγκυρο εργοστασιακό μέγεθος; Ο caller το χρησιμοποιεί ως **decode-gate**:
 * μόνο εικόνες ΧΩΡΙΣ intrinsic χρειάζονται async decode για να προκύψει ο λόγος πλευρών.
 */
export function hasStoredIntrinsicSize(entity: SizedImage): boolean {
  return isPositiveFinite(entity.intrinsicWidth) && isPositiveFinite(entity.intrinsicHeight);
}

/** Ο «αληθινός» λόγος πλευρών: intrinsic αν υπάρχει, αλλιώς decoded pixel-aspect· `null` αν κανένα. */
function trueAspect(entity: SizedImage, decoded?: DecodedPixelSize | null): number | null {
  if (hasStoredIntrinsicSize(entity)) return entity.intrinsicWidth! / entity.intrinsicHeight!;
  if (decoded && isPositiveFinite(decoded.w) && isPositiveFinite(decoded.h)) return decoded.w / decoded.h;
  return null;
}

/** Κράτα τη μεγαλύτερη τρέχουσα πλευρά, διόρθωσε την άλλη ώστε ο λόγος πλευρών = `aspect`. */
function keepLargerSide(entity: SizedImage, aspect: number): { width: number; height: number } {
  return entity.width >= entity.height
    ? { width: entity.width, height: entity.width / aspect }
    : { width: entity.height * aspect, height: entity.height };
}

/**
 * ΑΠΟΛΥΤΟ αρχικό μέγεθος (μονάδες σχεδίου) για την «Επαναφορά Διαστάσεων», ή `null` όταν δεν
 * προσδιορίζεται. Intrinsic → απόλυτο μέγεθος· αλλιώς aspect-only fallback από decoded pixels.
 */
export function resolveResetToOriginalSize(
  entity: SizedImage,
  decoded?: DecodedPixelSize | null,
): { width: number; height: number } | null {
  if (hasStoredIntrinsicSize(entity)) {
    return { width: entity.intrinsicWidth!, height: entity.intrinsicHeight! };
  }
  const aspect = trueAspect(entity, decoded);
  return aspect != null ? keepLargerSide(entity, aspect) : null;
}

/**
 * Μέγεθος μετά το «Κλείδωμα Αναλογιών» (un-deform ΧΩΡΙΣ αλλαγή κλίμακας), ή `null` όταν δεν
 * προσδιορίζεται λόγος πλευρών. Πάντα κρατά τη μεγαλύτερη πλευρά, διορθώνει μόνο την αναλογία.
 */
export function resolveLockAspect(
  entity: SizedImage,
  decoded?: DecodedPixelSize | null,
): { width: number; height: number } | null {
  const aspect = trueAspect(entity, decoded);
  return aspect != null ? keepLargerSide(entity, aspect) : null;
}

/**
 * Κοινό: μέγεθος-στόχος → patch με ΣΤΑΘΕΡΟ κέντρο & ΑΝΕΓΓΙΧΤΗ περιστροφή. `null` όταν δεν υπάρχει
 * στόχος ή η εικόνα είναι ήδη εκεί (μηδενικό patch → ο caller την παραλείπει, idempotent).
 */
function buildResizePatch(
  entity: ImageEntity,
  target: { width: number; height: number } | null,
): ImageResetPatch | null {
  if (!target) return null;
  if (approxEqual(entity.width, target.width) && approxEqual(entity.height, target.height)) {
    return null;
  }
  // Κέντρο σταθερό: ίδιο center/rotation του τρέχοντος frame, αλλάζουν μόνο οι ημι-διαστάσεις.
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

/** «Επαναφορά Διαστάσεων»: patch προς το ΑΠΟΛΥΤΟ αρχικό μέγεθος (κέντρο σταθερό). `null` = no-op. */
export function resetImageToOriginalSize(
  entity: ImageEntity,
  decoded?: DecodedPixelSize | null,
): ImageResetPatch | null {
  return buildResizePatch(entity, resolveResetToOriginalSize(entity, decoded));
}

/** «Κλείδωμα Αναλογιών»: patch που κάνει un-deform κρατώντας την κλίμακα (κέντρο σταθερό). `null` = no-op. */
export function lockImageAspect(
  entity: ImageEntity,
  decoded?: DecodedPixelSize | null,
): ImageResetPatch | null {
  return buildResizePatch(entity, resolveLockAspect(entity, decoded));
}
