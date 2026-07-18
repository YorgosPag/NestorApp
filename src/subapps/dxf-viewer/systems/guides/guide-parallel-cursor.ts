/**
 * @module systems/guides/guide-parallel-cursor
 * @description SSoT για το ΠΕΡΙΟΡΙΣΜΕΝΟ σημείο του κέρσορα στη ροή «Παράλληλος
 *              οδηγός» (ADR-189 §3.13) — ΟΡΘΟ (κάθετα ΣΤΟΝ ΟΔΗΓΟ) + ΒΗΜΑ (F9).
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-07-18
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (μην το παρακάμψεις):
 * Τέσσερα σημεία πρέπει να συμφωνούν απόλυτα — η ΖΩΓΡΑΦΙΚΗ της διακεκομμένης, το
 * ΛΕΥΚΟ HUD μήκους, το commit με Enter και το commit με ΔΕΥΤΕΡΟ ΚΛΙΚ. Αν καθένα
 * υπολόγιζε μόνο του πού «πραγματικά» δείχνει ο κέρσορας, θα ξαναγεννιόταν το
 * κλασικό bug «η γραμμή δείχνει άλλη πλευρά από αυτήν που τοποθετεί το Enter»
 * (βλ. σχόλιο στο `hooks/tools/useParallelGuideAnchorPreview.ts`). Εδώ υπολογίζεται
 * ΜΙΑ φορά και όλοι διαβάζουν το ΙΔΙΟ αποτέλεσμα.
 *
 * ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ: το `resolveParallelCursor` ΔΕΝ διαβάζει stores. Οι ζωντανές
 * τιμές των διακοπτών διαβάζονται event-time από το {@link readParallelCursorToggles}
 * (ADR-040 κανόνας 2) και περνούν ως `opts` — έτσι τεστάρεται ντετερμινιστικά.
 *
 * ΣΥΜΒΑΣΗ ΠΡΟΣΗΜΟΥ: η πλευρά έρχεται ΠΑΝΤΑ από το `resolveParallelSide` και ΠΑΝΤΑ
 * με το ΤΕΛΙΚΟ (περιορισμένο) σημείο — ποτέ με τον ωμό κέρσορα.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Guide } from './guide-types';
import { resolveParallelSide } from './guide-parallel-side';
import { perpendicularNormal } from './guide-parallel-ghost';
import { quantizeMagnitude, quantizePointFromAnchor } from '../tracking/adaptive-distance-snap';
import { cadToggleState } from '../constraints/cad-toggle-state';
import { immediateSceneScale } from '../cursor/ImmediateSceneScaleStore';

/** Το αποτέλεσμα του περιορισμού — ό,τι χρειάζονται ζωγραφική, HUD και commit. */
export interface ParallelCursorResolution {
  /** Το άκρο της διακεκομμένης, ΜΕΤΑ ΟΡΘΟ + βήμα. */
  point: Point2D;
  /** Προσημασμένη ΚΑΘΕΤΗ απόσταση από τον οδηγό αναφοράς. */
  signedPerpDistance: number;
  /** Η πλευρά — ΠΑΝΤΑ `resolveParallelSide(refGuide, point)`. */
  sign: 1 | -1;
  /** `|point - anchor|` — αυτό δείχνει το λευκό HUD (ρητή επιλογή του χρήστη). */
  lineLength: number;
}

/**
 * Οι ζωντανοί διακόπτες που επηρεάζουν τον περιορισμό.
 *
 * `stepSceneUnits` είναι ΠΡΟΑΙΡΕΤΙΚΟ: χωρίς μέγεθος βήματος δεν γίνεται κβάντιση,
 * οπότε το `stepSnap` λειτουργεί μόνο ως πύλη. Οι call sites παίρνουν και τα τρία
 * μαζί από το {@link readParallelCursorToggles} — μία ανάγνωση, μηδέν αντιγραφή.
 */
export interface ParallelCursorOptions {
  readonly ortho: boolean;
  readonly stepSnap: boolean;
  /** Βήμα σε **scene units** (ήδη μετατρεμμένο από mm). `0`/παράλειψη ⇒ καμία κβάντιση. */
  readonly stepSceneUnits?: number;
}

/** Το κάθετο μοναδιαίο διάνυσμα του οδηγού· `null` σε εκφυλισμένο διαγώνιο. */
function guideNormal(refGuide: Guide): Point2D | null {
  if (refGuide.axis === 'X') return { x: 1, y: 0 };
  if (refGuide.axis === 'Y') return { x: 0, y: 1 };
  if (!refGuide.startPoint || !refGuide.endPoint) return null;
  return perpendicularNormal(refGuide.startPoint, refGuide.endPoint);
}

/** Προσημασμένη κάθετη απόσταση του `point` από τον οδηγό, στον ίδιο χώρο με το commit. */
function signedPerpDistanceOf(refGuide: Guide, point: Point2D, n: Point2D): number {
  if (refGuide.axis === 'X') return point.x - refGuide.offset;
  if (refGuide.axis === 'Y') return point.y - refGuide.offset;
  const start = refGuide.startPoint;
  if (!start) return 0;
  return (point.x - start.x) * n.x + (point.y - start.y) * n.y;
}

/** Το ενεργό βήμα σε scene units, ή `0` όταν δεν εφαρμόζεται κβάντιση. */
function activeStep(opts: ParallelCursorOptions): number {
  if (!opts.stepSnap) return 0;
  const step = opts.stepSceneUnits ?? 0;
  return step > 0 ? step : 0;
}

/** Συσκευασία του αποτελέσματος — μία πηγή για `sign` και `lineLength`. */
function buildResolution(
  refGuide: Guide,
  anchor: Point2D,
  point: Point2D,
  signedPerpDistance: number,
): ParallelCursorResolution {
  return {
    point,
    signedPerpDistance,
    sign: resolveParallelSide(refGuide, point),
    lineLength: Math.hypot(point.x - anchor.x, point.y - anchor.y),
  };
}

/**
 * Το άκρο της διακεκομμένης μετά ΟΡΘΟ + ΒΗΜΑ.
 *
 * - ΟΡΘΟ ON → το σημείο προβάλλεται στην ΚΑΘΕΤΟ ΤΟΥ ΟΔΗΓΟΥ (όχι σε παγκόσμιο H/V):
 *   σε άξονα X/Y ταυτίζεται με το κλασικό ΟΡΘΟ, σε διαγώνιο δίνει την πραγματική
 *   κάθετο. Το βήμα κβαντίζει το ΒΑΘΜΩΤΟ κατά μήκος της καθέτου, ώστε το σημείο να
 *   ΜΕΙΝΕΙ πάνω στη γραμμή (κβάντιση x/y χωριστά θα το έβγαζε εκτός).
 * - ΟΡΘΟ OFF → ελεύθερος κέρσορας· το βήμα κβαντίζει το ΜΗΚΟΣ από το anchor,
 *   όπως ακριβώς κάνουν τα υπόλοιπα εργαλεία σχεδίασης (`applyAlongAxisStepSnap`).
 *
 * Εκφυλισμένος διαγώνιος οδηγός → επιστρέφει τον ωμό κέρσορα με μηδενική κάθετη
 * απόσταση· ΔΕΝ πετά exception (το preview δεν επιτρέπεται να ρίξει το frame).
 */
export function resolveParallelCursor(
  refGuide: Guide,
  anchor: Point2D,
  rawCursor: Point2D,
  opts: ParallelCursorOptions,
): ParallelCursorResolution {
  const n = guideNormal(refGuide);
  if (!n) {
    return buildResolution(refGuide, anchor, { x: rawCursor.x, y: rawCursor.y }, 0);
  }

  const step = activeStep(opts);

  if (opts.ortho) {
    const t = (rawCursor.x - anchor.x) * n.x + (rawCursor.y - anchor.y) * n.y;
    const tq = quantizeMagnitude(t, step);
    const point = { x: anchor.x + n.x * tq, y: anchor.y + n.y * tq };
    return buildResolution(refGuide, anchor, point, signedPerpDistanceOf(refGuide, point, n));
  }

  const point = step > 0
    ? quantizePointFromAnchor(rawCursor, anchor, step)
    : { x: rawCursor.x, y: rawCursor.y };
  return buildResolution(refGuide, anchor, point, signedPerpDistanceOf(refGuide, point, n));
}

/**
 * Event-time ανάγνωση των ζωντανών διακοπτών (ADR-040 κανόνας 2) — μία υλοποίηση
 * για όλα τα call sites (ζωγραφική, HUD, commit με Enter, commit με κλικ).
 *
 * ΕΥΡΗΜΑ ΒΗΜΑΤΟΣ: το κοινό `isGripStepActive()` των grips απαιτεί F9 **ΚΑΙ** το
 * πλήκτρο Q πατημένο. Ο χρήστης ζήτησε ρητά «όταν έχω επιλεγμένο το Snap» (F9 μόνο),
 * γι' αυτό εδώ ΔΕΝ καλείται το grip helper (θα άλλαζε τη συμπεριφορά των grips):
 * η πύλη είναι σκέτο `isSnapOn()`, ενώ η μετατροπή mm → scene units αντιγράφει
 * ΑΚΡΙΒΩΣ το `applyGripStepSnap` (`getSnapStep() * immediateSceneScale.getMmToScene()`).
 */
export function readParallelCursorToggles(): Required<ParallelCursorOptions> {
  const stepSnap = cadToggleState.isSnapOn();
  return {
    ortho: cadToggleState.isOrthoOn(),
    stepSnap,
    stepSceneUnits: stepSnap
      ? cadToggleState.getSnapStep() * immediateSceneScale.getMmToScene()
      : 0,
  };
}
