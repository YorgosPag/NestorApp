'use client';

/**
 * @fileoverview **Τα πεδία ρύθμισης ανά τύπο ιδιότητας** — ένας dispatcher πάνω στο discriminated union, και οι
 *   προαιρετικές αντιστοιχίσεις σε εξωτερικά λεξικά (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/attributes/AttributeConfigFields
 *
 * 🔑 Το `switch` είναι **εξαντλητικό** στο `type`: νέος τύπος ιδιότητας χωρίς πεδία ρύθμισης δεν μεταγλωττίζεται
 *    (ο κλάδος `never`). Κάθε κλάδος γράφει πίσω `{ ...draft, config }` στο **ίδιο** μέλος της ένωσης.
 * 🔑 Αντιστοιχίσεις (ETIM · bSDD · IFC Pset · ΑΤΟΕ): **προαιρετικές**, σε αναδιπλούμενη ενότητα — ο κατάλογος δεν
 *    απαιτεί ποτέ ETIM (ADR-923 §6), αλλά όποιος το θέλει βρίσκει τη θέση του. Η δέσμευση στο Κοινό Λεξικό (§17) δεν
 *    γράφεται από εδώ.
 */

import React from 'react';

import { Input } from '@/components/ui/input';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { AttributeMappings, CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogField, OptionalNumberField } from '../shared/CatalogFormFields';
import {
  AssetConfigFields,
  DateConfigFields,
  MeasurementConfigFields,
  NumberConfigFields,
  ReferenceConfigFields,
  RichTextConfigFields,
  TextConfigFields,
} from './AttributeScalarConfigFields';
import { OptionsEditor } from './OptionsEditor';
import { TableColumnsEditor } from './TableColumnsEditor';

interface AttributeConfigFieldsProps {
  readonly draft: CatalogAttributeDefinition;
  readonly onChange: (draft: CatalogAttributeDefinition) => void;
  readonly registry: MeasurementRegistry;
  readonly families: readonly { readonly code: string; readonly label: string }[];
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
}

export function AttributeConfigFields({ draft, onChange, registry, families, issues, disabled }: AttributeConfigFieldsProps) {
  const { t } = useCatalogText();
  const common = { issues, disabled };
  switch (draft.type) {
    case 'text':
      return <TextConfigFields {...common} config={draft.config} onChange={(config) => onChange({ ...draft, config })} />;
    case 'richText':
      return <RichTextConfigFields {...common} config={draft.config} onChange={(config) => onChange({ ...draft, config })} />;
    case 'number':
      return <NumberConfigFields {...common} config={draft.config} onChange={(config) => onChange({ ...draft, config })} />;
    case 'measurement':
      return <MeasurementConfigFields {...common} registry={registry} config={draft.config} onChange={(config) => onChange({ ...draft, config })} />;
    case 'boolean':
      return <p className="m-0 text-sm text-muted-foreground">{t('attributes.config.booleanHint')}</p>;
    case 'select':
      return <OptionsEditor {...common} path="config.options" options={draft.config.options} onChange={(options) => onChange({ ...draft, config: { options } })} />;
    case 'multiSelect':
      return (
        <>
          <OptionsEditor {...common} path="config.options" options={draft.config.options} onChange={(options) => onChange({ ...draft, config: { ...draft.config, options } })} />
          <OptionalNumberField label={t('attributes.config.maxSelections')} value={draft.config.maxSelections} initial={2} min={1} disabled={disabled} onChange={(maxSelections) => onChange({ ...draft, config: { ...draft.config, maxSelections } })} />
        </>
      );
    case 'date':
      return <DateConfigFields {...common} config={draft.config} onChange={(config) => onChange({ ...draft, config })} />;
    case 'asset':
      return <AssetConfigFields {...common} config={draft.config} onChange={(config) => onChange({ ...draft, config })} />;
    case 'reference':
      return <ReferenceConfigFields {...common} families={families} config={draft.config} onChange={(config) => onChange({ ...draft, config })} />;
    case 'table':
      return <TableColumnsEditor {...common} registry={registry} columns={draft.config.columns} onChange={(columns) => onChange({ ...draft, config: { columns } })} />;
    default: {
      const exhaustive: never = draft;
      return exhaustive;
    }
  }
}

/** Κενό ⇒ `null` (το «δεν αντιστοιχίζεται» είναι ρητό στο σχήμα). */
const orNull = (value: string): string | null => (value.trim().length > 0 ? value.trim() : null);

interface AttributeMappingsFieldsProps {
  readonly mappings: AttributeMappings;
  readonly onChange: (mappings: AttributeMappings) => void;
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
}

export function AttributeMappingsFields({ mappings, onChange, issues, disabled }: AttributeMappingsFieldsProps) {
  const { t } = useCatalogText();
  const ifc = mappings.ifc ?? { pset: '', property: '' };
  const setIfc = (next: { pset: string; property: string }) =>
    onChange({ ...mappings, ifc: next.pset.length > 0 || next.property.length > 0 ? next : null });
  const text = (key: 'etimFeature' | 'bsddUri' | 'atoeCode', labelKey: string, hintKey: string) => (
    <CatalogField label={t(labelKey)} hint={t(hintKey)} issues={issues} path={`mappings.${key}`}>
      {({ id, describedBy }) => (
        <Input id={id} aria-describedby={describedBy} className="font-mono" disabled={disabled} value={mappings[key] ?? ''} onChange={(event) => onChange({ ...mappings, [key]: orNull(event.target.value) })} />
      )}
    </CatalogField>
  );
  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">{t('attributes.mappings.title')}</summary>
      <p className="m-0 mt-2 text-xs text-muted-foreground">{t('attributes.mappings.lead')}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {text('etimFeature', 'attributes.mappings.etim', 'attributes.mappings.etimHint')}
        {text('bsddUri', 'attributes.mappings.bsdd', 'attributes.mappings.bsddHint')}
        <CatalogField label={t('attributes.mappings.ifcPset')} issues={issues} path="mappings.ifc">
          {({ id }) => <Input id={id} className="font-mono" disabled={disabled} value={ifc.pset} onChange={(event) => setIfc({ ...ifc, pset: event.target.value })} />}
        </CatalogField>
        <CatalogField label={t('attributes.mappings.ifcProperty')}>
          {({ id }) => <Input id={id} className="font-mono" disabled={disabled} value={ifc.property} onChange={(event) => setIfc({ ...ifc, property: event.target.value })} />}
        </CatalogField>
        {text('atoeCode', 'attributes.mappings.atoe', 'attributes.mappings.atoeHint')}
      </div>
    </details>
  );
}
