'use client';

/**
 * @fileoverview **Νέα εισαγωγή** (ADR-923 §5.5): αρχείο, σκοπός, στόχος, και αντιστοίχιση ή εύρος σελίδων.
 * @module components/catalog/imports/NewImportPanel
 */

import React, { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IMPORT_SOURCE_PURPOSES, isTableImportSource } from '@/subapps/catalog/vocabulary/catalog-import';
import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';
import { ColumnMappingTable } from './ColumnMappingTable';
import { useImportText } from './import-text';
import { ChoiceField, PageRangeFields, SheetFields } from './NewImportFields';
import { useImportTarget } from './use-import-target';
import { useNewImport } from './use-new-import';

type Flow = ReturnType<typeof useNewImport>;
type Target = ReturnType<typeof useImportTarget>;

function TargetField({ flow, target, familyOnly }: { readonly flow: Flow; readonly target: Target; readonly familyOnly: boolean }) {
  const { t } = useImportText();
  const current = flow.form.target;
  if (target.purpose === 'attributes' || familyOnly) {
    return <ChoiceField id="import-family" label={t('new.family')} value={target.familyId} choices={target.familyChoices} onChange={(id) => void flow.patchForm({ target: target.targetOfFamily(id) })} />;
  }
  return (
    <ChoiceField
      id="import-version"
      label={t('new.version')}
      value={current?.purpose === 'priceLines' ? current.priceListVersionId : ''}
      choices={target.versions}
      onChange={(id) => void flow.patchForm({ target: target.targetOfVersion(id) })}
    />
  );
}

function SourceOptions({ flow, target }: { readonly flow: Flow; readonly target: Target }) {
  const { t } = useImportText();
  const { source, table, form } = flow;
  if (!source) return null;
  const isPdf = source.kind === 'pdf';
  const isTable = isTableImportSource(source.kind);
  const readsPrices = IMPORT_SOURCE_PURPOSES[source.kind].includes('priceLines');
  const patch = (next: Parameters<Flow['patchForm']>[0]) => void flow.patchForm(next);
  const purposes = [{ value: 'attributes', label: t('new.purposeAttributes') }, { value: 'priceLines', label: t('new.purposePrices') }];
  return (
    <>
      {readsPrices ? <ChoiceField id="import-purpose" label={t('new.purpose')} value={target.purpose} choices={purposes} onChange={(value) => target.setPurpose(value === 'priceLines' ? 'priceLines' : 'attributes')} /> : null}
      <TargetField flow={flow} target={target} familyOnly={!readsPrices} />
      {isPdf ? <PageRangeFields form={form} onChange={patch} /> : null}
      {isTable ? <SheetFields form={form} onChange={patch} spreadsheet={source.kind === 'spreadsheet'} /> : null}
      {table && form.target ? <ColumnMappingTable table={table} purpose={form.target.purpose} attributes={target.familyAttributes} columns={form.columns} onChange={(columns) => patch({ columns })} /> : null}
      <footer className="flex justify-end">
        <Button type="button" disabled={flow.busy || form.target === null} onClick={() => void flow.start()}>{flow.busy ? t('new.working') : t('new.start')}</Button>
      </footer>
    </>
  );
}

export function NewImportPanel({ onReady }: { readonly onReady: (batchId: string) => void }) {
  const { t } = useImportText();
  const notify = useCatalogFailureNotice();
  const target = useImportTarget();
  const flow = useNewImport(target.familyAttributes, onReady);

  useEffect(() => {
    if (flow.failure) notify(flow.failure);
  }, [flow.failure, notify]);

  return (
    <section className="flex flex-col gap-4 rounded-md border border-border p-4" aria-label={t('new.title')}>
      <h2 className="m-0 text-lg font-semibold">{t('new.title')}</h2>
      <p className="m-0 flex flex-col gap-1">
        <Label htmlFor="import-file">{t('new.file')}</Label>
        <Input id="import-file" type="file" accept=".pdf,.xlsx,.csv,.txt,.json" disabled={flow.busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void flow.chooseFile(file); }} />
      </p>
      {flow.unsupported ? <p className="m-0 text-sm text-destructive" role="alert">{t('new.unsupported')}</p> : null}
      <SourceOptions flow={flow} target={target} />
    </section>
  );
}
