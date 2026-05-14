'use client';

/**
 * ADR-345 Fase 6 — Line spacing widget for the Text Editor contextual tab.
 *
 * Leaf component: reads/writes `lineSpacingMode` + `lineSpacingFactor`
 * directly from `useTextToolbarStore` (ADR-040 compliant micro-leaf).
 * Reuses the existing `LineSpacingMenu` control with all 6 modes
 * (single / 1.5x / double / multiple / exact / at-least) — SSoT.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useTextToolbarStore } from '../../../state/text-toolbar';
import { LineSpacingMenu } from '../../text-toolbar/controls/LineSpacingMenu';
import type { LineSpacingMode } from '../../../text-engine/types';

export function RibbonLineSpacingWidget() {
  const { t } = useTranslation('dxf-viewer-shell');
  const lineSpacingMode = useTextToolbarStore((s) => s.lineSpacingMode);
  const lineSpacingFactor = useTextToolbarStore((s) => s.lineSpacingFactor);
  const setMany = useTextToolbarStore((s) => s.setMany);

  const handleChange = useCallback(
    (mode: LineSpacingMode, factor: number) =>
      setMany({ lineSpacingMode: mode, lineSpacingFactor: factor }),
    [setMany],
  );

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
