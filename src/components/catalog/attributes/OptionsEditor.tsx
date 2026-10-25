'use client';

/**
 * @fileoverview **Οι επιλογές μιας ιδιότητας `select` / `multiSelect` (ή στήλης πίνακα)** (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/attributes/OptionsEditor
 *
 * 🔑 **Η σειρά είναι η σειρά του πίνακα** (ένα έγγραφο — `declared-order`), αναδιάταξη με σύρσιμο ή πληκτρολόγιο
 *    (`SortableList`). Ο κωδικός **ακολουθεί** την ετικέτα ώσπου να τον αγγίξει ο άνθρωπος.
 * 🔑 **Επικόλληση πολλών**: μία ετικέτα ανά γραμμή ⇒ μία επιλογή η καθεμία, με κωδικό από την ετικέτα και χωρίς
 *    διπλότυπα (Akeneo «bulk options»). Οι επτά τιμές μεγέθους του MFP μπαίνουν με ένα copy-paste.
 * ⚠️ Ο κωδικός μιας **αποθηκευμένης** επιλογής είναι η ταυτότητά της στις τιμές προϊόντων (Φάση 2): δεν τον
 *    κλειδώνουμε εδώ (καμία τιμή ακόμη), αλλά η υπόδειξη το λέει.
 */

import React, { useState } from 'react';
import { ListPlus, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SortableList } from '@/components/ui/sortable/SortableList';
import { reorderByMove } from '@/components/ui/sortable/sortable-model';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import type { LocalizedText } from '@/i18n/localized-text';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { SelectOption } from '@/subapps/catalog/types/attribute';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import { InlineLocalizedInputs } from '../shared/LocalizedTextField';

interface OptionsEditorProps {
  readonly options: readonly SelectOption[];
  readonly onChange: (options: readonly SelectOption[]) => void;
  readonly issues: readonly CatalogIssue[];
  /** Η διαδρομή του πίνακα επιλογών μέσα στον ορισμό (`config.options`). */
  readonly path: string;
  readonly disabled: boolean;
}

interface Row {
  readonly id: string;
  readonly option: SelectOption;
  readonly index: number;
}

/** Νέες επιλογές από κείμενο (μία ετικέτα ανά γραμμή), χωρίς κωδικούς που υπάρχουν ήδη. */
export function optionsFromLines(text: string, existing: readonly SelectOption[]): SelectOption[] {
  const taken = new Set(existing.map((option) => option.code));
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0).flatMap((label) => {
    const code = suggestCatalogCode(label);
    if (code.length === 0 || taken.has(code)) return [];
    taken.add(code);
    return [{ code, labels: { [DEFAULT_LANGUAGE]: label } }];
  });
}

interface OptionRowProps {
  readonly row: Row;
  readonly handle: React.ReactNode;
  readonly path: string;
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
  readonly onChange: (option: SelectOption) => void;
  readonly onRemove: () => void;
}

function OptionRow({ row, handle, path, issues, disabled, onChange, onRemove }: OptionRowProps) {
  const { t } = useCatalogText();
  const { option, index } = row;
  // Ο κωδικός ακολουθεί την κύρια ετικέτα όσο ήταν η πρότασή της (δεν τον έχει αγγίξει ο άνθρωπος).
  const setLabels = (labels: LocalizedText) => {
    const followCode = option.code === suggestCatalogCode(option.labels[DEFAULT_LANGUAGE] ?? '');
    onChange({ code: followCode ? suggestCatalogCode(labels[DEFAULT_LANGUAGE] ?? '') : option.code, labels });
  };
  return (
    <div className="flex flex-col gap-1 py-1">
      <span className="flex flex-wrap items-center gap-2">
        {handle}
        <Input className="w-36 font-mono" aria-label={t('attributes.options.codeOf', { index: index + 1 })} value={option.code} disabled={disabled} onChange={(event) => onChange({ ...option, code: event.target.value })} />
        <InlineLocalizedInputs value={option.labels} disabled={disabled} label={t('attributes.options.labelOf', { index: index + 1 })} onChange={setLabels} />
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t('attributes.options.removeOf', { index: index + 1 })} onClick={onRemove}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </span>
      <FieldIssues issues={issues} path={`${path}[${index}]`} />
    </div>
  );
}

export function OptionsEditor({ options, onChange, issues: allIssues, path, disabled }: OptionsEditorProps) {
  const { t, text } = useCatalogText();
  const [bulk, setBulk] = useState<string | null>(null);
  const rows: Row[] = options.map((option, index) => ({ id: `option-${index}`, option, index }));
  const replace = (index: number, option: SelectOption) => onChange(options.map((current, at) => (at === index ? option : current)));
  const addBulk = () => {
    if (bulk !== null) onChange([...options, ...optionsFromLines(bulk, options)]);
    setBulk(null);
  };
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-foreground">{t('attributes.options.title', { count: options.length })}</legend>
      <SortableList
        items={rows}
        getId={(row) => row.id}
        getLabel={(row) => text(row.option.labels, row.option.code)}
        ariaLabel={t('attributes.options.title', { count: options.length })}
        disabled={disabled}
        onMove={(move) => onChange(reorderByMove(rows, (row) => row.id, move).map((row) => row.option))}
        renderItem={(row, handle) => (
          <OptionRow row={row} handle={handle} path={path} issues={allIssues} disabled={disabled}
            onChange={(option) => replace(row.index, option)}
            onRemove={() => onChange(options.filter((_, at) => at !== row.index))} />
        )}
      />
      <FieldIssues issues={allIssues.filter((issue) => issue.path === path)} path={path} exact />
      {bulk !== null ? (
        <section className="flex flex-col gap-2">
          <Textarea aria-label={t('attributes.options.bulkLabel')} placeholder={t('attributes.options.bulkPlaceholder')} rows={6} value={bulk} onChange={(event) => setBulk(event.target.value)} />
          <span className="flex gap-2">
            <Button type="button" size="sm" onClick={addBulk}>{t('attributes.options.bulkAdd')}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setBulk(null)}>{t('common.cancel')}</Button>
          </span>
        </section>
      ) : (
        <span className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...options, { code: '', labels: {} }])}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />{t('attributes.options.add')}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setBulk('')}>
            <ListPlus className="mr-1 h-4 w-4" aria-hidden />{t('attributes.options.bulk')}
          </Button>
        </span>
      )}
    </fieldset>
  );
}
