'use client';

/**
 * ADR-345 §4.5 Fase 5.5 — Combobox button.
 *
 * Variable-width dropdown around Radix Select (`@/components/ui/select`,
 * canonical per ADR-001 — NEVER EnterpriseComboBox). Used for font
 * family / size, line spacing, layer selector, annotation scale.
 *
 * Options resolution (priority):
 *   1) `getComboboxState(commandKey).options` from the bridge (dynamic:
 *      fonts, layers, scales).
 *   2) `command.options` static list on the data declaration (e.g. line
 *      spacing presets).
 *
 * Value resolution:
 *   - `getComboboxState(commandKey).value` — `null` means mixed and
 *     renders an em-dash placeholder.
 *
 * Width: `command.comboboxWidthPx` (default 140) is applied as the
 * `--ribbon-combobox-width` CSS variable via `setProperty` to satisfy
 * the no-inline-style rule (CLAUDE.md SOS N.3).
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type {
  RibbonCommand,
  RibbonComboboxOption,
} from '../../types/ribbon-types';
import { useRibbonCommand } from '../../context/RibbonCommandContext';

const DEFAULT_WIDTH_PX = 140;
const MIXED_PLACEHOLDER = '—';

interface RibbonComboboxProps {
  command: RibbonCommand;
}

function resolveLabel(
  option: RibbonComboboxOption,
  t: (key: string) => string,
): string {
  if (option.isLiteralLabel) return option.labelKey;
  return t(option.labelKey);
}

export const RibbonCombobox: React.FC<RibbonComboboxProps> = ({ command }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const {
    onComboboxChange,
    onComingSoon,
    getComboboxState,
  } = useRibbonCommand();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const widthPx = command.comboboxWidthPx ?? DEFAULT_WIDTH_PX;

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    el.style.setProperty('--ribbon-combobox-width', `${widthPx}px`);
  }, [widthPx]);

  const dynamicState = getComboboxState(command.commandKey);
  const options: readonly RibbonComboboxOption[] =
    dynamicState?.options ?? command.options ?? [];
  const value = dynamicState?.value ?? null;
  const isMixed = value === null;

  const ariaLabel = t(command.labelKey);

  const handleValueChange = useCallback(
    (next: string) => {
      if (command.comingSoon) {
        onComingSoon(ariaLabel);
        return;
      }
      onComboboxChange(command.commandKey, next);
    },
    [onComboboxChange, onComingSoon, command.commandKey, command.comingSoon, ariaLabel],
  );

  return (
    <Select
      value={value ?? undefined}
      onValueChange={handleValueChange}
      disabled={command.comingSoon}
    >
      <SelectTrigger
        ref={triggerRef}
        size="sm"
        aria-label={ariaLabel}
        className="dxf-ribbon-combobox-trigger"
        data-command-id={command.id}
        data-mixed={isMixed ? 'true' : undefined}
        data-coming-soon={command.comingSoon ? 'true' : undefined}
      >
        <SelectValue placeholder={isMixed ? MIXED_PLACEHOLDER : ariaLabel} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {resolveLabel(opt, t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
