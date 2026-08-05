/**
 * @fileoverview 🔴 Η ΕΜΒΕΛΕΙΑ ΤΟΥ SUPERSEDE — ο φύλακας που αν λείπει σβήνει νόμιμη σύνδεση.
 *
 * Το ADR §Γ3 συνταγογραφεί «μαρκάρονται `superseded` τα προηγούμενα του **ίδιου** (fileRecordId,
 * levelId, sourceHandle, fieldKey)». **Αυτή η συνταγή, όπως είναι γραμμένη, είναι λάθος** — και
 * δεν φαίνεται παρά μόνο αν εκτελέσεις τον Λ2 στο πραγματικό δείγμα:
 *
 * - το κελί `ΜΕΛΕΤΗΤΗΣ` δίνει **δύο πρόσωπα** από το ίδιο `sourceHandle` και το ίδιο `fieldKey`
 * - το κελί `ΘΕΣΗ` δίνει **τρεις** ενότητες, ομοίως
 *
 * ⇒ Με εμβέλεια κελιού, η έγκριση του μελετητή #2 θα μαρκάριζε `superseded` τον #1: **δύο
 * νόμιμες συνδέσεις, η μία σβησμένη χωρίς να το ζητήσει κανείς.** Η θεραπεία του Γ3 θα γεννούσε
 * νέα απώλεια. Ο διαχωριστής είναι το `slot`.
 */

const updates: { id: string; patch: Record<string, unknown> }[] = [];
const setDocs: string[] = [];

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  doc: jest.fn((_db: unknown, _col: string, id: string) => ({ id, withConverter: () => ({ id }) })),
  collection: jest.fn(() => ({ withConverter: () => ({}) })),
  query: jest.fn(() => ({ withConverter: () => ({}) })),
  where: jest.fn(), orderBy: jest.fn(),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  getDocs: jest.fn(async () => ({ docs: [] })),
  setDoc: jest.fn(async (ref: { id: string }) => { setDocs.push(ref.id); }),
  updateDoc: jest.fn(async (ref: { id: string }, patch: Record<string, unknown>) => {
    updates.push({ id: ref.id, patch });
  }),
}));
jest.mock('@/lib/firebase', () => ({ __esModule: true, db: {} }));

import { saveTitleBlockBinding } from '../title-block-binding.service';
import type { TitleBlockBinding } from '@/types/title-block-binding';

const base: TitleBlockBinding = {
  id: 'tbb_new',
  companyId: 'c1',
  projectId: 'proj_1',
  fileRecordId: 'file_1',
  levelId: 'lvl_1',
  layerName: 'PINAKAKI 500',
  titleBlockIndex: 0,
  fieldKey: 'designers',
  sourceHandle: 'mtext_7',
  labelHandle: 'mtext_6',
  slot: 'MAYROMIXALHS',
  target: { kind: 'contact', contactId: 'cont_right', role: 'surveyor', projectId: 'proj_1' },
  snapshotValue: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ',
  status: 'active',
  confirmedBy: 'u1',
  confirmedAt: '2026-08-05T00:00:00.000Z',
};

const existing = (over: Partial<TitleBlockBinding>): TitleBlockBinding => ({ ...base, ...over });

beforeEach(() => { updates.length = 0; setDocs.length = 0; });

describe('🔴 Ο ΜΕΛΕΤΗΤΗΣ #1 ΕΠΙΒΙΩΝΕΙ ΤΗΣ ΕΓΚΡΙΣΗΣ ΤΟΥ #2', () => {
  it('ΙΔΙΟ κελί, ΑΛΛΟ slot ⇒ ΔΕΝ αποσύρεται', async () => {
    const designerOne = existing({
      id: 'tbb_designer_1',
      slot: 'NIKOLAOU',                    // ← άλλο πρόσωπο, ΙΔΙΟ κελί
      target: { kind: 'contact', contactId: 'cont_other', role: 'structural_engineer', projectId: 'proj_1' },
    });

    const result = await saveTitleBlockBinding(base, [designerOne]);

    expect(result.success).toBe(true);
    expect(result.success && result.supersededIds).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('τρεις ενότητες θέσης από ΕΝΑ κελί συνυπάρχουν', async () => {
    const municipality = existing({ id: 'tbb_muni', fieldKey: 'location', slot: 'municipality' });
    const neighborhood = existing({ id: 'tbb_nbhd', fieldKey: 'location', slot: 'neighborhood' });
    const incoming = existing({ id: 'tbb_ot', fieldKey: 'location', slot: 'buildingBlock' });

    await saveTitleBlockBinding(incoming, [municipality, neighborhood]);
    expect(updates).toEqual([]);
  });
});

describe('🔴 Η ΔΙΟΡΘΩΣΗ ΑΠΟΣΥΡΕΙ — ΔΕΝ ΣΒΗΝΕΙ', () => {
  it('ΙΔΙΟ slot, ΑΛΛΟΣ στόχος ⇒ ο παλιός γίνεται `superseded`', async () => {
    const wrong = existing({
      id: 'tbb_wrong',
      target: { kind: 'contact', contactId: 'cont_wrong', role: 'surveyor', projectId: 'proj_1' },
    });

    const result = await saveTitleBlockBinding(base, [wrong]);

    expect(result.success && result.supersededIds).toEqual(['tbb_wrong']);
    expect(updates).toEqual([{ id: 'tbb_wrong', patch: { status: 'superseded' } }]);
  });

  it('🔑 ο νέος γράφεται ΠΡΙΝ αποσυρθεί ο παλιός — αλλιώς μια αποτυχία αφήνει τη θέση ΚΕΝΗ', async () => {
    await saveTitleBlockBinding(base, [existing({ id: 'tbb_wrong', target: { kind: 'contact', contactId: 'cont_wrong', role: 'surveyor', projectId: 'proj_1' } })]);
    expect(setDocs).toEqual(['tbb_new']);
    expect(updates).toHaveLength(1);
  });

  it('ήδη αποσυρμένο δεν ξανα-αποσύρεται', async () => {
    const already = existing({ id: 'tbb_old', status: 'superseded', target: { kind: 'contact', contactId: 'cont_wrong', role: 'surveyor', projectId: 'proj_1' } });
    await saveTitleBlockBinding(base, [already]);
    expect(updates).toEqual([]);
  });

  it('το ίδιο το έγγραφο δεν αποσύρει τον εαυτό του (ιδεοδύναμη επανάληψη)', async () => {
    await saveTitleBlockBinding(base, [{ ...base }]);
    expect(updates).toEqual([]);
  });
});

describe('🔴 ΚΑΝΕΝΑ ΓΡΑΨΙΜΟ ΧΩΡΙΣ ΤΑΥΤΟΤΗΤΑ', () => {
  it.each([
    ['companyId', { companyId: '' }],
    ['confirmedBy', { confirmedBy: '' }],
  ])('κενό %s ⇒ αποτυχία, μηδέν εγγραφές', async (_n, over) => {
    const result = await saveTitleBlockBinding(existing(over), []);
    expect(result.success).toBe(false);
    expect(setDocs).toEqual([]);
  });
});
