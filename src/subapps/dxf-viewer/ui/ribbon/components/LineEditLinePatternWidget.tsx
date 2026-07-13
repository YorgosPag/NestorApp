'use client';

/**
 * ADR-642 Edit-in-place / Duplicate — ribbon parity for the left-palette «✎ Επεξεργασία»
 * affordance (Revit surfaces «Edit Type» in BOTH the Properties palette and the ribbon/type
 * selector). Contextual to the CURRENT linetype of the selected line (or the draw-default):
 *
 *   - user-created type  → «✎ Επεξεργασία» → edits it IN PLACE (name locked → every line updates);
 *   - ISO/built-in/imported → «⧉ Διπλότυπο» → new named copy, then ASSIGNED via the SAME
 *     `LINE_TOOL_RIBBON_KEYS.linetype` dispatch the «Τύπος» dropdown fires (bridge → selected line
 *     or draw-defaults). Zero new assign logic — 100% reuse of the bridge's linetype path.
 *   - solid / ByLayer / unknown (no resolvable def) → nothing to edit → renders nothing.
 *
 * Reads the live linetype value from `RibbonFieldStore` (`useRibbonComboboxState`) — the SAME slice
 * the «Τύπος» combobox shows — so no selection wiring is duplicated. Button + dialog = the shared
 * `LinePatternLauncherButton` (edit/duplicate mode), NOT a clone (N.18).
 */

import React, { useCallback } from 'react';
import { useRibbonDispatch } from '../context/RibbonCommandContext';
import { useRibbonComboboxState } from '../context/useRibbonFieldSelectors';
import { LINE_TOOL_RIBBON_KEYS } from '../hooks/bridge/line-tool-command-keys';
import { resolveLinetypeDef } from '../../../rendering/linetype-dash-resolver';
import { LinePatternLauncherButton } from './LinePatternLauncherButton';

export const LineEditLinePatternWidget: React.FC = () => {
  const { onComboboxChange } = useRibbonDispatch();
  const currentName = useRibbonComboboxState(LINE_TOOL_RIBBON_KEYS.linetype)?.value ?? null;
  const def = resolveLinetypeDef(currentName);

  const assignToLine = useCallback(
    (name: string) => onComboboxChange(LINE_TOOL_RIBBON_KEYS.linetype, name),
    [onComboboxChange],
  );

  // No resolvable named def (solid / ByLayer / unknown, or a mixed multi-selection) → nothing to edit.
  if (!def) return null;

  return def.origin === 'user-created' ? (
    <LinePatternLauncherButton labelKey="ribbon.commands.lineEditLineType" editName={def.name} />
  ) : (
    <LinePatternLauncherButton
      labelKey="ribbon.commands.lineDuplicateLineType"
      duplicateFrom={def.name}
      onCreated={assignToLine}
    />
  );
};
