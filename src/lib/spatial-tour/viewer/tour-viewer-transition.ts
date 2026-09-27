/**
 * @fileoverview **ΠΩΣ ΠΑΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ ΑΠΟ ΚΟΜΒΟ ΣΕ ΚΟΜΒΟ** — το σχέδιο μιας μετάβασης (ADR-884 Φ1 · §4.8). Καθαρό.
 * @related `tour-viewer-bearing.ts` (yaw ⟷ διόπτευση) · `lib/a11y/reduced-motion.ts` (ο καλών ρωτά, εδώ φτάνει η απάντηση) ·
 *   `lib/motion/easing.ts` (η καμπύλη)
 * @module lib/spatial-tour/viewer/tour-viewer-transition
 *
 * 📏 **Το μοτίβο των μεγάλων** (έρευνα 2026-09-27): Photo Sphere Viewer Virtual Tour — προεπιλογή `rotation: true` +
 * `effect: 'fade'` (πρώτα στρέφεται **προς** τον σύνδεσμο, μετά σβήνει-ανάβει)· Kuula walkthrough — στην άφιξη ο
 * επισκέπτης κοιτάζει **προς την κατεύθυνση που περπάτησε**· Matterport `FLY | FADEOUT | INSTANT`. **Ποτέ** «πτήση μέσα
 * από την εικόνα» (zoom-through): με δύο σφαίρες χωρίς βάθος παραμορφώνει.
 * ♿ **Λιγότερη κίνηση** (WCAG 2.3.3): ούτε στροφή ούτε σβήσιμο — ακαριαία αλλαγή, ίδια κατεύθυνση άφιξης.
 */

import { easeInOutCubic } from '@/lib/motion/easing';
import { normalizeAngleDiff } from '@/lib/geometry/angle';

import { viewBearing, yawForBearing } from './tour-viewer-bearing';

/** Στροφή μισού κύκλου — οι μικρότερες στροφές κρατούν αναλογικά λιγότερο. */
export const ROTATE_HALF_TURN_MS = 400;
/** Διασταυρούμενο σβήσιμο των δύο πανοραμάτων. */
export const CROSSFADE_MS = 300;
/** Κάτω από αυτή τη γωνία (ακτίνια ≈ 2°) η στροφή παραλείπεται — δεν αξίζει ούτε ένα καρέ. */
export const ROTATE_EPSILON = (2 * Math.PI) / 180;

export interface TourTransitionInput {
  /** Το τρέχον yaw μέσα στο πανόραμα που φεύγουμε. */
  readonly yaw: number;
  readonly fromHeading: number;
  readonly toHeading: number;
  /** Διόπτευση προς τον προορισμό — `null` χωρίς κάτοψη ή από τη λίστα σημείων (τότε καμία στροφή). */
  readonly linkBearing: number | null;
  readonly reducedMotion: boolean;
}

export interface TourTransitionPlan {
  /** Στροφή πριν από το σβήσιμο — `null` όταν δεν χρειάζεται ή δεν επιτρέπεται. */
  readonly rotate: { readonly fromYaw: number; readonly toYaw: number; readonly durationMs: number } | null;
  /** `0` ⇒ ακαριαία αλλαγή. */
  readonly fadeMs: number;
  /** Το yaw στο νέο πανόραμα: ίδια **διόπτευση** με αυτή που κοίταζε ο επισκέπτης φεύγοντας (ή προς τα πού περπάτησε). */
  readonly arrivalYaw: number;
}

/** Το σχέδιο της μετάβασης — ντετερμινιστικό, χωρίς ρολόι. */
export function planTransition(input: TourTransitionInput): TourTransitionPlan {
  const travelYaw = input.linkBearing === null ? input.yaw : yawForBearing(input.fromHeading, input.linkBearing);
  const arrivalYaw = yawForBearing(input.toHeading, viewBearing(input.fromHeading, travelYaw));
  if (input.reducedMotion) return { rotate: null, fadeMs: 0, arrivalYaw };
  const delta = normalizeAngleDiff(travelYaw - input.yaw);
  const rotate =
    Math.abs(delta) < ROTATE_EPSILON
      ? null
      : { fromYaw: input.yaw, toYaw: input.yaw + delta, durationMs: (Math.abs(delta) / Math.PI) * ROTATE_HALF_TURN_MS };
  return { rotate, fadeMs: CROSSFADE_MS, arrivalYaw };
}

/** Το yaw της στροφής σε χρόνο `elapsedMs` — με την κανονική καμπύλη της κάμερας (ADR-366 A.4.Q1). */
export function rotationYawAt(rotate: NonNullable<TourTransitionPlan['rotate']>, elapsedMs: number): number {
  const t = rotate.durationMs > 0 ? Math.min(1, Math.max(0, elapsedMs / rotate.durationMs)) : 1;
  return rotate.fromYaw + (rotate.toYaw - rotate.fromYaw) * easeInOutCubic(t);
}

/** Η αδιαφάνεια του νέου πανοράματος σε χρόνο `elapsedMs` από την αρχή του σβησίματος. */
export function crossfadeOpacityAt(fadeMs: number, elapsedMs: number): number {
  return fadeMs > 0 ? Math.min(1, Math.max(0, elapsedMs / fadeMs)) : 1;
}
