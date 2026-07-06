/**
 * ADR-557 Φ-attachment — scene TEXT/MTEXT → flat `DxfText` projection SSoT.
 *
 * THE single helper that turns a raw scene text entity (whose height / content /
 * style live in a `textNode`, ADR-344) into the flat `DxfText` the grip-box math
 * (`resolveTextBox` / `applyTextGripDrag`) consumes. Reuses the SAME converter SSoT
 * (`resolveTextHeight` + `extractFlatText` + `extractFirstRunStyle`) the render/
 * hit-test pipeline uses, so the box a transform operates on matches the box the
 * grips were emitted from.
 *
 * WHY a shared module: BOTH the live ghost preview (`apply-entity-preview.ts`) AND the
 * commit (`grip-parametric-text-commits.ts`) must project the raw entity identically —
 * else preview ≠ commit. The preview previously fed the RAW entity straight to
 * `applyTextGripDrag`; its flat `height`/`text` are absent for in-app text, so
 * `resolveBoxHeight` fell back to the 2.5 DIMTXT default → a ~1.5×2.5 box instead of the
 * real one → the ghost jumped / vanished and a corner drag read as a whole-entity move
 * (Giorgio 2026-07-06). Routing both through this SSoT keeps them byte-identical.
 *
 * Pure: zero React / DOM / Firestore / canvas / THREE deps.
 *
 * @see hooks/grips/grip-parametric-text-commits.ts — the commit consumer
 * @see rendering/ghost/apply-entity-preview.ts — the live-ghost consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfTextNode } from '../../text-engine/types';
import { resolveTextHeight, extractFirstRunStyle } from '../../hooks/canvas/dxf-text-style-extractor';
import { extractFlatText } from '../../utils/text-node-utils';

/** Narrow scene shape needed to project a TEXT/MTEXT entity to a flat `DxfText`. */
export interface TextSceneShape {
  type: string;
  position: Point2D;
  text?: string;
  textNode?: DxfTextNode;
  height?: number;
  fontSize?: number;
  rotation?: number;
  width?: number;       // MTEXT frame
  widthFactor?: number; // simple-TEXT X-scale
}

/**
 * Scene TEXT/MTEXT → the flat `DxfText` the grip adapter consumes. MTEXT carries its
 * real `width`; simple TEXT carries `widthFactor` (the discriminator the adapter reads).
 */
export function projectSceneTextToDxf(e: TextSceneShape, id: string): DxfText {
  const text = e.text ?? (e.textNode ? extractFlatText(e.textNode) : '') ?? '';
  const height = resolveTextHeight(e);
  // ADR-557 Φ-attachment — carry the derived style (textAlign/textBaseline) so the box
  // SSoT (`resolveTextBox`, via `applyTextGripDrag`) is attachment-aware — i.e. the
  // transform matches the box the user grabbed (TL..BR), not a hard TL.
  const textStyle = extractFirstRunStyle(e);
  return {
    id,
    type: 'text',
    visible: true,
    position: e.position,
    text,
    height,
    rotation: e.rotation,
    ...(textStyle ? { textStyle } : {}),
    ...(e.type === 'mtext' ? { width: e.width } : { widthFactor: e.widthFactor }),
  };
}
