/**
 * wall-join-overlap — «η ένωση τοίχων δεν είναι κατάληψη» (ADR-567 §join-is-not-occupation,
 * ADR-911 Φ3α-2).
 *
 * Δύο τοίχοι που ΕΝΩΝΟΝΤΑΙ μοιράζονται εμβαδό εκ κατασκευής: το άκρο του ενός φτάνει στον
 * άξονα του άλλου (Revit: οι ενώσεις γίνονται στις location lines). Ο λόγος «τομή / μικρότερο
 * εμβαδό» μετρούσε αυτό το κοινό κομμάτι σαν κατάληψη — και για κοντό τοίχο έβγαινε 33–55 %,
 * δηλαδή ψευδές «υπάρχει ήδη». Το μέγεθος της ένωσης δεν έχει σχέση με το μήκος του τοίχου.
 *
 * Κανόνας (πρακτική Revit / ArchiCAD: η επικάλυψη κρίνεται πάνω στη γεωμετρία ΜΕΤΑ την ένωση,
 * και μόνο οι παράλληλοι τοίχοι «επικαλύπτονται»): για ζεύγος ευθύγραμμων, μη παράλληλων
 * τοίχων, κάθε άκρο που βρίσκεται μέσα στο σώμα του άλλου κόβεται πίσω προς την παρειά του,
 * με το ΙΔΙΟ `penetrationBevel` που χρησιμοποιεί ο λύτης ενώσεων. Η κρίση επικάλυψης γίνεται
 * μετά, πάνω στα κομμένα αποτυπώματα.
 *
 * Το κόψιμο είναι `(μισό πάχος − απόσταση άκρου από τον άξονα) / sin`: μέγιστο όταν το άκρο
 * κάθεται στον άξονα (γνήσια ένωση ⇒ μηδέν υπόλοιπο), μηδέν όταν κάθεται σε παρειά. Είναι
 * ΣΥΝΕΧΕΣ — κανένα όριο πάνω σε τιμή των δεδομένων: θόρυβος 0,001 mm αλλάζει το αποτέλεσμα
 * κατά 0,001 mm. Άκρο που πέρασε τον άξονα παίρνει ΜΙΚΡΟΤΕΡΗ έκπτωση (δεν είναι πια ένωση,
 * είναι διείσδυση), άρα ένας τοίχος θαμμένος μέσα σε άλλον εξακολουθεί να κόβεται.
 *
 * Δεν διαβάζει αποθηκευμένα miter/bevel: η κρίση εξαρτάται μόνο από άξονες και πάχη, άρα
 * είναι ίδια στην προεπισκόπηση, στο χτίσιμο και στην εγγραφή.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ./structural-placement-overlap.ts — ο ΕΝΑΣ καταναλωτής
 * @see ../walls/wall-trims-corner-resolve.ts — `penetrationBevel`, `MIN_ANGLE_RAD`
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../types/wall-types';
import { mmScaleFor } from '../../utils/scene-units';
import { sinAngleBetween } from '../walls/wall-trims-geometry';
import { penetrationBevel, MIN_ANGLE_RAD } from '../walls/wall-trims-corner-resolve';
import { wallFootprintFromParams } from '../finishes/wall-footprint-union';

/**
 * Το ζεύγος μετά την ένωση. `swallowed` = ένας από τους δύο δεν έχει σώμα έξω από τον άλλον
 * (το κόψιμο των δύο άκρων του καλύπτει όλο το μήκος του) ⇒ πλήρης κατάληψη.
 */
export type JoinedWallPair =
  | { readonly kind: 'swallowed' }
  | { readonly kind: 'joined'; readonly a: Point2D[]; readonly b: Point2D[] };

/** Άξονας + μισό πάχος ενός ευθύγραμμου τοίχου, σε μονάδες σκηνής. */
interface WallFrame {
  readonly sx: number;
  readonly sy: number;
  readonly ux: number;
  readonly uy: number;
  readonly len: number;
  readonly half: number;
}

function frameOf(wall: WallEntity): WallFrame | null {
  if (wall.kind !== 'straight') return null;
  const { start, end } = wall.params;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const scale = mmScaleFor(wall.params);
  // Ίδιος φρουρός εκφυλισμού με το `classifyPair` του λύτη ενώσεων (1 mm σε μονάδες σκηνής).
  if (len < scale) return null;
  return { sx: start.x, sy: start.y, ux: dx / len, uy: dy / len, len, half: (wall.params.thickness / 2) * scale };
}

/**
 * Πόσο κόβεται το άκρο `(ex,ey)` του `own` επειδή κάθεται μέσα στο σώμα του `other`.
 * Το άκρο μετρά μόνο αν προβάλλεται στο μήκος του `other`, διευρυμένο κατά το μισό πάχος του
 * `own`: εκεί ακριβώς παύουν να αγγίζονται τα δύο σώματα, άρα και αυτό το όριο είναι συνεχές
 * (γωνία Γ με κοινό άκρο αξόνων ⇒ προβολή 0, βαθιά μέσα στο παράθυρο).
 */
function joinRetraction(ex: number, ey: number, own: WallFrame, other: WallFrame, sin: number): number {
  const along = (ex - other.sx) * other.ux + (ey - other.sy) * other.uy;
  if (along < -own.half || along > other.len + own.half) return 0;
  // `stemLen = ∞`: εδώ ΔΕΝ ισχύει το όριο αναστροφής του σχεδιασμού (`MAX_BEVEL_FRACTION`) —
  // η κρίση θέλει την πραγματική διείσδυση, όχι όση αντέχει να ζωγραφιστεί.
  return penetrationBevel(ex, ey, other.sx, other.sy, other.ux, other.uy, other.half, sin, Infinity);
}

/** Το αποτύπωμα του `wall` με τα άκρα του κομμένα έναντι του `other`· `null` αν δεν μένει σώμα. */
function retractedFootprint(wall: WallEntity, own: WallFrame, other: WallFrame, sin: number): Point2D[] | null {
  const { start, end } = wall.params;
  const atStart = joinRetraction(start.x, start.y, own, other, sin);
  const atEnd = joinRetraction(end.x, end.y, own, other, sin);
  if (atStart + atEnd >= own.len) return null;
  // Ωμά params: τα αποθηκευμένα πεδία ένωσης αφορούν ΟΛΟΥΣ τους γείτονες, όχι αυτό το ζεύγος.
  const { startMiter: _sm, endMiter: _em, startBevel: _sb, endBevel: _eb, ...raw } = wall.params;
  const params = {
    ...raw,
    start: { ...start, x: start.x + own.ux * atStart, y: start.y + own.uy * atStart },
    end: { ...end, x: end.x - own.ux * atEnd, y: end.y - own.uy * atEnd },
  };
  return wallFootprintFromParams(params, 'straight');
}

/**
 * Τα αποτυπώματα δύο τοίχων ΜΕΤΑ την ένωσή τους, ή `null` όταν το ζεύγος δεν είναι ένωση:
 * μη ευθύγραμμος τοίχος, εκφυλισμένο μήκος, ή άξονες εντός `MIN_ANGLE_RAD` (παράλληλοι — εκεί
 * η επικάλυψη ΕΙΝΑΙ κατάληψη και κρίνεται στα πλήρη αποτυπώματα).
 */
export function joinedWallPairFootprints(a: WallEntity, b: WallEntity): JoinedWallPair | null {
  const fa = frameOf(a);
  const fb = frameOf(b);
  if (!fa || !fb) return null;
  const sin = sinAngleBetween(fa.ux, fa.uy, fb.ux, fb.uy);
  if (sin < Math.sin(MIN_ANGLE_RAD)) return null;
  const footprintA = retractedFootprint(a, fa, fb, sin);
  const footprintB = retractedFootprint(b, fb, fa, sin);
  if (!footprintA || !footprintB) return { kind: 'swallowed' };
  return { kind: 'joined', a: footprintA, b: footprintB };
}
