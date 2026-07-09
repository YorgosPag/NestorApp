/**
 * @module drawing-entity-complete
 * @description `isEntityComplete` — how many clicks each drawing tool needs before its entity is
 * finished. Extracted from `drawing-entity-builders.ts` for file-size SRP (N.7.1); re-exported
 * from there so existing imports keep working.
 */

import type { DrawingTool } from './drawing-types';
import { getXLineModeState } from '../../systems/tools/xline-mode-store';

/**
 * True when `pointCount` clicks are enough to finish `tool`'s entity. Fixed-arity tools return a
 * threshold (2 for line/rectangle/circle/scale-bar, 1 for opening-info-tag, 3 for arc/3-point
 * circle/angle); the `xline` construction line branches on its live mode; open-ended tools
 * (polyline / polygon / area / hatch / best-fit) never auto-complete (Enter finishes them).
 */
export function isEntityComplete(tool: DrawingTool, pointCount: number): boolean {
  switch (tool) {
    case 'line':
    case 'line-perpendicular': // ADR-060 — 2 σημεία (βάση + κλειδωμένο κάθετο άκρο)
    case 'measure-distance':
    case 'rectangle':
    case 'circle':
    case 'circle-diameter':
    case 'circle-2p-diameter':
    case 'ray':
    case 'scale-bar': // ADR-583 Φ2 — 2 σημεία (origin + axis/length), mirror 'line'
      return pointCount >= 2;
    case 'opening-info-tag': // ADR-612 — 1 σημείο (box centre), mirror 'annotation-symbol'
      return pointCount >= 1;
    case 'measure-angle':
    case 'measure-angle-measuregeom':
    case 'arc-3p':
    case 'arc-cse':
    case 'arc-sce':
    case 'circle-3p':
    case 'circle-chord-sagitta':
    case 'circle-2p-radius':
      return pointCount >= 3;
    case 'xline': {
      const state = getXLineModeState();
      if (state.mode === 'horizontal' || state.mode === 'vertical') return pointCount >= 1;
      if (state.mode === 'angle') return state.angleValue !== null ? pointCount >= 1 : pointCount >= 2;
      if (state.mode === 'bisect') return pointCount >= 3;
      if (state.mode === 'offset') return false;
      return pointCount >= 2; // through default
    }
    case 'measure-distance-continuous':
    case 'polyline':
    case 'polygon':
    case 'measure-area':
    case 'hatch': // ADR-507 S2 — closed boundary, N-click + Enter
    case 'circle-best-fit':
      return false; // These tools continue until manually finished
    default:
      return false;
  }
}
