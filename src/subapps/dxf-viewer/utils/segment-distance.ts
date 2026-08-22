/**
 * SEGMENT DISTANCE — τα δύο πρωτόγονα «σημείο ↔ ευθύγραμμο τμήμα», ουδέτερα ως προς τομέα.
 *
 * ── Το σφάλμα που λύνει ─────────────────────────────────────────────────────────────────────
 * Οι συναρτήσεις αυτές ζούσαν στο `systems/guides/guide-types.ts`, δηλαδή **μέσα στο σύστημα
 * οδηγών**. Επτά αρχεία καθαρής γεωμετρίας και BIM (`bim/geometry/**`, `bim/finishes/**`,
 * `bim/stairs/**`) τις εισήγαγαν από το **βαρέλι** `systems/guides` — και έτσι έσερναν
 * ολόκληρο το σύστημα οδηγών (store, εντολές, analytics, NLP) μέσα σε κάθε γεωμετρικό module
 * για **δέκα γραμμές τριγωνομετρίας**.
 *
 * 🔴 **Δεν ήταν θέμα ύφους — μια σουίτα δεν έτρεχε καθόλου.** Ο κύκλος
 * `guide-command-base → guide-command-geometry → rotation-math → … → polygon-utils →
 * polygon-point-location → systems/guides (βαρέλι) → commands/index → guide-rotate-commands`
 * έριχνε `ReferenceError: Cannot access 'BatchRotateGuidesCommand' before initialization`, με
 * αποτέλεσμα το `guide-commands-ssot.test.ts` (ADR-611/613/614) να μετράει **0 tests**:
 * **αόρατο, όχι κόκκινο** — δεν περιλαμβανόταν σε κανένα «Ν πράσινα».
 *
 * ── Γιατί ΕΔΩ ───────────────────────────────────────────────────────────────────────────────
 * Ακριβώς το πρότυπο του γειτονικού `scalar-math.ts` (ADR-071): το πρωτόγονο **προάγεται στη
 * βάση της στοίβας** ώστε οι χαμηλού επιπέδου καταναλωτές (`bim/`, `snapping/`, `systems/`)
 * να το χρησιμοποιούν **χωρίς** να εισάγουν το επίπεδο που τυχαία το φιλοξενούσε πρώτο
 * (dependency inversion). Το `guide-types.ts` κάνει **re-export** για συμβατότητα — ίδια
 * κίνηση με το `geometry-utils.ts` → `scalar-math.ts`.
 *
 * ⚠️ **Καμία αλλαγή συμπεριφοράς**: τα σώματα μεταφέρθηκαν αυτούσια. Το δίχτυ χαρακτηρισμού
 * `__tests__/segment-distance.test.ts` γράφτηκε **πριν** τη μετακίνηση, εισάγει από το **παλιό**
 * μονοπάτι και μένει **αναλλοίωτο** — αυτό, όχι η δήλωσή μου, είναι η απόδειξη.
 *
 * ⚠️ **Τι ΔΕΝ ενοποιήθηκε εδώ (μετρημένο, όχι παραλειφθέν)**: υπάρχουν άλλα **τέσσερα** σώματα
 * που απαντούν την ίδια ερώτηση (`geometry-utils.pointToLineDistance`,
 * `geometry-polyline-utils.pointToSegmentDistance`, `geometry-rendering-utils.
 * pointToSegmentDistanceSq`, `GeometricCalculations.distancePointToLine`).
 *
 * ✅ **ΗΤΑΝ πέντε** — το `beam-span-snap.closestPointOnSegment` **διαγράφηκε 2026-08-22**
 * (ADR-789): ο μοναδικός του καταναλωτής, το ιδιωτικό `closestPointOnOutline`, έγινε delegate
 * στο SSoT `closestEdgeOnPolygonOutline`, οπότε το σώμα έμεινε νεκρό. ⚠️ Η **διαφορά
 * κατωφλίου εκφυλισμού** που κατέγραφε αυτή η σημείωση (`l2 < EPS` αντί `lenSq === 0`) ήταν
 * ακριβώς ο λόγος που η ενοποίηση ήταν **αλλαγή συμπεριφοράς**: δύο απαντήσεις σε ένα
 * ερώτημα (ADR-749). Έφυγε με τον καταναλωτή, όχι με σιωπηλή εξίσωση.
 *
 * Το module μένει **χωρίς εξαρτήσεις εκτέλεσης** πέρα από το `scalar-math` (και αυτό είναι
 * dependency-free): κάθε νέα εισαγωγή εδώ ξαναγεννά τη δυνατότητα κύκλου.
 *
 * @see ADR-071 (scalar-math promotion — το πρότυπο) · ADR-189 · ADR-730
 */

import type { Point2D } from '../rendering/types/Types';
import { clamp01 } from './scalar-math';

/**
 * Distance from a point to a line segment (clamped to endpoints).
 * Reused by GuideStore.findNearestGuide() and GuideSnapEngine.
 */
export function pointToSegmentDistance(point: Point2D, segStart: Point2D, segEnd: Point2D): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt((point.x - segStart.x) ** 2 + (point.y - segStart.y) ** 2);
  }

  const t = clamp01(((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq);
  const projX = segStart.x + t * dx;
  const projY = segStart.y + t * dy;
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Project a point onto a line segment, returning the projected point and parameter t.
 * t is clamped to [0, 1] (bounded to segment endpoints).
 */
export function projectPointOnSegment(
  point: Point2D,
  segStart: Point2D,
  segEnd: Point2D,
): { snapPoint: Point2D; distance: number; t: number } {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const d = Math.sqrt((point.x - segStart.x) ** 2 + (point.y - segStart.y) ** 2);
    return { snapPoint: { x: segStart.x, y: segStart.y }, distance: d, t: 0 };
  }

  const t = clamp01(((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq);
  const snapPoint = { x: segStart.x + t * dx, y: segStart.y + t * dy };
  const distance = Math.sqrt((point.x - snapPoint.x) ** 2 + (point.y - snapPoint.y) ** 2);

  return { snapPoint, distance, t };
}
