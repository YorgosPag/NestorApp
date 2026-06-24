/**
 * ADR-398 §3.13/§3.15 + ADR-514 — live `PolarDiskSnapOptions` για τον **member magnet** (τοίχος/δοκάρι),
 * αδελφό του `buildColumnPolarSnapOptions`. Ghost (preview) ΚΑΙ commit τα χτίζουν ΙΔΙΑ → preview ≡ commit.
 *
 * Reuse SSoT: `worldPerPixel` (live zoom) + `polarClearanceScene` (cover + ημι-διαγώνιος μέλους). Το
 * `shiftFractions` (Q1 κλάσματα ακτίνας/πλευράς) είναι interaction-mode της κολόνας — το μέλος παίρνει
 * το **βασικό** nice-absolute πλέγμα (shiftFractions ΟΧΙ· future work αν χρειαστεί member-side Shift).
 *
 * Μη-pure (διαβάζει live transform) — γι' αυτό χωριστά από τους pure resolvers.
 *
 * @see ../columns/column-polar-opts.ts — το column ισοδύναμο (ίδιο pattern)
 * @see ../columns/polar-disk-snap.ts — polarClearanceScene + PolarDiskSnapOptions (reuse)
 */

import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { SceneUnits } from '../../utils/scene-units';
import { polarClearanceScene, type PolarDiskSnapOptions } from '../columns/polar-disk-snap';

/**
 * Χτίσε τα live magnet opts για ένα γραμμικό μέλος πλάτους `memberWidthMm`. Η edge clearance κρατά τον
 * εξώτατο δακτύλιο/πλέγμα μακριά από το χείλος κατά cover + ημι-διαγώνιο του μέλους (reuse column SSoT·
 * τετράγωνη προσέγγιση `width×width` — το πλάτος είναι η κρίσιμη διάσταση κάτοψης).
 */
export function buildMemberMagnetOptions(memberWidthMm: number, sceneUnits: SceneUnits): PolarDiskSnapOptions {
  const w = memberWidthMm > 0 ? memberWidthMm : 0;
  return {
    worldPerPixel: worldPerPixel(getImmediateTransform().scale),
    clearanceScene: polarClearanceScene(w, w, sceneUnits),
  };
}
