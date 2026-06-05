'use client';

/**
 * 🏢 ADR-418 — ribbon view-scale (1:N) control.
 *
 * Shows the real current drawing scale (e.g. "1:69") and lets the user pick a
 * scale ratio preset (1:1 … 1:500) or type a custom denominator N. Distinct
 * from the annotation `DrawingScaleWidget` (ADR-375): this drives the viewport
 * zoom, not the plot scale.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { normalizeNumericInput, validateNumericInput } from './shared/input-validation';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n';
// 🏢 ADR-418: view-scale presets + formatting SSoT
import {
  VIEW_SCALE_MENU_PRESETS,
  isViewRatioActive,
  formatViewScale,
} from '../../utils/view-scale';

const VALIDATION_OPTIONS = { minValue: 1, maxValue: 99999, defaultValue: 100 };

interface ZoomControlsProps {
  /** Current view-scale denominator N (1:N). */
  currentRatioN: number;
  /** Apply a target drawing-scale ratio 1:N. */
  onSetRatio: (ratioN: number) => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({ currentRatioN, onSetRatio }) => {
  const { t } = useTranslation(['dxf-viewer-shell']);
  const colors = useSemanticColors();
  const { getStatusBorder, getFocusBorder } = useBorderTokens();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const roundedN = Number.isFinite(currentRatioN) ? Math.round(currentRatioN) : 0;
  const label = formatViewScale(currentRatioN);

  useEffect(() => {
    if (open) {
      setInputValue(roundedN > 0 ? roundedN.toString() : '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, roundedN]);

  const applyRatio = useCallback((raw: string) => {
    if (!validateNumericInput(raw, VALIDATION_OPTIONS)) return;
    const ratioN = normalizeNumericInput(raw, VALIDATION_OPTIONS);
    onSetRatio(ratioN);
    setOpen(false);
  }, [onSetRatio]);

  const handlePreset = useCallback((ratioN: number) => {
    onSetRatio(ratioN);
    setOpen(false);
  }, [onSetRatio]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      applyRatio((e.target as HTMLInputElement).value);
    }
    if (e.key === 'Escape') setOpen(false);
  }, [applyRatio]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t('zoomControls.viewScaleAriaLabel', { ratio: label })}
          className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} font-mono rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
        >
          <span>{label}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-28">
        <div className="px-2 py-1.5">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('zoomControls.viewScaleInputPlaceholder')}
            className={`w-full ${PANEL_LAYOUT.TYPOGRAPHY.XS} text-center rounded ${PANEL_LAYOUT.SPACING.COMPACT_XS} ${colors.bg.secondary} ${getStatusBorder('muted')} ${colors.text.inverted} ${getFocusBorder('input')} focus:outline-none font-mono`}
          />
        </div>
        <DropdownMenuSeparator />
        {VIEW_SCALE_MENU_PRESETS.map(presetN => (
          <DropdownMenuItem
            key={presetN}
            onSelect={() => handlePreset(presetN)}
            className={`flex items-center justify-between ${PANEL_LAYOUT.TYPOGRAPHY.XS} cursor-pointer font-mono`}
          >
            <span>{`1:${presetN}`}</span>
            {isViewRatioActive(currentRatioN, presetN) && <Check className="w-3 h-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
