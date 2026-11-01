'use client';

/**
 * @fileoverview **Ο διάλογος χειροκίνητης επιλογής** — μοντέλα και απλά προϊόντα, με οικογένεια και άλμα σε κωδικό
 *   (ADR-923 §5.6.1).
 * @related products/use-product-list.ts (τα ίδια ζωντανά παράθυρα με τη σελίδα προϊόντων) · products/CodeJumpField.tsx
 * @module components/catalog/publishing/PublicationSelectionDialog
 *
 * 🔑 **Καμία δεύτερη λίστα προϊόντων**: οι γραμμές είναι του `useProductList`, το άλμα του `CodeJumpField`. Το άλμα φτάνει ως τις
 *    παραλλαγές, που η λίστα δεν δείχνει, και βρίσκει κωδικό σε όλο τον κατάλογο, όχι μόνο στο φορτωμένο παράθυρο.
 * ⚠️ Ο καλών το αποδίδει **μόνο όσο είναι ανοιχτό**: τα παράθυρα είναι ζωντανοί ακροατές και μια συνταγή δεν τους χρειάζεται.
 * ⚠️ Το `CodeJumpField` είναι `<form>`: ζει μέσα σε πύλη διαλόγου, άρα δεν φωλιάζει στη φόρμα της συνταγής.
 */

import React, { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ClearableSelect } from '@/components/ui/clearable-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SelectItem } from '@/components/ui/select';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import { useCatalogSettings } from '@/hooks/catalog/useCatalogSettings';
import type { FacetSelection } from '@/subapps/catalog/list/catalog-list-query';
import { PUBLICATION_LIMITS } from '@/subapps/catalog/publishing/publication-vocabulary';
import type { PublicationSelectionEntry } from '@/subapps/catalog/types/publication';
import { uniqueAttributeRefsOf } from '@/subapps/catalog/list/catalog-code-jump';
import { CodeJumpField } from '../products/CodeJumpField';
import { rowIdentifier, rowLabel, type CatalogListRow } from '../products/product-list-rows';
import { useProductList } from '../products/use-product-list';
import { useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';

const NO_FACETS: FacetSelection = [];

export interface PublicationSelectionDialogProps {
  readonly entries: readonly PublicationSelectionEntry[];
  readonly onToggle: (entry: PublicationSelectionEntry, on: boolean) => void;
  readonly onClose: () => void;
}

const entryOf = (row: CatalogListRow): PublicationSelectionEntry => ({ kind: row.kind === 'model' ? 'productModel' : 'product', id: row.id });

function usePickerList() {
  const notice = useCatalogFailureNotice();
  const library = useCatalogLibrary(notice);
  const settings = useCatalogSettings();
  const families = useCatalogCollection('CATALOG_FAMILIES').items;
  const familyById = useMemo(() => new Map(families.map((family) => [family.id, family])), [families]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const filter = useMemo(() => ({ familyId, facets: NO_FACETS, sort: 'label' as const }), [familyId]);
  const list = useProductList({ filter, families: familyById, attributes: library.attributeById, settings: settings.definition });
  const uniqueAttributes = useMemo(() => uniqueAttributeRefsOf(library.attributes), [library.attributes]);
  return { families, familyId, setFamilyId, list, uniqueAttributes };
}

function FamilyFilter({ picker }: { readonly picker: ReturnType<typeof usePickerList> }) {
  const { t, text } = useCatalogText();
  const id = useId();
  return (
    <span className="grid gap-1">
      <Label htmlFor={id}>{t('publishing.selection.family')}</Label>
      <ClearableSelect id={id} value={picker.familyId ?? ''} placeholder={t('publishing.selection.allFamilies')} clearLabel={t('publishing.selection.allFamilies')}
        onValueChange={(value) => picker.setFamilyId(value === '' ? null : value)}>
        {picker.families.map((family) => <SelectItem key={family.id} value={family.id}>{text(family.labels, family.code)}</SelectItem>)}
      </ClearableSelect>
    </span>
  );
}

function PickerRow({ row, checked, blocked, onToggle }: {
  readonly row: CatalogListRow;
  readonly checked: boolean;
  readonly blocked: boolean;
  readonly onToggle: (entry: PublicationSelectionEntry, on: boolean) => void;
}) {
  const { t } = useCatalogText();
  const id = useId();
  const code = rowIdentifier(row) ?? t('publishing.selection.noCode');
  const label = rowLabel(row);
  return (
    <li className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} disabled={blocked && !checked} onCheckedChange={(next) => onToggle(entryOf(row), next === true)} />
      <Label htmlFor={id} className="min-w-0 truncate"><span className="font-mono">{code}</span>{label ? ` · ${label}` : ''}</Label>
    </li>
  );
}

function PickerRows({ picker, entries, onToggle }: { readonly picker: ReturnType<typeof usePickerList>; readonly entries: readonly PublicationSelectionEntry[]; readonly onToggle: PublicationSelectionDialogProps['onToggle'] }) {
  const { t } = useCatalogText();
  const { list } = picker;
  const chosen = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);
  const blocked = entries.length >= PUBLICATION_LIMITS.maxSelectionEntries;
  if (list.state === 'failed') return <p className="m-0 text-sm text-destructive" role="alert">{t('publishing.selection.unavailable')}</p>;
  if (list.state === 'ready' && list.rows.length === 0) return <p className="m-0 text-sm text-muted-foreground">{t('publishing.selection.noRows')}</p>;
  return (
    <>
      <ul className="m-0 flex max-h-72 list-none flex-col gap-2 overflow-auto p-0" aria-label={t('publishing.selection.pick')}>
        {list.rows.map((row) => <PickerRow key={row.id} row={row} checked={chosen.has(row.id)} blocked={blocked} onToggle={onToggle} />)}
      </ul>
      {blocked ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('publishing.selection.limit', { max: PUBLICATION_LIMITS.maxSelectionEntries })}</p> : null}
      {list.hasMore ? <Button type="button" variant="outline" size="sm" className="self-start" onClick={list.grow}>{t('publishing.selection.more')}</Button> : null}
    </>
  );
}

export function PublicationSelectionDialog({ entries, onToggle, onClose }: PublicationSelectionDialogProps) {
  const { t } = useCatalogText();
  const picker = usePickerList();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('publishing.selection.pick')}</DialogTitle>
          <DialogDescription>{t('publishing.selection.description')}</DialogDescription>
        </DialogHeader>
        <section className="flex min-w-0 flex-col gap-3">
          <CodeJumpField uniqueAttributes={picker.uniqueAttributes} onFound={(target) => onToggle(target, true)} />
          <FamilyFilter picker={picker} />
          <PickerRows picker={picker} entries={entries} onToggle={onToggle} />
        </section>
        <DialogFooter>
          <Button type="button" onClick={onClose}>{t('publishing.selection.done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
