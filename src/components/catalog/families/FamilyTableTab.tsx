'use client';

/**
 * @fileoverview **Καρτέλα «Πίνακας» της οικογένειας** — ο πίνακας μοντέλων × χαρακτηριστικών του εντύπου, ως σχήμα
 *   (ADR-923 §5.2 · §5.6 · §21 · Φάση 1γ).
 * @module components/catalog/families/FamilyTableTab
 *
 * 🔑 Ο πίνακας **στηρίζεται σε σχήμα παραλλαγών** (οι στήλες του): χωρίς σχήμα, η καρτέλα στέλνει τον άνθρωπο στις
 *    «Παραλλαγές». Με σχήμα: **πρόταση γραμμών** με ένα κλικ (άξονες + ομάδες + ιδιότητες), μετά χειροκίνητη ρύθμιση.
 * 🔑 Αναδιάταξη γραμμών με σύρσιμο/πληκτρολόγιο· η σειρά είναι η σειρά του πίνακα (ένα έγγραφο).
 */

import React from 'react';
import { Heading, Plus, Rows3, Trash2, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortableList } from '@/components/ui/sortable/SortableList';
import { reorderByMove } from '@/components/ui/sortable/sortable-model';
import type { CatalogFamilyDefinition, FamilyTableRow, FamilyTableSpec } from '@/subapps/catalog/types/family';
import { CATALOG_LIMITS } from '@/subapps/catalog/vocabulary/catalog-limits';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogField } from '../shared/CatalogFormFields';
import { FieldIssues } from '../shared/CatalogIssues';
import type { FamilyTabProps } from './AttributePicker';
import { nextLocalId } from './family-draft';
import { suggestTableRows } from './family-table-preview';
import { FamilyTablePreview } from './FamilyTablePreview';
import { TableRowEditor } from './TableRowEditor';

function withSpec(draft: CatalogFamilyDefinition, spec: FamilyTableSpec | null): CatalogFamilyDefinition {
  return { ...draft, tableSpec: spec };
}

function newRow(kind: FamilyTableRow['kind'], spec: FamilyTableSpec, axisId: string, attributeId: string): FamilyTableRow {
  const id = nextLocalId('row', spec.rows.map((row) => row.id));
  if (kind === 'groupHeader') return { kind, id, labels: {} };
  if (kind === 'axis') return { kind, id, axisAttributeId: axisId };
  return { kind, id, attributeId, labelOverride: null, displayUnitCode: null, axisFilter: null, merge: 'none' };
}

function TableRows({ spec, props }: { readonly spec: FamilyTableSpec; readonly props: FamilyTabProps }) {
  const { t } = useCatalogText();
  const { draft, update, disabled, library, inFamily, issues } = props;
  const scheme = draft.variantSchemes.find((candidate) => candidate.code === spec.variantSchemeCode);
  const axisIds = new Set(scheme?.levels.flatMap((level) => level.axisAttributeIds) ?? []);
  const axes = inFamily.filter((attribute) => axisIds.has(attribute.id));
  const rowAttributes = inFamily.filter((attribute) => !axisIds.has(attribute.id));
  const rows = spec.rows.map((row, index) => ({ id: row.id, row, index }));
  const setRows = (next: readonly FamilyTableRow[]) => update(withSpec(draft, { ...spec, rows: next }));
  const add = (kind: FamilyTableRow['kind']) => setRows([...spec.rows, newRow(kind, spec, axes[0]?.id ?? '', rowAttributes[0]?.id ?? '')]);
  const full = spec.rows.length >= CATALOG_LIMITS.maxTableSpecRows;
  return (
    <>
      <SortableList
        items={rows}
        getId={(item) => item.id}
        getLabel={(item) => t('families.table.rowAt', { index: item.index + 1 })}
        ariaLabel={t('families.table.rows')}
        disabled={disabled}
        onMove={(move) => setRows(reorderByMove(rows, (item) => item.id, move).map((item) => item.row))}
        renderItem={(item, handle) => (
          <div className="flex flex-col gap-1 border-b py-1">
            <span className="flex items-center gap-2">
              {handle}
              <TableRowEditor row={item.row} disabled={disabled} library={library} axes={axes} rowAttributes={rowAttributes}
                onChange={(row) => setRows(spec.rows.map((current, at) => (at === item.index ? row : current)))} />
              <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t('families.table.removeRow', { index: item.index + 1 })}
                onClick={() => setRows(spec.rows.filter((_, at) => at !== item.index))}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </span>
            <FieldIssues issues={issues} path={`tableSpec.rows[${item.index}]`} />
          </div>
        )}
      />
      <span className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || full} onClick={() => add('groupHeader')}><Heading className="mr-1 h-4 w-4" aria-hidden />{t('families.table.addHeader')}</Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled || full || axes.length === 0} onClick={() => add('axis')}><Rows3 className="mr-1 h-4 w-4" aria-hidden />{t('families.table.addAxis')}</Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled || full || rowAttributes.length === 0} onClick={() => add('attribute')}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('families.table.addAttribute')}</Button>
        {scheme ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setRows(suggestTableRows(scheme, library.attributeById, library.groups))}>
            <Wand2 className="mr-1 h-4 w-4" aria-hidden />{t('families.table.suggest')}
          </Button>
        ) : null}
      </span>
    </>
  );
}

export function FamilyTableTab(props: FamilyTabProps) {
  const { t, text } = useCatalogText();
  const { draft, update, disabled, issues } = props;
  const spec = draft.tableSpec;
  const schemes = draft.variantSchemes.filter((scheme) => scheme.code.length > 0);
  if (schemes.length === 0) return <p className="m-0 text-sm text-muted-foreground">{t('families.table.needScheme')}</p>;
  return (
    <section className="flex flex-col gap-3">
      <p className="m-0 text-sm text-muted-foreground">{t('families.table.lead')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <CatalogField label={t('families.table.scheme')} issues={issues} path="tableSpec.variantSchemeCode">
          {({ id, describedBy }) => (
            <Select value={spec && schemes.some((scheme) => scheme.code === spec.variantSchemeCode) ? spec.variantSchemeCode : ''} disabled={disabled}
              onValueChange={(code) => update(withSpec(draft, { variantSchemeCode: code, rows: spec?.rows ?? [] }))}>
              <SelectTrigger id={id} aria-describedby={describedBy} className="w-56"><SelectValue placeholder={t('families.table.chooseScheme')} /></SelectTrigger>
              <SelectContent>{schemes.map((scheme) => <SelectItem key={scheme.code} value={scheme.code}>{text(scheme.labels, scheme.code)}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </CatalogField>
        {spec ? <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => update(withSpec(draft, null))}>{t('families.table.remove')}</Button> : null}
      </div>
      {spec ? <TableRows spec={spec} props={props} /> : null}
      <FieldIssues issues={issues.filter((issue) => issue.path === 'tableSpec.rows')} path="tableSpec.rows" exact />
      {spec ? <FamilyTablePreview draft={draft} library={props.library} /> : null}
    </section>
  );
}
