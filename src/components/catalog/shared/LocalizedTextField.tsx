'use client';

/**
 * @fileoverview **Πεδίο πολύγλωσσου κειμένου δεδομένων** — μία είσοδος ανά ανθρώπινη γλώσσα (ADR-923 §5.2).
 * @module components/catalog/shared/LocalizedTextField
 *
 * 🔑 Οι γλώσσες **παράγονται** από το `HUMAN_LANGUAGES` — τρίτη γλώσσα στο `languages.ts` ⇒ τρίτη είσοδος εδώ, χωρίς
 *    αλλαγή κώδικα. Η πρώτη (προεπιλεγμένη) είναι η «κύρια»· οι άλλες είναι μεταφράσεις, προαιρετικές (Akeneo).
 */

import React, { useId } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HUMAN_LANGUAGES, type HumanLanguage } from '@/i18n/languages';
import type { LocalizedText } from '@/i18n/localized-text';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { LANGUAGE_KEYS } from './catalog-labels';
import { useCatalogText } from './catalog-ui-hooks';
import { FieldIssues } from './CatalogIssues';

interface LocalizedTextFieldProps {
  readonly label: string;
  readonly value: LocalizedText;
  readonly onChange: (value: LocalizedText) => void;
  readonly multiline?: boolean;
  readonly disabled?: boolean;
  /** Ευρήματα και η διαδρομή του πεδίου μέσα στον ορισμό (`labels`). */
  readonly issues?: readonly CatalogIssue[];
  readonly path?: string;
}

function withLanguage(value: LocalizedText, language: HumanLanguage, text: string): LocalizedText {
  const next: LocalizedText = { ...value };
  if (text.length === 0) delete next[language];
  else next[language] = text;
  return next;
}

export function LocalizedTextField({ label, value, onChange, multiline = false, disabled, issues = [], path }: LocalizedTextFieldProps) {
  const { t } = useCatalogText();
  const baseId = useId();
  const issuesId = `${baseId}-issues`;
  const control = (id: string, language: HumanLanguage) => {
    const shared = { id, value: value[language] ?? '', disabled, 'aria-describedby': path ? issuesId : undefined };
    return multiline ? (
      <Textarea {...shared} onChange={(event) => onChange(withLanguage(value, language, event.target.value))} />
    ) : (
      <Input {...shared} onChange={(event) => onChange(withLanguage(value, language, event.target.value))} />
    );
  };
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-foreground">{label}</legend>
      {HUMAN_LANGUAGES.map((language) => {
        const id = `${baseId}-${language}`;
        return (
          <div key={language} className="flex items-start gap-2">
            <Label htmlFor={id} className="mt-2 w-8 shrink-0 text-xs uppercase text-muted-foreground">
              {t(LANGUAGE_KEYS[language])}
            </Label>
            {control(id, language)}
          </div>
        );
      })}
      {path ? <FieldIssues id={issuesId} issues={issues} path={path} /> : null}
    </fieldset>
  );
}

interface InlineLocalizedInputsProps {
  readonly value: LocalizedText;
  readonly onChange: (value: LocalizedText) => void;
  /** Το προσβάσιμο όνομα του πεδίου· κάθε είσοδος γίνεται «<όνομα> (<γλώσσα>)». */
  readonly label: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

/**
 * **Συμπαγής μορφή**: μία είσοδος ανά γλώσσα, σε μία γραμμή — για γραμμές λιστών και πινάκων (επιλογές, στήλες,
 * ομάδες, κεφαλίδες). Η ίδια παραγωγή γλωσσών από το `HUMAN_LANGUAGES` με το πλήρες πεδίο.
 */
export function InlineLocalizedInputs({ value, onChange, label, disabled, className = 'min-w-28 flex-1' }: InlineLocalizedInputsProps) {
  const { t } = useCatalogText();
  return (
    <>
      {HUMAN_LANGUAGES.map((language) => {
        const name = t('common.labelIn', { label, language: t(LANGUAGE_KEYS[language]) });
        return (
          <Input key={language} className={className} placeholder={t(LANGUAGE_KEYS[language])} aria-label={name}
            value={value[language] ?? ''} disabled={disabled} onChange={(event) => onChange(withLanguage(value, language, event.target.value))} />
        );
      })}
    </>
  );
}
