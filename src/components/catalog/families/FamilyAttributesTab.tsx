'use client';

/**
 * @fileoverview **Καρτέλα «Ιδιότητες» της οικογένειας** — ποιες ιδιότητες, με ποια σειρά, υποχρεωτικές σε ποιο κανάλι
 *   (Akeneo attribute_requirements) (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/families/FamilyAttributesTab
 *
 * 🔑 Προσθήκη **από τη βιβλιοθήκη**, **ολόκληρης ομάδας** με μία κίνηση, ή **νέας ιδιότητας επί τόπου**.
 * 🔑 Η αφαίρεση καθαρίζει **και** τις αναφορές της (`withoutFamilyAttribute`) — άξονες, γραμμές, κανόνες.
 * 🔑 «Υποχρεωτικό ανά κανάλι» = πίνακας ιδιότητα × κανάλι με ρητή ετικέτα σε κάθε κουτί (αναγνώστης οθόνης: «Ψυκτική
 *    ισχύς H — Έντυπος κατάλογος»).
 */

import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortableList } from '@/components/ui/sortable/SortableList';
import { reorderByMove } from '@/components/ui/sortable/sortable-model';
import type { FamilyRecord } from '@/services/catalog/catalog-api.client';
import type { FamilyAttributeBinding } from '@/subapps/catalog/types/family';
import { CATALOG_CHANNELS, type CatalogChannel } from '@/subapps/catalog/vocabulary/channels';
import { ATTRIBUTE_TYPE_ICONS, ATTRIBUTE_TYPE_KEYS, CHANNEL_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import { AttributePicker, type FamilyTabProps } from './AttributePicker';
import { withoutFamilyAttribute } from './family-draft';
import { NewAttributeDialog } from './NewAttributeDialog';

const ROW_GRID = 'grid grid-cols-[1.5rem_minmax(10rem,1fr)_repeat(4,4.5rem)_2.25rem] items-center gap-2';

interface FamilyAttributesTabProps extends FamilyTabProps {
  readonly families: readonly FamilyRecord[];
  readonly canManage: boolean;
}

function toggleChannel(binding: FamilyAttributeBinding, channel: CatalogChannel, on: boolean): FamilyAttributeBinding {
  const channels = on ? [...binding.requiredChannels, channel] : binding.requiredChannels.filter((item) => item !== channel);
  return { ...binding, requiredChannels: CATALOG_CHANNELS.filter((item) => channels.includes(item)) };
}

function BindingRow({ binding, index, handle, props }: {
  readonly binding: FamilyAttributeBinding;
  readonly index: number;
  readonly handle: React.ReactNode;
  readonly props: FamilyAttributesTabProps;
}) {
  const { t, text } = useCatalogText();
  const { draft, update, disabled, library, issues } = props;
  const attribute = library.attributeById.get(binding.attributeId);
  const name = attribute ? text(attribute.labels, attribute.code) : binding.attributeId;
  const Icon = attribute ? ATTRIBUTE_TYPE_ICONS[attribute.type] : null;
  const replace = (next: FamilyAttributeBinding) => update({ ...draft, attributes: draft.attributes.map((item, at) => (at === index ? next : item)) });
  return (
    <div className="flex flex-col">
      <span className={ROW_GRID}>
        {handle}
        <span className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm">{name}</span>
            <span className="truncate font-mono text-xs text-muted-foreground">{attribute ? `${attribute.code} · ${t(ATTRIBUTE_TYPE_KEYS[attribute.type])}` : t('issues.attributeUnknown')}</span>
          </span>
        </span>
        {CATALOG_CHANNELS.map((channel) => (
          <span key={channel} className="flex justify-center">
            <Checkbox checked={binding.requiredChannels.includes(channel)} disabled={disabled}
              aria-label={t('families.attributes.requiredIn', { name, channel: t(CHANNEL_KEYS[channel]) })}
              onCheckedChange={(on) => replace(toggleChannel(binding, channel, on === true))} />
          </span>
        ))}
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t('families.attributes.removeOf', { name })}
          onClick={() => update(withoutFamilyAttribute(draft, binding.attributeId))}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </span>
      <FieldIssues issues={issues} path={`attributes[${index}]`} />
    </div>
  );
}

function AddControls(props: FamilyAttributesTabProps) {
  const { t, text } = useCatalogText();
  const { draft, update, disabled, library } = props;
  const [newOpen, setNewOpen] = useState(false);
  const bound = useMemo(() => new Set(draft.attributes.map((binding) => binding.attributeId)), [draft.attributes]);
  const available = library.attributes.filter((attribute) => !bound.has(attribute.id));
  const bind = (ids: readonly string[]) =>
    update({ ...draft, attributes: [...draft.attributes, ...ids.filter((id) => !bound.has(id)).map((attributeId) => ({ attributeId, requiredChannels: [] }))] });
  const groupsWithFree = library.groups.filter((group) => available.some((attribute) => attribute.groupId === group.id));
  return (
    <section className="flex flex-wrap items-center gap-2 border-t pt-3" aria-label={t('families.attributes.add')}>
      <AttributePicker className="w-64" value={null} options={available} disabled={disabled} placeholder={t('families.attributes.addFromLibrary')} ariaLabel={t('families.attributes.addFromLibrary')} onChange={(id) => bind([id])} />
      <Select value="" disabled={disabled || groupsWithFree.length === 0} onValueChange={(groupId) => bind(available.filter((attribute) => attribute.groupId === groupId).map((attribute) => attribute.id))}>
        <SelectTrigger className="w-56" aria-label={t('families.attributes.addGroup')}><SelectValue placeholder={t('families.attributes.addGroup')} /></SelectTrigger>
        <SelectContent>{groupsWithFree.map((group) => <SelectItem key={group.id} value={group.id}>{text(group.labels, group.code)}</SelectItem>)}</SelectContent>
      </Select>
      <Button type="button" variant="outline" disabled={disabled || !props.canManage} onClick={() => setNewOpen(true)}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />{t('families.attributes.newInline')}
      </Button>
      <NewAttributeDialog open={newOpen} onOpenChange={setNewOpen} library={library} families={props.families} canManage={props.canManage} onCreated={(created) => bind([created.id])} />
    </section>
  );
}

export function FamilyAttributesTab(props: FamilyAttributesTabProps) {
  const { t } = useCatalogText();
  const { draft, update, disabled, issues } = props;
  const rows = draft.attributes.map((binding, index) => ({ id: binding.attributeId, binding, index }));
  return (
    <section className="flex flex-col gap-2">
      <p className="m-0 text-sm text-muted-foreground">{t('families.attributes.lead')}</p>
      <span className={`${ROW_GRID} text-xs font-medium text-muted-foreground`} aria-hidden>
        <span />
        <span>{t('families.attributes.attribute')}</span>
        {CATALOG_CHANNELS.map((channel) => <span key={channel} className="text-center">{t(CHANNEL_KEYS[channel])}</span>)}
        <span />
      </span>
      {rows.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t('families.attributes.none')}</p> : null}
      <SortableList
        items={rows}
        getId={(row) => row.id}
        getLabel={(row) => props.library.attributeById.get(row.id)?.code ?? row.id}
        ariaLabel={t('families.tabs.attributes')}
        disabled={disabled}
        onMove={(move) => update({ ...draft, attributes: reorderByMove(rows, (row) => row.id, move).map((row) => row.binding) })}
        renderItem={(row, handle) => <BindingRow binding={row.binding} index={row.index} handle={handle} props={props} />}
      />
      <FieldIssues issues={issues.filter((issue) => issue.path === 'attributes')} path="attributes" exact />
      <AddControls {...props} />
    </section>
  );
}
