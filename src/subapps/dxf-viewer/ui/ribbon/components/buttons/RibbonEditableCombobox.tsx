'use client';

/**
 * ADR-345 §4.5 — Editable numeric combobox (Revit-grade type-to-enter).
 *
 * Rendered by `RibbonCombobox` in place of the plain Radix Select whenever the
 * field's option list is numeric (`resolveNumericConfig` ≠ null). Mirrors the
 * established `RibbonWallDimensionWidget` pattern (input + preset dropdown +
 * Enter/Esc/blur commit) but is GENERIC: it mutates through the same
 * `onComboboxChange(commandKey, value)` SSoT path, so EVERY numeric combobox in
 * EVERY contextual tab (foundation, column, beam, wall, MEP…) becomes editable
 * with zero per-domain wiring.
 *
 * Commit policy (Revit): typing stays local; Enter / blur / preset-pick commit.
 * Esc reverts to the external value. The minus key is accepted only when the field
 * allows it (`config.allowNegative` — e.g. top-elevation, offsets), so dimension
 * fields can never be typed negative.
 *
 * @see ./ribbon-combobox-numeric.ts — pure detect/resolve/filter/commit helpers
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useEscapeHandler, ESC_PRIORITY } from '../../../../systems/escape-bus';
import type {
  RibbonCommand,
  RibbonComboboxOption,
} from '../../types/ribbon-types';
import {
  filterNumericDraft,
  commitNumericDraft,
  parseOptionNumber,
  type ResolvedNumericConfig,
} from './ribbon-combobox-numeric';

const MIXED_PLACEHOLDER = '—';

interface RibbonEditableComboboxProps {
  command: RibbonCommand;
  /** Preset options (numeric literals) shown in the dropdown. */
  options: readonly RibbonComboboxOption[];
  /** Current committed value (`null` = mixed selection). */
  value: string | null;
  disabled: boolean;
  config: ResolvedNumericConfig;
  ariaLabel: string;
  widthPx: number;
  /**
   * ADR-677 Φάση 2γ — trailing unit symbol (e.g. «m», «cm»), or `undefined` for a field that
   * carries no unit (counts, DN sizes). Resolved by the caller — this control never asks what
   * unit is active, it only renders what it is handed.
   */
  unitSuffix?: string;
  /** Same handler as the Select path — `onComboboxChange(commandKey, value)`. */
  onCommit: (value: string) => void;
}

export const RibbonEditableCombobox: React.FC<RibbonEditableComboboxProps> = ({
  command,
  options,
  value,
  disabled,
  config,
  ariaLabel,
  widthPx,
  unitSuffix,
  onCommit,
}) => {
  const colors = useSemanticColors();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef<boolean>(false);

  const external = value ?? '';
  const [draft, setDraft] = useState<string>(external);

  // Sync draft to external value (selection change / grip-drag) — NEVER while
  // editing, or a live scene re-render would clobber the in-flight draft.
  useEffect(() => {
    if (!focusedRef.current) setDraft(external);
  }, [external]);

  // No-inline-style rule (SOS N.3): width via CSS variable on the input.
  useEffect(() => {
    const el = inputRef.current;
    if (el) el.style.setProperty('--ribbon-combobox-width', `${widthPx}px`);
  }, [widthPx]);

  const commit = useCallback(
    (raw: string) => {
      const next = commitNumericDraft(raw, config);
      if (next === null) {
        setDraft(external); // invalid / out-of-range → revert, no dispatch
        return;
      }
      setDraft(next);
      if (next !== external) onCommit(next);
    },
    [config, external, onCommit],
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDraft(filterNumericDraft(e.target.value, config));
    },
    [config],
  );

  const onBlur = useCallback(() => {
    focusedRef.current = false;
    commit(draft);
  }, [commit, draft]);

  const selectPreset = useCallback(
    (preset: string) => {
      setDraft(preset);
      if (preset !== external) onCommit(preset);
    },
    [external, onCommit],
  );

  // ESC reverts draft + blurs (escape-bus SSoT — owns ESC while focused).
  useEscapeHandler({
    id: `ribbon-combobox-${command.id}`,
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    allowWhenEditable: true,
    canHandle: () => focusedRef.current,
    handle: () => {
      setDraft(external);
      inputRef.current?.blur();
      return true;
    },
  });

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur(); // → onBlur commits
    }
  }, []);

  const inputBg = colors.bg.primary;
  const isMixed = value === null && draft === '';
  // The symbol annotates a number; on the mixed em-dash (or a half-typed «-») it would annotate
  // nothing. Same rule as the status-bar combobox, where «Ελεύθερο» hides the suffix.
  const showUnit = unitSuffix !== undefined && parseOptionNumber(draft) !== null;
  // The visible «(mm)» left the labels the moment the fields started showing metres, so the
  // accessible name must carry the unit instead — otherwise a screen-reader user hears a bare
  // «0.9» with no way to know what it means. Punctuation + a physical symbol, not translatable
  // text (N.11).
  const fieldAriaLabel = unitSuffix === undefined ? ariaLabel : `${ariaLabel} (${unitSuffix})`;
  // Keep input focus when the preset trigger is pressed (no blur-commit race).
  const preventBlur = (e: React.MouseEvent): void => e.preventDefault();

  return (
    <div className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label" aria-hidden="true">
        {ariaLabel}
      </span>
      <span
        className="dxf-ribbon-editable-combobox"
        data-mixed={isMixed ? 'true' : undefined}
      >
        {/* The unit rides INSIDE the field (Revit «900.0 mm»), so it stays attached to the
            number when several comboboxes sit side by side in one ribbon row. */}
        <span
          className="dxf-ribbon-editable-combobox-field"
          data-unit={showUnit ? 'true' : undefined}
        >
          <input
            ref={inputRef}
            className={cn('dxf-ribbon-editable-combobox-input', inputBg)}
            type="text"
            inputMode={config.allowDecimal ? 'decimal' : 'numeric'}
            autoComplete="off"
            disabled={disabled}
            value={draft}
            placeholder={MIXED_PLACEHOLDER}
            onChange={onChange}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            aria-label={fieldAriaLabel}
            data-command-id={command.id}
          />
          {showUnit && (
            // Presentational only — the unit reaches assistive tech through `fieldAriaLabel`,
            // so reading this span too would say «Πλάτος (m) 0.9 m».
            <span className="dxf-ribbon-editable-combobox-unit" aria-hidden="true">
              {unitSuffix}
            </span>
          )}
        </span>
        {options.length > 0 && !disabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                tabIndex={-1}
                className={cn('dxf-ribbon-editable-combobox-trigger', inputBg)}
                aria-label={ariaLabel}
                onMouseDown={preventBlur}
              >
                <span aria-hidden="true">▾</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {options.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => selectPreset(opt.value)}
                >
                  {unitSuffix !== undefined && parseOptionNumber(opt.labelKey) !== null
                    ? `${opt.labelKey} ${unitSuffix}`
                    : opt.labelKey}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
    </div>
  );
};
