/**
 * ADR-911 Δ7 — **Άξονας από το συμφραζόμενο** για ορθογώνια χωρίς προφανή άξονα.
 *
 * Ένα τετράγωνο 100×100 δεν λέει προς τα πού «τρέχει». Ο λόγος πλευρών δεν μπορεί να το
 * απαντήσει (το κατώφλι του είναι αβαθμονόμητο)· το σχέδιο όμως συχνά μπορεί: αν το κομμάτι
 * κάθεται **στην ευθεία** ενός τοίχου ίδιου πάχους, είναι συνέχειά του — ο κοντός τοίχος
 * ανάμεσα σε δύο ανοίγματα. Τότε ο άξονάς του είναι ο άξονας του γείτονα.
 *
 * Ό,τι δεν έχει τέτοιον γείτονα μένει αμφίσημο και πηγαίνει στον άνθρωπο («θέλει απόφαση»).
 * Αν δύο γείτονες δίνουν **κάθετους** άξονες, το συμφραζόμενο αντιφάσκει ⇒ επίσης αμφίσημο.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ./wall-proposal.ts (ο καταναλωτής)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md §5 Δ7
 */

import type { Point2D } from '../../rendering/types/Types';
import { detectedRectAxis, type DetectedRectangle } from '../walls/wall-in-region';

export interface ContextAxisOptions {
  /** Ανοχή σύμπτωσης (scene units): ευθυγράμμιση αξόνων και ισότητα πάχους. */
  readonly tol: number;
  /** Μέγιστο κενό (scene units) ανάμεσα στο ορθογώνιο και τον γείτονα που το εξηγεί. */
  readonly maxGap: number;
}

function centreOf(rect: DetectedRectangle): Point2D {
  return {
    x: rect.polygon.reduce((s, p) => s + p.x, 0) / 4,
    y: rect.polygon.reduce((s, p) => s + p.y, 0) / 4,
  };
}

/** Πλάτος του ορθογωνίου ΚΑΘΕΤΑ σε μια μοναδιαία διεύθυνση (= το πάχος του αν τρέχει κατά αυτήν). */
function extentAcross(rect: DetectedRectangle, ux: number, uy: number): number {
  const across = rect.polygon.map((p) => -uy * p.x + ux * p.y);
  return Math.max(...across) - Math.min(...across);
}

/** Έκταση του ορθογωνίου ΚΑΤΑ ΜΗΚΟΣ μιας μοναδιαίας διεύθυνσης, ως [min, max] προβολής. */
function spanAlong(rect: DetectedRectangle, ux: number, uy: number): readonly [number, number] {
  const along = rect.polygon.map((p) => ux * p.x + uy * p.y);
  return [Math.min(...along), Math.max(...along)];
}

/**
 * Η μοναδιαία διεύθυνση που ο `neighbour` υπαγορεύει στο `rect`, ή `null`: ο γείτονας πρέπει
 * να έχει το ίδιο πάχος, ο άξονάς του να περνά από το κέντρο του `rect`, και το κενό ανάμεσά
 * τους (κατά μήκος του άξονα) να μην ξεπερνά το `maxGap`.
 */
function directionFrom(
  rect: DetectedRectangle,
  neighbour: DetectedRectangle,
  options: ContextAxisOptions,
): Point2D | null {
  const axis = detectedRectAxis(neighbour);
  if (!(axis.length > 0)) return null;
  const ux = (axis.end.x - axis.start.x) / axis.length;
  const uy = (axis.end.y - axis.start.y) / axis.length;
  if (Math.abs(extentAcross(rect, ux, uy) - axis.thickness) > options.tol) return null;
  const c = centreOf(rect);
  const offAxis = Math.abs(-uy * (c.x - axis.start.x) + ux * (c.y - axis.start.y));
  if (offAxis > options.tol) return null;
  const [a0, a1] = spanAlong(rect, ux, uy);
  const [b0, b1] = spanAlong(neighbour, ux, uy);
  const gap = Math.max(b0 - a1, a0 - b1);
  return gap <= options.maxGap ? { x: ux, y: uy } : null;
}

/** Το ίδιο ορθογώνιο με ρητό άξονα κατά τη διεύθυνση `dir` (κεντρική γραμμή, πλήρες μήκος). */
function withAxis(rect: DetectedRectangle, dir: Point2D): DetectedRectangle {
  const c = centreOf(rect);
  const [s0, s1] = spanAlong(rect, dir.x, dir.y);
  const mid = dir.x * c.x + dir.y * c.y;
  const at = (s: number): Point2D => ({ x: c.x + dir.x * (s - mid), y: c.y + dir.y * (s - mid) });
  return { ...rect, axis: [at(s0), at(s1)] };
}

/**
 * Δίνει ρητό άξονα σε όσα `ambiguous` ορθογώνια έχουν ομοαξονικό γείτονα ίδιου πάχους μέσα
 * στους `anchors`. Επιστρέφει ΜΟΝΟ όσα λύθηκαν (παλιό → νέο)· τα υπόλοιπα δεν εμφανίζονται.
 *
 * @param ambiguous  ορθογώνια χωρίς προφανή άξονα
 * @param anchors    ορθογώνια με ΒΕΒΑΙΟ άξονα — μόνο αυτά μπορούν να εξηγήσουν άλλο
 */
export function resolveAxesFromContext(
  ambiguous: readonly DetectedRectangle[],
  anchors: readonly DetectedRectangle[],
  options: ContextAxisOptions,
): ReadonlyMap<DetectedRectangle, DetectedRectangle> {
  const resolved = new Map<DetectedRectangle, DetectedRectangle>();
  for (const rect of ambiguous) {
    const dirs = anchors.flatMap((n) => {
      const dir = directionFrom(rect, n, options);
      return dir ? [dir] : [];
    });
    if (dirs.length === 0) continue;
    // Όλοι οι γείτονες πρέπει να συμφωνούν (παράλληλοι): |u·v| ≈ 1. Αλλιώς αντίφαση ⇒ αμφίσημο.
    const [first] = dirs;
    const agree = dirs.every((d) => Math.abs(d.x * first.x + d.y * first.y) > 0.99);
    if (agree) resolved.set(rect, withAxis(rect, first));
  }
  return resolved;
}
