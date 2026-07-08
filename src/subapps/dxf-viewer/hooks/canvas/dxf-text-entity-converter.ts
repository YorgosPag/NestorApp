/**
 * 🏢 ENTERPRISE: DXF Text Entity Converter (pure, module-level)
 *
 * @description Pure TEXT/MTEXT SceneEntity → DxfText projection for the RENDER pipeline.
 * Extracted from {@link convertEntity} (dxf-scene-entity-converter.ts) to keep that file
 * ≤500 LOC (Google SRP, N.7.1). Single consumer — the `mtext`/`text` switch arm there.
 *
 * ADR-557 (Giorgio 2026-07-08 «το πρόβλημα επιστρέφει πάντα») — this converter now DELEGATES
 * the text-field derivation to the ONE scene→`DxfText` SSoT `projectSceneTextToDxf`
 * (`bim/text/project-scene-text.ts`) and copies its output through the single-list
 * `pickTextRenderFields` (`bim/text/text-render-fields.ts`). Before this, this converter AND
 * `projectSceneTextToDxf` each hand-maintained their own scene→DxfText field list; they drifted
 * (this one carried `lineSpacing`, the other did not), and every new text property had to be
 * added to both. Now the flat text (CreateTextCommand entities), height + first-run style
 * (ADR-344 Φ6.E), flat-font fallback (ADR-526 Φ5a), and the MTEXT-`width`/TEXT-`widthFactor`
 * discriminator (ADR-557) all live in ONE place — the render + grip/ghost paths cannot diverge.
 */

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { projectSceneTextToDxf, type TextSceneShape } from '../../bim/text/project-scene-text';
import { pickTextRenderFields } from '../../bim/text/text-render-fields';
import type { SceneEntity, DxfBaseFields } from './dxf-scene-entity-converter';

/**
 * Project a TEXT/MTEXT scene entity onto a DxfText. `base` carries the shared
 * id/layer/style fields built by `buildBase`. MTEXT is normalised to 'text'
 * because DxfEntityUnion has no `mtext` variant. The text-specific fields come from the
 * `projectSceneTextToDxf` SSoT so render ≡ grips ≡ ghost ≡ 3D (one field list).
 */
export function convertTextEntity(entity: SceneEntity, base: DxfBaseFields): DxfEntityUnion {
  const id = (base as { id?: string }).id ?? (entity as { id?: string }).id ?? '';
  const projected = projectSceneTextToDxf(entity as unknown as TextSceneShape, id);
  return {
    ...base,
    type: 'text' as const,
    ...pickTextRenderFields(projected),
  } as DxfEntityUnion;
}
