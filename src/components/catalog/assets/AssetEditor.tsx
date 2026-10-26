'use client';

/**
 * @fileoverview **Ο επεξεργαστής ενός μέσου** — ετικέτες · ρόλος/είδος · δικαιώματα · αρχείο (ADR-923 §5.10.4).
 * @related asset-draft.ts (πρόχειρο + κρίση) · AssetFilePanel.tsx · shared/use-definition-draft.ts · shared/EditorFooter.tsx
 * @module components/catalog/assets/AssetEditor
 *
 * 🔑 Ίδια συμβόλαια με τους επεξεργαστές του σχήματος: πρόχειρο με βάση CAS (`baseRevision`), ευρήματα στο πεδίο,
 *    αποθήκευση κλειδωμένη όσο υπάρχουν ευρήματα του πελάτη ⇒ γνωστό 422 δεν στέλνεται ποτέ.
 * 🔑 Η **νέα έκδοση αρχείου** δεν περνά από το πρόχειρο: είναι δική της πράξη (ανέβασμα + σύνδεση με CAS) και δεν
 *    χάνει ποτέ τις αλλαγές που γράφει ο άνθρωπος στις ετικέτες την ίδια στιγμή.
 */

import React, { useEffect, useMemo } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { MediaRightsFields } from '@/components/shared/media-rights/MediaRightsFields';
import { Badge } from '@/components/ui/badge';
import { EnumSelect } from '@/components/ui/enum-select';
import { Label } from '@/components/ui/label';
import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { mediaLicenseStanding } from '@/lib/media-rights/media-license-standing';
import { mediaRightsDraftIssues } from '@/lib/media-rights/media-rights-draft';
import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import { ASSET_ROLE_KINDS, CATALOG_ASSET_ROLES } from '@/subapps/catalog/vocabulary/asset-roles';
import type { FileRecord } from '@/types/file-record';
import { deleteDefinition, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { ASSET_KIND_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import { EditorFooter } from '../shared/EditorFooter';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import { useDefinitionDraft } from '../shared/use-definition-draft';
import { assetDraftIssues, assetDraftOf, assetInputOf, type AssetDraft } from './asset-draft';
import { fileFactsOfRecord, type IntakeRow } from './asset-intake-model';
import { ASSET_ROLE_KEYS, LICENSE_STANDING_KEYS } from './asset-labels';
import { AssetFilePanel } from './AssetFilePanel';
import { useCatalogRightsWords } from './use-catalog-rights-words';

export interface AssetEditorProps {
  readonly record: AssetRecord;
  readonly current: FileRecord | null;
  readonly versions: readonly FileRecord[];
  readonly ops: CatalogOptimistic<AssetRecord>;
  readonly canManage: boolean;
  /** Η τελευταία πράξη αρχείου (εισαγωγή ή νέα έκδοση) για αυτό το μέσο. */
  readonly fileRow: IntakeRow | null;
  readonly onReplaceFile: (file: File) => void;
  readonly onRetryFile: (row: IntakeRow) => void;
  readonly onRefreshRenditions: () => void;
  readonly onDeleted: () => void;
  readonly reportDirty: (dirty: boolean) => void;
}

function useAssetEditor({ record, current, reportDirty }: AssetEditorProps) {
  const { user } = useAuth();
  const author = useMemo(() => ({ uid: user?.uid ?? null, name: user?.displayName ?? '' }), [user]);
  const base = useMemo(() => assetDraftOf(record), [record]);
  const editor = useDefinitionDraft<AssetDraft>(base, record.id, record.revision);
  useEffect(() => reportDirty(editor.unsaved), [editor.unsaved, reportDirty]);
  const input = useMemo(() => assetInputOf(editor.draft, record, author, new Date().getFullYear()), [editor.draft, record, author]);
  const clientIssues = useMemo(
    () => assetDraftIssues(editor.draft, input, record, current ? fileFactsOfRecord(current) : null),
    [editor.draft, input, record, current],
  );
  const rightsIssues = mediaRightsDraftIssues(editor.draft.rights);
  const issues = editor.dirty || editor.serverIssues.length > 0 ? [...clientIssues, ...editor.serverIssues] : [];
  return { editor, input, clientIssues, rightsIssues, issues };
}

export function AssetEditor(props: AssetEditorProps) {
  const { record, current, versions, ops, canManage, fileRow, onReplaceFile, onRetryFile, onRefreshRenditions, onDeleted } = props;
  const { t } = useCatalogText();
  const words = useCatalogRightsWords();
  const { editor, input, clientIssues, rightsIssues, issues } = useAssetEditor(props);
  const { draft, update } = editor;
  const standing = mediaLicenseStanding(record.rights, Date.now(), false);
  const save = () => saveDefinition(ops, {
    kind: 'asset',
    existing: record,
    definition: input,
    optimistic: optimisticWire({ ...input, fileId: record.fileId }, record, record.id),
    baseRevision: editor.baseRevision,
    onSettled: editor.beginSave<AssetRecord>(),
  });
  const remove = () => { deleteDefinition(ops, 'asset', record); onDeleted(); };
  return (
    <section className="flex flex-col">
      <section className="flex flex-col gap-4 p-4">
        <p className="m-0 font-mono text-xs text-muted-foreground">{record.code}</p>
        <LocalizedTextField label={t('assets.editor.label')} value={draft.labels} disabled={!canManage} issues={issues} path="labels"
          onChange={(labels) => update({ ...draft, labels })} />
        <LocalizedTextField label={t('assets.editor.description')} value={draft.description} multiline disabled={!canManage} issues={issues}
          path="description" onChange={(description) => update({ ...draft, description })} />
        <section className="grid gap-3 sm:grid-cols-2">
          <section className="space-y-1">
            <Label htmlFor="asset-role">{t('assets.editor.role')}</Label>
            <EnumSelect id="asset-role" value={draft.role} values={CATALOG_ASSET_ROLES} disabled={!canManage} getLabel={(role) => t(ASSET_ROLE_KEYS[role])}
              onValueChange={(role) => update({ ...draft, role, kind: ASSET_ROLE_KINDS[role].includes(draft.kind) ? draft.kind : ASSET_ROLE_KINDS[role][0] })} />
          </section>
          <section className="space-y-1">
            <Label htmlFor="asset-kind">{t('assets.editor.kind')}</Label>
            <EnumSelect id="asset-kind" value={draft.kind} values={ASSET_ROLE_KINDS[draft.role]} disabled={!canManage || ASSET_ROLE_KINDS[draft.role].length < 2}
              getLabel={(kind) => t(ASSET_KIND_KEYS[kind])} onValueChange={(kind) => update({ ...draft, kind })} />
            <FieldIssues issues={issues} path="kind" exact />
          </section>
        </section>
        <section className="flex flex-col gap-2">
          <Badge variant={standing === 'active' ? 'success' : 'warning'} className="w-fit">{t(LICENSE_STANDING_KEYS[standing])}</Badge>
          <MediaRightsFields context="catalog" idPrefix={`asset-rights-${record.id}`} draft={draft.rights} words={words} disabled={!canManage}
            issues={editor.dirty ? rightsIssues : []} onChange={(rights) => update({ ...draft, rights })} />
        </section>
        <AssetFilePanel asset={record} current={current} versions={versions} canManage={canManage} fileRow={fileRow}
          onReplace={onReplaceFile} onRetry={onRetryFile} onRefreshRenditions={onRefreshRenditions} />
      </section>
      <EditorFooter editor={editor} issues={clientIssues} canManage={canManage} onSave={save} onDelete={remove} record={record} />
    </section>
  );
}
