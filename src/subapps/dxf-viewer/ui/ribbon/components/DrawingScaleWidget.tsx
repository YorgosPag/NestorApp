'use client';

/**
 * ADR-375 Phase B.1 — Drawing Scale Widget.
 *
 * Ribbon widget for setting the BIM annotation scale denominator (e.g. 100 → 1:100).
 * Decoupled from viewport zoom (Revit annotation scale pattern).
 * Reads/writes `useDrawingScaleStore` directly — no bridge action needed.
 *
 * UI: compact trigger showing "1:100" + DropdownMenu with custom input + 6 presets.
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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  normalizeNumericInput,
  validateNumericInput,
} from '../../toolbar/shared/input-validation';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import {
  useDrawingScaleStore,
  DRAWING_SCALE_PRESETS,
  DRAWING_SCALE_MIN,
  DRAWING_SCALE_MAX,
} from '../../../state/drawing-scale-store';
// ADR-364 — Escape Command Bus SSoT (no inline e.key === 'Escape' checks)
import { useEscapeHandler, ESC_PRIORITY } from '../../../systems/escape-bus';

const VALIDATION_OPTIONS = {
  minValue: DRAWING_SCALE_MIN,
  maxValue: DRAWING_SCALE_MAX,
  defaultValue: 100,
};

export const DrawingScaleWidget: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const { getStatusBorder, getFocusBorder } = useBorderTokens();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const drawingScale = useDrawingScaleStore((s) => s.drawingScale);
  const setDrawingScale = useDrawingScaleStore((s) => s.setDrawingScale);

  useEffect(() => {
    if (open) {
      setInputValue(String(drawingScale));
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, drawingScale]);

  const applyScale = useCallback(
    (raw: string) => {
      if (!validateNumericInput(raw, VALIDATION_OPTIONS)) return;
      const value = normalizeNumericInput(raw, VALIDATION_OPTIONS);
      setDrawingScale(value);
      setOpen(false);
    },
    [setDrawingScale],
  );

  const handlePreset = useCallback(
    (preset: number) => {
      setDrawingScale(preset);
      setOpen(false);
    },
    [setDrawingScale],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        applyScale((e.target as HTMLInputElement).value);
      }
    },
    [applyScale],
  );

  // ADR-364 — Escape closes the dropdown via the central bus. `allowWhenEditable`
  // is required because focus lives on the numeric input while the popover is open.
  useEscapeHandler({
    id: 'ribbon/drawing-scale-widget',
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    canHandle: () => open,
    handle: () => { setOpen(false); return true; },
    allowWhenEditable: true,
  });

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.drawingScale.label')}
      </span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t('ribbon.commands.drawingScale.ariaLabel', {
              scale: drawingScale,
            })}
            className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} font-mono rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
          >
            <span>1:{drawingScale}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-28">
          <div className="px-2 py-1.5">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('ribbon.commands.drawingScale.placeholder')}
              aria-label={t('ribbon.commands.drawingScale.inputAriaLabel')}
              className={`w-full ${PANEL_LAYOUT.TYPOGRAPHY.XS} text-center rounded ${PANEL_LAYOUT.SPACING.COMPACT_XS} ${colors.bg.secondary} ${getStatusBorder('muted')} ${colors.text.inverted} ${getFocusBorder('input')} focus:outline-none font-mono`}
            />
          </div>
          <DropdownMenuSeparator />
          {DRAWING_SCALE_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onSelect={() => handlePreset(preset)}
              className={`flex items-center justify-between ${PANEL_LAYOUT.TYPOGRAPHY.XS} cursor-pointer font-mono`}
            >
              <span>1:{preset}</span>
              {drawingScale === preset && <Check className="w-3 h-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
};
