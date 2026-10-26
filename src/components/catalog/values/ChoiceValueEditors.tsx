'use client';
/**
 * **Επεξεργαστές επιλογής** — ναι/όχι · επιλογή · πολλαπλή επιλογή (ADR-923 §5.10.4 Β3).
 *
 * 🔑 Το ναι/όχι είναι **τριών καταστάσεων**: κενό · Ναι · Όχι. Το «Όχι» **είναι τιμή** (μετρά πλήρες), το κενό
 * λείπει — ένα σκέτο switch θα έσβηνε αυτή τη διάκριση, και μαζί την πληρότητα (Akeneo: «Yes / No / —»).
 *
 * @module components/catalog/values/ChoiceValueEditors
 */

import { ClearableSelect } from '@/components/ui/clearable-select';
import { SelectItem } from '@/components/ui/select';
import { ToggleButton } from '@/components/ui/toggle-button';

import { useCatalogText } from '../shared/catalog-ui-hooks';
import type { ValueEditorProps } from './value-editor-types';

export function BooleanValueEditor({ id, label, value, onChange, disabled, describedBy, env }: ValueEditorProps<'boolean'>) {
  const current = value?.value;
  const choice = (next: boolean) => onChange(current === next ? null : { type: 'boolean', value: next });
  return (
    <span id={id} role="group" aria-label={label} aria-describedby={describedBy} className="inline-flex gap-1">
      <ToggleButton size="sm" pressed={current === true} disabled={disabled} onClick={() => choice(true)}>{env.codec.yes}</ToggleButton>
      <ToggleButton size="sm" pressed={current === false} disabled={disabled} onClick={() => choice(false)}>{env.codec.no}</ToggleButton>
    </span>
  );
}

export function SelectValueEditor({ id, attribute, value, onChange, disabled, env }: ValueEditorProps<'select'>) {
  const { t } = useCatalogText();
  return (
    <ClearableSelect id={id} value={value?.optionCode ?? ''} disabled={disabled} placeholder={t('values.empty')} clearLabel={t('values.clear')}
      onValueChange={(code) => onChange(code === '' ? null : { type: 'select', optionCode: code })}>
      {attribute.config.options.map((option) => <SelectItem key={option.code} value={option.code}>{env.text(option.labels, option.code)}</SelectItem>)}
    </ClearableSelect>
  );
}

export function MultiSelectValueEditor({ id, label, attribute, value, onChange, disabled, describedBy, env }: ValueEditorProps<'multiSelect'>) {
  const selected = value?.optionCodes ?? [];
  const full = attribute.config.maxSelections !== null && selected.length >= attribute.config.maxSelections;
  const toggle = (code: string) => {
    const next = selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code];
    // Σειρά = σειρά των επιλογών της ιδιότητας (σταθερή, ανεξάρτητη από τη σειρά των κλικ).
    const ordered = attribute.config.options.map((option) => option.code).filter((option) => next.includes(option));
    onChange(ordered.length === 0 ? null : { type: 'multiSelect', optionCodes: ordered });
  };
  return (
    <span id={id} role="group" aria-label={label} aria-describedby={describedBy} className="flex flex-wrap gap-1">
      {attribute.config.options.map((option) => {
        const pressed = selected.includes(option.code);
        return (
          <ToggleButton key={option.code} size="sm" pressed={pressed} disabled={disabled || (full && !pressed)} onClick={() => toggle(option.code)}>
            {env.text(option.labels, option.code)}
          </ToggleButton>
        );
      })}
    </span>
  );
}
