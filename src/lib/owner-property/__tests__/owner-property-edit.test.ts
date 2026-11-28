/**
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ ADR-953 §3.3** — η συγχώνευση τριών δρόμων ανά πεδίο, ως πίνακας.
 * @related lib/owner-property/owner-property-edit.ts
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | το αμετάβλητο πεδίο γράφεται από τη φόρμα | «παλιά καρτέλα δεν σβήνει ξένη αλλαγή» ⇒ 🔴 |
 * | η σύγκρουση κρίνεται χωρίς τον έλεγχο έκδοσης | «ίδια έκδοση ⇒ ποτέ σύγκρουση» ⇒ 🔴 |
 * | οι λεζάντες κρίνονται ως ένα πεδίο | «άλλες φωτογραφίες δεν συγκρούονται» ⇒ 🔴 |
 * | το `keepMine` αγνοείται | «κράτα τις δικές μου» ⇒ 🔴 |
 */

import {
  OWNER_PROPERTY_DRAFT_FIELDS,
  mergeOwnerPropertyEdit,
  ownerListingConflictFrom,
  ownerPropertyEditOf,
} from '../owner-property-edit';
import { offerOf, validDraft } from './owner-property-fixtures';

const V1 = '2026-11-28T09:00:00.000Z';
const V2 = '2026-11-28T09:05:00.000Z';

/** Η φόρμα άνοιξε στο `base`, ο άνθρωπος έφτασε στο `mine`, και στον διακομιστή βρίσκεται το `theirs`. */
function merge(
  base: ReturnType<typeof validDraft>,
  mine: ReturnType<typeof validDraft>,
  theirs: ReturnType<typeof validDraft>,
  options: { readonly concurrent?: boolean; readonly keepMine?: readonly (keyof typeof base)[] } = {},
) {
  const edit = ownerPropertyEditOf(base, mine, V1, options.keepMine ?? []);
  return mergeOwnerPropertyEdit(theirs, options.concurrent === false ? V1 : V2, mine, edit);
}

describe('ownerPropertyEditOf — τι άλλαξε ο άνθρωπος', () => {
  it('καμία αλλαγή ⇒ κενό `changed`, κενή βάση', () => {
    const edit = ownerPropertyEditOf(validDraft(), validDraft(), V1);
    expect(edit).toEqual({ baseContentAt: V1, changed: [], base: {}, keepMine: [] });
  });

  it('δηλώνει μόνο τα αλλαγμένα πεδία, με την τιμή-βάση τους', () => {
    const edit = ownerPropertyEditOf(validDraft(), validDraft({ title: 'Νέος τίτλος', bedrooms: 3 }), V1);
    expect(edit.changed).toEqual(['title', 'bedrooms']);
    expect(edit.base).toEqual({ title: 'Διαμέρισμα 92 τ.μ.', bedrooms: 2 });
  });

  it('η σειρά κλειδιών δεν είναι αλλαγή', () => {
    const reordered = { areaId: null, link: null, accuracy: 'exact', label: 'Εγνατίας 147, Θεσσαλονίκη', point: { lng: 22.95, lat: 40.63 }, kind: 'declared' } as const;
    expect(ownerPropertyEditOf(validDraft(), validDraft({ place: reordered }), V1).changed).toEqual([]);
  });

  it('πεδίο που δεν υπήρχε στη βάση ⇒ στο `changed`, χωρίς κλειδί στη βάση', () => {
    const edit = ownerPropertyEditOf(validDraft(), validDraft({ publishedFileCaptions: { f1: { text: 'Σαλόνι' } } as never }), V1);
    expect(edit.changed).toEqual(['publishedFileCaptions']);
    expect(edit.base).toEqual({});
  });

  it('το `keepMine` κρατά μόνο πεδία που όντως άλλαξαν', () => {
    const edit = ownerPropertyEditOf(validDraft(), validDraft({ title: 'Νέος' }), V1, ['title', 'bedrooms']);
    expect(edit.keepMine).toEqual(['title']);
  });
});

describe('🏆 mergeOwnerPropertyEdit — ο πίνακας του §3.3', () => {
  it('🔴 παλιά καρτέλα ΔΕΝ σβήνει ξένη αλλαγή: πεδίο που δεν άλλαξα μένει του διακομιστή', () => {
    const base = validDraft();
    const result = merge(base, validDraft({ title: 'Δικός μου τίτλος' }), validDraft({ bedrooms: 4 }));

    expect(result).toMatchObject({ kind: 'merged', written: ['title'] });
    if (result.kind !== 'merged') throw new Error('αναμενόταν συγχώνευση');
    expect(result.draft.title).toBe('Δικός μου τίτλος');
    expect(result.draft.bedrooms).toBe(4);
  });

  it('εγώ το άλλαξα, ο άλλος όχι ⇒ η δική μου', () => {
    const result = merge(validDraft(), validDraft({ areaSqm: 95 }), validDraft());
    expect(result).toMatchObject({ kind: 'merged', written: ['areaSqm'] });
  });

  it('και οι δύο στην ΙΔΙΑ τιμή ⇒ καμία αλλαγή, καμία σύγκρουση', () => {
    const result = merge(validDraft(), validDraft({ areaSqm: 95 }), validDraft({ areaSqm: 95 }));
    expect(result).toMatchObject({ kind: 'merged', written: [] });
  });

  it('🔴 και οι δύο σε ΑΛΛΗ τιμή ⇒ σύγκρουση, με το όνομα του πεδίου', () => {
    const result = merge(validDraft(), validDraft({ areaSqm: 95, title: 'Α' }), validDraft({ areaSqm: 99 }));
    expect(result).toEqual({ kind: 'conflict', fields: ['areaSqm'] });
  });

  it('🔑 ίδια έκδοση περιεχομένου ⇒ ΠΟΤΕ σύγκρουση, ακόμη κι αν η βάση διαφέρει από το έγγραφο', () => {
    // Διαφορά κανονικοποίησης «βάση φόρμας ↔ αποθηκευμένο» δεν είναι ξένη αλλαγή.
    const result = merge(validDraft({ areaSqm: 92 }), validDraft({ areaSqm: 95 }), validDraft({ areaSqm: 92.0001 }), { concurrent: false });
    expect(result).toMatchObject({ kind: 'merged', written: ['areaSqm'] });
  });

  it('«κράτα τις δικές μου» ⇒ η δική μου περνά στο συγκρουόμενο πεδίο', () => {
    const result = merge(validDraft(), validDraft({ areaSqm: 95 }), validDraft({ areaSqm: 99 }), { keepMine: ['areaSqm'] });
    expect(result).toMatchObject({ kind: 'merged', written: ['areaSqm'] });
    if (result.kind !== 'merged') throw new Error('αναμενόταν συγχώνευση');
    expect(result.draft.areaSqm).toBe(95);
  });

  it('σύνθετο πεδίο (διαθέσεις) κρίνεται ολόκληρο', () => {
    const result = merge(
      validDraft(),
      validDraft({ offers: [offerOf('sell', 195_000)] }),
      validDraft({ offers: [offerOf('sell', 199_000)] }),
    );
    expect(result).toEqual({ kind: 'conflict', fields: ['offers'] });
  });
});

describe('🏆 δηλώσεις ανά αρχείο — κρίνονται ανά αρχείο', () => {
  const captions = (entries: Record<string, string>) =>
    ({ publishedFileCaptions: Object.fromEntries(Object.entries(entries).map(([id, text]) => [id, { text }])) }) as never;

  it('🔴 λεζάντες σε ΑΛΛΕΣ φωτογραφίες συγχωνεύονται χωρίς ερώτηση', () => {
    const base = validDraft(captions({ a: 'Σαλόνι' }));
    const mine = validDraft(captions({ a: 'Σαλόνι', b: 'Κουζίνα' }));
    const theirs = validDraft(captions({ a: 'Σαλόνι', c: 'Μπάνιο' }));

    const result = merge(base, mine, theirs);

    if (result.kind !== 'merged') throw new Error('αναμενόταν συγχώνευση');
    expect(Object.keys(result.draft.publishedFileCaptions ?? {}).sort()).toEqual(['a', 'b', 'c']);
  });

  it('🔴 σβήσιμο λεζάντας δεν ανασταίνεται, και ξένη λεζάντα δεν σβήνεται', () => {
    const base = validDraft(captions({ a: 'Σαλόνι', b: 'Κουζίνα' }));
    const mine = validDraft(captions({ b: 'Κουζίνα' }));
    const theirs = validDraft(captions({ a: 'Σαλόνι', b: 'Κουζίνα', c: 'Μπάνιο' }));

    const result = merge(base, mine, theirs);

    if (result.kind !== 'merged') throw new Error('αναμενόταν συγχώνευση');
    expect(Object.keys(result.draft.publishedFileCaptions ?? {}).sort()).toEqual(['b', 'c']);
  });

  it('η ΙΔΙΑ φωτογραφία σε άλλη λεζάντα ⇒ σύγκρουση', () => {
    const result = merge(
      validDraft(captions({ a: 'Σαλόνι' })),
      validDraft(captions({ a: 'Καθιστικό' })),
      validDraft(captions({ a: 'Living room' })),
    );
    expect(result).toEqual({ kind: 'conflict', fields: ['publishedFileCaptions'] });
  });

  it('η δήλωση αρχείων ενώνεται ως σύνολο: οι αφαιρέσεις και οι προσθήκες μου πάνω στη δήλωση του άλλου', () => {
    const result = merge(
      validDraft({ publishedFileIds: ['a', 'b'] }),
      validDraft({ publishedFileIds: ['b', 'x'] }),
      validDraft({ publishedFileIds: ['b', 'a', 'y'] }),
    );
    if (result.kind !== 'merged') throw new Error('αναμενόταν συγχώνευση');
    expect(result.draft.publishedFileIds).toEqual(['b', 'y', 'x']);
  });
});

describe('ownerListingConflictFrom — το σώμα του 409', () => {
  it('διαβάζει πεδία, στιγμή και «ποιος»', () => {
    expect(ownerListingConflictFrom({ fields: ['title', 'άγνωστο'], at: V2, bySelf: false, byName: 'Μαρία' })).toEqual({
      fields: ['title'],
      at: V2,
      bySelf: false,
      byName: 'Μαρία',
    });
  });

  it('χωρίς γνωστό πεδίο ⇒ `null` (ποτέ κενός διάλογος)', () => {
    expect(ownerListingConflictFrom({ fields: ['άγνωστο'] })).toBeNull();
    expect(ownerListingConflictFrom(null)).toBeNull();
  });

  it('το μητρώο πεδίων καλύπτει και τα 15 του προσχεδίου', () => {
    expect(OWNER_PROPERTY_DRAFT_FIELDS).toHaveLength(15);
  });
});
