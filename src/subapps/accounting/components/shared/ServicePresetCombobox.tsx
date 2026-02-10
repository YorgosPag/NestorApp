'use client';

/**
 * @fileoverview ServicePresetCombobox — Searchable preset + free-text input
 * @description Input με dropdown λίστα presets. Επιλογή preset → auto-fill πεδίων.
 *              Ελεύθερο κείμενο → μόνο η description αλλάζει.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-011 Service Presets
 * @compliance CLAUDE.md — Radix Popover (ADR-001), zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ServicePreset } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface ServicePresetComboboxProps {
  /** Τρέχουσα τιμή description */
  value: string;
  /** Callback όταν αλλάζει η description (ελεύθερο κείμενο) */
  onDescriptionChange: (description: string) => void;
  /** Callback όταν επιλέγεται preset → auto-fill πολλαπλών πεδίων */
  onPresetSelect: (preset: ServicePreset) => void;
  /** Διαθέσιμα presets */
  presets: ServicePreset[];
  /** Placeholder text */
  placeholder?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServicePresetCombobox({
  value,
  onDescriptionChange,
  onPresetSelect,
  presets,
  placeholder,
}: ServicePresetComboboxProps) {
  const { t } = useTranslation('accounting');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter presets based on current input value
  const filtered = useMemo(() => {
    if (!value.trim()) return presets;
    const lower = value.toLowerCase();
    return presets.filter((p) => p.description.toLowerCase().includes(lower));
  }, [value, presets]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filtered.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onDescriptionChange(e.target.value);
      if (!open && presets.length > 0) {
        setOpen(true);
      }
    },
    [onDescriptionChange, open, presets.length],
  );

  const handleSelect = useCallback(
    (preset: ServicePreset) => {
      onPresetSelect(preset);
      setOpen(false);
      setHighlightedIndex(-1);
    },
    [onPresetSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || filtered.length === 0) {
        // Open dropdown on arrow down when closed
        if (e.key === 'ArrowDown' && presets.length > 0) {
          e.preventDefault();
          setOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1,
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
            handleSelect(filtered[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [open, filtered, highlightedIndex, handleSelect, presets.length],
  );

  const handleFocus = useCallback(() => {
    if (presets.length > 0) {
      setOpen(true);
    }
  }, [presets.length]);

  // Don't render dropdown if no presets
  if (presets.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder={placeholder ?? t('forms.lineDescription')}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <fieldset className="relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder ?? t('forms.lineDescription')}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            autoComplete="off"
          />
          <ChevronDown
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none transition-transform',
              open && 'rotate-180',
            )}
          />
        </fieldset>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1 max-h-60 overflow-y-auto"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {filtered.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">
            {t('servicePresets.noResults')}
          </p>
        ) : (
          <ul ref={listRef} role="listbox" className="space-y-0.5">
            {filtered.map((preset, index) => (
              <li
                key={preset.presetId}
                role="option"
                aria-selected={highlightedIndex === index}
                className={cn(
                  'flex flex-col gap-0.5 rounded-md px-2 py-1.5 cursor-pointer text-sm',
                  highlightedIndex === index
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50',
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(preset);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="font-medium">{preset.description}</span>
                <span className="text-xs text-muted-foreground">
                  {preset.unit} · {preset.unitPrice > 0 ? `${preset.unitPrice}€` : t('servicePresets.variablePrice')} · {t('common.vatRates.standard').includes(String(preset.vatRate)) ? `${preset.vatRate}%` : `${preset.vatRate}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
