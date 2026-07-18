/**
 * ADR-513 §opening-width — Dynamic-input («Δαχτυλίδι Εντολών») typed distance για την
 * ΕΠΕΚΤΑΣΗ ΠΛΑΤΟΥΣ κουφώματος μέσω λαβής παρειάς (`opening-corner-*` grip). SSoT resolver.
 *
 * Parity με την επέκταση άκρου γραμμής (`grip-endpoint-lock.ts`): ο ΙΔΙΟΣ pure helper τρέχει
 * στο live ghost ΚΑΙ στο commit → preview ≡ commit. Επιστρέφει `null` (→ ο caller κρατά το raw
 * cursor delta) όταν δεν υπάρχει ενεργό lock / δεν είναι λαβή παρειάς / λείπει ο host τοίχος.
 *
 * Μοντέλο (Giorgio 2026-07-18): πληκτρολογείς **απόσταση μετακίνησης** (όχι νέο συνολικό πλάτος).
 *   · μέγεθος            = η κλειδωμένη τιμή «Μήκος» (`DynamicInputLockStore.length`, scene units, signed),
 *   · φορά               = σε ΠΟΙΑ πλευρά της τρέχουσας παρειάς (grip) είναι ο κέρσορας κατά μήκος
 *                          του άξονα **τοίχου**,
 *   · αρνητική τιμή      = αντιστρέφει (το πρόσημο του locked length περνά αυτούσιο).
 *
 * 🔴 ΚΡΙΣΙΜΟ (fix Giorgio 2026-07-18): ο άξονας υπολογίζεται από τον **ΤΟΙΧΟ** (μέσω
 * `projectPointToWallOffsetMm`), ΟΧΙ από το `opening.geometry.rotation` — το opening rotation μπορεί να
 * είναι **αντιπαράλληλο** με τη φορά `wall.start→wall.end` (π.χ. κούφωμα σε τοίχο που τρέχει δεξιά→αριστερά),
 * οπότε delta κατά το opening axis πήγαινε ΑΝΤΙΘΕΤΑ στο πλαίσιο που μετρά το `resizeJamb`. Η κατεύθυνση
 * +axial στον world χώρο προκύπτει από **gradient probe** του `projectPointToWallOffsetMm` (δουλεύει και
 * για κεκλιμένους/καμπύλους τοίχους, ανεξαρτήτως μονάδων).
 *
 * Το delta είναι σχετικό με τη θέση της λαβής (`gripPosition`)· ο υπάρχων commit
 * (`commitOpeningGripDrag` → `resizeJamb`) το καταναλώνει ΑΜΕΤΑΒΛΗΤΟΣ (translatePoint(grip, delta)
 * = currentPos → projected στον άξονα τοίχου → νέο πλάτος, με την απέναντι παρειά άγκυρα).
 *
 * @see ./grip-endpoint-lock.ts — ο αδελφός resolver (άκρο γραμμής) που mirror-άρει το two-seam contract
 * @see ../../bim/geometry/opening-geometry.ts — `projectPointToWallOffsetMm` (world → wall-axial mm)
 * @see ../../bim/walls/opening-grips.ts — `resizeJamb` (anchor-jamb geometry, καταναλωτής του delta)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { OpeningGripKind } from '../../hooks/grip-kinds';
import type { WallEntity } from '../../bim/types/wall-types';
import { DynamicInputLockStore } from './DynamicInputLockStore';
import { isLengthAngleLockActive } from './length-angle-lock';
import { projectPointToWallOffsetMm } from '../../bim/geometry/opening-geometry';

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

/**
 * Το length-locked world delta (σχετικά με `gripPosition` = η λαβή τη στιγμή του grab) για μια
 * λαβή παρειάς κουφώματος. `hostWall` = ο τοίχος-ξενιστής (ίδιος που χρησιμοποιεί το `resizeJamb`).
 * `cursorWorld` = ο ζωντανός κέρσορας σε world coords. `null` όταν δεν ισχύει.
 */
export function resolveOpeningWidthLockedDelta(
  hostWall: WallEntity | null | undefined,
  openingGripKind: OpeningGripKind | null | undefined,
  gripPosition: Readonly<Point2D>,
  cursorWorld: Readonly<Point2D>,
): Point2D | null {
  if (!isLengthAngleLockActive()) return null;
  if (!isOpeningCornerGripKind(openingGripKind)) return null;
  if (!hostWall) return null;

  const lengthScene = DynamicInputLockStore.getLocked().length;
  if (lengthScene === null) return null;

  // Πλαίσιο ΤΟΙΧΟΥ: axial (mm) της λαβής και του κέρσορα κατά μήκος του wall.start→end.
  const grabbedAxial = projectPointToWallOffsetMm(gripPosition, hostWall);
  const cursorAxial = projectPointToWallOffsetMm(cursorWorld, hostWall);
  const dirSign = Math.sign(cursorAxial - grabbedAxial) || 1;

  // +axial world direction μέσω gradient probe του `projectPointToWallOffsetMm` (world → mm).
  // gx/gy = παράγωγος του axial ως προς world x/y στη θέση της λαβής → δείχνει προς +axial.
  const gx = projectPointToWallOffsetMm({ x: gripPosition.x + 1, y: gripPosition.y }, hostWall) - grabbedAxial;
  const gy = projectPointToWallOffsetMm({ x: gripPosition.x, y: gripPosition.y + 1 }, hostWall) - grabbedAxial;
  const gmag = Math.hypot(gx, gy);
  if (gmag < 1e-9) return null;

  // Μοναδιαίο +axial world vector × (πλευρά κέρσορα × πρόσημο τιμής) × μέγεθος (scene units).
  // |delta| = lengthScene ⇒ μετατόπιση κατά τον άξονα = lengthScene world = locked mm (preview≡commit).
  const move = (dirSign * lengthScene) / gmag;
  return { x: gx * move, y: gy * move };
}
