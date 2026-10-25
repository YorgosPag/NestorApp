'use client';

/**
 * @fileoverview **Μία γραμμή του πίνακα καταλόγου** — κεφαλίδα ομάδας · γραμμή άξονα · γραμμή ιδιότητας
 *   (ADR-923 §5.2 · §21 · Φάση 1γ).
 * @module components/catalog/families/TableRowEditor
 *
 * 🔑 Γραμμή ιδιότητας: **ετικέτα γραμμής** (π.χ. «Ψυκτ. ισχύς H» αντί της πλήρους) · **μονάδα προβολής** (μόνο για
 *    μέτρηση, από την οικογένεια της ιδιότητας) · **φίλτρο άξονα** («ΤΙΜΗ € BAC-1-CI») · **συγχώνευση δηλωμένη** —
 *    ποτέ αυτόματη (§21.4.3: στο MFP το «3/4″-3/4″» είναι ίδιο παντού και το πρωτότυπο ΔΕΝ το συγχωνεύει).
 */

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { hasAnyLocalizedText } from '@/i18n/localized-text';
import type { CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { FamilyTableRow, TableAxisFilter } from '@/subapps/catalog/types/family';
import { TABLE_ROW_MERGE_MODES } from '@/subapps/catalog/types/family';
import { MERGE_MODE_KEYS, TABLE_ROW_KIND_KEYS } from '../shared/catalog-labels';
import { InlineLocalizedInputs } from '../shared/LocalizedTextField';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { AttributePicker } from './AttributePicker';

type AttributeRow = Extract<FamilyTableRow, { kind: 'attribute' }>;

/** Τιμή του επιλογέα φίλτρου: `axisId::optionCode`, ή η λέξη-κλειδί «κανένα». */
const NO_FILTER = 'none';
const filterKey = (filter: TableAxisFilter) => `${filter.axisAttributeId}::${filter.optionCode}`;
const DEFAULT_UNIT = 'default';

function AttributeRowFields({ row, onChange, disabled, library, rowAttributes, selectAxes }: {
  readonly row: AttributeRow;
  readonly onChange: (row: FamilyTableRow) => void;
  readonly disabled: boolean;
  readonly library: CatalogLibrary;
  readonly rowAttributes: readonly AttributeRecord[];
  readonly selectAxes: readonly AttributeRecord[];
}) {
  const { t, text } = useCatalogText();
  const attribute = library.attributeById.get(row.attributeId);
  const unitFamily = attribute?.type === 'measurement' ? library.registry.get(attribute.config.measurementFamilyCode) : undefined;
  const filters = selectAxes.flatMap((axis) => (axis.type === 'select' ? axis.config.options.map((option) => ({ key: filterKey({ axisAttributeId: axis.id, optionCode: option.code }), axis, option })) : []));
  const chooseFilter = (key: string) => {
    const match = filters.find((item) => item.key === key);
    onChange({ ...row, axisFilter: match ? { axisAttributeId: match.axis.id, optionCode: match.option.code } : null });
  };
  return (
    <>
      <AttributePicker className="w-56" value={row.attributeId} options={rowAttributes} disabled={disabled} placeholder={t('families.table.chooseAttribute')} ariaLabel={t('families.table.attribute')} onChange={(attributeId) => onChange({ ...row, attributeId, displayUnitCode: null })} />
      <InlineLocalizedInputs value={row.labelOverride ?? {}} disabled={disabled} label={t('families.table.rowLabel')} onChange={(labels) => onChange({ ...row, labelOverride: hasAnyLocalizedText(labels) ? labels : null })} />
      {unitFamily ? (
        <Select value={row.displayUnitCode ?? DEFAULT_UNIT} disabled={disabled} onValueChange={(unit) => onChange({ ...row, displayUnitCode: unit === DEFAULT_UNIT ? null : unit })}>
          <SelectTrigger className="w-32" aria-label={t('families.table.displayUnit')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_UNIT}>{t('families.table.defaultUnit')}</SelectItem>
            {unitFamily.units.map((unit) => <SelectItem key={unit.code} value={unit.code}>{unit.symbol}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : null}
      {filters.length > 0 ? (
        <Select value={row.axisFilter ? filterKey(row.axisFilter) : NO_FILTER} disabled={disabled} onValueChange={chooseFilter}>
          <SelectTrigger className="w-44" aria-label={t('families.table.axisFilter')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_FILTER}>{t('families.table.noFilter')}</SelectItem>
            {filters.map((item) => <SelectItem key={item.key} value={item.key}>{`${text(item.axis.labels, item.axis.code)} = ${text(item.option.labels, item.option.code)}`}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : null}
      <Select value={row.merge} disabled={disabled} onValueChange={(merge) => {
        const mode = TABLE_ROW_MERGE_MODES.find((item) => item === merge);
        if (mode) onChange({ ...row, merge: mode });
      }}>
        <SelectTrigger className="w-52" aria-label={t('families.table.merge')}><SelectValue /></SelectTrigger>
        <SelectContent>{TABLE_ROW_MERGE_MODES.map((mode) => <SelectItem key={mode} value={mode}>{t(MERGE_MODE_KEYS[mode])}</SelectItem>)}</SelectContent>
      </Select>
    </>
  );
}

export interface TableRowEditorProps {
  readonly row: FamilyTableRow;
  readonly onChange: (row: FamilyTableRow) => void;
  readonly disabled: boolean;
  readonly library: CatalogLibrary;
  /** Οι άξονες του σχήματος του πίνακα. */
  readonly axes: readonly AttributeRecord[];
  /** Ιδιότητες που μπορούν να γίνουν γραμμή (της οικογένειας, όχι άξονες). */
  readonly rowAttributes: readonly AttributeRecord[];
}

export function TableRowEditor({ row, onChange, disabled, library, axes, rowAttributes }: TableRowEditorProps) {
  const { t } = useCatalogText();
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{t(TABLE_ROW_KIND_KEYS[row.kind])}</span>
      {row.kind === 'groupHeader' ? (
        <InlineLocalizedInputs value={row.labels} disabled={disabled} label={t('families.table.headerLabel')} onChange={(labels) => onChange({ ...row, labels })} />
      ) : null}
      {row.kind === 'axis' ? (
        <AttributePicker className="w-56" value={row.axisAttributeId} options={axes} disabled={disabled} placeholder={t('families.table.chooseAxis')} ariaLabel={t('families.table.axis')} onChange={(axisAttributeId) => onChange({ ...row, axisAttributeId })} />
      ) : null}
      {row.kind === 'attribute' ? (
        <AttributeRowFields row={row} onChange={onChange} disabled={disabled} library={library} rowAttributes={rowAttributes} selectAxes={axes.filter((axis) => axis.type === 'select')} />
      ) : null}
    </span>
  );
}
