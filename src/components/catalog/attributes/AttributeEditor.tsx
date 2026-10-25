'use client';

/**
 * @fileoverview **Επεξεργαστής ιδιότητας καταλόγου** (ADR-923 §5.2 · Φάση 1γ) — και στη σελίδα «Ιδιότητες» και μέσα
 *   στον επεξεργαστή οικογένειας («νέα ιδιότητα επί τόπου», χωρίς έξοδο).
 * @module components/catalog/attributes/AttributeEditor
 *
 * 🔑 Ο **τύπος κλειδώνει όσο η ιδιότητα χρησιμοποιείται** (Akeneo): λέγεται εδώ, με τις οικογένειες που τη
 *    χρησιμοποιούν — όχι ως 409 μετά την αποθήκευση.
 * 🔑 Οι σημαίες εμφανίζονται **μόνο** όπου ο τύπος τις υποστηρίζει (`isUniqueCapableAttributeType` κ.λπ.): καμία
 *    επιλογή που ο γραφέας θα απέρριπτε.
 * 🔑 Αλλαγή ομάδας = νέα θέση **στο τέλος** της νέας ομάδας (ένα κλειδί σειράς, `keyBetween`).
 */

import React, { useEffect, useMemo } from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import type { AttributeGroupRecord, AttributeRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import {
  ATTRIBUTE_TYPES,
  isLocalizableAttributeType,
  isUniqueCapableAttributeType,
} from '@/subapps/catalog/vocabulary/attribute-types';
import { deleteDefinition, newEntityKey, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { ATTRIBUTE_TYPE_ICONS, ATTRIBUTE_TYPE_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogCodeField, CatalogField, SwitchField } from '../shared/CatalogFormFields';
import { IssueSummary } from '../shared/CatalogIssues';
import { EditorFooter } from '../shared/EditorFooter';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import { useDefinitionDraft } from '../shared/use-definition-draft';
import { AttributeConfigFields, AttributeMappingsFields } from './AttributeConfigFields';
import { attributeDraftOf, familiesUsing, storedAttributeOf, validateAttributeDraft, withAttributeType } from './attribute-draft';

export interface AttributeEditorProps {
  /** `null` = νέα ιδιότητα, με αφετηρία το `blank`. */
  readonly record: AttributeRecord | null;
  readonly blank: CatalogAttributeDefinition;
  readonly groups: readonly AttributeGroupRecord[];
  readonly families: readonly FamilyRecord[];
  readonly registry: MeasurementRegistry;
  readonly ops: CatalogOptimistic<AttributeRecord>;
  readonly canManage: boolean;
  /** Κλειδί σειράς στο τέλος μιας ομάδας (χωρίς την ίδια την ιδιότητα). */
  readonly orderKeyAtEnd: (groupId: string, excludeId: string | null) => string;
  readonly onCreated: (record: AttributeRecord) => void;
  readonly onDeleted?: () => void;
  readonly reportDirty?: (dirty: boolean) => void;
}

function useAttributeEditor(props: AttributeEditorProps) {
  const { record, blank, groups, registry, families, reportDirty } = props;
  const base = useMemo(() => (record ? attributeDraftOf(record) : blank), [record, blank]);
  const editor = useDefinitionDraft(base, record?.id ?? 'new', record?.revision ?? null);
  useEffect(() => reportDirty?.(editor.unsaved), [editor.unsaved, reportDirty]);
  const groupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups]);
  const clientIssues = useMemo(() => validateAttributeDraft(editor.draft, registry, groupIds), [editor.draft, registry, groupIds]);
  const usedBy = useMemo(() => (record ? familiesUsing(record.id, families) : []), [record, families]);
  // Ανέγγιχτη φόρμα δεν «κοκκινίζει»: τα ευρήματα φαίνονται από την πρώτη πληκτρολόγηση (ή την απάντηση του γραφέα).
  const shown = editor.dirty || editor.serverIssues.length > 0 ? [...clientIssues, ...editor.serverIssues] : [];
  return { editor, clientIssues, usedBy, issues: shown };
}

function TypeAndGroupFields({ draft, update, props, typeLocked, disabled, issues }: {
  readonly issues: readonly CatalogIssue[];
  readonly draft: CatalogAttributeDefinition;
  readonly update: (draft: CatalogAttributeDefinition) => void;
  readonly props: AttributeEditorProps;
  readonly typeLocked: boolean;
  readonly disabled: boolean;
}) {
  const { t, text } = useCatalogText();
  const chooseType = (value: string) => {
    const type = ATTRIBUTE_TYPES.find((item) => item === value);
    if (type) update(withAttributeType(draft, type, props.registry));
  };
  const chooseGroup = (groupId: string) => update({ ...draft, groupId, orderKey: props.orderKeyAtEnd(groupId, props.record?.id ?? null) });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CatalogField label={t('attributes.fields.type')} hint={typeLocked ? t('attributes.fields.typeLocked') : undefined}>
        {({ id, describedBy }) => (
          <Select value={draft.type} disabled={disabled || typeLocked} onValueChange={chooseType}>
            <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ATTRIBUTE_TYPES.map((type) => {
                const Icon = ATTRIBUTE_TYPE_ICONS[type];
                return (
                  <SelectItem key={type} value={type}>
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4" aria-hidden />{t(ATTRIBUTE_TYPE_KEYS[type])}</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </CatalogField>
      <CatalogField label={t('attributes.fields.group')} issues={issues} path="groupId">
        {({ id, describedBy }) => (
          <Select value={props.groups.some((group) => group.id === draft.groupId) ? draft.groupId : ''} disabled={disabled} onValueChange={chooseGroup}>
            <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue placeholder={t('attributes.fields.chooseGroup')} /></SelectTrigger>
            <SelectContent>
              {props.groups.map((group) => <SelectItem key={group.id} value={group.id}>{text(group.labels, group.code)}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </CatalogField>
    </div>
  );
}

function FlagFields({ draft, update, disabled }: { readonly draft: CatalogAttributeDefinition; readonly update: (draft: CatalogAttributeDefinition) => void; readonly disabled: boolean }) {
  const { t } = useCatalogText();
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-foreground">{t('attributes.fields.behaviour')}</legend>
      {isUniqueCapableAttributeType(draft.type) ? (
        <SwitchField label={t('attributes.fields.unique')} hint={t('attributes.fields.uniqueHint')} checked={draft.unique} disabled={disabled} onChange={(unique) => update({ ...draft, unique })} />
      ) : null}
      {isLocalizableAttributeType(draft.type) ? (
        <SwitchField label={t('attributes.fields.localizable')} hint={t('attributes.fields.localizableHint')} checked={draft.localizable} disabled={disabled} onChange={(localizable) => update({ ...draft, localizable })} />
      ) : null}
      <SwitchField label={t('attributes.fields.scopable')} hint={t('attributes.fields.scopableHint')} checked={draft.scopable} disabled={disabled} onChange={(scopable) => update({ ...draft, scopable })} />
    </fieldset>
  );
}

export function AttributeEditor(props: AttributeEditorProps) {
  const { record, ops, canManage, onCreated, onDeleted, families, registry } = props;
  const { t, text } = useCatalogText();
  const { editor, clientIssues, usedBy, issues } = useAttributeEditor(props);
  const { draft, update } = editor;
  const disabled = !canManage;
  const familyOptions = useMemo(() => families.map((family) => ({ code: family.code, label: text(family.labels, family.code) })), [families, text]);
  const save = () => saveDefinition(ops, {
    kind: 'attribute',
    existing: record,
    definition: draft,
    optimistic: optimisticWire(storedAttributeOf(draft), record, newEntityKey(draft.code)),
    baseRevision: editor.baseRevision,
    onSettled: editor.beginSave<AttributeRecord>((saved) => { if (!record) onCreated(saved); }),
  });
  const remove = record && onDeleted ? () => { deleteDefinition(ops, 'attribute', record); onDeleted(); } : undefined;
  return (
    <section className="flex flex-col">
      <section className="flex flex-col gap-4 p-4">
        {usedBy.length > 0 ? (
          <p className="m-0 text-sm text-muted-foreground">{t('attributes.usedIn', { count: usedBy.length, families: usedBy.map((family) => text(family.labels, family.code)).join(', ') })}</p>
        ) : null}
        <LocalizedTextField label={t('common.labels')} value={draft.labels} disabled={disabled} issues={issues} path="labels" onChange={(labels) => update({ ...draft, labels })} />
        <CatalogCodeField value={draft.code} locked={record !== null} disabled={disabled} suggestFrom={draft.labels[DEFAULT_LANGUAGE] ?? ''} issues={issues} onChange={(code) => update({ ...draft, code })} />
        <TypeAndGroupFields draft={draft} update={update} props={props} typeLocked={usedBy.length > 0} disabled={disabled} issues={issues} />
        <LocalizedTextField label={t('common.description')} multiline value={draft.description} disabled={disabled} onChange={(description) => update({ ...draft, description })} />
        <FlagFields draft={draft} update={update} disabled={disabled} />
        <section className="flex flex-col gap-3" aria-label={t('attributes.fields.settings')}>
          <h3 className="m-0 text-sm font-semibold text-foreground">{t('attributes.fields.settings')}</h3>
          <AttributeConfigFields draft={draft} onChange={update} registry={registry} families={familyOptions} issues={issues} disabled={disabled} />
        </section>
        <AttributeMappingsFields mappings={draft.mappings} issues={issues} disabled={disabled} onChange={(mappings) => update({ ...draft, mappings })} />
        <IssueSummary issues={editor.status === 'dirty' ? clientIssues : []} title={t('editor.issuesTitle')} />
      </section>
      <EditorFooter
        editor={editor}
        issues={clientIssues}
        canManage={canManage}
        onSave={save}
        onDelete={remove}
        record={record}
      />
    </section>
  );
}
