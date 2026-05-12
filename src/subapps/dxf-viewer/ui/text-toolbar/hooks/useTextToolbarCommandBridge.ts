'use client';

/**
 * ADR-344 Phase 6.E — Toolbar mutation → CommandHistory bridge.
 *
 * Subscribes (vanilla Zustand) to `useTextToolbarStore`. On every change
 * that is NOT a populate cycle (`isPopulating === false`), diffs the
 * previous vs next snapshot and dispatches one DXF text command per
 * affected field, per selected entity, through `getGlobalCommandHistory`.
 *
 * Routing matrix (toolbar field → command):
 *
 *   fontFamily, fontHeight, bold, italic, underline, overline,
 *   strikethrough, color, widthFactor, obliqueAngle, tracking
 *     → UpdateTextStyleCommand  (run-level style, merges across calls)
 *
 *   rotation
 *     → UpdateTextGeometryCommand (merges within 500 ms drag window)
 *
 *   justification, lineSpacingMode, lineSpacingFactor, layerId,
 *   currentScale
 *     → deferred (no commands yet — see Q11/Q17 wiring follow-ups)
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
  UpdateTextGeometryCommand,
  type GeometryPatch,
} from '../../../core/commands/text/UpdateTextGeometryCommand';
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
  'widthFactor',
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
    case 'widthFactor':
      return { widthFactor: value as number };
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

function dispatchGeometryPatch(
  ids: readonly string[],
  patch: GeometryPatch,
  services: DxfTextServices,
): void {
  const history = getGlobalCommandHistory();
  for (const entityId of ids) {
    const cmd = new UpdateTextGeometryCommand(
      { entityId, patch },
      services.sceneManager,
      services.layerProvider,
      services.auditRecorder,
    );
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
  // Geometry — rotation is the only toolbar-driven geometry field.
  if (!Object.is(next.rotation, prev.rotation) && next.rotation !== null) {
    dispatchGeometryPatch(ids, { rotation: next.rotation }, services);
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
  // lineSpacing* / layerId — deferred.
}

export function useTextToolbarCommandBridge(): void {
  const services = useDxfTextServices();

  useEffect(() => {
    if (!services) return;
    const unsubscribe = useTextToolbarStore.subscribe((state, prev) => {
      if (state.isPopulating) return;
      const ids = useTextSelectionStore.getState().selectedIds;
      if (ids.length === 0) return;
      diffAndDispatch(state, prev, ids, services);
    });
    return unsubscribe;
  }, [services]);
}
