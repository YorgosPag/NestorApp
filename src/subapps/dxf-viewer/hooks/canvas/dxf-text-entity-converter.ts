/**
 * 🏢 ENTERPRISE: DXF Text Entity Converter (pure, module-level)
 *
 * @description Pure TEXT/MTEXT SceneEntity → DxfText projection. Extracted from
 * {@link convertEntity} (dxf-scene-entity-converter.ts) to keep that file ≤500 LOC
 * (Google SRP, N.7.1). Single consumer — the `mtext`/`text` switch arm there.
 *
 * Resolves: flat text (CreateTextCommand entities carry only a textNode), text
 * height + first-run style (ADR-344 Phase 6.E), flat-font fallback (ADR-526 Φ5a),
 * and the ADR-557 grip-box width discriminator (MTEXT `width` vs TEXT `widthFactor`).
 */

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import type { TextEntity } from '../../types/entities';
import { extractFlatText } from '../../utils/text-node-utils';
import { extractFirstRunStyle, resolveTextHeight } from './dxf-text-style-extractor';
import type { SceneEntity, DxfBaseFields } from './dxf-scene-entity-converter';

/**
 * Project a TEXT/MTEXT scene entity onto a DxfText. `base` carries the shared
 * id/layer/style fields built by `buildBase`. MTEXT is normalised to 'text'
 * because DxfEntityUnion has no `mtext` variant.
 */
export function convertTextEntity(entity: SceneEntity, base: DxfBaseFields): DxfEntityUnion {
  const e = entity as typeof entity & { position: Point2D; text?: string; rotation?: number };
  const withNode = entity as TextEntity;
  // ADR-344 Phase 6.E: entities from CreateTextCommand have no flat text — derive it.
  const flatText = e.text ?? (withNode.textNode ? extractFlatText(withNode.textNode) : '');
  const textHeight = resolveTextHeight(withNode);
  const textStyle = extractFirstRunStyle(withNode);
  // ADR-526 Φ5a — flat `fontFamily` (π.χ. εισαγωγή Τέκτονα, χωρίς textNode) → textStyle
  // when textNode set no font. Additive: DXF text keeps its textNode font → unchanged.
  const flatFont = withNode.fontFamily;
  const finalStyle = flatFont && !textStyle?.fontFamily
    ? { ...textStyle, fontFamily: flatFont }
    : textStyle;
  // ADR-557 — grip-box width discriminator: MTEXT WITH a real `width` frame → that frame;
  // otherwise (simple TEXT, or a width-less in-app MTEXT) → the AutoCAD X-scale `widthFactor`.
  // This MIRRORS the resize discriminator (`text-grips.ts` `isMTextBox` = `width != null`):
  // a width-less MTEXT resize writes `widthFactor`, so the converter MUST carry it here too —
  // else the render/display path (converted entity) drops it and its box stays wide while the
  // hit-test box narrows, so grips draw at one width but hover-test at another (Giorgio 2026-07-07).
  const mtextWidth = entity.type === 'mtext'
    ? (entity as unknown as { width?: number }).width
    : undefined;
  const textWidthFactor = mtextWidth == null
    ? (entity as unknown as { widthFactor?: number }).widthFactor
    : undefined;
  return {
    ...base,
    type: 'text' as const,
    position: e.position,
    text: flatText,
    height: textHeight,
    rotation: e.rotation,
    ...(finalStyle && { textStyle: finalStyle }),
    ...(mtextWidth != null && { width: mtextWidth }),
    ...(textWidthFactor != null && { widthFactor: textWidthFactor }),
    // ADR-557 — carry node line-spacing FLAT so the render/box/3D paths read the factor
    // (the full textNode is flattened away here). Without this the ribbon «Διάστιχο» edit
    // wrote textNode.lineSpacing but the renderer never saw it (factor stayed 1).
    ...(withNode.textNode?.lineSpacing && { lineSpacing: withNode.textNode.lineSpacing }),
  } as DxfEntityUnion;
}
