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

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useRibbonDispatch } from '../../context/RibbonCommandContext';
import { useRibbonComboboxState } from '../../context/useRibbonFieldSelectors';
import { RibbonEditableCombobox } from './RibbonEditableCombobox';
import { HatchPatternPicker } from './HatchPatternPicker';
import { RibbonDxfColorPickerWidget } from './RibbonDxfColorPickerWidget';
import { RibbonComboboxThumbnail } from './RibbonComboboxThumbnail';
import { resolveNumericConfig } from './ribbon-combobox-numeric';
// ADR-677 Φάση 2β — the display-unit boundary (mm ↔ user unit) for numeric comboboxes.
import {
  optionsToDisplayUnit,
  valueToDisplayUnit,
  valueFromDisplayUnit,
  boundsToDisplayUnit,
  isSameCommittedValue,
} from '../../units/ribbon-display-unit';

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

/**
 * Dispatcher: delegates to a specialised control when `comboboxVariant` is set
 * (ADR-507 Φ2), else renders the standard Select / editable-numeric combobox.
 * Hook-free wrapper → keeps rules-of-hooks satisfied for both branches.
 */
// ADR-547 Stage 4 Option B — memoized on the (static) `command`. Combined with the
// per-key `RibbonFieldStore` subscription inside `RibbonComboboxDefault` + the
// stable dispatch context, editing ANOTHER field no longer re-renders this combobox.
const RibbonComboboxInner: React.FC<RibbonComboboxProps> = ({ command }) => {
  if (command.comboboxVariant === 'hatch-pattern') {
    return <HatchPatternPicker command={command} />;
  }
  if (command.comboboxVariant === 'dxf-color') {
    return <RibbonDxfColorPickerWidget command={command} />;
  }
  return <RibbonComboboxDefault command={command} />;
};

export const RibbonCombobox = React.memo(RibbonComboboxInner);

const RibbonComboboxDefault: React.FC<RibbonComboboxProps> = ({ command }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  // ADR-547 Stage 4 Option B — writers from the STABLE dispatch context; the
  // reactive VALUE from a per-key `RibbonFieldStore` subscription. Editing another
  // field never re-renders this widget.
  const { onComboboxChange, onComingSoon } = useRibbonDispatch();
  const dynamicState = useRibbonComboboxState(command.commandKey);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const widthPx = command.comboboxWidthPx ?? DEFAULT_WIDTH_PX;
  // ADR-547 Stage 4 (Option A follow-up) — lazy option list. Mounting a wall/
  // column contextual panel mounted 7 Radix Selects × ~11 options ≈ 76 SelectItems
  // eagerly (profile 12:13 commit#8 = 122ms ribbon self-time, the dominant cost
  // AFTER the tool-button memo win). We keep ONLY the currently-selected item
  // mounted while closed — so `<SelectValue>`, value sync, keyboard and a11y stay
  // intact — and render the full option list only when the dropdown is open.
  // Controlled `open` (not just observed) renders the items in the SAME commit the
  // popup opens → no one-frame flash of a single item.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    el.style.setProperty('--ribbon-combobox-width', `${widthPx}px`);
  }, [widthPx]);

  // ADR-677 Φάση 2β — THE display-unit boundary. Everything below this line speaks the
  // user's unit; everything above it (presets in `data/`, the bridge, the store) stays
  // canonical-mm. Applied here, ABOVE the editable/Select branch, so a `editable:false`
  // numeric field (e.g. roof) is re-expressed just like a typed one. Non-`model-length`
  // fields — counts, degrees, DN sizes, paper mm — pass through untouched.
  const quantityKind = command.numericInput?.quantityKind;
  const dynamicOpts = dynamicState?.options;
  const authoredOptions: readonly RibbonComboboxOption[] =
    (dynamicOpts && dynamicOpts.length > 0 ? dynamicOpts : null) ?? command.options ?? [];
  const baseOptions = optionsToDisplayUnit(authoredOptions, quantityKind);
  // Treat an empty-string value like "no selection" (null): Radix Select forbids a
  // SelectItem with value="" (see select.tsx guard), so an empty value must never be
  // injected as an option below. A bridge that returns '' for an unset/unclassified
  // field (e.g. a pipe with no classification) therefore shows the placeholder, not
  // a crash. SSoT render guard — covers every contextual combobox.
  const rawValue = dynamicState?.value ?? null;
  const storedValue = rawValue === '' ? null : rawValue;
  const value = valueToDisplayUnit(storedValue, quantityKind);
  const isMixed = value === null;
  // Inject current value as first option if not already present — ensures
  // free-form values (e.g. height=500) are always visible, not replaced by '—'.
  const valueInOptions = value === null || baseOptions.some((o) => o.value === value);
  const options: readonly RibbonComboboxOption[] = valueInOptions
    ? baseOptions
    : [{ value, labelKey: value, isLiteralLabel: true as const }, ...baseOptions];

  const ariaLabel = t(command.labelKey);
  // ADR-410 — when the selected option carries a preview thumbnail, render it in
  // the (collapsed) trigger too, and let the trigger grow to fit it.
  const selectedOption = value !== null ? options.find((o) => o.value === value) : undefined;
  const selectedImageUrl = selectedOption?.imageUrl;
  // ADR-562 Φ8 — inline-SVG preview (linetype/arrowhead) for the selected option.
  const selectedThumbnail = selectedOption?.thumbnail;
  // Closed → only the selected item is mounted (keeps Radix value↔label + a11y);
  // open → the full list. `selectedOption` already includes an injected free-form
  // value (see `options` above), so the trigger label never goes blank.
  const renderedOptions: readonly RibbonComboboxOption[] = open
    ? options
    : selectedOption
      ? [selectedOption]
      : [];

  const handleValueChange = useCallback(
    (next: string) => {
      if (command.comingSoon) {
        onComingSoon(ariaLabel);
        return;
      }
      // Back across the boundary: the store only ever receives millimetres.
      const committed = valueFromDisplayUnit(next, quantityKind);
      // Rounding to the unit's precision makes «0.900» and «0.9» the same millimetre value
      // but different strings, so the editable field's own `next !== external` guard would
      // let a no-op through. Compare where it actually matters — in mm.
      if (storedValue !== null && isSameCommittedValue(committed, storedValue)) return;
      onComboboxChange(command.commandKey, committed);
    },
    [
      onComboboxChange, onComingSoon, command.commandKey, command.comingSoon,
      ariaLabel, quantityKind, storedValue,
    ],
  );

  // ADR-345 §4.5 — Revit-grade editable numeric combobox. When the option list is
  // purely numeric (resolveNumericConfig ≠ null), render a type-to-enter input with
  // preset dropdown instead of the read-only Radix Select. Non-numeric enum combos
  // (kind/justification/anchor/scale/fonts) and Coming-Soon fields keep the Select.
  // ADR-677 Φάση 2β — resolved against the CONVERTED presets, so a metre ladder correctly
  // infers `allowDecimal`. `min`/`max` are authored in mm and are moved into the same space
  // as the draft, or a `max: 5000` mm guard would wave through 5000 m.
  const resolvedNumeric = command.comingSoon
    ? null
    : resolveNumericConfig(command, baseOptions);
  const numericConfig =
    resolvedNumeric === null ? null : boundsToDisplayUnit(resolvedNumeric, quantityKind);
  if (numericConfig) {
    return (
      <RibbonEditableCombobox
        command={command}
        options={baseOptions}
        value={value}
        disabled={dynamicState?.disabled === true}
        config={numericConfig}
        ariaLabel={ariaLabel}
        widthPx={widthPx}
        onCommit={handleValueChange}
      />
    );
  }

  return (
    <div className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label" aria-hidden="true">
        {ariaLabel}
      </span>
      <Select
        // Always CONTROLLED: `value ?? ''` (never `undefined`). Το `undefined` εναλλάσσει το
        // Radix Select uncontrolled↔controlled ανά render (mixed→value) → React warning «changing
        // from uncontrolled to controlled». Το `''` = controlled «καμία επιλογή» → placeholder
        // (κανένα SelectItem δεν έχει value="" — βλ. options guard παραπάνω). ADR-001.
        value={value ?? ''}
        onValueChange={handleValueChange}
        open={open}
        onOpenChange={setOpen}
        disabled={command.comingSoon || dynamicState?.disabled === true}
      >
        <SelectTrigger
          ref={triggerRef}
          size="sm"
          aria-label={ariaLabel}
          className={`dxf-ribbon-combobox-trigger${selectedImageUrl ? ' h-auto min-h-20 py-1' : ''}`}
          data-command-id={command.id}
          data-mixed={isMixed ? 'true' : undefined}
          data-coming-soon={command.comingSoon ? 'true' : undefined}
        >
          {selectedImageUrl ? (
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImageUrl}
                alt=""
                aria-hidden="true"
                className="h-16 w-16 shrink-0 rounded object-contain bg-white/5 p-0.5"
                loading="lazy"
              />
              <span className="truncate">{resolveLabel(selectedOption!, t)}</span>
            </span>
          ) : selectedThumbnail ? (
            // ADR-562 Φ8 — inline-SVG preview at normal row height (no min-h-20 growth).
            <span className="flex items-center gap-2">
              <RibbonComboboxThumbnail thumbnail={selectedThumbnail} />
              <span className="truncate">{resolveLabel(selectedOption!, t)}</span>
            </span>
          ) : (
            <SelectValue placeholder={MIXED_PLACEHOLDER} />
          )}
        </SelectTrigger>
        {/*
         * The canonical SelectContent locks width to the (narrow) trigger
         * (`w-[var(--radix-select-trigger-width)]`), which truncates long
         * option labels (e.g. column catalog / anchor names). Override to
         * size the popup to its content while never going below the trigger
         * width; `whitespace-nowrap` items keep each label on one line.
         */}
        <SelectContent className="w-auto min-w-[var(--radix-select-trigger-width)] max-w-[28rem]">
          {renderedOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="whitespace-nowrap">
              {opt.imageUrl ? (
                <span className="flex items-center gap-3 py-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={opt.imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-16 w-16 shrink-0 rounded object-contain bg-white/5 p-0.5"
                    loading="lazy"
                  />
                  <span>{resolveLabel(opt, t)}</span>
                </span>
              ) : opt.thumbnail ? (
                <span className="flex items-center gap-2">
                  <RibbonComboboxThumbnail thumbnail={opt.thumbnail} />
                  <span>{resolveLabel(opt, t)}</span>
                </span>
              ) : (
                resolveLabel(opt, t)
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
