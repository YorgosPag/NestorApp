/**
 * ADR-513 §opening-width — Dynamic-input («Δαχτυλίδι Εντολών») typed distance για την
 * ΕΠΕΚΤΑΣΗ ΠΛΑΤΟΥΣ κουφώματος μέσω λαβής παρειάς (`opening-corner-*` grip). SSoT resolver.
 *
 * Parity με την επέκταση άκρου γραμμής (`grip-endpoint-lock.ts`): ο ΙΔΙΟΣ pure helper τρέχει
 * στο live ghost ΚΑΙ στο commit → preview ≡ commit. Επιστρέφει `null` (→ ο caller κρατά το raw
 * cursor delta) όταν δεν υπάρχει ενεργό lock ή δεν είναι λαβή παρειάς — μηδέν regression όταν το
 * δαχτυλίδι δεν χρησιμοποιείται.
 *
 * Μοντέλο (Giorgio 2026-07-18): πληκτρολογείς **απόσταση μετακίνησης** (όχι νέο συνολικό πλάτος).
 *   · μέγεθος            = η κλειδωμένη τιμή «Μήκος» (`DynamicInputLockStore.length`, scene units, signed),
 *   · φορά               = σε ΠΟΙΑ πλευρά της τρέχουσας παρειάς (grip) βρίσκεται ο κέρσορας, κατά μήκος
 *                          του άξονα τοίχου (η «πράσινη γραμμή» = η παρειά),
 *   · αρνητική τιμή      = αντιστρέφει (το πρόσημο του locked length περνά αυτούσιο).
 *
 * Το delta είναι σχετικό με τη θέση της λαβής (`gripPosition`)· ο υπάρχων commit
 * (`commitOpeningGripDrag` → `resizeJamb`) το καταναλώνει ΑΜΕΤΑΒΛΗΤΟΣ (translatePoint(grip, delta)
 * = currentPos → projected στον άξονα τοίχου → νέο πλάτος, με την απέναντι παρειά άγκυρα).
 *
 * @see ./grip-endpoint-lock.ts — ο αδελφός resolver (άκρο γραμμής) που mirror-άρει το two-seam contract
 * @see ./length-angle-lock.ts — κοινό `isLengthAngleLockActive` SSoT
 * @see ../../bim/walls/opening-grips.ts — `resizeJamb` (anchor-jamb geometry, καταναλωτής του delta)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { OpeningGripKind } from '../../hooks/grip-kinds';
import { DynamicInputLockStore } from './DynamicInputLockStore';
import { isLengthAngleLockActive } from './length-angle-lock';

const OPENING_CORNER_KINDS: ReadonlySet<OpeningGripKind> = new Set<OpeningGripKind>([
  'opening-corner-ne',
  'opening-corner-nw',
  'opening-corner-sw',
  'opening-corner-se',
]);

/** `true` ΜΟΝΟ για τις 4 λαβές παρειάς (WIDTH resize) — όχι move/rotation/facing. */
export function isOpeningCornerGripKind(kind: OpeningGripKind | null | undefined): boolean {
  return !!kind && OPENING_CORNER_KINDS.has(kind);
}

/** Ελάχιστη δομική όψη του κουφώματος — κρατά τον resolver decoupled + pure. */
interface OpeningGeometryLike {
  readonly geometry?: {
    readonly position?: Point2D;
    readonly rotation?: number;
  };
}

/**
 * Το length-locked world delta (σχετικά με `gripPosition` = η λαβή τη στιγμή του grab) για μια
 * λαβή παρειάς κουφώματος. `cursorWorld` = ο ζωντανός κέρσορας σε world coords. `null` όταν δεν
 * ισχύει (no lock / όχι λαβή παρειάς / χωρίς γεωμετρία).
 */
export function resolveOpeningWidthLockedDelta(
  entity: unknown,
  openingGripKind: OpeningGripKind | null | undefined,
  gripPosition: Readonly<Point2D>,
  cursorWorld: Readonly<Point2D>,
): Point2D | null {
  if (!isLengthAngleLockActive()) return null;
  if (!isOpeningCornerGripKind(openingGripKind)) return null;

  const lengthScene = DynamicInputLockStore.getLocked().length;
  if (lengthScene === null) return null;

  const g = (entity as OpeningGeometryLike | null | undefined)?.geometry;
  if (!g?.position || g.rotation === undefined) return null;

  // Τοπικός μοναδιαίος άξονας τοίχου στο κούφωμα (rotation = διεύθυνση άξονα).
  const ax = Math.cos(g.rotation);
  const ay = Math.sin(g.rotation);

  // Αξονική συντεταγμένη κατά μήκος του άξονα (σχετική — η αρχή απαλείφεται): dot(P − center, axisDir).
  const grabbedAxial = (gripPosition.x - g.position.x) * ax + (gripPosition.y - g.position.y) * ay;
  const cursorAxial = (cursorWorld.x - g.position.x) * ax + (cursorWorld.y - g.position.y) * ay;
  const dirSign = Math.sign(cursorAxial - grabbedAxial) || 1;

  // Signed μετατόπιση κατά μήκος του άξονα: πλευρά κέρσορα × πρόσημο πληκτρολογημένης τιμής.
  const moveScene = dirSign * lengthScene;
  return { x: ax * moveScene, y: ay * moveScene };
}
