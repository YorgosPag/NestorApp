'use client';

/**
 * Shared presentational rows + footer for the Properties Palette (de-dup, ADR-583).
 *
 * The palette repeated byte-identical editable-number rows, readonly-derived rows, and
 * the Cancel/Apply footer across its LINE and DIMENSION sections. These own each shape
 * once so the palette body stays declarative (and under the 500-line component budget).
 */
import React from 'react';
import type { TFunction } from 'i18next';

import { PropertiesPaletteStore } from './PropertiesPaletteStore';
import styles from './PropertiesPalette.module.css';

/** Shared row chrome: label on the left, the input(s), then the unit suffix. */
function RowShell(props: {
  readonly label: string;
  readonly unitLabel: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  const { label, unitLabel, children } = props;
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.inputWrap}>
        {children}
        <span className={styles.unit}>{unitLabel}</span>
      </div>
    </div>
  );
}

/** Editable numeric property row: label + number input + unit suffix. */
export function NumberInputRow(props: {
  readonly label: string;
  readonly value: string | number;
  readonly onChange: (value: string) => void;
  readonly unitLabel: string;
  readonly step?: string;
  readonly min?: string;
  readonly max?: string;
}): React.ReactElement {
  const { label, value, onChange, unitLabel, step = 'any', min, max } = props;
  return (
    <RowShell label={label} unitLabel={unitLabel}>
      <input
        className={styles.input}
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </RowShell>
  );
}

/** Readonly derived property row: label + readonly text input + unit suffix. */
export function ReadonlyInputRow(props: {
  readonly label: string;
  readonly value: string | number;
  readonly unitLabel: string;
}): React.ReactElement {
  const { label, value, unitLabel } = props;
  return (
    <RowShell label={label} unitLabel={unitLabel}>
      <input className={styles.inputReadonly} type="text" readOnly value={value} />
    </RowShell>
  );
}

/** Cancel/Apply footer. Cancel always closes the palette; Apply is per-section. */
export function PaletteFooter(props: {
  readonly onApply: () => void;
  readonly t: TFunction;
}): React.ReactElement {
  const { onApply, t } = props;
  return (
    <footer className={styles.footer}>
      <button
        type="button"
        className={styles.btnCancel}
        onClick={() => PropertiesPaletteStore.close()}
      >
        {t('propertiesPalette.close')}
      </button>
      <button
        type="button"
        className={styles.btnApply}
        onClick={onApply}
      >
        {t('propertiesPalette.apply')}
      </button>
    </footer>
  );
}
