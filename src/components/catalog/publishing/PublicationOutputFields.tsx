'use client';

/**
 * @fileoverview **Τι βγαίνει** — προφίλ εξόδου · πρότυπα · ομάδες πίνακα · στήλες πλέγματος (ADR-923 §5.6.1).
 * @module components/catalog/publishing/PublicationOutputFields
 *
 * 🔑 Τα σύνολα επιλογών **παράγονται** από το λεξιλόγιο του εκδότη (`publication-vocabulary`) — νέο πρότυπο ⇒ νέα
 *    επιλογή εδώ χωρίς αλλαγή κώδικα. Η σειρά αποθήκευσης είναι η σειρά του λεξιλογίου (σταθερό hash εισόδων).
 * 🔑 Η σελίδα οικογένειας και το πλέγμα μπαίνουν πάντα: δεν προσφέρονται ως επιλογή.
 */

import React, { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { EnumSelect } from '@/components/ui/enum-select';
import { Label } from '@/components/ui/label';
import { NumericField } from '@/components/ui/numeric-field';
import {
  PUBLICATION_OPTIONAL_TEMPLATES,
  PUBLICATION_OUTPUT_PROFILES,
  TABLE_GROUP_STYLES,
  type PublicationOptionalTemplate,
  type PublicationOutputProfile,
} from '@/subapps/catalog/publishing/publication-vocabulary';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import { GRID_COLUMN_LIMITS, toggleInOrder, type PublicationFieldsProps } from './publication-draft';

interface ChoiceListProps<T extends string> {
  readonly legend: string;
  readonly options: readonly T[];
  readonly selected: readonly T[];
  readonly labelOf: (option: T) => string;
  readonly disabled: boolean;
  readonly onToggle: (option: T, on: boolean) => void;
  readonly children?: React.ReactNode;
}

function ChoiceList<T extends string>({ legend, options, selected, labelOf, disabled, onToggle, children }: ChoiceListProps<T>) {
  const baseId = useId();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-foreground">{legend}</legend>
      {options.map((option) => (
        <span key={option} className="flex items-center gap-2">
          <Checkbox id={`${baseId}-${option}`} checked={selected.includes(option)} disabled={disabled}
            onCheckedChange={(checked) => onToggle(option, checked === true)} />
          <Label htmlFor={`${baseId}-${option}`}>{labelOf(option)}</Label>
        </span>
      ))}
      {children}
    </fieldset>
  );
}

export function PublicationOutputFields({ draft, onChange, issues, disabled }: PublicationFieldsProps) {
  const { t } = useCatalogText();
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <ChoiceList<PublicationOutputProfile> legend={t('publishing.fields.profiles')} options={PUBLICATION_OUTPUT_PROFILES}
        selected={draft.profiles} disabled={disabled} labelOf={(profile) => t(`publishing.profile.${profile}`)}
        onToggle={(profile, on) => onChange({ ...draft, profiles: toggleInOrder(draft.profiles, profile, on, PUBLICATION_OUTPUT_PROFILES) })}>
        <FieldIssues issues={issues} path="profiles" exact />
      </ChoiceList>
      <ChoiceList<PublicationOptionalTemplate> legend={t('publishing.fields.templates')} options={PUBLICATION_OPTIONAL_TEMPLATES}
        selected={draft.templates.enabled} disabled={disabled} labelOf={(template) => t(`publishing.template.${template}`)}
        onToggle={(template, on) => onChange({ ...draft, templates: { ...draft.templates, enabled: toggleInOrder(draft.templates.enabled, template, on, PUBLICATION_OPTIONAL_TEMPLATES) } })} />
      <CatalogField label={t('publishing.fields.groupStyle')}>
        {({ id }) => (
          <EnumSelect id={id} value={draft.templates.groupStyle} values={TABLE_GROUP_STYLES} disabled={disabled}
            getLabel={(style) => t(`publishing.groupStyle.${style}`)}
            onValueChange={(groupStyle) => onChange({ ...draft, templates: { ...draft.templates, groupStyle } })} />
        )}
      </CatalogField>
      <CatalogField label={t('publishing.fields.gridColumns')}>
        {({ id, describedBy }) => (
          <NumericField id={id} aria-describedby={describedBy} value={draft.templates.gridColumns} disabled={disabled}
            min={GRID_COLUMN_LIMITS.min} max={GRID_COLUMN_LIMITS.max} step={1}
            onValueChange={(gridColumns) => onChange({ ...draft, templates: { ...draft.templates, gridColumns } })} />
        )}
      </CatalogField>
    </section>
  );
}
