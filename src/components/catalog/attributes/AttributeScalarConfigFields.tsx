'use client';

/**
 * @fileoverview **Τα πεδία ρύθμισης των «απλών» τύπων ιδιότητας** — κείμενο, αριθμός, μέτρηση, ημερομηνία, αρχείο,
 *   σύνδεση (ADR-923 §5.2 · Φάση 1γ). Οι επιλογές και ο πίνακας ζουν σε δικά τους αρχεία (έχουν γραμμές).
 * @module components/catalog/attributes/AttributeScalarConfigFields
 *
 * 🔑 Κάθε όριο είναι **προαιρετικό ρητά** (διακόπτης + αριθμός): το `0` είναι έγκυρο ελάχιστο, όχι «κενό».
 * 🔑 Μέτρηση: η μονάδα προτείνεται από την **επιλεγμένη** οικογένεια — αλλαγή οικογένειας ⇒ μονάδα = το πρότυπό της,
 *    ποτέ μονάδα άλλης οικογένειας που θα απέρριπτε ο γραφέας.
 */

import React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiCombobox } from '@/components/ui/multi-combobox';
import { NumericField } from '@/components/ui/numeric-field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type {
  AssetAttributeConfig,
  DateAttributeConfig,
  MeasurementAttributeConfig,
  NumberAttributeConfig,
  ReferenceAttributeConfig,
  RichTextAttributeConfig,
  TextAttributeConfig,
} from '@/subapps/catalog/types/attribute';
import { ASSET_KINDS, REFERENCE_RELATIONS } from '@/subapps/catalog/vocabulary/attribute-types';
import { CATALOG_LIMITS } from '@/subapps/catalog/vocabulary/catalog-limits';
import { useMeasurementFamilyName } from '../measurements/MeasurementFamilyList';
import { ASSET_KIND_KEYS, REFERENCE_RELATION_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogField, OptionalNumberField, SwitchField } from '../shared/CatalogFormFields';
import { FieldIssues } from '../shared/CatalogIssues';

interface ConfigProps<C> {
  readonly config: C;
  readonly onChange: (config: C) => void;
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
}

export function TextConfigFields({ config, onChange, issues, disabled }: ConfigProps<TextAttributeConfig>) {
  const { t } = useCatalogText();
  return (
    <>
      <OptionalNumberField label={t('attributes.config.maxLength')} value={config.maxLength} initial={100} min={1} disabled={disabled} onChange={(maxLength) => onChange({ ...config, maxLength })} />
      <CatalogField label={t('attributes.config.pattern')} hint={t('attributes.config.patternHint')} issues={issues} path="config.pattern">
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} className="font-mono" disabled={disabled} value={config.pattern ?? ''} onChange={(event) => onChange({ ...config, pattern: event.target.value.length > 0 ? event.target.value : null })} />
        )}
      </CatalogField>
    </>
  );
}

export function RichTextConfigFields({ config, onChange, disabled }: ConfigProps<RichTextAttributeConfig>) {
  const { t } = useCatalogText();
  return <OptionalNumberField label={t('attributes.config.maxLength')} value={config.maxLength} initial={2000} min={1} disabled={disabled} onChange={(maxLength) => onChange({ maxLength })} />;
}

export function NumberConfigFields<C extends NumberAttributeConfig>({ config, onChange, issues, disabled }: ConfigProps<C>) {
  const { t } = useCatalogText();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <OptionalNumberField label={t('attributes.config.min')} value={config.min} disabled={disabled} onChange={(min) => onChange({ ...config, min })} />
        <OptionalNumberField label={t('attributes.config.max')} value={config.max} disabled={disabled} onChange={(max) => onChange({ ...config, max })} />
      </div>
      <FieldIssues issues={issues} path="config.min" exact />
      <CatalogField label={t('attributes.config.decimals')} issues={issues} path="config.decimals">
        {({ id, describedBy }) => (
          <NumericField id={id} aria-describedby={describedBy} className="w-24" value={config.decimals} min={0} max={CATALOG_LIMITS.maxDecimals} step={1} disabled={disabled} onValueChange={(decimals) => onChange({ ...config, decimals })} />
        )}
      </CatalogField>
      <SwitchField label={t('attributes.config.negativeAllowed')} checked={config.negativeAllowed} disabled={disabled} onChange={(negativeAllowed) => onChange({ ...config, negativeAllowed })} />
    </>
  );
}

interface MeasurementConfigProps extends ConfigProps<MeasurementAttributeConfig> {
  readonly registry: MeasurementRegistry;
}

export function MeasurementConfigFields({ config, onChange, issues, disabled, registry }: MeasurementConfigProps) {
  const { t } = useCatalogText();
  const nameOf = useMeasurementFamilyName();
  const family = registry.get(config.measurementFamilyCode);
  const sources = [
    { key: 'workspace', label: t('measurement.workspaceFamilies'), items: registry.families.filter((item) => item.source === 'workspace') },
    { key: 'platform', label: t('measurement.platformFamilies'), items: registry.families.filter((item) => item.source === 'platform') },
  ].filter((group) => group.items.length > 0);
  const chooseFamily = (code: string) => {
    const next = registry.get(code);
    if (next) onChange({ ...config, measurementFamilyCode: code, defaultUnitCode: next.standardUnitCode });
  };
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <CatalogField label={t('attributes.config.measurementFamily')} issues={issues} path="config.measurementFamilyCode">
          {({ id, describedBy }) => (
            <Select value={family ? config.measurementFamilyCode : ''} disabled={disabled} onValueChange={chooseFamily}>
              <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue placeholder={t('attributes.config.chooseFamily')} /></SelectTrigger>
              <SelectContent>
                {sources.map((group) => (
                  <SelectGroup key={group.key}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.items.map((item) => <SelectItem key={item.code} value={item.code}>{nameOf(item)}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}
        </CatalogField>
        <CatalogField label={t('attributes.config.defaultUnit')} hint={t('attributes.config.defaultUnitHint')} issues={issues} path="config.unitCode">
          {({ id, describedBy }) => (
            <Select value={family?.units.some((unit) => unit.code === config.defaultUnitCode) ? config.defaultUnitCode : ''} disabled={disabled || !family} onValueChange={(defaultUnitCode) => onChange({ ...config, defaultUnitCode })}>
              <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue placeholder={t('attributes.config.chooseUnit')} /></SelectTrigger>
              <SelectContent>
                {(family?.units ?? []).map((unit) => <SelectItem key={unit.code} value={unit.code}>{unit.symbol}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </CatalogField>
      </div>
      <NumberConfigFields config={config} onChange={onChange} issues={issues} disabled={disabled} />
    </>
  );
}

export function DateConfigFields({ config, onChange, issues, disabled }: ConfigProps<DateAttributeConfig>) {
  const { t } = useCatalogText();
  const dateField = (key: 'min' | 'max', labelKey: string) => (
    <CatalogField label={t(labelKey)} issues={issues} path={`config.${key}`}>
      {({ id, describedBy }) => (
        <Input id={id} type="date" aria-describedby={describedBy} disabled={disabled} value={config[key] ?? ''} onChange={(event) => onChange({ ...config, [key]: event.target.value.length > 0 ? event.target.value : null })} />
      )}
    </CatalogField>
  );
  return <div className="grid gap-3 sm:grid-cols-2">{dateField('min', 'attributes.config.minDate')}{dateField('max', 'attributes.config.maxDate')}</div>;
}

export function AssetConfigFields({ config, onChange, issues, disabled }: ConfigProps<AssetAttributeConfig>) {
  const { t } = useCatalogText();
  const toggle = (kind: AssetAttributeConfig['assetKinds'][number], on: boolean) =>
    onChange({ ...config, assetKinds: on ? [...config.assetKinds, kind] : config.assetKinds.filter((item) => item !== kind) });
  return (
    <>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-medium text-foreground">{t('attributes.config.assetKinds')}</legend>
        <ul className="m-0 flex list-none flex-wrap gap-4 p-0">
          {ASSET_KINDS.map((kind) => (
            <li key={kind} className="flex items-center gap-2">
              <Checkbox id={`asset-${kind}`} checked={config.assetKinds.includes(kind)} disabled={disabled} onCheckedChange={(on) => toggle(kind, on === true)} />
              <Label htmlFor={`asset-${kind}`} className="font-normal">{t(ASSET_KIND_KEYS[kind])}</Label>
            </li>
          ))}
        </ul>
        <FieldIssues issues={issues} path="config.assetKinds" exact />
      </fieldset>
      <CatalogField label={t('attributes.config.maxFiles')}>
        {({ id, describedBy }) => (
          <NumericField id={id} aria-describedby={describedBy} className="w-24" value={config.maxFiles} min={1} max={100} step={1} disabled={disabled} onValueChange={(maxFiles) => onChange({ ...config, maxFiles })} />
        )}
      </CatalogField>
    </>
  );
}

interface ReferenceConfigProps extends ConfigProps<ReferenceAttributeConfig> {
  /** Οι οικογένειες του χώρου: κωδικός → ετικέτα. */
  readonly families: readonly { readonly code: string; readonly label: string }[];
}

export function ReferenceConfigFields({ config, onChange, issues, disabled, families }: ReferenceConfigProps) {
  const { t } = useCatalogText();
  return (
    <>
      <CatalogField label={t('attributes.config.relation')}>
        {({ id, describedBy }) => (
          <Select value={config.relation} disabled={disabled} onValueChange={(relation) => {
            const match = REFERENCE_RELATIONS.find((item) => item === relation);
            if (match) onChange({ ...config, relation: match });
          }}>
            <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue /></SelectTrigger>
            <SelectContent>
              {REFERENCE_RELATIONS.map((relation) => <SelectItem key={relation} value={relation}>{t(REFERENCE_RELATION_KEYS[relation])}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </CatalogField>
      <CatalogField label={t('attributes.config.targetFamilies')} hint={t('attributes.config.targetFamiliesHint')} issues={issues} path="config.targetFamilyCodes">
        {() => (
          <MultiCombobox
            value={[...config.targetFamilyCodes]}
            onChange={(targetFamilyCodes) => onChange({ ...config, targetFamilyCodes })}
            options={families.map((family) => ({ value: family.code, label: family.label }))}
            ariaLabel={t('attributes.config.targetFamilies')}
            disabled={disabled}
          />
        )}
      </CatalogField>
      <OptionalNumberField label={t('attributes.config.maxReferences')} value={config.maxReferences} initial={1} min={1} disabled={disabled} onChange={(maxReferences) => onChange({ ...config, maxReferences })} />
    </>
  );
}
