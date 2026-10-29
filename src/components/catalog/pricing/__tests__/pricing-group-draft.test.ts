import type { CustomerAssignmentWire, CustomerGroupWire } from '@/subapps/catalog/types/pricing-views';
import {
  emptyGroupDraft,
  groupDraftIssues,
  groupSelectionOf,
  membersOf,
  membershipVerdict,
  parseGroupSelection,
} from '../pricing-group-draft';

const wire = <T>(id: string, fields: T, isDeleted = false) => ({ ...fields, id, revision: 1, isDeleted }) as unknown;
const group = (id: string, code: string) => wire(id, { code, labels: { el: code } }) as CustomerGroupWire;
const assignment = (contactId: string, customerGroupId: string, isDeleted = false) =>
  wire(`cass_${contactId}`, { party: { kind: 'contact', contactId }, customerGroupId }, isDeleted) as CustomerAssignmentWire;

const WHOLESALE = group('cgrp_w', 'wholesale');
const RETAIL = group('cgrp_r', 'retail');

describe('επιλογή στη διεύθυνση — το είδος ταξιδεύει μαζί με τον κωδικό', () => {
  it('στρογγυλή διαδρομή · ίδιος κωδικός σε δύο είδη = δύο επιλογές', () => {
    expect(parseGroupSelection(groupSelectionOf('customerGroup', 'a:b'))).toEqual({ kind: 'customerGroup', code: 'a:b' });
    expect(groupSelectionOf('discountGroup', 'x')).not.toBe(groupSelectionOf('customerGroup', 'x'));
  });

  it('άγνωστο είδος, κενός κωδικός, κενό ⇒ καμία επιλογή', () => {
    expect([parseGroupSelection('priceList:x'), parseGroupSelection('discountGroup:'), parseGroupSelection(null), parseGroupSelection('x')]).toEqual([null, null, null, null]);
  });
});

describe('πρόχειρο ομάδας — ό,τι θα έλεγε ο γραφέας', () => {
  it('κωδικός + ετικέτα, και ο διπλός κωδικός ΜΟΝΟ για νέα, ΜΟΝΟ στο ίδιο είδος', () => {
    expect(groupDraftIssues(emptyGroupDraft(), [], null).map((issue) => issue.code)).toEqual(['invalidCode', 'labelRequired']);
    const draft = { code: 'wholesale', labels: { el: 'Χ' } };
    expect(groupDraftIssues(draft, [WHOLESALE], null)).toEqual([{ code: 'duplicateCode', path: 'code', params: { code: 'wholesale' } }]);
    expect(groupDraftIssues(draft, [WHOLESALE], WHOLESALE)).toEqual([]);
  });
});

describe('«ένας συμβαλλόμενος ⇒ μία ομάδα», πριν από την αποστολή', () => {
  const assignments = [assignment('a', 'cgrp_r'), assignment('b', 'cgrp_w'), assignment('gone', 'cgrp_r', true)];
  const party = (contactId: string) => ({ kind: 'contact', contactId }) as const;

  it('νέος ⇒ προσθήκη · ήδη εδώ ⇒ τίποτα · αλλού ⇒ ΜΕΤΑΚΙΝΗΣΗ της ίδιας ανάθεσης', () => {
    expect(membershipVerdict(party('new'), 'cgrp_w', assignments, [WHOLESALE, RETAIL])).toEqual({ kind: 'add' });
    expect(membershipVerdict(party('b'), 'cgrp_w', assignments, [WHOLESALE, RETAIL]).kind).toBe('alreadyHere');
    expect(membershipVerdict(party('a'), 'cgrp_w', assignments, [WHOLESALE, RETAIL])).toMatchObject({ kind: 'move', from: RETAIL, assignment: { id: 'cass_a' } });
  });

  it('διαγραμμένη ανάθεση δεν δεσμεύει · μέλη μόνο της ομάδας, κατά όνομα', () => {
    expect(membershipVerdict(party('gone'), 'cgrp_w', assignments, [WHOLESALE, RETAIL])).toEqual({ kind: 'add' });
    const names: Record<string, string> = { cass_x: 'Βήτα', cass_y: 'Άλφα' };
    const members = membersOf('cgrp_w', [assignment('x', 'cgrp_w'), assignment('y', 'cgrp_w'), assignment('z', 'cgrp_r')], (item) => names[item.id] ?? '');
    expect(members.map((item) => item.id)).toEqual(['cass_y', 'cass_x']);
  });
});
