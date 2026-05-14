'use client';

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
import { MOVEMENT_DETECTION } from '../../config/tolerance-config';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n';

const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200, 400] as const;
const VALIDATION_OPTIONS = { minValue: 1, maxValue: 99999, defaultValue: 100 };

interface ZoomControlsProps {
  currentZoom: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onSetZoom: (zoom: number) => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({ currentZoom, onSetZoom }) => {
  const { t } = useTranslation(['dxf-viewer-shell']);
  const colors = useSemanticColors();
  const { getStatusBorder, getFocusBorder } = useBorderTokens();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const currentPct = Math.round(currentZoom * 100);

  useEffect(() => {
    if (open) {
      setInputValue(currentPct.toString());
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, currentPct]);

  const applyZoom = useCallback((raw: string) => {
    if (!validateNumericInput(raw, VALIDATION_OPTIONS)) return;
    const pct = normalizeNumericInput(raw, VALIDATION_OPTIONS);
    const decimal = pct / 100;
    if (Math.abs(decimal - currentZoom) > MOVEMENT_DETECTION.ZOOM_CHANGE) {
      onSetZoom(decimal);
    }
    setOpen(false);
  }, [currentZoom, onSetZoom]);

  const handlePreset = useCallback((pct: number) => {
    const decimal = pct / 100;
    if (Math.abs(decimal - currentZoom) > MOVEMENT_DETECTION.ZOOM_CHANGE) {
      onSetZoom(decimal);
    }
    setOpen(false);
  }, [currentZoom, onSetZoom]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      applyZoom((e.target as HTMLInputElement).value);
    }
    if (e.key === 'Escape') setOpen(false);
  }, [applyZoom]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t('zoomControls.badgeAriaLabel', { percentage: currentPct })}
          className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} font-mono rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
        >
          <span>{currentPct}%</span>
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
            placeholder={t('zoomControls.customInputPlaceholder')}
            className={`w-full ${PANEL_LAYOUT.TYPOGRAPHY.XS} text-center rounded ${PANEL_LAYOUT.SPACING.COMPACT_XS} ${colors.bg.secondary} ${getStatusBorder('muted')} ${colors.text.inverted} ${getFocusBorder('input')} focus:outline-none font-mono`}
          />
        </div>
        <DropdownMenuSeparator />
        {ZOOM_PRESETS.map(pct => (
          <DropdownMenuItem
            key={pct}
            onSelect={() => handlePreset(pct)}
            className={`flex items-center justify-between ${PANEL_LAYOUT.TYPOGRAPHY.XS} cursor-pointer font-mono`}
          >
            <span>{pct}%</span>
            {currentPct === pct && <Check className="w-3 h-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
