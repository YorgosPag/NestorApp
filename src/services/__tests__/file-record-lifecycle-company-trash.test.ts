/**
 * @fileoverview 🗑️ **ΤΟ ΕΤΑΙΡΙΚΟ ΑΡΧΕΙΟ ΤΟ ΠΕΤΑ Ο ΔΙΑΚΟΜΙΣΤΗΣ** — η πλευρά του πελάτη (ADR-845 §7.17 Α2).
 * @related services/file-record-lifecycle.ts · services/filesystem/file-trash.client.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: (α) ο browser **δεν** γράφει πια τον κάδο εταιρικού αρχείου — ούτε `updateDoc`
 * ούτε δέσμη· (β) τα γεγονότα `FILE_TRASHED` / `FILE_RESTORED` εκπέμπονται **μετά** την απάντηση
 * και **μόνο** για ό,τι άλλαξε πραγματικά — οι συνδρομητές αδειάζουν καμβά και λίστες, άρα γεγονός
 * για αρχείο που ο διακομιστής αρνήθηκε θα έσβηνε από την οθόνη κάτι που υπάρχει· (γ) η μαζική
 * πράξη είναι **ένα** αίτημα, όχι ένα ανά αρχείο.
 */

const clientWrites: string[] = [];
const dispatch = jest.fn();
const requestFileTrash = jest.fn();

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('@/services/realtime', () => ({ RealtimeService: { dispatch: (...args: unknown[]) => dispatch(...args) } }));
jest.mock('@/services/filesystem/file-trash.client', () => ({
  requestFileTrash: (...args: unknown[]) => requestFileTrash(...args),
}));
jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  return {
    ...actual,
    doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}`, id }),
    getDoc: async () => { clientWrites.push('getDoc'); return { exists: () => false, data: () => undefined }; },
    updateDoc: async () => { clientWrites.push('updateDoc'); },
    writeBatch: () => { clientWrites.push('writeBatch'); return { set: jest.fn(), update: jest.fn(), commit: jest.fn() }; },
  };
});

const { moveToTrash, restoreFromTrash, moveManyToTrash } =
  require('@/services/file-record-lifecycle') as typeof import('@/services/file-record-lifecycle');

const answer = (files: unknown[], errors: string[] = []) => ({
  success: true, processedCount: files.length, errors, listings: [], files,
});

beforeEach(() => {
  clientWrites.length = 0;
  dispatch.mockReset();
  requestFileTrash.mockReset();
});

describe('ADR-845 §7.17 Α2 — ο πελάτης ΖΗΤΑ, δεν γράφει', () => {
  it('🏆 Π1 — κάδος εταιρικού: ΕΝΑ αίτημα, ΚΑΜΙΑ ανάγνωση/γραφή από τον browser', async () => {
    requestFileTrash.mockResolvedValue(answer([{ fileId: 'f1', purgeAt: '2026-11-07T00:00:00.000Z' }]));

    await moveToTrash('f1', 'company', 'u_alpha');

    expect(requestFileTrash).toHaveBeenCalledWith(['f1'], 'trash');
    expect(clientWrites).toEqual([]);
  });

  it('🔑 Π2 — το `FILE_TRASHED` φέρει ό,τι ΕΓΡΑΨΕ ο διακομιστής, και εκπέμπεται ΜΕΤΑ την απάντηση', async () => {
    let dispatchedBeforeAnswer = false;
    requestFileTrash.mockImplementation(async () => {
      dispatchedBeforeAnswer = dispatch.mock.calls.length > 0;
      return answer([{ fileId: 'f1', purgeAt: 'P', displayName: 'Κάτοψη', entityId: 'prop_1', entityType: 'property' }]);
    });

    await moveToTrash('f1', 'company', 'u_alpha');

    expect(dispatchedBeforeAnswer).toBe(false);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('FILE_TRASHED', expect.objectContaining({
      fileId: 'f1', trashedBy: 'u_alpha', purgeAt: 'P', displayName: 'Κάτοψη', entityId: 'prop_1', entityType: 'property',
    }));
  });

  it('🔴 Π3 — ΑΡΝΗΣΗ: ρίψη με όνομα, και ΚΑΝΕΝΑ γεγονός για το αρχείο που έμεινε', async () => {
    requestFileTrash.mockResolvedValue(answer([], ['f1: not-owner']));

    await expect(moveToTrash('f1', 'company', 'u_alpha')).rejects.toThrow('FILE_TRASH_REFUSED: f1: not-owner');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('Π4 — ήδη στον κάδο (ιδεμποτία του διακομιστή) ⇒ ούτε γεγονός ούτε ρίψη', async () => {
    requestFileTrash.mockResolvedValue(answer([]));

    await expect(moveToTrash('f1', 'company', 'u_alpha')).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('♻️ Π5 — επαναφορά εταιρικού: αίτημα `restore`, `FILE_RESTORED` μετά· άρνηση ⇒ ρίψη', async () => {
    requestFileTrash.mockResolvedValueOnce(answer([{ fileId: 'f1', purgeAt: null }]));
    await restoreFromTrash('f1', 'company', 'u_alpha');

    expect(requestFileTrash).toHaveBeenCalledWith(['f1'], 'restore');
    expect(dispatch).toHaveBeenCalledWith('FILE_RESTORED', expect.objectContaining({ fileId: 'f1', restoredBy: 'u_alpha' }));
    expect(clientWrites).toEqual([]);

    requestFileTrash.mockResolvedValueOnce(answer([], ['f1: not-in-trash']));
    await expect(restoreFromTrash('f1', 'company', 'u_alpha')).rejects.toThrow('FILE_RESTORE_REFUSED: f1: not-in-trash');
  });
});

describe('ADR-845 §7.17 Α2 — η μαζική πράξη είναι ΕΝΑ αίτημα', () => {
  it('🔑 Π6 — Ν εταιρικά ⇒ ΜΙΑ κλήση με όλα τα ids (όχι μία ανά αρχείο)', async () => {
    requestFileTrash.mockResolvedValue(answer([
      { fileId: 'f1', purgeAt: 'P' }, { fileId: 'f2', purgeAt: 'P' }, { fileId: 'f3', purgeAt: 'P' },
    ]));

    await moveManyToTrash(
      [{ id: 'f1', custody: 'company' }, { id: 'f2', custody: 'company' }, { id: 'f3', custody: 'company' }],
      'u_alpha',
    );

    expect(requestFileTrash).toHaveBeenCalledTimes(1);
    expect(requestFileTrash).toHaveBeenCalledWith(['f1', 'f2', 'f3'], 'trash');
    expect(dispatch).toHaveBeenCalledTimes(3);
  });

  it('Π7 — μερική άρνηση: γεγονός για όσα ΑΛΛΑΞΑΝ, και μετά ρίψη για τα υπόλοιπα', async () => {
    requestFileTrash.mockResolvedValue(answer([{ fileId: 'f1', purgeAt: 'P' }], ['f2: not-owner']));

    await expect(
      moveManyToTrash([{ id: 'f1', custody: 'company' }, { id: 'f2', custody: 'company' }], 'u_alpha'),
    ).rejects.toThrow('FILE_TRASH_REFUSED: f2: not-owner');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('FILE_TRASHED', expect.objectContaining({ fileId: 'f1' }));
  });

  it('Π8 — κανένα εταιρικό στη δέσμη ⇒ κανένα αίτημα', async () => {
    await moveManyToTrash([], 'u_alpha');

    expect(requestFileTrash).not.toHaveBeenCalled();
  });
});
