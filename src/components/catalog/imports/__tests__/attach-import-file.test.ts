/**
 * Η αντιστάθμιση της σύνδεσης αρχείου (ADR-923 §5.5.1). 🔴 Η ρίζα των 93,2 MB ορφανών: το ανέβασμα προηγείται, και αποτυχημένη σύνδεση
 * άφηνε το αρχείο πίσω. 🔴 Το αντίθετο λάθος είναι χειρότερο: κάδος σε αρχείο που όντως συνδέθηκε.
 */

import { attachImportFile, fetchImportBatch } from '@/services/catalog/catalog-import-api.client';
import { requestFileTrash } from '@/services/filesystem/file-trash.client';
import { attachUploadedFile } from '../attach-import-file';

jest.mock('@/services/catalog/catalog-import-api.client', () => ({ attachImportFile: jest.fn(), fetchImportBatch: jest.fn() }));
jest.mock('@/services/filesystem/file-trash.client', () => ({ requestFileTrash: jest.fn() }));

const attach = jest.mocked(attachImportFile);
const fetchBatch = jest.mocked(fetchImportBatch);
const trash = jest.mocked(requestFileTrash);

const batch = { id: 'cibat_1', revision: 1 };
const conflict = new Error('409');
type Detail = Awaited<ReturnType<typeof fetchImportBatch>>;
const detailWith = (fileId: string | null): Detail => ({ batch: { id: 'cibat_1', fileId, status: 'extracting' }, proposals: [] }) as unknown as Detail;

beforeEach(() => {
  jest.resetAllMocks();
});

it('επιτυχής σύνδεση: κανένας κάδος', async () => {
  attach.mockResolvedValue(detailWith('file_1').batch);
  await attachUploadedFile(batch, 'file_1');
  expect(trash).not.toHaveBeenCalled();
});

it('🔴 αποτυχημένη σύνδεση: το αρχείο πάει στον κάδο, και ο άνθρωπος βλέπει την αρχική αιτία', async () => {
  attach.mockRejectedValue(conflict);
  fetchBatch.mockResolvedValue(detailWith(null));
  await expect(attachUploadedFile(batch, 'file_1')).rejects.toBe(conflict);
  expect(trash).toHaveBeenCalledWith(['file_1'], 'trash');
});

it('🔴 η σύνδεση έγινε αλλά χάθηκε η απάντηση: κανένας κάδος, και η ροή συνεχίζει', async () => {
  attach.mockRejectedValue(new Error('network'));
  fetchBatch.mockResolvedValue(detailWith('file_1'));
  await expect(attachUploadedFile(batch, 'file_1')).resolves.toMatchObject({ fileId: 'file_1' });
  expect(trash).not.toHaveBeenCalled();
});

it('άλλο αρχείο κέρδισε τη σύνδεση: το δικό μας περισσεύει', async () => {
  attach.mockRejectedValue(conflict);
  fetchBatch.mockResolvedValue(detailWith('file_other'));
  await expect(attachUploadedFile(batch, 'file_1')).rejects.toBe(conflict);
  expect(trash).toHaveBeenCalledWith(['file_1'], 'trash');
});

it('αποτυχία της αντιστάθμισης δεν κρύβει την αρχική αιτία', async () => {
  attach.mockRejectedValue(conflict);
  fetchBatch.mockRejectedValue(new Error('offline'));
  await expect(attachUploadedFile(batch, 'file_1')).rejects.toBe(conflict);
  expect(trash).not.toHaveBeenCalled();
});
