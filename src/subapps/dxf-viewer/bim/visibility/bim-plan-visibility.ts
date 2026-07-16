/**
 * ADR-382 / ADR-405 — BIM 2D-plan visibility convenience SSoT.
 *
 * Κάθε 2Δ BIM renderer έκανε copy-paste το ΙΔΙΟ visibility preamble πριν
 * σχεδιάσει: διάβαζε `objectStyles` + `disciplineVisibility` από το render-
 * settings store και τα περνούσε (μαζί με το per-entity layer) στον pure
 * `resolveIsEntityVisible`. 21 πανομοιότυπα αντίγραφα του ίδιου context object.
 *
 * Αυτό το module είναι η ΜΙΑ SSoT για εκείνο το preamble: διαβάζει το store
 * μία φορά (event-time, ADR-040 compliant — χωρίς subscription) και delegate-άρει
 * στον pure resolver.
 *
 * ΠΟΙΟΣ ΔΕΝ το χρησιμοποιεί (by design):
 *   • Τα 3Δ scene-build paths — consult-άρουν επιπλέον floor/building/isolate
 *     sources, οπότε καλούν κατευθείαν τον `resolveIsEntityVisible` με πλήρες
 *     `VisibilityContext`.
 *   • Τα React overlay micro-leaves (EnvelopeOverlay / HomeRunWiresOverlay) —
 *     πρέπει να **subscribe** reactively (`useDrawingScaleStore((s) => s.x)`)
 *     ώστε να re-render-άρουν σε V/G toggle· ένα event-time `getState()` εδώ θα
 *     έσπαγε τη reactivity. Μένουν στο inline reactive-selector form.
 *
 * Ο διαχωρισμός από το `visibility-resolver.ts` (pure, no-store) είναι σκόπιμος:
 * ο resolver παραμένει pure/unit-testable χωρίς να σέρνει το Zustand store στο
 * module graph του.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-382-visibility-resolver-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { SceneLayer } from '../../types/scene-types';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { resolveIsEntityVisible } from './visibility-resolver';
import type { EntityVisibilityInput } from './visibility-resolver';

/**
 * 2Δ-plan visibility check. Reads `objectStyles` + `disciplineVisibility` από το
 * render-settings store (event-time snapshot) και τα combine-άρει με το ήδη
 * resolved `layer` του entity μέσω του pure AND-of-shows resolver.
 *
 * Behaviour-identical με το per-renderer inline preamble που αντικαθιστά.
 *
 * @param entity  descriptor — `category` (+ optional `layerId`/`id`/`discipline`)
 * @param layer   το ήδη resolved `SceneLayer` του entity (`null` ⇒ no layer constraint)
 * @returns `true` όταν όλες οι sources συμφωνούν "δείξε"
 */
export function resolveBimPlanVisibility(
  entity: EntityVisibilityInput,
  layer: SceneLayer | null,
): boolean {
  const { objectStyles, disciplineVisibility } = useDrawingScaleStore.getState();
  return resolveIsEntityVisible(entity, { objectStyles, disciplineVisibility, layer });
}
