/**
 * ADR-915 §45 Φ4 — **η ανάθεση ως εκκρεμότητα**: παράγεται ΜΟΝΟ όσο η μπάλα δεν είναι `null` · προθεσμία ΜΟΝΟ μετά την
 * ανάθεση · μία ανά ανάθεση · ημερομηνία πρώτα · στο ημερολόγιο ΜΟΝΟ με προθεσμία, ΜΟΝΟ για ανάγνωση, με σύνδεσμο στη γραμμή.
 */

import {
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import type { IssuanceRosterEntry } from '@/lib/document-validity/issuance-candidates';
import { issuanceOpenItemsOf } from '@/lib/document-validity/issuance-open-item';
import { isCalendarEventEditable } from '@/services/calendar/calendar-event-editability';
import { issuanceOpenItemToCalendarEvent } from '@/services/calendar/mappers';

import { FIXTURE_AS_OF, fixtureResponse } from './registry-fixture';

const ACTOR: IssuanceActor = { kind: 'office', uid: 'uid_agent', nowIso: '2026-10-10T09:00:00.000Z' };
const PROPOSE: IssuanceAction = {
  kind: 'propose', professional: { kind: 'contact', contactId: 'cont_client' }, credential: { qualification: 'energy-inspector-registered', registryNumber: null },
};
const QUOTED: readonly IssuanceAction[] = [
  PROPOSE,
  { kind: 'notify', channel: 'phone', invitationId: null, note: null, verification: null },
  {
    kind: 'quote',
    terms: { basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31', scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: null },
  },
];
const APPROVE: IssuanceAction = { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_alpha', quoteRevision: 1, ownerAttestation: null };

function recordOf(actions: readonly IssuanceAction[]): IssuanceAssignmentRecord {
  return actions.reduce<IssuanceAssignmentRecord | null>((record, action) => {
    const reduced = reduceIssuance('energy-certificate', record, null, action, ACTOR);
    if (!reduced.ok) throw new Error(reduced.refusal);
    return reduced.record;
  }, null) as IssuanceAssignmentRecord;
}

function itemsWith(roster: readonly IssuanceRosterEntry[]) {
  const registry = fixtureResponse({}, undefined, undefined, roster);
  return issuanceOpenItemsOf({
    rows: registry.rows, issuance: registry.issuance, asOf: registry.asOf,
    propertyNameOf: (id) => registry.properties[id]?.name ?? null,
    contactNameOf: (id) => registry.people[id]?.name ?? null,
  });
}

describe('ADR-915 §45 Φ4 — issuanceOpenItemsOf', () => {
  it('καμία ανάθεση ⇒ καμία εκκρεμότητα (ποτέ γραμμή «χωρίς ανάθεση» ως εργασία)', () => {
    expect(itemsWith([])).toEqual([]);
  });

  it('πρόταση ⇒ ΜΙΑ εκκρεμότητα, μπάλα στο γραφείο, ΧΩΡΙΣ προθεσμία (πριν την έγκριση δεν υπάρχει δέσμευση)', () => {
    const items = itemsWith([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE]) }]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'issuance:p6:energy-certificate', key: 'p6:energy-certificate', propertyId: 'p6', documentKind: 'energy-certificate',
      professionalName: 'Συνθετική Πελάτισσα', stage: 'proposed', dueOn: null, lateness: { tier: 'no-due-date' },
    });
  });

  it('ανάθεση με προθεσμία ⇒ `dueOn` + βαθμίδα από το ΙΔΙΟ ρολόι (`asOf`)', () => {
    const accepted = recordOf([...QUOTED, APPROVE, { kind: 'schedule-delivery', dueOn: '2026-10-12', reason: 'Συμφωνήθηκε νωρίτερα' }]);
    const [item] = itemsWith([{ propertyId: 'p6', documentKind: 'energy-certificate', record: accepted }]);
    // Ρολόι του fixture: 2026-10-15 ⇒ 3 ημέρες καθυστέρηση.
    expect(FIXTURE_AS_OF).toBe('2026-10-15');
    expect(item).toMatchObject({ stage: 'accepted', dueOn: '2026-10-12', lateness: { tier: 'overdue', days: 3 } });
  });

  it('ακυρωμένη ανάθεση ⇒ ΚΑΜΙΑ εκκρεμότητα («κλείνει» μόνη της — απλώς παύει να παράγεται)', () => {
    expect(itemsWith([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE, { kind: 'cancel', reason: 'cancelled' }]) }])).toEqual([]);
  });
});

describe('ADR-915 §45 Φ4 — το ημερολόγιο (ADR-089)', () => {
  const base = itemsWith([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE]) }])[0];

  it('χωρίς προθεσμία ⇒ ΟΧΙ στο ημερολόγιο (Procore: μόνο στη λίστα)', () => {
    expect(issuanceOpenItemToCalendarEvent(base, null)).toBeNull();
  });

  it('με προθεσμία ⇒ ολοήμερο, πηγή «μητρώο», σύνδεσμος που ανοίγει το πάνελ της γραμμής', () => {
    const event = issuanceOpenItemToCalendarEvent({ ...base, dueOn: '2026-12-13' }, null);
    expect(event).toMatchObject({ id: base.id, allDay: true, source: 'document-issuance', eventType: 'document', entityId: base.key });
    expect(event?.href).toContain(`doc=${encodeURIComponent(base.key)}`);
  });

  it('🔴 μόνο οι εργασίες του CRM μετακινούνται· ραντεβού και μητρώο ΜΟΝΟ για ανάγνωση', () => {
    expect(isCalendarEventEditable('task')).toBe(true);
    expect(isCalendarEventEditable('appointment')).toBe(false);
    expect(isCalendarEventEditable('document-issuance')).toBe(false);
  });
});
