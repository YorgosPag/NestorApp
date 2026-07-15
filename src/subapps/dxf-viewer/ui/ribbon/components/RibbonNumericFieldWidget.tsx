'use client';

/**
 * ADR-662 Φάση 1b — Store-backed numeric ribbon field (SSoT shell).
 *
 * The numeric analogue of {@link RibbonToggleWidget}: everything that varies
 * between fields — which store value they read/write, their label, presets and
 * range — arrives via a single {@link RibbonNumericConfig}, so a new field is a
 * ~6-line config instead of a copy-pasted input component.
 *
 * ZERO new input logic: the draft / stepper-less / preset-dropdown /
 * Enter-Esc-blur commit + comma-dot normalize all come from the existing
 * {@link RibbonEditableCombobox} primitive (ADR-345 §4.5) — this shell only
 * bridges a plain `{value, commit}` store hook to that primitive. `value` and
 * `commit` are in DISPLAY units (e.g. meters); the config's own hook owns any
 * unit conversion to the store's canonical units (e.g. ×1000 → mm).
 *
 * ADR-040: the config hook subscribes a LOW-freq topo store (changes on click),
 * exactly like the toggle widgets — no hot-path subscription.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { RibbonEditableCombobox } from './buttons/RibbonEditableCombobox';
import { resolveNumericConfig } from './buttons/ribbon-combobox-numeric';
import type {
  RibbonCommand,
  RibbonComboboxOption,
} from '../types/ribbon-types';

export interface RibbonNumericConfig {
  /**
   * Reactive read of the current value (display units) plus the commit action.
   * Called as a hook, so it may subscribe to any store; invoked unconditionally
   * once per render (rules-of-hooks safe — a config is a stable module constant).
   */
  readonly useNumericState: () => {
    readonly value: number;
    readonly commit: (next: number) => void;
  };
  /** Stable command id (used as React key + editable-combobox escape-bus id). */
  readonly commandId: string;
  /** Row label i18n key. */
  readonly labelKey: string;
  /** Optional dropdown presets (display units). */
  readonly presets?: readonly number[];
  /** Reject committed values below this (typed input reverts). */
  readonly min?: number;
  /** Reject committed values above this (typed input reverts). */
  readonly max?: number;
  /** Allow a decimal separator (default false → integer-only field). */
  readonly allowDecimal?: boolean;
}

/** Field width in px — compact, matching the inline ribbon combobox row. */
const FIELD_WIDTH_PX = 72;

function toOptions(
  presets: readonly number[] | undefined,
): readonly RibbonComboboxOption[] {
  if (!presets || presets.length === 0) return [];
  return presets.map((n) => ({
    value: String(n),
    labelKey: String(n),
    isLiteralLabel: true,
  }));
}

interface RibbonNumericFieldWidgetProps {
  readonly config: RibbonNumericConfig;
}

export const RibbonNumericFieldWidget: React.FC<RibbonNumericFieldWidgetProps> = ({
  config,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { value, commit } = config.useNumericState();
  const label = t(config.labelKey);

  const options = React.useMemo(() => toOptions(config.presets), [config.presets]);
  const command = React.useMemo<RibbonCommand>(
    () => ({
      id: config.commandId,
      labelKey: config.labelKey,
      commandKey: config.commandId,
      numericInput: {
        editable: true,
        allowNegative: false,
        allowDecimal: config.allowDecimal ?? false,
        min: config.min,
        max: config.max,
      },
    }),
    [config.commandId, config.labelKey, config.allowDecimal, config.min, config.max],
  );

  const numericConfig = React.useMemo(
    () => resolveNumericConfig(command, options),
    [command, options],
  );
  if (!numericConfig) return null;

  return (
    <RibbonEditableCombobox
      command={command}
      options={options}
      value={String(value)}
      disabled={false}
      config={numericConfig}
      ariaLabel={label}
      widthPx={FIELD_WIDTH_PX}
      onCommit={(next) => commit(Number(next))}
    />
  );
};
