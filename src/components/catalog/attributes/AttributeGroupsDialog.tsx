'use client';

/**
 * @fileoverview **Οι ομάδες ιδιοτήτων** — δημιουργία, μετονομασία, αναδιάταξη, διαγραφή (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/attributes/AttributeGroupsDialog
 *
 * 🔑 Ομάδα = ενότητα **της βιβλιοθήκης** (Akeneo attribute groups · Revit «Group parameter under»): «Ψύξη» είναι η
 *    ίδια ενότητα σε κάθε οικογένεια. Η σειρά τους είναι **καθολική** — ένα κλειδί ανά ομάδα, μία εγγραφή ανά μετακίνηση.
 * 🔑 Κάθε αλλαγή αισιόδοξη· η διαγραφή ομάδας που έχει ιδιότητες την αρνείται ο γραφέας («χρησιμοποιείται») και η
 *    ομάδα επιστρέφει.
 */

import React, { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { dequal } from 'dequal';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SortableList } from '@/components/ui/sortable/SortableList';
import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import type { LocalizedText } from '@/i18n/localized-text';
import type { AttributeGroupRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogAttributeGroupDefinition } from '@/subapps/catalog/types/attribute-group';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';
import { deleteDefinition, newEntityKey, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { orderKeyAtEnd, orderKeyBetween } from '../shared/catalog-ordering';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { InlineLocalizedInputs } from '../shared/LocalizedTextField';

interface AttributeGroupsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly groups: readonly AttributeGroupRecord[];
  readonly ops: CatalogOptimistic<AttributeGroupRecord>;
  readonly canManage: boolean;
}

const definitionOf = (group: AttributeGroupRecord): CatalogAttributeGroupDefinition => ({
  code: group.code,
  labels: group.labels,
  orderKey: group.orderKey,
});

function saveGroup(ops: CatalogOptimistic<AttributeGroupRecord>, existing: AttributeGroupRecord | null, definition: CatalogAttributeGroupDefinition) {
  saveDefinition(ops, {
    kind: 'attributeGroup',
    existing,
    definition,
    optimistic: optimisticWire(definition, existing, newEntityKey(definition.code)),
  });
}

function GroupRow({ group, handle, ops, canManage }: {
  readonly group: AttributeGroupRecord;
  readonly handle: React.ReactNode;
  readonly ops: CatalogOptimistic<AttributeGroupRecord>;
  readonly canManage: boolean;
}) {
  const { t, text } = useCatalogText();
  const [labels, setLabels] = useState<LocalizedText>(group.labels);
  const name = text(group.labels, group.code);
  const changed = !dequal(labels, group.labels);
  return (
    <span className="flex flex-wrap items-center gap-2 py-1">
      {handle}
      <code className="w-28 truncate text-xs text-muted-foreground">{group.code}</code>
      <InlineLocalizedInputs value={labels} onChange={setLabels} disabled={!canManage} label={t('attributes.groups.labelOf', { name })} />
      <Button type="button" variant="ghost" size="icon" disabled={!canManage || !changed} aria-label={t('attributes.groups.saveOf', { name })}
        onClick={() => saveGroup(ops, group, { ...definitionOf(group), labels })}>
        <Check className="h-4 w-4" aria-hidden />
      </Button>
      <Button type="button" variant="ghost" size="icon" disabled={!canManage} aria-label={t('attributes.groups.deleteOf', { name })}
        onClick={() => deleteDefinition(ops, 'attributeGroup', group)}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </span>
  );
}

function NewGroupForm({ groups, ops }: { readonly groups: readonly AttributeGroupRecord[]; readonly ops: CatalogOptimistic<AttributeGroupRecord> }) {
  const { t } = useCatalogText();
  const [labels, setLabels] = useState<LocalizedText>({});
  const code = suggestCatalogCode(labels[DEFAULT_LANGUAGE] ?? '');
  const taken = groups.some((group) => group.code === code);
  const create = () => {
    saveGroup(ops, null, { code, labels, orderKey: orderKeyAtEnd(groups) });
    setLabels({});
  };
  return (
    <form className="flex flex-wrap items-center gap-2 border-t pt-3" onSubmit={(event) => { event.preventDefault(); if (code && !taken) create(); }}>
      <InlineLocalizedInputs value={labels} onChange={setLabels} label={t('attributes.groups.newLabelOf')} />
      <code className="text-xs text-muted-foreground">{code || '—'}</code>
      <Button type="submit" size="sm" disabled={code.length === 0 || taken}>{t('attributes.groups.create')}</Button>
      {taken ? <span className="w-full text-xs text-destructive" role="alert">{t('issues.duplicateCode', { code })}</span> : null}
    </form>
  );
}

export function AttributeGroupsDialog({ open, onOpenChange, groups, ops, canManage }: AttributeGroupsDialogProps) {
  const { t, text } = useCatalogText();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('attributes.groups.title')}</DialogTitle>
          <DialogDescription>{t('attributes.groups.lead')}</DialogDescription>
        </DialogHeader>
        {groups.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t('attributes.groups.none')}</p> : null}
        <SortableList
          items={groups}
          getId={(group) => group.id}
          getLabel={(group) => text(group.labels, group.code)}
          ariaLabel={t('attributes.groups.title')}
          disabled={!canManage}
          onMove={(move) => {
            const group = groups.find((item) => item.id === move.id);
            if (group) saveGroup(ops, group, { ...definitionOf(group), orderKey: orderKeyBetween(groups, move) });
          }}
          renderItem={(group, handle) => <GroupRow key={`${group.id}-${group.revision}`} group={group} handle={handle} ops={ops} canManage={canManage} />}
        />
        {canManage ? <NewGroupForm groups={groups} ops={ops} /> : null}
      </DialogContent>
    </Dialog>
  );
}
