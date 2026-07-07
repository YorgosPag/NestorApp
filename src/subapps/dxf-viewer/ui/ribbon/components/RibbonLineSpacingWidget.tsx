'use client';

/**
 * ADR-345 Fase 6 — Line spacing widget for the Text Editor contextual tab.
 *
 * Leaf component: reads/writes `lineSpacingMode` + `lineSpacingFactor`
 * directly from `useTextToolbarStore` (ADR-040 compliant micro-leaf).
 * Reuses the existing `LineSpacingMenu` control with all 6 modes
 * (single / 1.5x / double / multiple / exact / at-least) — SSoT.
 *
 * ADR-557 — MTEXT-only visibility: line spacing is the baseline-to-baseline step,
 * so it is meaningless on a single line (AutoCAD/Revit parity). The widget renders
 * nothing unless the selection has ≥ 2 lines (`isMultiLine`, derived at populate time
 * from the `textLineCount` SSoT). The now-empty ribbon row collapses via the global
 * `.dxf-ribbon-panel-row:empty { display: none }` rule — the «Στοίχιση παραγράφου»
 * widget in the same panel stays visible (single-line TEXT keeps its 9-point attachment).
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useTextToolbarStore } from '../../../state/text-toolbar';
import { LineSpacingMenu } from '../../text-toolbar/controls/LineSpacingMenu';
import type { LineSpacingMode } from '../../../text-engine/types';

export function RibbonLineSpacingWidget() {
  const { t } = useTranslation('dxf-viewer-shell');
  const isMultiLine = useTextToolbarStore((s) => s.isMultiLine);
  const lineSpacingMode = useTextToolbarStore((s) => s.lineSpacingMode);
  const lineSpacingFactor = useTextToolbarStore((s) => s.lineSpacingFactor);
  const setMany = useTextToolbarStore((s) => s.setMany);

  const handleChange = useCallback(
    (mode: LineSpacingMode, factor: number) =>
      setMany({ lineSpacingMode: mode, lineSpacingFactor: factor }),
    [setMany],
  );

  // ADR-557 — MTEXT-only: hidden on single-line selections (AutoCAD/Revit parity).
  if (!isMultiLine) return null;

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.textEditor.paragraph.lineSpacing')}
      </span>
      <span className="dxf-ribbon-widget-compact">
        <LineSpacingMenu
          mode={lineSpacingMode}
          factor={lineSpacingFactor}
          onChange={handleChange}
        />
      </span>
    </span>
  );
}
