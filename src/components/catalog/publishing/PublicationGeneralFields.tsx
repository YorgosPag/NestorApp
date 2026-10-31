'use client';

/**
 * @fileoverview **Τα γενικά της συνταγής** — κωδικός · όνομα · τίτλος εξωφύλλου · γλώσσα · σημείωση υποσέλιδου
 *   (ADR-923 §5.6.1).
 * @module components/catalog/publishing/PublicationGeneralFields
 *
 * 🔑 Ο κωδικός είναι η ταυτότητα και **κλειδώνει** μετά τη δημιουργία (`CatalogCodeField`)· πριν, ακολουθεί το όνομα.
 */

import React from 'react';

import { EnumSelect } from '@/components/ui/enum-select';
import { HUMAN_LANGUAGES } from '@/i18n/languages';
import { CatalogCodeField, CatalogField } from '../shared/CatalogFormFields';
import { LANGUAGE_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import type { PublicationFieldsProps } from './publication-draft';

interface GeneralProps extends PublicationFieldsProps {
  readonly codeLocked: boolean;
}

export function PublicationGeneralFields({ draft, onChange, issues, disabled, codeLocked }: GeneralProps) {
  const { t } = useCatalogText();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <CatalogCodeField value={draft.code} locked={codeLocked} disabled={disabled} issues={issues}
        suggestFrom={draft.labels[draft.language] ?? ''} onChange={(code) => onChange({ ...draft, code })} />
      <LocalizedTextField label={t('publishing.fields.label')} value={draft.labels} disabled={disabled}
        onChange={(labels) => onChange({ ...draft, labels })} />
      <LocalizedTextField label={t('publishing.fields.documentTitle')} value={draft.title} disabled={disabled}
        issues={issues} path="title" onChange={(title) => onChange({ ...draft, title })} />
      <CatalogField label={t('publishing.fields.language')}>
        {({ id }) => (
          <EnumSelect id={id} value={draft.language} values={HUMAN_LANGUAGES} disabled={disabled}
            getLabel={(language) => t(LANGUAGE_KEYS[language])} onValueChange={(language) => onChange({ ...draft, language })} />
        )}
      </CatalogField>
      <LocalizedTextField label={t('publishing.fields.footerNote')} value={draft.footerNote}
        disabled={disabled} onChange={(footerNote) => onChange({ ...draft, footerNote })} />
    </fieldset>
  );
}
