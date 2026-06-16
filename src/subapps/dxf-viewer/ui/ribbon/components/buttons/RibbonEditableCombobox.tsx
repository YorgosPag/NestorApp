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
          aria-label={ariaLabel}
          data-command-id={command.id}
        />
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
                  {opt.labelKey}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
    </div>
  );
};
