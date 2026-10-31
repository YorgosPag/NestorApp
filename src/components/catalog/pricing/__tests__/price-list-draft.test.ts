import type { PriceListDefinition } from '@/subapps/catalog/types/price-list';
import type { PriceListWire } from '@/subapps/catalog/types/pricing-views';
import { emptyPriceListDraft, priceListDraftIssues, priceListDraftOf, withPriceListKind, type PriceListDraftContext } from '../price-list-draft';

const list = (id: string, definition: Partial<PriceListDefinition>, isDeleted = false): PriceListWire =>
  ({ ...emptyPriceListDraft(), code: id, labels: { el: id }, ...definition, id, revision: 1, isDeleted }) as unknown as PriceListWire;

const WHOLESALE = { kind: 'customerGroup', customerGroupId: 'cgrp_w' } as const;

const context = (over: Partial<PriceListDraftContext> = {}): PriceListDraftContext => ({
  customerGroupIds: new Set(['cgrp_w']),
  lists: [],
  record: null,
  hasVersions: false,
  created: null,
  ...over,
});

const codes = (draft: PriceListDefinition, ctx: PriceListDraftContext) => priceListDraftIssues(draft, ctx).map((issue) => `${issue.code}@${issue.path}`);

describe('price-list-draft — ό,τι θα έλεγε ο γραφέας, πριν από την αποστολή', () => {
  const valid: PriceListDefinition = { ...emptyPriceListDraft(), code: 'mfp', labels: { el: 'MFP' } };

  it('έγκυρο πρόχειρο ⇒ κανένα εύρημα', () => {
    expect(codes(valid, context())).toEqual([]);
  });

  it('η ίδια επικύρωση με τον γραφέα: κωδικός · ετικέτα · άγνωστη ομάδα · φράχτης εκτός ορίων', () => {
    const draft: PriceListDefinition = { ...emptyPriceListDraft(), audience: { kind: 'customerGroup', customerGroupId: 'cgrp_x' }, changeFenceBp: 100 };
    expect(codes(draft, context())).toEqual(['invalidCode@code', 'labelRequired@labels', 'unknownReference@audience.customerGroupId', 'fenceOutOfBounds@changeFenceBp']);
  });

  it('είδος/τύπος κλειδώνουν ΜΟΝΟ όταν υπάρχει έκδοση', () => {
    const record = list('mfp', {});
    const changed = { ...priceListDraftOf(record), priceType: 'net_customer' as const };
    expect(codes(changed, context({ record, hasVersions: false }))).toEqual([]);
    expect(codes(changed, context({ record, hasVersions: true }))).toEqual(['typeLockedInUse@priceType']);
  });

  it('δύο λίστες πώλησης στο ίδιο κοινό ⇒ ασάφεια· η ίδια η λίστα, η διαγραμμένη και η κόστους δεν μετρούν', () => {
    const draft = { ...valid, audience: WHOLESALE };
    expect(codes(draft, context({ lists: [list('other', { audience: WHOLESALE })] }))).toEqual(['priceListAudienceAmbiguous@audience']);
    const self = list('mfp', { audience: WHOLESALE });
    expect(codes(draft, context({ record: self, lists: [self] }))).toEqual([]);
    expect(codes(draft, context({ lists: [list('gone', { audience: WHOLESALE }, true)] }))).toEqual([]);
  });

  it('Σ2 (ζωντανά): νέα λίστα που ΗΔΗ στάλθηκε δεν συγκρούεται με τον εαυτό της — ούτε αισιόδοξη ούτε αποθηκευμένη', () => {
    const draft = { ...valid, audience: WHOLESALE };
    const optimistic = list('new:mfp', { code: 'mfp', audience: WHOLESALE });
    const stored = list('plst_server', { code: 'mfp', audience: WHOLESALE });
    expect(codes(draft, context({ lists: [optimistic], created: draft }))).toEqual([]);
    expect(codes(draft, context({ lists: [stored], created: draft }))).toEqual([]);
    // Πριν από την αποστολή, ή άλλη λίστα στο ίδιο κοινό ⇒ η ασάφεια μένει.
    expect(codes(draft, context({ lists: [stored] }))).toEqual(['priceListAudienceAmbiguous@audience']);
    expect(codes(draft, context({ lists: [stored, list('other', { audience: WHOLESALE })], created: draft }))).toEqual(['priceListAudienceAmbiguous@audience']);
  });

  it('συνεργάτης χωρίς επιλεγμένη επαφή ⇒ το ίδιο εύρημα με τον γραφέα (κενό id δεν υπάρχει)', () => {
    const empty = { ...valid, audience: { kind: 'partner', party: { kind: 'contact', contactId: '' } } } as const;
    expect(codes(empty, context())).toEqual(['unknownParty@audience.party']);
    const chosen = { ...valid, audience: { kind: 'partner', party: { kind: 'contact', contactId: 'cont_1' } } } as const;
    expect(codes(chosen, context())).toEqual([]);
  });

  it('αλλαγή σε κόστους καθαρίζει το κοινό (η φόρμα το κρύβει — κανένα αόρατο εύρημα)', () => {
    const cost = withPriceListKind({ ...valid, audience: WHOLESALE }, 'cost');
    expect(cost.audience).toBeNull();
    expect(codes(cost, context())).toEqual([]);
  });

  it('priceListDraftOf: μόνο τα πεδία του ορισμού, ποτέ μεταδεδομένα εγγραφής', () => {
    expect(Object.keys(priceListDraftOf(list('mfp', {}))).sort()).toEqual(['audience', 'changeFenceBp', 'code', 'kind', 'labels', 'priceType', 'projectId']);
  });
});
