/**
 * ADR-358 §G7 Phase 6.5 — AutoCAD-style pillola toggle between ByLayer
 * (sentinel inheritance) and Concrete (explicit value).
 *
 * Shared across colour and lineweight resolution modes in the drawing-tool
 * preview settings. Extracted from `LineSettingsSections.tsx` to keep that
 * file under the 500-LOC Google SRP ceiling.
 */

'use client';

import React from 'react';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import type { LineSettingsState } from './useLineSettingsState';

export type ByLayerToggleProps = {
  mode: 'ByLayer' | 'Concrete';
  onChange: (mode: 'ByLayer' | 'Concrete') => void;
  colors: LineSettingsState['colors'];
  borderTokens: LineSettingsState['borderTokens'];
  tByLayer: string;
  tConcrete: string;
};

export function ByLayerToggle({ mode, onChange, colors, borderTokens, tByLayer, tConcrete }: ByLayerToggleProps) {
  const { radius } = borderTokens;
  const baseBtn = `${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.SPACING.SM} ${radius.md} ${PANEL_LAYOUT.CURSOR.POINTER}`;
  const activeCls = `${colors.bg.accent} ${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`;
  const inactiveCls = `${colors.bg.secondary} ${colors.text.muted}`;
  return (
    <div
      role="radiogroup"
      aria-label={tByLayer}
      className={`inline-flex ${PANEL_LAYOUT.GAP.XS} ${colors.bg.secondary} ${radius.md} ${PANEL_LAYOUT.SPACING.XS}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'ByLayer'}
        onClick={() => onChange('ByLayer')}
        className={`${baseBtn} ${mode === 'ByLayer' ? activeCls : inactiveCls}`}
      >
        {tByLayer}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'Concrete'}
        onClick={() => onChange('Concrete')}
        className={`${baseBtn} ${mode === 'Concrete' ? activeCls : inactiveCls}`}
      >
        {tConcrete}
      </button>
    </div>
  );
}
