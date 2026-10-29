/**
 * @fileoverview **Η εκτέλεση της εισαγωγής μέσων** — σειρά σταδίων, όριο ταυτόχρονων, επανάληψη από το στάδιο της
 *   αποτυχίας χωρίς ξανανέβασμα, νέα έκδοση αρχείου (ADR-923 §5.10.4).
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { CatalogOperation, CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import type { MediaRights } from '@/types/media-rights';
import { intakeRowsFor } from '../asset-intake-model';
import { INTAKE_CONCURRENCY, useAssetIntake } from '../use-asset-intake';

const mockCreate = jest.fn();
const mockAttach = jest.fn();
const mockUpload = jest.fn();

jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1', displayName: 'Νίκος' } }) }));
jest.mock('@/hooks/useCompanyId', () => ({ useCompanyId: () => ({ companyId: 'comp_test' }) }));
jest.mock('@/services/filesystem/file-mutation-gateway', () => ({ validateUploadAuth: jest.fn(async () => undefined) }));
jest.mock('@/services/filesystem/upload-entity-file', () => ({ uploadEntityFile: (...args: unknown[]) => mockUpload(...args) }));
jest.mock('@/services/catalog/catalog-api.client', () => ({
  createCatalogDefinition: (...args: unknown[]) => mockCreate(...args),
  attachCatalogAssetFile: (...args: unknown[]) => mockAttach(...args),
}));

const RIGHTS: MediaRights = {
  creator: { name: 'Νίκος', userId: 'u1', url: null },
  licensors: [],
  copyrightNotice: '© 2026 Νίκος',
  webStatementOfRights: null,
  license: { purpose: 'catalog-publication', term: { kind: 'perpetual' } },
};

function record(code: string, revision: number, fileId: string | null = null): AssetRecord {
  return {
    id: `casst_${code}`, companyId: 'comp_test', revision, isDeleted: false, code, role: 'photo', kind: 'image',
    labels: { el: code }, description: {}, rights: RIGHTS, fileId,
    createdAt: '', createdBy: 'u1', updatedAt: '', updatedBy: 'u1', deletedAt: null, deletedBy: null,
  };
}

/** Αισιόδοξη ουρά που απλώς εκτελεί — η σειριοποίηση ανά κλειδί δοκιμάζεται στο `useCatalogOptimistic.test`. */
function passthroughOps(): CatalogOptimistic<AssetRecord> {
  return {
    view: [], settled: [], pendingKeys: new Set(),
    submit: (op: CatalogOperation<AssetRecord>) => {
      op.send(op.baseRevision).then(
        (saved) => op.onSettled?.({ ok: true, record: saved }),
        () => op.onSettled?.({ ok: false, failure: { kind: 'network', issues: [], currentRevision: null, fence: null } }),
      );
    },
  };
}

const file = (name: string) => ({ name, type: 'image/jpeg', size: 2048 }) as File;
const keyOf = (index: number) => `k${index}`;

beforeEach(() => {
  mockCreate.mockReset().mockImplementation(async (_kind: string, definition: { code: string }) => record(definition.code, 1));
  mockUpload.mockReset().mockImplementation(async (spec: { entityId: string; onProgress?: (p: { percent: number }) => void }) => {
    spec.onProgress?.({ percent: 50 });
    return { fileId: `file_${spec.entityId}`, displayName: undefined };
  });
  mockAttach.mockReset().mockImplementation(async (id: string, revision: number, fileId: string) => ({ ...record(id.replace('casst_', ''), revision + 1), fileId }));
});

it('Ε1 — create → upload (κάτοχος = το μέσο, στόχος από τον ρόλο) → attach με την αναθεώρηση της δημιουργίας', async () => {
  const { result } = renderHook(() => useAssetIntake(passthroughOps(), 'el'));
  const rows = intakeRowsFor([file('a.jpg')], new Set(), keyOf);
  act(() => result.current.add(rows));
  await act(async () => { await result.current.start(rows, RIGHTS); });
  expect(mockCreate).toHaveBeenCalledWith('asset', expect.objectContaining({ code: 'a', role: 'photo', kind: 'image', rights: RIGHTS, labels: { el: 'a' } }));
  expect(mockUpload.mock.calls[0][0]).toMatchObject({ entityType: 'catalog_asset', entityId: 'casst_a', custody: { companyId: 'comp_test' }, category: 'photos' });
  expect(mockAttach).toHaveBeenCalledWith('casst_a', 1, 'file_casst_a');
  expect(result.current.rows[0].status).toEqual({ kind: 'done' });
});

it(`Ε2 — ως ${INTAKE_CONCURRENCY} ανεβάσματα ταυτόχρονα, τα υπόλοιπα σε αναμονή`, async () => {
  let inFlight = 0;
  let peak = 0;
  mockUpload.mockImplementation(async (spec: { entityId: string }) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return { fileId: `file_${spec.entityId}`, displayName: undefined };
  });
  const { result } = renderHook(() => useAssetIntake(passthroughOps(), 'el'));
  const rows = intakeRowsFor(['a', 'b', 'c', 'd', 'e'].map((name) => file(`${name}.jpg`)), new Set(), keyOf);
  act(() => result.current.add(rows));
  await act(async () => { await result.current.start(rows, RIGHTS); });
  expect(peak).toBe(INTAKE_CONCURRENCY);
  expect(result.current.rows.every((row) => row.status.kind === 'done')).toBe(true);
});

it('Ε3 — αποτυχία σύνδεσης ⇒ η επανάληψη ΔΕΝ ξαναδημιουργεί ούτε ξανανεβάζει', async () => {
  mockAttach.mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useAssetIntake(passthroughOps(), 'el'));
  const rows = intakeRowsFor([file('a.jpg')], new Set(), keyOf);
  act(() => result.current.add(rows));
  await act(async () => { await result.current.start(rows, RIGHTS); });
  expect(result.current.rows[0].status).toMatchObject({ kind: 'failed', stage: 'attach', reason: 'network' });
  await act(async () => { await result.current.start([result.current.rows[0]], RIGHTS); });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockAttach).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(result.current.rows[0].status).toEqual({ kind: 'done' }));
});

it('Ε4 — νέα έκδοση αρχείου: χωρίς δημιουργία, ανέβασμα κάτω από το ΙΔΙΟ μέσο, σύνδεση με CAS', async () => {
  const { result } = renderHook(() => useAssetIntake(passthroughOps(), 'el'));
  await act(async () => { await result.current.replaceFile(record('a', 4, 'file_old'), file('a-v2.jpg'), 'r1'); });
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockUpload.mock.calls[0][0]).toMatchObject({ entityId: 'casst_a' });
  expect(mockAttach).toHaveBeenCalledWith('casst_a', 4, 'file_casst_a');
});

it('Ε5 — γραμμή σε εκτέλεση δεν αφαιρείται και δεν αλλάζει', async () => {
  let release: () => void = () => undefined;
  mockUpload.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ fileId: 'f', displayName: undefined }); }));
  const { result } = renderHook(() => useAssetIntake(passthroughOps(), 'el'));
  const rows = intakeRowsFor([file('a.jpg')], new Set(), keyOf);
  act(() => result.current.add(rows));
  let running: Promise<void> = Promise.resolve();
  act(() => { running = result.current.start(rows, RIGHTS); });
  await waitFor(() => expect(result.current.rows[0].status).toMatchObject({ kind: 'running', stage: 'upload' }));
  act(() => { result.current.remove('k0'); result.current.patch('k0', { code: 'changed' }); });
  expect(result.current.rows).toHaveLength(1);
  expect(result.current.rows[0].code).toBe('a');
  await act(async () => { release(); await running; });
});

it('Ε6 — ανανέωση αποδόσεων: ούτε δημιουργία ούτε ανέβασμα· σύνδεση του ΙΔΙΟΥ αρχείου με την αναθεώρηση του μέσου', async () => {
  const { result } = renderHook(() => useAssetIntake(passthroughOps(), 'el'));
  await act(async () => { await result.current.refreshRenditions(record('a', 2, 'file_current'), 'r1'); });
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockAttach).toHaveBeenCalledWith('casst_a', 2, 'file_current');
});
