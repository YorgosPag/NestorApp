/**
 * 🏢 ENTERPRISE: IMMEDIATE TRANSFORM STORE
 *
 * Module-level singleton per transform updates sincronizzati.
 * Bypassa React state per zero-latency canvas render durante zoom/pan.
 *
 * PROBLEMA: React state update cycle aggiunge 1-2 frame di lag:
 *   wheel → setTransform (state) → commit → useEffect → isDirtyRef=true → RAF → canvas draw
 *
 * SOLUZIONE: canvas legge da questo store (aggiornato SINCRONO nell'event handler)
 * invece che da refs.transformRef.current (aggiornato solo su React re-render).
 *
 * PATTERN: identico a ImmediatePositionStore usato per il cursor.
 *
 * @see ImmediatePositionStore — stesso pattern per la posizione del cursore
 * @see ADR-040 — Canvas Performance (Phase I: zoom/pan lag elimination)
 */

import type { ViewTransform } from '../../rendering/types/Types';
import { markSystemsDirty } from '../../rendering/core/UnifiedFrameScheduler';

// Canvas IDs che dipendono dal transform (esclude crosshair-overlay e preview-canvas)
const TRANSFORM_CANVAS_IDS = ['dxf-canvas', 'layer-canvas'] as const;

let _transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

/**
 * Aggiorna il transform sincrono e marca dirty i canvas di rendering.
 * Chiamato da useViewportManager.setTransform PRIMA dell'aggiornamento React state.
 */
export function updateImmediateTransform(t: ViewTransform): void {
  _transform = t;
  markSystemsDirty([...TRANSFORM_CANVAS_IDS]);
}

/**
 * Legge il transform corrente. Usato dentro i renderScene/renderLayers RAF callback.
 * Zero lag — aggiornato sincrono prima del RAF.
 */
export function getImmediateTransform(): ViewTransform {
  return _transform;
}
