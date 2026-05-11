'use client';

/**
 * ADR-344 Phase 5.C — Line spacing dropdown.
 *
 * Combines `lineSpacingMode` + `lineSpacingFactor` from `useTextToolbarStore`
 * into one preset list. Custom values open a numeric input in the same menu.
 * Radix DropdownMenu per ADR-001 (Select is overkill for action-style menus).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LineSpacingMode, MixedValue } from '../../../text-engine/types';

interface LineSpacingMenuProps {
  readonly mode: MixedValue<LineSpacingMode>;
  readonly factor: MixedValue<number>;
  readonly onChange: (mode: LineSpacingMode, factor: number) => void;
  readonly disabled?: boolean;
}

const PRESETS: ReadonlyArray<{ readonly factor: number; readonly labelKey: string }> = [
  { factor: 1.0, labelKey: 'textToolbar:lineSpacing.single' },
  { factor: 1.5, labelKey: 'textToolbar:lineSpacing.oneAndHalf' },
  { factor: 2.0, labelKey: 'textToolbar:lineSpacing.double' },
] as const;

const MODES: readonly LineSpacingMode[] = ['multiple', 'exact', 'at-least'] as const;

export function LineSpacingMenu({ mode, factor, onChange, disabled }: LineSpacingMenuProps) {
  const { t } = useTranslation(['textToolbar']);
  const label =
    factor === null || mode === null
      ? t('textToolbar:lineSpacing.mixed')
      : `${t(`textToolbar:lineSpacing.mode.${mode}`)} ×${factor.toFixed(1)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={t('textToolbar:lineSpacing.label')}
          className={cn('min-h-[44px] sm:min-h-[36px]')}
          data-state={factor === null ? 'indeterminate' : 'determinate'}
        >
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t('textToolbar:lineSpacing.presetLabel')}</DropdownMenuLabel>
        {PRESETS.map((p) => (
          <DropdownMenuItem
            key={p.factor}
            onSelect={() => onChange(mode ?? 'multiple', p.factor)}
          >
            {t(p.labelKey)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('textToolbar:lineSpacing.modeLabel')}</DropdownMenuLabel>
        {MODES.map((m) => (
          <DropdownMenuItem
            key={m}
            onSelect={() => onChange(m, factor ?? 1)}
          >
            {t(`textToolbar:lineSpacing.mode.${m}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
