'use client';

/**
 * @fileoverview **Καρτέλα «Παραλλαγές» της οικογένειας** — σχήματα, άξονες ανά επίπεδο, κατανομή ιδιοτήτων
 *   (Akeneo family variants: έως 2 επίπεδα, έως 5 άξονες) (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/families/FamilyVariantsTab
 *
 * 🔑 **Άξονας μόνο ό,τι επιτρέπει ο επικυρωτής** (επιλογή · ναι/όχι · μέτρηση, χωρίς τιμή ανά γλώσσα/κανάλι) — ο
 *    επιλογέας δεν προσφέρει τίποτα άλλο. Ένας άξονας ανήκει σε **ένα** επίπεδο: στα άλλα δεν προσφέρεται.
 * 🔑 Μετονομασία κωδικού σχήματος **μεταφέρει** και τον πίνακα καταλόγου που το χρησιμοποιεί· διαγραφή σχήματος
 *    αδειάζει τον πίνακα του — καμία ορφανή αναφορά.
 */

import React from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MultiCombobox } from '@/components/ui/multi-combobox';
import type { CatalogFamilyDefinition, VariantScheme } from '@/subapps/catalog/types/family';
import { CATALOG_LIMITS } from '@/subapps/catalog/vocabulary/catalog-limits';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogCodeField, CatalogField } from '../shared/CatalogFormFields';
import { FieldIssues } from '../shared/CatalogIssues';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import type { FamilyTabProps } from './AttributePicker';
import { axisCandidates } from './family-draft';
import { VariantLevelBoard } from './VariantLevelBoard';

function withScheme(draft: CatalogFamilyDefinition, index: number, next: VariantScheme): CatalogFamilyDefinition {
  const previous = draft.variantSchemes[index];
  const renamed = draft.tableSpec !== null && previous !== undefined && draft.tableSpec.variantSchemeCode === previous.code;
  return {
    ...draft,
    variantSchemes: draft.variantSchemes.map((scheme, at) => (at === index ? next : scheme)),
    tableSpec: renamed && draft.tableSpec ? { ...draft.tableSpec, variantSchemeCode: next.code } : draft.tableSpec,
  };
}

function withoutScheme(draft: CatalogFamilyDefinition, index: number): CatalogFamilyDefinition {
  const removed = draft.variantSchemes[index];
  return {
    ...draft,
    variantSchemes: draft.variantSchemes.filter((_, at) => at !== index),
    tableSpec: draft.tableSpec && removed && draft.tableSpec.variantSchemeCode === removed.code ? null : draft.tableSpec,
  };
}

/** Νέοι άξονες ενός επιπέδου — και φεύγουν από τις κατανομές, αφού οι άξονες ζουν αυτόματα στο επίπεδό τους. */
function withAxes(scheme: VariantScheme, levelIndex: number, axes: readonly string[]): VariantScheme {
  return {
    ...scheme,
    levels: scheme.levels.map((level, index) => ({
      axisAttributeIds: index === levelIndex ? axes : level.axisAttributeIds,
      attributeIds: level.attributeIds.filter((id) => !axes.includes(id)),
    })),
  };
}

function SchemeCard({ scheme, index, props }: { readonly scheme: VariantScheme; readonly index: number; readonly props: FamilyTabProps }) {
  const { t, text } = useCatalogText();
  const { draft, update, issues, disabled, inFamily } = props;
  const path = `variantSchemes[${index}]`;
  const set = (next: VariantScheme) => update(withScheme(draft, index, next));
  const candidates = axisCandidates(inFamily);
  const axesElsewhere = (levelIndex: number) => new Set(scheme.levels.flatMap((level, at) => (at === levelIndex ? [] : level.axisAttributeIds)));
  return (
    <section className="flex flex-col gap-3 rounded-md border p-3" aria-label={text(scheme.labels, scheme.code)}>
      <header className="flex items-start justify-between gap-2">
        <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-foreground"><Layers className="h-4 w-4" aria-hidden />{text(scheme.labels, scheme.code) || t('families.variants.scheme')}</h3>
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t('families.variants.removeScheme')} onClick={() => update(withoutScheme(draft, index))}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <LocalizedTextField label={t('common.labels')} value={scheme.labels} disabled={disabled} issues={issues} path={`${path}.labels`} onChange={(labels) => set({ ...scheme, labels })} />
        <CatalogCodeField value={scheme.code} locked={false} disabled={disabled} suggestFrom={text(scheme.labels)} issues={issues} path={`${path}.code`} onChange={(code) => set({ ...scheme, code })} />
      </div>
      {scheme.levels.map((level, levelIndex) => (
        <CatalogField key={levelIndex} label={t('families.variants.axesOf', { number: levelIndex + 1 })} hint={t('families.variants.axesHint', { max: CATALOG_LIMITS.maxAxesPerLevel })}>
          {() => (
            <MultiCombobox
              value={[...level.axisAttributeIds]}
              options={candidates.filter((attribute) => !axesElsewhere(levelIndex).has(attribute.id)).map((attribute) => ({ value: attribute.id, label: text(attribute.labels, attribute.code) }))}
              onChange={(axes) => set(withAxes(scheme, levelIndex, axes))}
              ariaLabel={t('families.variants.axesOf', { number: levelIndex + 1 })}
              disabled={disabled}
            />
          )}
        </CatalogField>
      ))}
      <FieldIssues issues={issues} path={`${path}.levels`} />
      <span className="flex gap-2">
        {scheme.levels.length < CATALOG_LIMITS.maxVariantLevels ? (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => set({ ...scheme, levels: [...scheme.levels, { axisAttributeIds: [], attributeIds: [] }] })}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />{t('families.variants.addLevel')}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => set({ ...scheme, levels: scheme.levels.slice(0, 1) })}>
            {t('families.variants.removeLevel')}
          </Button>
        )}
      </span>
      <VariantLevelBoard scheme={scheme} attributes={inFamily} disabled={disabled} onChange={set} />
    </section>
  );
}

export function FamilyVariantsTab(props: FamilyTabProps) {
  const { t } = useCatalogText();
  const { draft, update, disabled, issues } = props;
  // Κενός κωδικός: τον προτείνει η ετικέτα μόλις γραφτεί (`CatalogCodeField`).
  const addScheme = () =>
    update({ ...draft, variantSchemes: [...draft.variantSchemes, { code: '', labels: {}, levels: [{ axisAttributeIds: [], attributeIds: [] }] }] });
  return (
    <section className="flex flex-col gap-3">
      <p className="m-0 text-sm text-muted-foreground">{t('families.variants.lead')}</p>
      {draft.variantSchemes.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t('families.variants.none')}</p> : null}
      {draft.variantSchemes.map((scheme, index) => <SchemeCard key={index} scheme={scheme} index={index} props={props} />)}
      <FieldIssues issues={issues.filter((issue) => issue.path === 'variantSchemes')} path="variantSchemes" exact />
      <Button type="button" variant="outline" className="self-start" disabled={disabled || draft.variantSchemes.length >= CATALOG_LIMITS.maxVariantSchemes} onClick={addScheme}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />{t('families.variants.addScheme')}
      </Button>
    </section>
  );
}
