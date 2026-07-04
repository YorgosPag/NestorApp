'use client';

/**
 * StatusBarEditableCombobox — shared type-to-enter numeric combobox for the CAD status bar.
 *
 * SSoT UI for the "preset dropdown + free typing" numeric field shared by the SNAP
 * step (mm) and the POLAR increment angle (°). Both menus render THIS control, so the
 * type-to-enter behaviour, keystroke filtering, and range/commit policy live in one
 * place (Giorgio 2026-07-04: «το Snap να πάρει το μενού του Polar»).
 *
 * The filter/commit numeric logic is REUSED from the ribbon editable-combobox SSoT
 * (`ribbon-combobox-numeric.ts`) — NOT re-implemented here (ADR-345 §4.5).
 *
 * Commit policy (Revit): typing stays local; Enter / blur / preset-pick commit.
 * A preset whose label is non-numeric (e.g. «Ελεύθερο» = 0) hides the unit suffix.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  filterNumericDraft,
  commitNumericDraft,
  parseOptionNumber,
  type ResolvedNumericConfig,
} from '../ui/ribbon/components/buttons/ribbon-combobox-numeric';

export interface StatusBarComboboxPreset {
  /** Committed numeric value the preset applies. */
  readonly value: number;
  /** Dropdown label. Non-numeric labels (e.g. «Ελεύθερο») suppress the unit suffix. */
  readonly label: string;
}

interface StatusBarEditableComboboxProps {
  readonly id: string;
  /** Current committed value (drives the field; external changes re-sync while unfocused). */
  readonly value: number;
  /** Called with the parsed number on Enter / blur / preset-pick when it changes. */
  readonly onCommit: (value: number) => void;
  /** Preset options shown in the dropdown. */
  readonly presets: readonly StatusBarComboboxPreset[];
  readonly ariaLabel: string;
  /** Allow a decimal point while typing (e.g. 22.5°). Default true. */
  readonly allowDecimal?: boolean;
  readonly min?: number;
  readonly max?: number;
  /** Trailing unit label (e.g. "mm", "°") — shown only when the field reads numeric. */
  readonly unitSuffix?: string;
  /** Tailwind width class (default "w-24"). */
  readonly widthClass?: string;
}

/** A field text is "numeric" when it parses to a finite number (hides suffix on «Ελεύθερο»). */
function isNumericText(text: string): boolean {
  return parseOptionNumber(text) !== null;
}

export function StatusBarEditableCombobox({
  id,
  value,
  onCommit,
  presets,
  ariaLabel,
  allowDecimal = true,
  min,
  max,
  unitSuffix,
  widthClass = 'w-24',
}: StatusBarEditableComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  const config: ResolvedNumericConfig = { allowNegative: false, allowDecimal, min, max };

  const matchingPreset = presets.find((p) => p.value === value);
  const displayText = focused ? draft : (matchingPreset?.label ?? String(value));
  const showSuffix = Boolean(unitSuffix) && isNumericText(displayText);

  const onFocus = useCallback(() => {
    setFocused(true);
    setDraft(String(value));
    // Defer select so the value is populated before selection.
    requestAnimationFrame(() => inputRef.current?.select());
  }, [value]);

  const commit = useCallback(
    (raw: string) => {
      setFocused(false);
      const next = commitNumericDraft(raw, config);
      if (next === null) return; // invalid / out-of-range → revert to external value
      const n = Number(next);
      if (n !== value) onCommit(n);
    },
    [config, value, onCommit],
  );

  const selectPreset = useCallback(
    (preset: StatusBarComboboxPreset) => {
      setFocused(false);
      if (preset.value !== value) onCommit(preset.value);
    },
    [value, onCommit],
  );

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur(); // → onBlur commits
    }
  }, []);

  const padding = unitSuffix ? 'pl-2 pr-12' : 'pl-2 pr-6';
  const preventBlur = (e: React.MouseEvent): void => e.preventDefault();

  return (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={displayText}
        onFocus={onFocus}
        onChange={(e) => setDraft(filterNumericDraft(e.target.value, config))}
        onBlur={() => commit(draft)}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
        className={`h-6 ${widthClass} text-xs ${padding} rounded border border-border bg-background`}
      />
      {showSuffix && (
        <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          {unitSuffix}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label={ariaLabel}
            onMouseDown={preventBlur}
            className="absolute right-0.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <span aria-hidden="true">▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[1800] min-w-[5rem]">
          {presets.map((preset) => (
            <DropdownMenuItem
              key={preset.value}
              onSelect={() => selectPreset(preset)}
              className="text-xs"
            >
              {isNumericText(preset.label) && unitSuffix
                ? `${preset.label} ${unitSuffix}`
                : preset.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
