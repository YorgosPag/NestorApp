/**
 * @module bim-body-fill
 * @description FULL SSoT για το **translucent body fill** («poché») ΟΛΩΝ των BIM 2Δ
 * renderers. Πριν, κάθε renderer έλυνε ΜΟΝΟΣ του «V/G tint ?? hardcoded παλέτα» και
 * **ΜΟΝΟ ο `WallRenderer`** εφάρμοζε επιπλέον το background-adaptive boost (ADR-509)·
 * οι υπόλοιποι (Column/Beam/Slab/…) ζωγράφιζαν raw → **ασύμβατη διαφάνεια** μεταξύ
 * μελών (π.χ. ο τοίχος έδειχνε πιο αδιαφανής από την κολώνα σε μαύρο φόντο, αφού μόνο
 * αυτός boost-αριζόταν). Πλέον **ΕΝΑΣ κώδικας** για όλα:
 *   `resolveVgFillTint` (ADR-375 V/G) → palette fallback → `adaptFillTintForCanvas` (ADR-509)
 * ⇒ κάθε μέλος έχει **ΙΔΙΑ διαφάνεια** σε κάθε φόντο (Giorgio order 2026-06-22, FULL SSoT).
 *
 * @see ./bim-vg-fill-tint.ts — V/G category color → rgba tint (ADR-375)
 * @see ../../config/adaptive-entity-color.ts — adaptFillTintForCanvas (dark-canvas boost, ADR-509)
 */
import type { BimCategory, ObjectStyle } from '../../config/bim-object-styles';
import type { CutState } from '../../config/bim-view-range';
import { resolveVgFillTint } from './bim-vg-fill-tint';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';

/**
 * Resolve the final canvas `fillStyle` string for a BIM member's translucent body
 * fill: the V/G category tint (when the user set one) else the renderer's own
 * palette `fallbackFill`, then the shared ADR-509 background-adaptive boost. ONE
 * code path for ALL BIM members → identical translucency on any canvas background.
 *
 * @param fallbackFill the renderer's own per-kind/per-category translucent rgba
 *   (e.g. `KIND_FILL[kind]` / `WALL_CATEGORY_FILL[cat]`), used when no V/G color.
 * @param bgHex optional live canvas background (defaults to the resolved DXF bg).
 */
export function resolveBimBodyFill(
  category: BimCategory,
  cutState: CutState,
  objectStyles: Partial<Record<BimCategory, ObjectStyle>> | undefined,
  fallbackFill: string,
  bgHex?: string,
): string {
  return adaptBimBodyFill(resolveVgFillTint(category, cutState, objectStyles) ?? fallbackFill, bgHex);
}

/**
 * Adaptive-only entry point του ίδιου SSoT, για body fills όπου το V/G tint + το
 * fallback έχουν ΗΔΗ λυθεί upstream και ΔΕΝ ταιριάζουν στο single-fallback signature
 * του {@link resolveBimBodyFill} — π.χ. ο `StairRenderer` λύνει το V/G tint πάνω
 * (με cutState/objectStyles) και το per-tread-type fallback (glass vs default) κάτω
 * στο render module. Έτσι ΟΛΑ τα BIM body fills περνούν από το ΙΔΙΟ module → ένα
 * adaptive SSoT, μηδέν διπλότυπη κλήση του `adaptFillTintForCanvas` διάσπαρτη.
 *
 * @param resolvedFill το ήδη resolved `rgba` (V/G tint ?? palette fallback).
 */
export function adaptBimBodyFill(resolvedFill: string, bgHex?: string): string {
  return adaptFillTintForCanvas(resolvedFill, bgHex);
}
