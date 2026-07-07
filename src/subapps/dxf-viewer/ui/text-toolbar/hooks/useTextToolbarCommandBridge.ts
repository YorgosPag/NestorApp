'use client';

/**
 * ADR-344 Phase 6.E — Toolbar mutation → CommandHistory bridge.
 *
 * Subscribes (vanilla Zustand) to `useTextToolbarStore`. On every change
 * that is NEITHER a populate cycle NOR a grip-drag live preview
 * (`isPopulating === false` AND `isPreviewing === false`, ADR-557 grip-drag
 * live-preview flow), diffs the previous vs next snapshot and dispatches one
 * DXF text command per affected field, per selected entity, through
 * `getGlobalCommandHistory`.
 *
 * Routing matrix (toolbar field → command):
 *
 *   fontFamily, fontHeight, bold, italic, underline, overline,
 *   strikethrough, color, obliqueAngle, tracking
 *     → UpdateTextStyleCommand  (run-level style, merges across calls)
 *
 *   rotation, widthFactor
 *     → UpdateTextTransformCommand (FLAT top-level box transform the renderer reads —
 *       ADR-557; writing the AST `textNode.rotation` / `run.style.widthFactor` renders
 *       as a no-op, which is why those two ribbon fields "did nothing" before)
 *
 *   justification, lineSpacingMode, lineSpacingFactor
 *     → UpdateMTextParagraphCommand (node-level `textNode.attachment` /
 *       `textNode.lineSpacing` — the fields the renderer reads via
 *       `bim/text/text-lines.ts`; ADR-557)
 *
 *   layerId, currentScale
 *     → deferred (layerId) / handled above (currentScale)
 *
 * AutoCAD parity: equivalent to the PROPERTIES palette → grpcode
 * dispatcher in stock AutoCAD. One change = one logical undo step
 * (merged by CommandHistory when consecutive).
 *
 * The hook returns nothing; mount it once per panel host.
 */

import { useEffect } from 'react';
import {
  useTextToolbarStore,
  useTextSelectionStore,
  type TextToolbarValues,
} from '../../../state/text-toolbar';
import {
  UpdateTextStyleCommand,
  type TextStylePatch,
} from '../../../core/commands/text/UpdateTextStyleCommand';
import {
  UpdateTextTransformCommand,
  type TextTransformState,
} from '../../../core/commands/text/UpdateTextTransformCommand';
// ADR-557 — the SAME scene→flat projection the grips read, so a ribbon-typed transform
// is byte-identical to a grip-dragged one (preview ≡ commit).
import { projectSceneTextToDxf, type TextSceneShape } from '../../../bim/text/project-scene-text';
import { UpdateTextCurrentScaleCommand } from '../../../core/commands/text/UpdateTextCurrentScaleCommand';
import { UpdateMTextParagraphCommand } from '../../../core/commands/text/UpdateMTextParagraphCommand';
import type { TextJustification } from '../../../text-engine/types';
import { getGlobalCommandHistory } from '../../../core/commands';
import { setActiveScale } from '../../../systems/viewport';
import { useDxfTextServices, type DxfTextServices } from './useDxfTextServices';

const STYLE_FIELDS = [
  'fontFamily',
  'fontHeight',
  'bold',
  'italic',
  'underline',
  'overline',
  'strikethrough',
  'color',
  'obliqueAngle',
  'tracking',
] as const satisfies readonly (keyof TextToolbarValues)[];

type StyleField = (typeof STYLE_FIELDS)[number];

function buildStylePatch(
  field: StyleField,
  value: TextToolbarValues[StyleField],
): TextStylePatch | null {
  if (value === null) return null;
  switch (field) {
    case 'fontFamily':
      return { fontFamily: value as string };
    case 'fontHeight':
      return { height: value as number };
    case 'bold':
      return { bold: value as boolean };
    case 'italic':
      return { italic: value as boolean };
    case 'underline':
      return { underline: value as boolean };
    case 'overline':
      return { overline: value as boolean };
    case 'strikethrough':
      return { strikethrough: value as boolean };
    case 'color':
      return { color: value as TextStylePatch['color'] };
    case 'obliqueAngle':
      return { obliqueAngle: value as number };
    case 'tracking':
      return { tracking: value as number };
  }
}

function dispatchStylePatch(
  ids: readonly string[],
  patch: TextStylePatch,
  services: DxfTextServices,
): void {
  const history = getGlobalCommandHistory();
  for (const entityId of ids) {
    const cmd = new UpdateTextStyleCommand(
      { entityId, patch },
      services.sceneManager,
      services.layerProvider,
      services.auditRecorder,
    );
    history.execute(cmd);
  }
}

/**
 * ADR-557 — dispatch a FLAT box-transform field (`rotation` / `widthFactor`).
 *
 * These live as TOP-LEVEL entity fields the renderer + grip commit own — NOT on the AST
 * `textNode` / run-style. Route them through the SAME `UpdateTextTransformCommand` the grips
 * use: build the full transform state from the SAME projection the grips read
 * (`projectSceneTextToDxf`), change the one field, dispatch. Writing the AST fields instead
 * (the old routing) rendered as a no-op — that is why the ribbon «Περιστροφή»/«Πλάτος» did
 * nothing. Position/height are re-written with their current (projected) values → idempotent.
 */
function dispatchTransformField(
  ids: readonly string[],
  field: 'rotation' | 'widthFactor',
  value: number,
  services: DxfTextServices,
): void {
  const history = getGlobalCommandHistory();
  for (const entityId of ids) {
    const raw = services.sceneManager.getEntity(entityId) as unknown as TextSceneShape | undefined;
    if (!raw || (raw.type !== 'text' && raw.type !== 'mtext')) continue;
    const dxf = projectSceneTextToDxf(raw, entityId);
    const height = dxf.height;
    const previous: TextTransformState = {
      position: dxf.position,
      rotation: dxf.rotation ?? 0,
      height,
      fontSize: height,
      ...(dxf.width != null ? { width: dxf.width } : { widthFactor: dxf.widthFactor ?? 1 }),
    };
    // `widthFactor` is the simple-TEXT X-scale; a frame-width MTEXT has no ribbon width
    // field, so never force the widthFactor channel onto it (would drop its `width`).
    if (field === 'widthFactor' && previous.width != null) continue;
    const next: TextTransformState =
      field === 'rotation'
        ? { ...previous, rotation: value }
        : { ...previous, widthFactor: value };
    const cmd = new UpdateTextTransformCommand(entityId, next, previous, services.sceneManager, false);
    if (cmd.validate() !== null) continue;
    history.execute(cmd);
  }
}

function diffAndDispatch(
  next: TextToolbarValues,
  prev: TextToolbarValues,
  ids: readonly string[],
  services: DxfTextServices,
): void {
  // Style fields — one patch per changed key, all entities.
  for (const field of STYLE_FIELDS) {
    if (Object.is(next[field], prev[field])) continue;
    const patch = buildStylePatch(field, next[field]);
    if (!patch) continue;
    dispatchStylePatch(ids, patch, services);
  }
  // Box transform (FLAT SSoT) — rotation + widthFactor go through UpdateTextTransformCommand
  // (the SAME command the grips use), so the ribbon edit actually renders (ADR-557).
  if (!Object.is(next.rotation, prev.rotation) && next.rotation !== null) {
    dispatchTransformField(ids, 'rotation', next.rotation, services);
  }
  if (!Object.is(next.widthFactor, prev.widthFactor) && next.widthFactor !== null) {
    dispatchTransformField(ids, 'widthFactor', next.widthFactor, services);
  }
  // Annotation scale — sync viewport + update entity textNode.currentScale.
  if (!Object.is(next.currentScale, prev.currentScale) && next.currentScale !== null) {
    setActiveScale(next.currentScale);
    const history = getGlobalCommandHistory();
    for (const entityId of ids) {
      const cmd = new UpdateTextCurrentScaleCommand(
        { entityId, scaleName: next.currentScale },
        services.sceneManager,
        services.layerProvider,
        services.auditRecorder,
      );
      history.execute(cmd);
    }
  }
  // Justification (9-point attachment) — updates textNode.attachment → canvas textAlign.
  if (!Object.is(next.justification, prev.justification) && next.justification !== null) {
    const attachment = next.justification as TextJustification;
    const history = getGlobalCommandHistory();
    for (const entityId of ids) {
      const cmd = new UpdateMTextParagraphCommand(
        { entityId, patch: {}, attachment },
        services.sceneManager,
        services.layerProvider,
        services.auditRecorder,
      );
      history.execute(cmd);
    }
  }
  // Line spacing (node-level {mode,factor}) — ADR-557: writes textNode.lineSpacing,
  // the SINGLE field resolveLineSpacingRatio reads. Same command + updateEntity path as
  // justification, so the multi-line block re-lays-out live (single-line → renderer no-op).
  if (
    (!Object.is(next.lineSpacingMode, prev.lineSpacingMode) ||
      !Object.is(next.lineSpacingFactor, prev.lineSpacingFactor)) &&
    next.lineSpacingMode !== null &&
    next.lineSpacingFactor !== null
  ) {
    const lineSpacing = { mode: next.lineSpacingMode, factor: next.lineSpacingFactor };
    const history = getGlobalCommandHistory();
    for (const entityId of ids) {
      const cmd = new UpdateMTextParagraphCommand(
        { entityId, patch: {}, lineSpacing },
        services.sceneManager,
        services.layerProvider,
        services.auditRecorder,
      );
      if (cmd.validate() === null) history.execute(cmd);
    }
  }
  // layerId — deferred.
}

export function useTextToolbarCommandBridge(): void {
  const services = useDxfTextServices();

  useEffect(() => {
    if (!services) return;
    const unsubscribe = useTextToolbarStore.subscribe((state, prev) => {
      // ADR-557 — suppress dispatch during selection populate (isPopulating) AND
      // during a grip-drag live preview (isPreviewing), so the live `setPreview`
      // writes never fire an UpdateTextStyleCommand / undo entry per frame.
      if (state.isPopulating || state.isPreviewing) return;
      const ids = useTextSelectionStore.getState().selectedIds;
      if (ids.length === 0) return;
      diffAndDispatch(state, prev, ids, services);
    });
    return unsubscribe;
  }, [services]);
}
