'use client';

/**
 * @fileoverview **Η εκτέλεση της εισαγωγής μέσων** — `create → upload → attach` ανά γραμμή, ως {@link INTAKE_CONCURRENCY}
 *   ταυτόχρονα (ADR-923 §5.10.4).
 * @related asset-intake-model.ts (καθαρό μοντέλο) · services/filesystem/upload-entity-file.ts (ο ένας αγωγός bytes) ·
 *   services/catalog/catalog-api.client.ts (`attachCatalogAssetFile`) · hooks/catalog/useCatalogOptimistic.ts
 * @module components/catalog/assets/use-asset-intake
 *
 * 🔑 **Δημιουργία και σύνδεση περνούν από την αισιόδοξη ουρά** (`ops.submit`): το νέο μέσο φαίνεται αμέσως στη βιβλιοθήκη,
 *    και η σύνδεση **σειριοποιείται** με κάθε άλλη αλλαγή του ίδιου μέσου (κλειδί = id) — ένας άνθρωπος που αλλάζει την
 *    ετικέτα ενώ τρέχει η σύνδεση δεν χτυπά 409 στον εαυτό του (αλυσίδα δικών μας εγγραφών, `fastForwardOwnWrites`).
 * 🔑 **Το ανέβασμα ΔΕΝ περνά από την ουρά**: δεν γράφει το μέσο, μόνο ένα `FileRecord` κάτω από αυτό — άρα δεν κρατά
 *    κλειδωμένη την οντότητα όσο ανεβαίνουν 400 MB.
 * ⚠️ Ο έλεγχος ταυτότητας πριν από τα bytes (`validateUploadAuth`) ζει **εδώ**, όπως σε κάθε καλούντα του αγωγού.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { useCompanyId } from '@/hooks/useCompanyId';
import type { CatalogOptimistic, CatalogOutcome } from '@/hooks/catalog/useCatalogOptimistic';
import type { HumanLanguage } from '@/i18n/languages';
import {
  attachCatalogAssetFile,
  createCatalogDefinition,
  type AssetRecord,
} from '@/services/catalog/catalog-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import { validateUploadAuth } from '@/services/filesystem/file-mutation-gateway';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';
import type { CatalogAssetInput } from '@/subapps/catalog/schema/zod/asset.schema';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import { CATALOG_ASSET_UPLOAD_TARGET } from '@/subapps/catalog/vocabulary/asset-files';
import type { MediaRights } from '@/types/media-rights';
import { newEntityKey, optimisticWire } from '../shared/catalog-actions';
import { isStartable, nextStageOf, type IntakeRow, type IntakeStage, type IntakeStatus } from './asset-intake-model';

/** Πόσα αρχεία ανεβαίνουν μαζί — αρκετά για να γεμίζει η γραμμή, λίγα ώστε το ένα να μη στερεί το άλλο. */
export const INTAKE_CONCURRENCY = 3;

type IntakeAction =
  | { readonly type: 'add'; readonly rows: readonly IntakeRow[] }
  | { readonly type: 'patch'; readonly key: string; readonly patch: Partial<Pick<IntakeRow, 'code' | 'label' | 'role' | 'kind'>> }
  | { readonly type: 'replace'; readonly row: IntakeRow }
  | { readonly type: 'status'; readonly key: string; readonly status: IntakeStatus }
  | { readonly type: 'remove'; readonly key: string }
  | { readonly type: 'clearDone' };

function reduce(rows: readonly IntakeRow[], action: IntakeAction): readonly IntakeRow[] {
  switch (action.type) {
    case 'add':
      return [...rows, ...action.rows];
    case 'patch':
      return rows.map((row) => (row.key === action.key && isStartable(row) ? { ...row, ...action.patch } : row));
    case 'replace':
      return rows.map((row) => (row.key === action.row.key ? action.row : row));
    case 'status':
      return rows.map((row) => (row.key === action.key ? { ...row, status: action.status } : row));
    case 'remove':
      return rows.filter((row) => row.key !== action.key || !isStartable(row));
    case 'clearDone':
      return rows.filter((row) => row.status.kind !== 'done');
  }
}

type StageOutcome = { readonly ok: true; readonly row: IntakeRow } | { readonly ok: false; readonly failure: CatalogFailure };

interface IntakeDeps {
  readonly ops: CatalogOptimistic<AssetRecord>;
  readonly companyId: string;
  readonly uid: string;
  readonly uploaderName: string | undefined;
  readonly language: HumanLanguage;
  /** Μόνο για τη δημιουργία· η αντικατάσταση αρχείου υπάρχοντος μέσου δεν δηλώνει ξανά δικαιώματα. */
  readonly rights: MediaRights | null;
  readonly onProgress: (fraction: number) => void;
}

/** Μία πράξη της αισιόδοξης ουράς, ως υπόσχεση — η εισαγωγή συνεχίζει μόνο με την εγγραφή του γραφέα στο χέρι. */
function submitAwaited(ops: CatalogOptimistic<AssetRecord>, op: Omit<Parameters<CatalogOptimistic<AssetRecord>['submit']>[0], 'onSettled'>) {
  return new Promise<CatalogOutcome<AssetRecord>>((resolve) => ops.submit({ ...op, onSettled: resolve }));
}

function definitionOf(row: IntakeRow, deps: IntakeDeps): CatalogAssetInput {
  if (deps.rights === null) throw new Error('create without rights');
  return { code: row.code, role: row.role, kind: row.kind, labels: { [deps.language]: row.label.trim() }, description: {}, rights: deps.rights };
}

async function createStage(row: IntakeRow, deps: IntakeDeps): Promise<StageOutcome> {
  const definition = definitionOf(row, deps);
  const key = newEntityKey(row.code);
  const outcome = await submitAwaited(deps.ops, {
    key,
    optimistic: optimisticWire<CatalogAssetDefinition>({ ...definition, fileId: null }, null, key),
    baseRevision: null,
    send: () => createCatalogDefinition('asset', definition),
  });
  return outcome.ok ? { ok: true, row: { ...row, asset: outcome.record } } : outcome;
}

async function uploadStage(row: IntakeRow, deps: IntakeDeps): Promise<StageOutcome> {
  if (row.asset === null) throw new Error('upload before create');
  try {
    await validateUploadAuth(deps.companyId);
    const target = CATALOG_ASSET_UPLOAD_TARGET[row.role];
    const { fileId } = await uploadEntityFile({
      custody: { companyId: deps.companyId },
      entityType: ENTITY_TYPES.CATALOG_ASSET,
      entityId: row.asset.id,
      domain: target.domain,
      category: target.category,
      entityLabel: row.label.trim(),
      createdBy: deps.uid,
      uploaderName: deps.uploaderName,
      onProgress: (progress) => deps.onProgress(progress.percent / 100),
    }, row.file);
    return { ok: true, row: { ...row, fileId } };
  } catch (cause) {
    return { ok: false, failure: catalogFailureOf(cause) };
  }
}

async function attachStage(row: IntakeRow, deps: IntakeDeps): Promise<StageOutcome> {
  const { asset, fileId } = row;
  if (asset === null || fileId === null) throw new Error('attach before upload');
  const current = deps.ops.settled.find((record) => record.id === asset.id) ?? asset;
  const outcome = await submitAwaited(deps.ops, {
    key: asset.id,
    optimistic: { ...current, fileId },
    baseRevision: current.revision,
    send: (revision) => attachCatalogAssetFile(asset.id, revision ?? current.revision, fileId),
  });
  return outcome.ok ? { ok: true, row: { ...row, asset: outcome.record, status: { kind: 'done' } } } : outcome;
}

const STAGES: Readonly<Record<IntakeStage, (row: IntakeRow, deps: IntakeDeps) => Promise<StageOutcome>>> = {
  create: createStage,
  upload: uploadStage,
  attach: attachStage,
};

/** Μία γραμμή ως το τέλος ή ως την πρώτη άρνηση — συνεχίζει από το στάδιο χωρίς αποτέλεσμα. */
async function runRow(start: IntakeRow, deps: Omit<IntakeDeps, 'onProgress'>, dispatch: (action: IntakeAction) => void): Promise<void> {
  let row = start;
  for (let stage = nextStageOf(row); stage !== null; stage = nextStageOf(row)) {
    const current = stage;
    const onProgress = (progress: number) => dispatch({ type: 'status', key: row.key, status: { kind: 'running', stage: current, progress } });
    onProgress(0);
    const outcome = await STAGES[current](row, { ...deps, onProgress });
    if (!outcome.ok) {
      const { kind: reason, issues } = outcome.failure;
      dispatch({ type: 'status', key: row.key, status: { kind: 'failed', stage: current, reason, issues } });
      return;
    }
    row = outcome.row;
    dispatch({ type: 'replace', row });
  }
}

export interface AssetIntake {
  readonly rows: readonly IntakeRow[];
  readonly add: (rows: readonly IntakeRow[]) => void;
  readonly patch: (key: string, patch: Partial<Pick<IntakeRow, 'code' | 'label' | 'role' | 'kind'>>) => void;
  readonly remove: (key: string) => void;
  readonly clearDone: () => void;
  /** Ξεκινά (ή ξαναδοκιμάζει) τις δοσμένες γραμμές· οι υπόλοιπες περιμένουν σε ουρά. */
  readonly start: (rows: readonly IntakeRow[], rights: MediaRights | null) => Promise<void>;
  /**
   * **Νέα έκδοση αρχείου** υπάρχοντος μέσου (Δ9): γραμμή με το μέσο ήδη στο χέρι ⇒ ξεκινά από το ανέβασμα. Νέο `FileRecord`
   * κάτω από το **ίδιο** μέσο + σύνδεση με CAS· τα προϊόντα δεν ξαναγράφονται.
   */
  readonly replaceFile: (asset: AssetRecord, file: File, key: string) => Promise<void>;
  /**
   * **Ανανέωση αποδόσεων** του δεμένου αρχείου: ξανά σύνδεση του **ίδιου** `fileId`. Ο διακομιστής ξαναφτιάχνει ό,τι είναι
   * μπαγιάτικο (νέα συνταγή · ξαναγραμμένο πρωτότυπο) και η συναλλαγή **δεν** γράφει νέα αναθεώρηση (ιδεμπότητο).
   */
  readonly refreshRenditions: (asset: AssetRecord, key: string) => Promise<void>;
}

export function useAssetIntake(ops: CatalogOptimistic<AssetRecord>, language: HumanLanguage): AssetIntake {
  const [rows, dispatch] = useReducer(reduce, []);
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId ?? null;
  const opsRef = useRef(ops);
  useEffect(() => {
    opsRef.current = ops;
  }, [ops]);

  const start = useCallback(async (selected: readonly IntakeRow[], rights: MediaRights | null) => {
    if (user === null || companyId === null) return;
    const queue = selected.filter(isStartable);
    for (const row of queue) dispatch({ type: 'status', key: row.key, status: { kind: 'queued' } });
    const deps = { ops: opsRef.current, companyId, uid: user.uid, uploaderName: user.displayName ?? undefined, language, rights };
    const worker = async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) await runRow(next, { ...deps, ops: opsRef.current }, dispatch);
    };
    await Promise.all(Array.from({ length: Math.min(INTAKE_CONCURRENCY, queue.length) }, worker));
  }, [user, companyId, language]);

  const replaceFile = useCallback(async (asset: AssetRecord, file: File, key: string) => {
    const row: IntakeRow = {
      key, file, code: asset.code, label: file.name, role: asset.role, kind: asset.kind, status: { kind: 'draft' }, asset, fileId: null,
    };
    dispatch({ type: 'add', rows: [row] });
    await start([row], null);
  }, [start]);

  const refreshRenditions = useCallback(async (asset: AssetRecord, key: string) => {
    if (asset.fileId === null) return;
    const row: IntakeRow = {
      key, file: new File([], asset.code), code: asset.code, label: asset.code, role: asset.role, kind: asset.kind,
      status: { kind: 'draft' }, asset, fileId: asset.fileId,
    };
    dispatch({ type: 'add', rows: [row] });
    await start([row], null);
  }, [start]);

  return {
    rows,
    replaceFile,
    refreshRenditions,
    add: useCallback((added) => dispatch({ type: 'add', rows: added }), []),
    patch: useCallback((key, patch) => dispatch({ type: 'patch', key, patch }), []),
    remove: useCallback((key) => dispatch({ type: 'remove', key }), []),
    clearDone: useCallback(() => dispatch({ type: 'clearDone' }), []),
    start,
  };
}
