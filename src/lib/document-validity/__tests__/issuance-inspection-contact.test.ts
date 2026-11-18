/**
 * ADR-915 §45.15 — άγκυρες του ΥΠΕΥΘΥΝΟΥ ΑΥΤΟΨΙΑΣ: ορισμός μόνο από το γραφείο · κάθε αλλαγή είναι γεγονός (ποτέ
 * σιωπηλή αντικατάσταση) · ίδιος ορισμός ⇒ ιδεμποτές · «Άλλο» μόνο με κείμενο · ο ορισμός επιβιώνει νέας πρότασης
 * στον ίδιο ανοιχτό κύκλο · το σχήμα του δίσκου διαβάζει παλιά έγγραφα ως «κανείς». Συνθετικά δεδομένα.
 */

import {
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import {
  currentInspectionContactOf,
  INSPECTION_CONTACT_POLICY,
} from '@/lib/document-validity/issuance-inspection-contact';
import { issuanceAssignmentBody, issuanceActionOf } from '@/lib/document-validity/issuance-request';

const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-123' } as const;
const PROPOSE: IssuanceAction = { kind: 'propose', professional: { kind: 'contact', contactId: 'cont_pro' }, credential: INSPECTOR };
const REPROPOSE: IssuanceAction = { kind: 'propose', professional: { kind: 'contact', contactId: 'cont_pro_2' }, credential: INSPECTOR };
const DECLINE: IssuanceAction = { kind: 'respond', outcome: 'declined', note: null };
const NOTIFY: IssuanceAction = { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null };
const CANCEL: IssuanceAction = { kind: 'cancel', reason: 'cancelled' };
const contact = (contactId: string, role: 'owner' | 'tenant' | 'other' = 'owner', roleOther: string | null = null): IssuanceAction =>
  ({ kind: 'set-inspection-contact', contactId, role, roleOther });

const at = (i: number): string => `2026-11-${String(i + 2).padStart(2, '0')}T09:00:00.000Z`;
const office = (i: number): IssuanceActor => ({ kind: 'office', uid: 'uid_agent', nowIso: at(i) });

function step(record: IssuanceAssignmentRecord | null, action: IssuanceAction, i: number, actor: IssuanceActor = office(i)) {
  return reduceIssuance('energy-certificate', record, null, action, actor);
}

function run(actions: readonly IssuanceAction[]): IssuanceAssignmentRecord {
  let record: IssuanceAssignmentRecord | null = null;
  actions.forEach((action, i) => {
    const reduced = step(record, action, i);
    if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
    record = reduced.record;
  });
  if (record === null) throw new Error('no record');
  return record;
}

describe('set-inspection-contact — ο ορισμός', () => {
  it('το γραφείο ορίζει υπεύθυνο: γεγονός με ποιος/πότε, και ο τρέχων = ο νεότερος', () => {
    const record = run([PROPOSE, contact('cont_owner')]);
    expect(record.inspectionContacts).toEqual([{ contactId: 'cont_owner', role: 'owner', roleOther: null, at: at(1), byUid: 'uid_agent' }]);
    expect(currentInspectionContactOf(record)?.contactId).toBe('cont_owner');
  });

  it('αλλαγή = νέα εγγραφή, ποτέ σιωπηλή αντικατάσταση', () => {
    const record = run([PROPOSE, contact('cont_owner'), contact('cont_tenant', 'tenant')]);
    expect(record.inspectionContacts.map((e) => e.contactId)).toEqual(['cont_owner', 'cont_tenant']);
    expect(currentInspectionContactOf(record)?.role).toBe('tenant');
  });

  it('ίδιος ορισμός ξανά ⇒ `changed: false`, κανένα γεγονός', () => {
    const record = run([PROPOSE, contact('cont_owner')]);
    const again = step(record, contact('cont_owner'), 2);
    expect(again).toEqual({ ok: true, record, changed: false });
  });

  it('ίδιο πρόσωπο με άλλη ιδιότητα ⇒ είναι αλλαγή', () => {
    const record = run([PROPOSE, contact('cont_owner'), contact('cont_owner', 'tenant')]);
    expect(record.inspectionContacts).toHaveLength(2);
  });

  it('«Άλλο» χωρίς κείμενο ⇒ άρνηση· με κείμενο ⇒ δεκτό (κομμένο)', () => {
    const record = run([PROPOSE]);
    expect(step(record, contact('cont_x', 'other', '   '), 1)).toEqual({ ok: false, refusal: 'terms-refused' });
    const ok = step(record, contact('cont_x', 'other', '  Θυρωρός  '), 1);
    expect(ok.ok && currentInspectionContactOf(ok.record)?.roleOther).toBe('Θυρωρός');
  });

  it('ιδιότητα πλην «Άλλο» με κείμενο ⇒ άρνηση (ποτέ «Ιδιοκτήτης» με παράπλευρο κείμενο)', () => {
    expect(step(run([PROPOSE]), contact('cont_x', 'owner', 'κάτι'), 1)).toEqual({ ok: false, refusal: 'terms-refused' });
  });

  it('ο σύνδεσμος δεν ορίζει υπεύθυνο — πράξη του γραφείου', () => {
    const link: IssuanceActor = { kind: 'link', invitationId: 'diin_1', verifiedBy: 'link', nowIso: at(1) };
    expect(step(run([PROPOSE]), contact('cont_owner'), 1, link)).toEqual({ ok: false, refusal: 'actor-refused' });
  });

  it('χωρίς ενεργή ανάθεση ή μετά την ακύρωση ⇒ `transition-refused`', () => {
    expect(step(null, contact('cont_owner'), 0)).toEqual({ ok: false, refusal: 'transition-refused' });
    expect(step(run([PROPOSE, CANCEL]), contact('cont_owner'), 2)).toEqual({ ok: false, refusal: 'transition-refused' });
  });

  it('φρένο ιστορικού: πάνω από το όριο ⇒ άρνηση', () => {
    const roles = ['owner', 'tenant'] as const;
    const many = Array.from({ length: INSPECTION_CONTACT_POLICY.maxEntries }, (_, i) => contact('cont_owner', roles[i % 2]));
    const full = run([PROPOSE, ...many]);
    expect(step(full, contact('cont_other'), 21)).toEqual({ ok: false, refusal: 'terms-refused' });
  });
});

describe('set-inspection-contact — ο κύκλος', () => {
  it('νέα πρόταση μετά από άρνηση: ο υπεύθυνος αυτοψίας μένει (γεγονός του ακινήτου)', () => {
    const record = run([PROPOSE, contact('cont_owner'), NOTIFY, DECLINE, REPROPOSE]);
    expect(record.professional).toEqual({ kind: 'contact', contactId: 'cont_pro_2' });
    expect(currentInspectionContactOf(record)?.contactId).toBe('cont_owner');
  });

  it('νέος κύκλος μετά από ακύρωση: ξεκινά χωρίς υπεύθυνο', () => {
    const record = run([PROPOSE, contact('cont_owner'), CANCEL, REPROPOSE]);
    expect(record.inspectionContacts).toEqual([]);
  });
});

describe('set-inspection-contact — το σώμα του αιτήματος', () => {
  const base = { action: 'set-inspection-contact', propertyId: 'p1', documentKind: 'energy-certificate', expectedStage: 'proposed' };

  it('κενό «Άλλο» ⇒ `null`, και μεταφράζεται στην πράξη του μειωτή', () => {
    const parsed = issuanceAssignmentBody.parse({ ...base, contactId: 'cont_owner', role: 'owner', roleOther: '' });
    expect(issuanceActionOf(parsed)).toEqual({ kind: 'set-inspection-contact', contactId: 'cont_owner', role: 'owner', roleOther: null });
  });

  it('άγνωστη ιδιότητα ⇒ το σχήμα αρνείται', () => {
    expect(issuanceAssignmentBody.safeParse({ ...base, contactId: 'c', role: 'landlord', roleOther: null }).success).toBe(false);
  });
});
