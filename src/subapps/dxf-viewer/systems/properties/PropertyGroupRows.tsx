'use client';

/**
 * PropertyGroupRows — ADR-357 Phase 10 / ADR-362 §7.
 *
 * Generic, schema-driven renderer for a `PropertyGroup[]` (from
 * `entity-property-schema.ts`). Turns the previously-decorative schema registry
 * into a real SSoT: any entity type with a registered schema renders its
 * collapsible groups + rows here, keyed off each descriptor's `editorType`.
 *
 * First consumer: the DIMENSION branch of `PropertiesPalette` (F11/Ctrl+1). The
 * legacy LINE branch keeps its hand-rolled JSX for now (no render test guards it
 * — migrating it is a separate Boy-Scout follow-up, ADR-362 §7 note).
 *
 * Pure controlled component: reads `form[key]`, emits `onFieldChange(key, value)`.
 * Select options are resolved by the parent (dynamic layers / arrows / linetypes /
 * enum labels) via `resolveOptions` — this component stays presentation-only.
 */

import React, { useState, useCallback } from 'react';
import type { TFunction } from 'i18next';
import type { PropertyGroup, PropertyDescriptor } from './entity-property-schema';
import styles from './PropertiesPalette.module.css';

export interface PropertySelectOption {
  readonly value: string;
  readonly label: string;
}

export interface PropertyGroupRowsProps {
  readonly groups: readonly PropertyGroup[];
  readonly form: Record<string, string>;
  readonly onFieldChange: (key: string, value: string) => void;
  /** Resolve the option list for a `select` descriptor (dynamic or enum-labelled). */
  readonly resolveOptions: (descriptor: PropertyDescriptor) => readonly PropertySelectOption[];
  readonly unitLabel: string;
  readonly t: TFunction;
}

/** Unit suffix for a descriptor: display-unit label, degrees, or none. */
function unitSuffix(descriptor: PropertyDescriptor, unitLabel: string): string {
  if (descriptor.unit === 'display') return unitLabel;
  if (descriptor.unit === 'deg') return '°';
  return '';
}

function SelectRow(props: {
  descriptor: PropertyDescriptor;
  value: string;
  options: readonly PropertySelectOption[];
  onChange: (value: string) => void;
}) {
  const { descriptor, value, options, onChange } = props;
  // Inject the current value as a literal option if it isn't in the list (so it
  // never silently drops to the first option on render).
  const hasValue = options.some((o) => o.value === value);
  const finalOptions = hasValue || value === ''
    ? options
    : [{ value, label: value }, ...options];
  return (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {finalOptions.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function PropertyRow(props: {
  descriptor: PropertyDescriptor;
  value: string;
  unitLabel: string;
  onChange: (value: string) => void;
  resolveOptions: (d: PropertyDescriptor) => readonly PropertySelectOption[];
  t: TFunction;
}) {
  const { descriptor, value, unitLabel, onChange, resolveOptions, t } = props;
  const suffix = unitSuffix(descriptor, unitLabel);

  return (
    <div className={styles.row}>
      <span className={styles.label}>{t(descriptor.labelKey)}</span>
      <div className={styles.inputWrap}>
        {descriptor.editorType === 'color' && value && (
          <span
            className={styles.colorSwatch}
            style={{ '--qp-swatch': value } as React.CSSProperties}
          />
        )}
        {descriptor.editorType === 'readonly' ? (
          <input className={styles.inputReadonly} type="text" readOnly value={value || '—'} />
        ) : descriptor.editorType === 'select' ? (
          <SelectRow
            descriptor={descriptor}
            value={value}
            options={resolveOptions(descriptor)}
            onChange={onChange}
          />
        ) : descriptor.editorType === 'number' ? (
          <input
            className={styles.input}
            type="number"
            step={descriptor.step ?? 'any'}
            min={descriptor.min}
            max={descriptor.max}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            className={styles.input}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {suffix && <span className={styles.unit}>{suffix}</span>}
      </div>
    </div>
  );
}

function GroupSection(props: {
  group: PropertyGroup;
  form: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  resolveOptions: (d: PropertyDescriptor) => readonly PropertySelectOption[];
  unitLabel: string;
  t: TFunction;
}) {
  const { group, form, onFieldChange, resolveOptions, unitLabel, t } = props;
  const [open, setOpen] = useState(true);
  return (
    <section className={styles.group}>
      <button
        type="button"
        className={styles.groupHeader}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{t(group.groupKey)}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▶</span>
      </button>
      {open && (
        <div className={styles.groupBody}>
          {group.properties.map((descriptor) => (
            <PropertyRow
              key={descriptor.key}
              descriptor={descriptor}
              value={form[descriptor.key] ?? ''}
              unitLabel={unitLabel}
              onChange={(v) => onFieldChange(descriptor.key, v)}
              resolveOptions={resolveOptions}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function PropertyGroupRows(props: PropertyGroupRowsProps) {
  const { groups, form, onFieldChange, resolveOptions, unitLabel, t } = props;
  const handleFieldChange = useCallback(onFieldChange, [onFieldChange]);
  return (
    <>
      {groups.map((group) => (
        <GroupSection
          key={group.groupKey}
          group={group}
          form={form}
          onFieldChange={handleFieldChange}
          resolveOptions={resolveOptions}
          unitLabel={unitLabel}
          t={t}
        />
      ))}
    </>
  );
}
