/**
 * ADR-658 M2 (D3) / M3 (D2) — Command key constants for the «Μολύβι» ribbon bridge.
 *
 * Two combobox keys, both handled by `useRibbonSketchFidelityBridge` (one bridge, two keys
 * → zero extra dispatch wiring):
 *   - sketch:fidelity   — reads/writes sketch-fidelity-store (RDP tolerance level).
 *   - sketch:outputType — reads/writes sketch-output-store (polyline «Τεθλασμένη» / spline «Καμπύλη»).
 * Used by useRibbonSketchFidelityBridge and CONTEXTUAL_SKETCH_TAB.
 */
import { makeKeySetGuard } from './make-key-set-guard';

export const SKETCH_RIBBON_KEYS = {
  fidelity: 'sketch:fidelity',
  outputType: 'sketch:outputType',
} as const;

export type SketchRibbonKey = (typeof SKETCH_RIBBON_KEYS)[keyof typeof SKETCH_RIBBON_KEYS];

export const isSketchRibbonKey = makeKeySetGuard<SketchRibbonKey>(Object.values(SKETCH_RIBBON_KEYS));
