'use client';

/**
 * StatusBarXLineModeSlot — XLine construction mode indicator for the status bar.
 *
 * Renders when activeTool === 'xline'.
 * Click opens a Radix Popover with 6 mode options.
 * Sub-info: Angle shows `(27°)`, Offset shows `(d=1.20m)`.
 *
 * ADR-359 Phase 2. SSoT: XLineModeStore.
 */

import React, { useCallback, useSyncExternalStore } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  getXLineModeState,
  setMode,
  subscribe,
  type XLineMode,
} from '../../systems/tools/xline-mode-store';
import type { ToolType } from '../toolbar/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatusBarXLineModeSlotProps {
  activeTool: ToolType;
  className?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_MODES: ReadonlyArray<XLineMode> = [
  'through', 'horizontal', 'vertical', 'angle', 'bisect', 'offset',
];

/** Keyboard shortcut for each mode (BricsCAD pattern) */
const MODE_SHORTCUT: Record<XLineMode, string> = {
  through:    'T',
  horizontal: 'H',
  vertical:   'V',
  angle:      'A',
  bisect:     'B',
  offset:     'O',
};

/** Whether the mode requires parameters (shown as `…` suffix in context menu) */
const MODE_REQUIRES_PARAMS: Record<XLineMode, boolean> = {
  through:    false,
  horizontal: false,
  vertical:   false,
  angle:      true,
  bisect:     true,
  offset:     true,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function StatusBarXLineModeSlot({ activeTool, className }: StatusBarXLineModeSlotProps) {
  const { t } = useTranslation(['dxf-viewer']);
  const modeState = useSyncExternalStore(subscribe, getXLineModeState, getXLineModeState);

  const handleSelect = useCallback((mode: XLineMode) => {
    setMode(mode);
  }, []);

  if (activeTool !== 'xline') return null;

  const modeLabel = t(`tools.xline.modes.${modeState.mode}`);
  const prefix = t('tools.xline.statusBarPrefix');

  let subInfo: string | null = null;
  if (modeState.mode === 'angle' && modeState.angleValue !== null) {
    subInfo = `(${modeState.angleValue}°)`;
  } else if (modeState.mode === 'offset' && modeState.offsetDistance !== null) {
    subInfo = `(d=${modeState.offsetDistance.toFixed(2)}m)`;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1 rounded px-2 py-1 text-xs',
            'hover:bg-white/10 transition-colors cursor-pointer select-none',
            'text-muted-foreground hover:text-foreground',
            className,
          )}
        >
          <span className="opacity-70">{prefix}</span>
          <span className="font-medium text-foreground">{modeLabel}</span>
          {subInfo && <span className="opacity-60">{subInfo}</span>}
          <ChevronDown size={12} className="opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent side="top" align="start" className="w-44 p-1">
        {ALL_MODES.map((mode) => {
          const label = t(`tools.xline.modes.${mode}`);
          const isActive = modeState.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleSelect(mode)}
              className={cn(
                'flex w-full items-center justify-between rounded px-3 py-1.5 text-sm',
                'transition-colors cursor-pointer',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'hover:bg-accent/60',
              )}
            >
              <span>
                {label}
                {MODE_REQUIRES_PARAMS[mode] && <span className="opacity-50">…</span>}
              </span>
              <span className="text-xs opacity-40 font-mono">{MODE_SHORTCUT[mode]}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
