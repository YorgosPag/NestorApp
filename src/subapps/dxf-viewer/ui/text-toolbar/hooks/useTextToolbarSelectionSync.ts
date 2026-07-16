'use client';

/**
 * ADR-344 Phase 6.E — Selection → Toolbar populate bridge.
 *
 * AutoCAD parity: equivalent to AutoCAD's "PROPERTIES on selection-change"
 * event — the global pick-set is the SSoT, every observer (Properties
 * palette, Quick Properties, ribbon contextual tab) reads from it.
 *
 * Pipeline:
 *   1. `useUniversalSelection` is the canonical pick-set (Tier-1 SSoT).
 *   2. We filter for entities of `dxf-entity` type AND resolve each ID
 *      against the current scene to keep only TEXT/MTEXT nodes.
 *   3. `useTextSelectionStore.setSelection(ids)` is mirrored so other
 *      text-engine consumers (capabilities hook, FindReplaceDialog…)
 *      stay in lock-step.
 *   4. `computeMixedValues(selection)` collapses agreement/mixed values
 *      across the selection.
 *   5. `useTextToolbarStore.populate(values)` writes the values atomically
 *      with the `isPopulating` flag raised — the command-bridge skips
 *      these updates so the populate cycle never enters CommandHistory.
 *
 * The hook is effect-only; it returns nothing. Mount it once at the
 * Text Properties panel host or any ribbon root that owns text editing.
 *
 * ADR-040 note: this hook is safe to call from desktop chrome (panel
 * hosts, ribbon shells) — it has zero canvas-level frequency, only
 * fires when the pick-set changes (low rate).
 */

import { useEffect } from 'react';
import { useUniversalSelection } from '../../../systems/selection';
import { useCurrentSceneModel } from './useCurrentSceneModel';
import {
  useTextSelectionStore,
  useTextToolbarStore,
  computeMixedValues,
  DEFAULT_TOOLBAR_VALUES,
  type TextFlatGeometry,
} from '../../../state/text-toolbar';
import { ensureTextNode } from '../../../text-engine/edit';
// ADR-557 — line-count SSoT (same split the renderer uses) + node→flat join, so the
// «Διάστιχο» MTEXT-only gate agrees byte-for-byte with what the canvas paints.
import { textLineCount } from '../../../bim/text/text-lines';
import { extractFlatText } from '../../../utils/text-node-utils';
import type { SceneModel, AnySceneEntity } from '../../../types/scene';
import type { DxfTextNode } from '../../../text-engine/types';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT
// ADR-557 read-side flat-SSoT — the SAME height / run-style extractors the render
// pipeline (dxf-scene-entity-converter) uses, so the toolbar geometry ≡ the canvas.
import { resolveTextHeight, extractFirstRunStyle } from '../../../hooks/canvas/dxf-text-style-extractor';
// Non-null default font SSoT (text-engine) — the toolbar default is `MixedValue<string>`
// (nullable = «Μεικτή»), so the final fallback coalesces its type-level `null` away.
import { DEFAULT_RUN_STYLE } from '../../../text-engine/templates/defaults/template-helpers';

interface ResolvedTextEntity {
  readonly id: string;
  readonly node: DxfTextNode;
  readonly layerId: string;
  readonly flat: TextFlatGeometry;
}

/** Narrow flat-field view of a scene TEXT/MTEXT (the fields the renderer owns). */
type FlatTextFields = {
  rotation?: number;
  widthFactor?: number;
  fontFamily?: string;
};

/**
 * ADR-557 — derive the FLAT entity geometry SSoT (rotation / widthFactor / height /
 * fontFamily) the renderer + grip commit own, using the SAME extractors the render
 * pipeline uses. This is what the toolbar must reflect — NOT the AST node, whose
 * `rotation` / `run.style.widthFactor` the commit deliberately never updates.
 */
function resolveFlatGeometry(entity: AnySceneEntity): TextFlatGeometry {
  const flat = entity as unknown as FlatTextFields;
  // fontFamily: prefer the rendered run style, then the flat field, then the toolbar
  // default — NEVER an empty string (which the font combobox reads as «Μεικτή»).
  const fontFamily =
    extractFirstRunStyle(entity as unknown as Parameters<typeof extractFirstRunStyle>[0])?.fontFamily ||
    (flat.fontFamily?.trim() ? flat.fontFamily : '') ||
    (DEFAULT_TOOLBAR_VALUES.fontFamily ?? DEFAULT_RUN_STYLE.fontFamily);
  return {
    rotation: flat.rotation ?? 0,
    // Simple TEXT carries `widthFactor`; MTEXT uses a `width` frame → factor 1.
    widthFactor: flat.widthFactor ?? 1,
    height: resolveTextHeight(entity as unknown as Parameters<typeof resolveTextHeight>[0]),
    fontFamily,
  };
}

/**
 * ADR-557 — the selection is «multi-line» (→ the ribbon «Διάστιχο» widget is shown)
 * when ANY selected text has ≥ 2 visual lines. Line spacing is the baseline-to-baseline
 * step, so it only has a visible effect on a block of ≥ 2 lines (AutoCAD/Revit: MTEXT-only).
 * A lone single-line TEXT hides it; a multi-line one in the mix shows it.
 */
function selectionIsMultiLine(resolved: readonly ResolvedTextEntity[]): boolean {
  return resolved.some((r) => textLineCount(extractFlatText(r.node)) >= 2);
}

function resolveTextEntities(
  ids: readonly string[],
  scene: SceneModel | null,
): ResolvedTextEntity[] {
  if (!scene || ids.length === 0) return [];
  const byId = new Map<string, AnySceneEntity>();
  for (const e of scene.entities) byId.set(e.id, e);
  const out: ResolvedTextEntity[] = [];
  for (const id of ids) {
    const entity = byId.get(id);
    if (!entity) continue;
    if (entity.type !== 'text' && entity.type !== 'mtext') continue;
    out.push({
      id: entity.id,
      node: ensureTextNode(entity as unknown as Parameters<typeof ensureTextNode>[0]),
      // ADR-557 E-α — seed the entity's OWN layer ID (not the resolved NAME): the dropdown's
      // `SelectItem` value is `layer.id`, so the picker only highlights the current layer AND
      // the command bridge only diffs id↔id when this holds an id. `resolveEntityLayerName`
      // (which returns the layer NAME) mismatched every SelectItem → wrong/blank selection.
      layerId: (entity as { layerId?: string }).layerId ?? '',
      flat: resolveFlatGeometry(entity),
    });
  }
  return out;
}

/**
 * ADR-557 — imperative reconcile of the toolbar to the CURRENT committed selection,
 * reusing the exact SSoT the selection-sync effect uses (`resolveTextEntities` +
 * `computeMixedValues` + `populate`). Used by the grip-drag ribbon sync to settle the
 * ribbon on the final committed height/width when a text resize drag ENDS — covering the
 * cancel/Esc path where the scene reference does NOT change and the effect below would
 * therefore never re-fire, leaving a stale live-preview value in the store.
 *
 * @returns the resolved TEXT/MTEXT ids (empty if none) — mirrors the effect's `textIds`.
 */
export function reconcileTextToolbarFromSelection(
  ids: readonly string[],
  scene: SceneModel | null,
): string[] {
  const resolved = resolveTextEntities(ids, scene);
  if (resolved.length === 0) return [];
  const values = computeMixedValues(
    resolved.map((r) => ({ node: r.node, layerId: r.layerId, flat: r.flat })),
  );
  useTextToolbarStore.getState().populate(values, { isMultiLine: selectionIsMultiLine(resolved) });
  return resolved.map((r) => r.id);
}

export function useTextToolbarSelectionSync(): void {
  const selection = useUniversalSelection();
  const scene = useCurrentSceneModel();
  const setTextSelection = useTextSelectionStore((s) => s.setSelection);
  const populate = useTextToolbarStore((s) => s.populate);

  // Re-derive on every selection or scene change. Both sources update at
  // human-event rate (click / scene swap), so this is not a hot path.
  const allIds = selection.getIds();
  const idsKey = allIds.join(',');

  useEffect(() => {
    const resolved = resolveTextEntities(allIds, scene);
    const textIds = resolved.map((r) => r.id);
    setTextSelection(textIds);
    if (resolved.length === 0) return;
    const values = computeMixedValues(
      resolved.map((r) => ({ node: r.node, layerId: r.layerId, flat: r.flat })),
    );
    populate(values, { isMultiLine: selectionIsMultiLine(resolved) });
    // `allIds` is captured indirectly via idsKey to keep the dep array stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, scene, setTextSelection, populate]);
}
