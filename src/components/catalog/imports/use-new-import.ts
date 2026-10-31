'use client';

/**
 * @fileoverview **Η νέα εισαγωγή** (ADR-923 §5.5.1): αρχείο → στόχος → αντιστοίχιση → παρτίδα → ανέβασμα → σύνδεση.
 * @module components/catalog/imports/use-new-import
 *
 * Η σειρά είναι ιδεμπότητη σε κάθε βήμα: το αποτύπωμα υπολογίζεται **πριν** το ανέβασμα, άρα ίδιο αρχείο ανοίγει την ίδια
 * παρτίδα αντί να ξανανέβει. Το προφίλ σώζεται πρώτο, γιατί η έκδοσή του μπαίνει στο κλειδί της παρτίδας.
 */

import { useCallback, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { ENTITY_TYPES, FILE_CATEGORIES, FILE_DOMAINS } from '@/config/domain-constants';
import { useCompanyId } from '@/hooks/useCompanyId';
import type { RawTable } from '@/lib/tabular-import/tabular-types';
import {
  attachImportFile,
  createImportBatch,
  createImportProfile,
  fetchImportProfiles,
  mapImportBatch,
  updateImportProfile,
} from '@/services/catalog/catalog-import-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import { validateUploadAuth } from '@/services/filesystem/file-mutation-gateway';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';
import type { ImportBatchTarget, ImportColumnRule, ImportProfileDefinition } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchWire } from '@/subapps/catalog/types/catalog-import-requests';
import type { ImportSourceKind } from '@/subapps/catalog/vocabulary/catalog-import';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';
import { proposeColumns, readTablePreview, sha256Of, sourceKindOf, type AttributeChoice } from './import-source-file';

export interface NewImportSource {
  readonly file: File;
  readonly kind: ImportSourceKind;
  readonly sha256: string;
}

export interface NewImportForm {
  readonly target: ImportBatchTarget | null;
  readonly columns: readonly ImportColumnRule[];
  readonly skipRows: number;
  readonly sheetIndex: number;
  readonly pageFrom: number;
  readonly pageTo: number;
  readonly run: number;
}

const EMPTY_FORM: NewImportForm = { target: null, columns: [], skipRows: 0, sheetIndex: 0, pageFrom: 1, pageTo: 1, run: 0 };

async function savedProfileId(source: NewImportSource, form: NewImportForm, target: ImportBatchTarget): Promise<string> {
  const code = suggestCatalogCode(`${source.file.name.replace(/\.[^.]+$/, '')}_${target.purpose}`) || 'import_profile';
  const definition: ImportProfileDefinition = {
    code,
    label: source.file.name,
    purpose: target.purpose,
    supplierContactId: null,
    familyId: target.purpose === 'attributes' ? target.familyId : null,
    skipRows: form.skipRows,
    sheetIndex: form.sheetIndex,
    columns: form.columns,
  };
  const existing = (await fetchImportProfiles()).find((profile) => profile.code === code);
  return (existing ? await updateImportProfile(existing.id, existing.revision, definition) : await createImportProfile(definition)).id;
}

async function batchFor(source: NewImportSource, form: NewImportForm, target: ImportBatchTarget): Promise<ImportBatchWire> {
  const tabular = source.kind !== 'pdf';
  return createImportBatch({
    sourceKind: source.kind,
    contentSha256: source.sha256,
    fileName: source.file.name,
    sizeBytes: source.file.size,
    target,
    profileId: tabular ? await savedProfileId(source, form, target) : null,
    run: form.run,
    pageRange: tabular ? null : { from: form.pageFrom, to: form.pageTo },
  });
}

interface Uploader {
  readonly companyId: string;
  readonly uid: string;
  readonly name: string | undefined;
}

async function uploadBatchFile(uploader: Uploader, batch: ImportBatchWire, file: File): Promise<string> {
  await validateUploadAuth(uploader.companyId);
  const { fileId } = await uploadEntityFile({
    custody: { companyId: uploader.companyId },
    entityType: ENTITY_TYPES.CATALOG_IMPORT_BATCH,
    entityId: batch.id,
    domain: FILE_DOMAINS.CATALOG,
    category: FILE_CATEGORIES.DOCUMENTS,
    entityLabel: file.name,
    createdBy: uploader.uid,
    uploaderName: uploader.name,
  }, file);
  return fileId;
}

/** Παρτίδα που περιμένει αρχείο ανεβαίνει· όποια έχει ήδη αρχείο απλώς ανοίγει. */
async function runImport(uploader: Uploader, source: NewImportSource, form: NewImportForm, target: ImportBatchTarget): Promise<string> {
  const batch = await batchFor(source, form, target);
  if (batch.status !== 'awaitingFile') return batch.id;
  const attached = await attachImportFile(batch.id, batch.revision, await uploadBatchFile(uploader, batch, source.file));
  if (attached.status === 'mapping') await mapImportBatch(batch.id);
  return batch.id;
}

function useImportSource(attributes: readonly AttributeChoice[]) {
  const [source, setSource] = useState<NewImportSource | null>(null);
  const [table, setTable] = useState<RawTable | null>(null);
  const [form, setForm] = useState<NewImportForm>(EMPTY_FORM);
  const [unsupported, setUnsupported] = useState(false);

  const reloadTable = useCallback(async (next: NewImportSource, patch: Partial<NewImportForm>) => {
    const merged = { ...form, ...patch };
    const preview = await readTablePreview(next.file, next.kind, merged);
    setTable(preview);
    setForm({ ...merged, columns: proposeColumns(preview, merged.target?.purpose ?? 'attributes', attributes) });
  }, [attributes, form]);

  const chooseFile = useCallback(async (file: File) => {
    const kind = sourceKindOf(file.name);
    setUnsupported(kind === null);
    if (kind === null) return;
    const next = { file, kind, sha256: await sha256Of(file) };
    setSource(next);
    if (kind === 'pdf') setTable(null);
    else await reloadTable(next, {});
  }, [reloadTable]);

  const patchForm = useCallback(async (patch: Partial<NewImportForm>) => {
    const reshapes = 'skipRows' in patch || 'sheetIndex' in patch || 'target' in patch;
    if (source && source.kind !== 'pdf' && reshapes) await reloadTable(source, patch);
    else setForm((current) => ({ ...current, ...patch }));
  }, [reloadTable, source]);

  return { source, table, form, unsupported, chooseFile, patchForm };
}

export function useNewImport(attributes: readonly AttributeChoice[], onReady: (batchId: string) => void) {
  const companyId = useCompanyId()?.companyId ?? '';
  const { user } = useAuth();
  const input = useImportSource(attributes);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<CatalogFailure | null>(null);
  const { source, form } = input;

  const start = useCallback(async () => {
    if (!source || !form.target) return;
    setBusy(true);
    setFailure(null);
    try {
      const uploader = { companyId, uid: user?.uid ?? '', name: user?.displayName ?? undefined };
      onReady(await runImport(uploader, source, form, form.target));
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
    } finally {
      setBusy(false);
    }
  }, [companyId, form, onReady, source, user]);

  return { ...input, busy, failure, start };
}
