'use client';

/**
 * CurrentLayerPicker — ADR-358 §5.5.bis Q8 Phase 7.
 *
 * Single component with two visual variants (`status-bar`, `ribbon`),
 * both backed by the same `useCurrentLayerPickerState` SSoT hook. The
 * trigger reflects `LayerStore.currentLayerId`; the popover content
 * (search + recent + grouped + actions) lives in
 * `CurrentLayerPickerPopover.tsx`.
 *
 * Mount sites are restricted to the ratchet allowlist
 * (`statusbar/CadStatusBar.tsx`, `ui/ribbon/components/RibbonPanel.tsx`).
 */

import * as React from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCurrentLayerPickerState } from './useCurrentLayerPickerState';
import { CurrentLayerPickerPopover } from './CurrentLayerPickerPopover';

export type CurrentLayerPickerVariant = 'status-bar' | 'ribbon';

export interface CurrentLayerPickerProps {
  readonly variant: CurrentLayerPickerVariant;
  readonly className?: string;
}

export function CurrentLayerPicker({
  variant,
  className,
}: CurrentLayerPickerProps): React.ReactElement {
  const { state, actions } = useCurrentLayerPickerState();
  const { t } = useTranslation('dxf-viewer-shell');

  const triggerClass = variant === 'status-bar' ? STATUS_BAR_TRIGGER : RIBBON_TRIGGER;
  const labelClass = variant === 'status-bar' ? STATUS_BAR_LABEL : RIBBON_LABEL;
  const baseSwatchClass = variant === 'status-bar' ? STATUS_BAR_SWATCH : RIBBON_SWATCH;
  const pulseClass =
    variant === 'status-bar' && state.pulseToken > 0 ? ' layer-picker-pulse' : '';
  const swatchKey =
    state.pulseToken > 0 ? `swatch-${state.pulseToken}` : 'swatch-init';
  const tooltipLabel = state.currentLayer
    ? t('layerPicker.tooltipCurrent', { name: state.currentLayer.name })
    : t('layerPicker.tooltipEmpty');

  return (
    <Popover open={state.isOpen} onOpenChange={actions.setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid={`current-layer-picker-trigger-${variant}`}
              aria-label={tooltipLabel}
              disabled={!state.isReady}
              className={`${triggerClass} ${className ?? ''}`.trim()}
            >
              <span
                key={swatchKey}
                className={`${baseSwatchClass}${pulseClass}`}
                style={{ backgroundColor: state.currentLayer?.color ?? '#888888' }}
                aria-hidden
              />
              <span className={labelClass}>
                {state.currentLayer?.name ?? t('layerPicker.placeholder')}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              {variant === 'ribbon' && (
                <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side={variant === 'status-bar' ? 'top' : 'bottom'}>
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side={variant === 'status-bar' ? 'top' : 'bottom'}
        align="start"
        sideOffset={6}
        className={POPOVER_CONTENT_CLASS}
      >
        <CurrentLayerPickerPopover state={state} actions={actions} />
      </PopoverContent>
    </Popover>
  );
}

const STATUS_BAR_TRIGGER =
  'flex items-center gap-1.5 h-6 max-w-[180px] min-w-[120px] px-2 rounded ' +
  'border border-border bg-background/80 text-xs leading-none ' +
  'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed';

const RIBBON_TRIGGER =
  'flex items-center gap-2 h-9 w-[220px] px-3 rounded ' +
  'border border-border bg-background text-sm leading-none ' +
  'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed';

const STATUS_BAR_LABEL = 'truncate flex-1 text-left font-medium';
const RIBBON_LABEL = 'truncate flex-1 text-left font-semibold';

const STATUS_BAR_SWATCH =
  'h-3 w-3 shrink-0 rounded-[2px] border border-border';
const RIBBON_SWATCH = 'h-4 w-4 shrink-0 rounded-sm border border-border';

const POPOVER_CONTENT_CLASS = 'z-[1800] w-[320px] p-0';
