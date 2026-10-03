/**
 * @jest-environment node
 *
 * ADR-901 Φ4.4 — **Α26**: η σταλμένη έκδοση δεν σβήνεται οριστικά όσο ζει transmittal που την καρφώνει.
 *
 * Ο γραφέας δέσμευσης (`file-hold.service`) και η στοίβα εκδόσεων είναι πλαστά — έχουν δικές τους άγκυρες
 * (`file-hold-service.test.ts`, και για το προσωπικό διαμέρισμα). Εδώ ασκούνται οι **τρεις κανόνες** του transmittal:
 * αιτιολογία ανά υπόθεση · ξανακάλυψη της στοίβας όταν νέα έκδοση δεν καλύπτεται · ποτέ ξένη δέσμευση.
 */

import type { FileRecord } from '@/types/file-record';

const placeFileHold = jest.fn();
const releaseFileHold = jest.fn();
jest.mock('@/services/file-record/file-hold.service', () => ({
  placeFileHold: (input: unknown) => placeFileHold(input),
  releaseFileHold: (input: unknown) => releaseFileHold(input),
}));
let stack: readonly Partial<FileRecord>[] = [];
jest.mock('@/services/iso19650/version-stack', () => ({
  readVersionStack: async () => (stack.length === 0 ? { kind: 'not-found' } : { kind: 'stack', headFileId: stack[0].id, versions: stack }),
}));

import { ensureTransmittalHold, releaseTransmittalHold } from '../conveyance-transmittal-hold';

const OURS = { hold: 'admin', holdReason: 'conveyance-transmittal:cvc_1' } as const;
const FOREIGN = { hold: 'legal', holdReason: 'αγωγή 12/2026' } as const;

beforeEach(() => {
  jest.clearAllMocks();
  stack = [];
});

describe('Α26 — τοποθέτηση', () => {
  it('ελεύθερη στοίβα ⇒ δέσμευση από τον ΣΥΝΤΑΚΤΗ στο προσωπικό του διαμέρισμα, αιτιολογία της υπόθεσης', async () => {
    placeFileHold.mockResolvedValue({ kind: 'placed', fileIds: ['pf_1'] });
    expect(await ensureTransmittalHold('u_n', 'pf_1', 'cvc_1')).toBe('held');
    expect(placeFileHold).toHaveBeenCalledWith({
      actor: { uid: 'u_n', owner: { userId: 'u_n' } }, fileId: 'pf_1', holdType: 'admin', reason: 'conveyance-transmittal:cvc_1',
    });
  });

  it('νέα έκδοση σε στοίβα που κρατά ΔΙΚΗ μας δέσμευση, χωρίς να την καλύπτει ⇒ αποδέσμευση + ξανατοποθέτηση σε ΟΛΗ τη στοίβα', async () => {
    placeFileHold.mockResolvedValueOnce({ kind: 'already-held', holdType: 'admin' }).mockResolvedValueOnce({ kind: 'placed', fileIds: ['pf_1', 'pf_2'] });
    stack = [{ id: 'pf_2' }, { id: 'pf_1', ...OURS }];
    expect(await ensureTransmittalHold('u_n', 'pf_2', 'cvc_1')).toBe('held');
    expect(releaseFileHold).toHaveBeenCalledTimes(1);
    expect(placeFileHold).toHaveBeenCalledTimes(2);
  });

  it('η έκδοση καλύπτεται ήδη ⇒ καμία κίνηση', async () => {
    placeFileHold.mockResolvedValue({ kind: 'already-held', holdType: 'admin' });
    stack = [{ id: 'pf_1', ...OURS }];
    expect(await ensureTransmittalHold('u_n', 'pf_1', 'cvc_1')).toBe('held');
    expect(releaseFileHold).not.toHaveBeenCalled();
  });

  it('🔴 ΞΕΝΗ δέσμευση (π.χ. νόμιμη) ⇒ ούτε αποδέσμευση ούτε αντικατάσταση — ονομάζεται', async () => {
    placeFileHold.mockResolvedValue({ kind: 'already-held', holdType: 'legal' });
    stack = [{ id: 'pf_2' }, { id: 'pf_1', ...FOREIGN }];
    expect(await ensureTransmittalHold('u_n', 'pf_2', 'cvc_1')).toBe('foreign-hold');
    expect(releaseFileHold).not.toHaveBeenCalled();
  });
});

describe('Α26 — αποδέσμευση', () => {
  it('καμία άλλη ζωντανή αποστολή στη στοίβα ⇒ αποδέσμευση', async () => {
    releaseFileHold.mockResolvedValue({ kind: 'released', fileIds: ['pf_1'] });
    stack = [{ id: 'pf_1', ...OURS }];
    expect(await releaseTransmittalHold('u_n', 'pf_1', new Set())).toBe('released');
    expect(releaseFileHold).toHaveBeenCalledWith({ actor: { uid: 'u_n', owner: { userId: 'u_n' } }, fileId: 'pf_1' });
  });

  it('🔴 άλλη ζωντανή αποστολή καρφώνει ΑΛΛΗ έκδοση της ίδιας στοίβας ⇒ η δέσμευση ΜΕΝΕΙ', async () => {
    stack = [{ id: 'pf_2', ...OURS }, { id: 'pf_1', ...OURS }];
    expect(await releaseTransmittalHold('u_n', 'pf_2', new Set(['pf_1']))).toBe('kept');
    expect(releaseFileHold).not.toHaveBeenCalled();
  });

  it('🔴 ξένη δέσμευση ⇒ δεν αγγίζεται', async () => {
    stack = [{ id: 'pf_1', ...FOREIGN }];
    expect(await releaseTransmittalHold('u_n', 'pf_1', new Set())).toBe('foreign-hold');
    expect(releaseFileHold).not.toHaveBeenCalled();
  });
});
