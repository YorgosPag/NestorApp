'use client';

/**
 * ADR-507 Φ2 (§5β.6-7 thumbnail + §5γ.5 search) — Hatch pattern picker.
 *
 * Ο Revit «Fill Patterns» / AutoCAD pattern picker: searchable popover με
 * **thumbnail preview** κάθε predefined PAT μοτίβου. Mirror του searchable
 * `FontFamilyCombobox` (cmdk) — το `RibbonCombobox` (Radix Select) δεν έχει search,
 * γι' αυτό χρησιμοποιείται αυτός ο dedicated picker όταν το command έχει
 * `comboboxVariant: 'hatch-pattern'`.
 *
 * **FULL SSoT:**
 *   - options = `command.options` (τα catalog-derived options — ίδια λίστα με το
 *     plain combobox)· value/onChange μέσω του ΥΠΑΡΧΟΝΤΟΣ `useRibbonCommand`
 *     bridge (`patternName` key) → μηδέν νέο store/state.
 *   - thumbnail = `buildHatchPatternThumbnail` (η ΙΔΙΑ `buildPredefinedHatchLines`
 *     γεωμετρία με canvas+DXF), render inline `<svg stroke="currentColor">`
 *     (theme-correct, μηδέν hardcoded χρώμα — N.3).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §5β.6-7, §5γ.5
 * @see ui/text-toolbar/controls/FontFamilyCombobox.tsx (searchable precedent)
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from 'cmdk';
import { Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RibbonCommand, RibbonComboboxOption } from '../../types/ribbon-types';
import { useRibbonDispatch } from '../../context/RibbonCommandContext';
import { useRibbonComboboxState } from '../../context/useRibbonFieldSelectors';
import { buildHatchPatternThumbnail } from '../../../../bim/hatch/hatch-pattern-thumbnail';

const MIXED_PLACEHOLDER = '—';

interface HatchPatternPickerProps {
  command: RibbonCommand;
}

function resolveLabel(option: RibbonComboboxOption, t: (key: string) => string): string {
  return option.isLiteralLabel ? option.labelKey : t(option.labelKey);
}

/** Inline SVG preview ενός μοτίβου — currentColor (theme-correct). */
const PatternThumbnail: React.FC<{ name: string }> = ({ name }) => {
  const thumb = buildHatchPatternThumbnail(name);
  return (
    <svg
      viewBox={`0 0 ${thumb.size} ${thumb.size}`}
      className="h-9 w-9 shrink-0 rounded border border-border/40 bg-background/40 text-foreground"
      aria-hidden="true"
    >
      {thumb.lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="currentColor"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  );
};

export const HatchPatternPicker: React.FC<HatchPatternPickerProps> = ({ command }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onComboboxChange } = useRibbonDispatch();
  const [open, setOpen] = useState(false);

  // ADR-547 Stage 4 — per-key leaf subscription: re-renders only when THIS hatch
  // pattern field's value moves, not on every BIM edit.
  const state = useRibbonComboboxState(command.commandKey);
  const value = state?.value && state.value !== '' ? state.value : null;
  const options = command.options ?? [];
  const selected = value !== null ? options.find((o) => o.value === value) : undefined;
  const ariaLabel = t(command.labelKey);

  return (
    <div className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label" aria-hidden="true">
        {ariaLabel}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            data-command-id={command.id}
            className="min-h-9 min-w-40 justify-start gap-2"
          >
            {selected ? (
              <>
                <PatternThumbnail name={selected.value} />
                <span className="truncate">{resolveLabel(selected, t)}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground">{MIXED_PLACEHOLDER}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0">
          <Command>
            <CommandInput placeholder={t('ribbon.picker.searchPlaceholder')} />
            <CommandList>
              <CommandEmpty>{t('ribbon.picker.empty')}</CommandEmpty>
              {options.map((opt) => {
                const label = resolveLabel(opt, t);
                return (
                  <CommandItem
                    key={opt.value}
                    // Search ανά όνομα (π.χ. "BRICK") ΚΑΙ i18n label.
                    value={`${opt.value} ${label}`}
                    onSelect={() => {
                      onComboboxChange(command.commandKey, opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex items-center gap-3 px-2 py-1.5 cursor-pointer rounded-sm',
                      'data-[selected=true]:bg-accent',
                    )}
                  >
                    <PatternThumbnail name={opt.value} />
                    <span className="flex-1 truncate">{label}</span>
                    {value === opt.value ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
