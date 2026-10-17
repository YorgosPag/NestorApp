/**
 * ADR-915 §30 Η-Δ3 — άγκυρες της **αναδίπλωσης παράδοσης**: ο Mailgun δεν εγγυάται σειρά γεγονότων και η αναφορά του
 * αποστολέα μπορεί να γραφτεί μετά το πρώτο γεγονός ⇒ η παράδοση πρέπει να είναι ιδεμποτής και αντιμεταθετική, όχι «το
 * τελευταίο κερδίζει».
 */

import { reduceIssuance, type IssuanceAction, type IssuanceActor, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import {
  foldDeliveryOutcome,
  withIssuanceDelivery,
  withObservedDelivery,
  type IssuanceDeliveryOutcome,
  type ObservedDeliveryOutcome,
} from '@/lib/document-validity/issuance-delivery';

const NOW = '2026-10-17T09:00:00.000Z';
const OFFICE: IssuanceActor = { kind: 'office', uid: 'uid_agent', nowIso: NOW };
const PROPOSE: IssuanceAction = {
  kind: 'propose', professionalContactId: 'cont_pro', credential: { qualification: 'energy-inspector-registered', registryNumber: null },
};
const REQUEST: IssuanceAction = { kind: 'request-approval', invitationId: 'diin_1', ownerContactId: 'cont_lead', note: null, verification: 'link' };
const RECIPIENT = { kind: 'recipient' } as const;

function requested(): IssuanceAssignmentRecord {
  let record: IssuanceAssignmentRecord | null = null;
  for (const action of [PROPOSE, REQUEST]) {
    const reduced = reduceIssuance('energy-certificate', record, null, action, OFFICE);
    if (!reduced.ok) throw new Error(reduced.refusal);
    record = reduced.record;
  }
  if (record === null) throw new Error('no record');
  return record;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
}

const OBSERVED: readonly ObservedDeliveryOutcome[] = ['delivered', 'bounced', 'complained'];
const SENDER: readonly IssuanceDeliveryOutcome[] = ['accepted', 'failed', 'unaddressable'];

describe('ADR-915 §30 — foldDeliveryOutcome', () => {
  it('ιδεμποτής: το ίδιο γεγονός δεύτερη φορά δεν αλλάζει τίποτα', () => {
    for (const outcome of [...SENDER, ...OBSERVED]) expect(foldDeliveryOutcome(outcome, outcome)).toBe(outcome);
  });

  it('🔴 αντιμεταθετική: κάθε σειρά άφιξης των γεγονότων του παρόχου δίνει το ΙΔΙΟ αποτέλεσμα', () => {
    for (const start of SENDER) {
      for (const size of [2, 3]) {
        const results = new Set(permutations(OBSERVED.slice(0, size)).map((order) => order.reduce<IssuanceDeliveryOutcome>(foldDeliveryOutcome, start)));
        expect(results.size).toBe(1);
      }
    }
    expect(permutations(['bounced', 'complained'] as const).map((order) => order.reduce<IssuanceDeliveryOutcome>(foldDeliveryOutcome, 'accepted')))
      .toEqual(['complained', 'complained']);
  });

  it('η αλήθεια του παρόχου ξεπερνά την αναφορά του αποστολέα — και η αναφορά δεν τη γυρίζει πίσω', () => {
    expect(foldDeliveryOutcome('failed', 'delivered')).toBe('delivered');
    for (const sender of SENDER) {
      for (const observed of OBSERVED) expect(foldDeliveryOutcome(observed, sender)).toBe(observed);
    }
  });

  it('η καθυστερημένη επιστροφή ακυρώνει το «παραδόθηκε»· ένα παλιό «παραδόθηκε» δεν σβήνει την επιστροφή', () => {
    expect(foldDeliveryOutcome('delivered', 'bounced')).toBe('bounced');
    expect(foldDeliveryOutcome('bounced', 'delivered')).toBe('bounced');
  });

  it('ανάμεσα σε αναφορές αποστολέα κερδίζει η νεότερη (μία ανά μήνυμα — καμία δεν είναι «ισχυρότερη»)', () => {
    expect(foldDeliveryOutcome('accepted', 'failed')).toBe('failed');
    expect(foldDeliveryOutcome('failed', 'accepted')).toBe('accepted');
  });
});

describe('ADR-915 §30 — η αναφορά του αποστολέα και τα γεγονότα στο ΙΔΙΟ μήνυμα', () => {
  it('🔴 γεγονός ΠΡΙΝ από την αναφορά ⇒ `null` (καμία επινοημένη τιμή)· μετά, η αναφορά δεν σβήνει το γεγονός', () => {
    const record = requested();
    expect(withObservedDelivery(record, 'diin_1', RECIPIENT, 'delivered')).toBeNull();
    const reported = withIssuanceDelivery(record, 'diin_1', { recipient: 'accepted', coOwners: { cont_b: 'accepted' } });
    if (reported === null) throw new Error('no report');
    const observed = withObservedDelivery(reported, 'diin_1', RECIPIENT, 'delivered');
    if (observed === null) throw new Error('no observation');
    // Το σενάριο αγώνα του Mailgun: μια **δεύτερη** αναφορά αποστολέα (επανάληψη) έρχεται μετά το γεγονός.
    expect(withIssuanceDelivery(observed, 'diin_1', { recipient: 'accepted', coOwners: { cont_b: 'accepted' } })?.approvalRequest?.delivery)
      .toEqual({ recipient: 'delivered', coOwners: { cont_b: 'accepted' } });
  });

  it('ο συνιδιοκτήτης έχει ΔΙΚΗ του θέση — η επιστροφή του δεν αγγίζει τον παραλήπτη', () => {
    const reported = withIssuanceDelivery(requested(), 'diin_1', { recipient: 'accepted', coOwners: { cont_b: 'accepted' } });
    if (reported === null) throw new Error('no report');
    expect(withObservedDelivery(reported, 'diin_1', { kind: 'co-owner', contactId: 'cont_b' }, 'bounced')?.approvalRequest?.delivery)
      .toEqual({ recipient: 'accepted', coOwners: { cont_b: 'bounced' } });
  });

  it('γεγονός για παλιό μήνυμα ⇒ `null` — δεν σκεπάζει το νέο', () => {
    const reported = withIssuanceDelivery(requested(), 'diin_1', { recipient: 'accepted', coOwners: {} });
    if (reported === null) throw new Error('no report');
    expect(withObservedDelivery(reported, 'diin_0', RECIPIENT, 'bounced')).toBeNull();
  });
});
