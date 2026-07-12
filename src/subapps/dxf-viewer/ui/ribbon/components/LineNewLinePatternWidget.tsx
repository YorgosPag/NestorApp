'use client';

/**
 * ADR-510 Φ2E #3 — «＋ Νέος τύπος γραμμής» ribbon launcher for the LINE tab.
 *
 * Mirror of `DimNewLinePatternWidget`, but it ALSO ASSIGNS the freshly-created
 * linetype: `onCreated(name)` dispatches the SAME `LINE_TOOL_RIBBON_KEYS.linetype`
 * combobox change the «Τύπος» dropdown fires, through the stable ribbon dispatch
 * context. That routes into `useRibbonLineToolBridge.onComboboxChange`, which:
 *   - a line is selected  → `patchEntity(selected, { linetypeName })` (undoable
 *     via UpdateEntityCommand — Revit «επίλεξε → όρισε μοτίβο»);
 *   - no selection (draw) → `setQuickStyleLinetype(name)` for the NEXT line.
 *
 * Zero new assign logic — 100% reuse of the bridge's linetype path (both modes).
 * Big-player practice (Revit «Line Patterns» / AutoCAD LTYPE): named reusable
 * pattern + assign + per-object scale — never inline per-object dash editing.
 */

import React, { useCallback } from 'react';
import { useRibbonDispatch } from '../context/RibbonCommandContext';
import { LINE_TOOL_RIBBON_KEYS } from '../hooks/bridge/line-tool-command-keys';
import { LinePatternLauncherButton } from './LinePatternLauncherButton';

export const LineNewLinePatternWidget: React.FC = () => {
  const { onComboboxChange } = useRibbonDispatch();
  const assignToLine = useCallback(
    (name: string) => onComboboxChange(LINE_TOOL_RIBBON_KEYS.linetype, name),
    [onComboboxChange],
  );

  return (
    <LinePatternLauncherButton
      labelKey="ribbon.commands.lineNewLineType"
      onCreated={assignToLine}
    />
  );
};
