'use client';

/**
 * @fileoverview **Καρτέλα «Σύνθετες ενδείξεις» της οικογένειας** — π.χ. «Ηλεκτρική παροχή» = «1~ 230 V 50 Hz» από τρεις
 *   δομημένες ιδιότητες (ADR-923 §21.6 · IEC 61293).
 * @module components/catalog/families/FamilyCompositesTab
 *
 * 🔑 **Δηλωμένη, όχι τύπος**: ετικέτα, διαχωριστής, μέρη με σειρά — ποτέ κείμενο-τύπος (ArchiCAD `CONCAT`).
 * 🔑 **Ζωντανό πρότυπο** («[Φάσεις]~ [Τάση] V [Συχνότητα] Hz») από τον ίδιο κανόνα σύνδεσης με τη σύνθεση: ο άνθρωπος βλέπει
 *    σειρά, σύμβολα και μονάδες πριν υπάρξει προϊόν (το Revit ζητά να διαλέξεις πρότυπο από λίστα χωρίς να το δεις).
 * 🔑 Η αφαίρεση ένδειξης παίρνει μαζί τις γραμμές πίνακα που τη δείχνουν (`withoutComposite`).
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { compositeDisplaysOf, type CompositeDisplay } from '@/subapps/catalog/types/family';
import { compositeTemplate } from '@/subapps/catalog/values/composite-display';
import { displayUnitSymbol } from '@/subapps/catalog/values/measurement-in-unit';
import { isCompositePartType } from '@/subapps/catalog/vocabulary/attribute-types';
import { CATALOG_LIMITS } from '@/subapps/catalog/vocabulary/catalog-limits';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogField } from '../shared/CatalogFormFields';
import { FieldIssues } from '../shared/CatalogIssues';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import type { FamilyTabProps } from './AttributePicker';
import { CompositePartsList, newCompositePart } from './CompositePartsList';
import { nextLocalId, withoutComposite } from './family-draft';

/** IEC 61293 §4.2.5: τα μέρη χωρίζονται με κενό. */
const DEFAULT_SEPARATOR = ' ';

function CompositeTemplate({ composite, props }: { readonly composite: CompositeDisplay; readonly props: FamilyTabProps }) {
  const { t, text } = useCatalogText();
  const { library } = props;
  const template = compositeTemplate(composite, {
    nameOf: (attributeId) => { const attribute = library.attributeById.get(attributeId); return attribute ? text(attribute.labels, attribute.code) : attributeId; },
    unitSymbolOf: (part) => { const attribute = library.attributeById.get(part.attributeId); return attribute ? displayUnitSymbol(attribute, part.displayUnitCode, library.registry) : null; },
  });
  return (
    <p className="m-0 flex flex-wrap items-baseline gap-2 text-sm">
      <span className="text-xs text-muted-foreground">{t('families.composites.preview')}</span>
      <output className="rounded bg-muted px-2 py-0.5 font-mono text-foreground">{template}</output>
    </p>
  );
}

function CompositeCard({ composite, index, props }: { readonly composite: CompositeDisplay; readonly index: number; readonly props: FamilyTabProps }) {
  const { t } = useCatalogText();
  const { draft, update, disabled, issues, library, inFamily } = props;
  const path = `compositeDisplays[${index}]`;
  const set = (next: CompositeDisplay) => update({ ...draft, compositeDisplays: compositeDisplaysOf(draft).map((item, at) => (at === index ? next : item)) });
  return (
    <li className="flex list-none flex-col gap-3 rounded-md border p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <CompositeTemplate composite={composite} props={props} />
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t('families.composites.remove', { index: index + 1 })}
          onClick={() => update(withoutComposite(draft, composite.id))}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </header>
      <LocalizedTextField label={t('families.composites.labels')} value={composite.labels} disabled={disabled} issues={issues} path={`${path}.labels`}
        onChange={(labels) => set({ ...composite, labels })} />
      <CatalogField label={t('families.composites.separator')} hint={t('families.composites.separatorHint')} issues={issues} path={`${path}.separator`}>
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} className="w-20 text-center font-mono" value={composite.separator} disabled={disabled}
            maxLength={CATALOG_LIMITS.maxCompositeAffixLength} onChange={(event) => set({ ...composite, separator: event.target.value })} />
        )}
      </CatalogField>
      <CompositePartsList parts={composite.parts} options={inFamily.filter((attribute) => isCompositePartType(attribute.type))} library={library}
        disabled={disabled} onChange={(parts) => set({ ...composite, parts })} />
      <FieldIssues issues={issues} path={`${path}.parts`} />
    </li>
  );
}

export function FamilyCompositesTab(props: FamilyTabProps) {
  const { t } = useCatalogText();
  const { draft, update, disabled, issues, inFamily } = props;
  const composites = compositeDisplaysOf(draft);
  const options = inFamily.filter((attribute) => isCompositePartType(attribute.type));
  const add = () => update({
    ...draft,
    compositeDisplays: [...composites, {
      id: nextLocalId('cd', composites.map((composite) => composite.id)),
      labels: {},
      separator: DEFAULT_SEPARATOR,
      parts: [newCompositePart(options, [])],
    }],
  });
  return (
    <section className="flex flex-col gap-3">
      <p className="m-0 text-sm text-muted-foreground">{t('families.composites.lead')}</p>
      {composites.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t('families.composites.none')}</p> : null}
      <ul className="m-0 flex flex-col gap-2 p-0">{composites.map((composite, index) => <CompositeCard key={composite.id} composite={composite} index={index} props={props} />)}</ul>
      <FieldIssues issues={issues.filter((issue) => issue.path === 'compositeDisplays')} path="compositeDisplays" exact />
      <Button type="button" variant="outline" size="sm" className="self-start" disabled={disabled || options.length === 0 || composites.length >= CATALOG_LIMITS.maxCompositeDisplays} onClick={add}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />{t('families.composites.add')}
      </Button>
    </section>
  );
}
