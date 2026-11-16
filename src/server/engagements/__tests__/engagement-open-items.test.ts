/**
 * ADR-915 §45.19 Φ6β — **«Οι εκκρεμότητές μου»**: κάθε συμμετοχή ρωτά τον οικοδεσπότη **του είδους της** · η κοντινότερη
 * ημερομηνία πρώτη · `null` του οικοδεσπότη ⇒ καμία γραμμή · ένας οικοδεσπότης που πετά ⇒ `unknown`, ποτέ μισή λίστα.
 * Και το ημερολόγιο: ολοήμερο, **μόνο ανάγνωση**, σύνδεσμος στη σελίδα της συμμετοχής.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { isCalendarEventEditable } from '@/services/calendar/calendar-event-editability';
import { engagementOpenItemToCalendarEvent } from '@/services/calendar/mappers';
import type { ConveyanceEngagement, Engagement, IssuanceEngagement } from '@/types/engagement';
import type { EngagementOpenItem } from '@/types/my-engagements';

import { engagementOpenItemsOf } from '../engagement-hosts';

const mockConveyanceOpenItem = jest.fn();
const mockIssuanceOpenItem = jest.fn();

jest.mock('@/services/conveyance/conveyance-engagement-host-adapter', () => ({
  CONVEYANCE_ENGAGEMENT_HOST: { openItem: (...args: unknown[]) => mockConveyanceOpenItem(...args) },
}));
jest.mock('@/services/document-registry/issuance-engagement-host-adapter', () => ({
  ISSUANCE_ENGAGEMENT_HOST: { openItem: (...args: unknown[]) => mockIssuanceOpenItem(...args) },
}));

const NOW = Date.parse('2026-11-16T09:00:00.000Z');
const DAY = 86_400_000;
const db = {} as Firestore;

function caseEngagement(id: string): ConveyanceEngagement {
  return {
    id, hostCompanyId: 'comp_host', projectId: 'proj_1', uid: 'u_pro', email: 'p@example.gr',
    template: 'legal', role: 'notary', subject: { kind: 'conveyance_case', caseId: `cvc_${id}` }, scopes: ['conveyance:case:view'],
    state: 'active', expiresAt: new Date(NOW + 30 * DAY).toISOString(),
    origin: { kind: 'professional_appointment', contactId: 'cont_1' }, consents: [],
    offeredBy: 'u_host', offeredAt: new Date(NOW - DAY).toISOString(), respondedAt: null,
    revokedBy: null, closedAt: null, updatedAt: new Date(NOW - DAY).toISOString(),
  };
}

function issuanceEngagement(id: string): IssuanceEngagement {
  return {
    ...caseEngagement(id),
    template: 'issuer', role: 'document_issuer', subject: { kind: 'document_issuance', assignmentId: `dia_${id}` },
    scopes: ['issuance:assignment:collaborate'],
  };
}

function item(engagement: Engagement, dueOn: string, overrides: Partial<EngagementOpenItem> = {}): EngagementOpenItem {
  const delivery = engagement.subject.kind === 'document_issuance';
  return {
    engagementId: engagement.id, kind: engagement.subject.kind, due: delivery ? 'delivery' : 'signing',
    dueOn, countdown: { tier: 'on-track', daysLeft: 10 }, hostName: 'Γραφείο Α', propertyName: 'Διαμέρισμα 3',
    ...overrides,
  };
}

beforeEach(() => {
  mockConveyanceOpenItem.mockReset();
  mockIssuanceOpenItem.mockReset();
});

describe('ADR-915 §45.19 — engagementOpenItemsOf', () => {
  it('κάθε είδος ρωτά τον ΔΙΚΟ του οικοδεσπότη· η κοντινότερη ημερομηνία πρώτη', async () => {
    const sign = caseEngagement('eng_sign');
    const deliver = issuanceEngagement('eng_deliver');
    mockConveyanceOpenItem.mockResolvedValue(item(sign, '2026-12-01'));
    mockIssuanceOpenItem.mockResolvedValue(item(deliver, '2026-11-20'));

    const items = await engagementOpenItemsOf(db, 'u_pro', [sign, deliver], NOW);

    // Μετάλλαξη: λάθος δρομολόγηση ⇒ ο οικοδεσπότης της μεταβίβασης παίρνει την ανάθεση.
    expect(mockConveyanceOpenItem).toHaveBeenCalledWith(db, 'u_pro', sign, NOW);
    expect(mockIssuanceOpenItem).toHaveBeenCalledWith(db, 'u_pro', deliver, NOW);
    // Μετάλλαξη: χωρίς ταξινόμηση / φθίνουσα ⇒ η υπογραφή πρώτη.
    expect(items).toEqual([item(deliver, '2026-11-20'), item(sign, '2026-12-01')]);
  });

  it('ίδια ημέρα ⇒ σταθερή σειρά (ταυτότητα), ώστε η οθόνη να μη «χορεύει»', async () => {
    const b = issuanceEngagement('eng_b');
    const a = issuanceEngagement('eng_a');
    mockIssuanceOpenItem.mockImplementation(async (_db: Firestore, _uid: string, e: Engagement) => item(e, '2026-11-20'));
    const items = await engagementOpenItemsOf(db, 'u_pro', [b, a], NOW);
    expect(items !== 'unknown' && items.map((i) => i.engagementId)).toEqual(['eng_a', 'eng_b']);
  });

  it('`null` του οικοδεσπότη (όχι ενεργή · χωρίς ημερομηνία · κλειστή) ⇒ καμία γραμμή', async () => {
    mockConveyanceOpenItem.mockResolvedValue(null);
    expect(await engagementOpenItemsOf(db, 'u_pro', [caseEngagement('eng_closed')], NOW)).toEqual([]);
  });

  it('ένας οικοδεσπότης πετά ⇒ `unknown` — ποτέ λίστα που κρύβει σιωπηλά εκκρεμότητα', async () => {
    mockConveyanceOpenItem.mockResolvedValue(item(caseEngagement('eng_ok'), '2026-11-20'));
    mockIssuanceOpenItem.mockRejectedValue(new Error('firestore down'));
    // Μετάλλαξη: `allSettled` + φίλτρο ⇒ επιστρέφει τη μία γραμμή ως «πλήρη».
    expect(await engagementOpenItemsOf(db, 'u_pro', [caseEngagement('eng_ok'), issuanceEngagement('eng_bad')], NOW)).toBe('unknown');
  });
});

describe('ADR-915 §45.19 — η εκκρεμότητα στο ημερολόγιο CRM', () => {
  it('ολοήμερο, πηγή `engagement`, μόνο ανάγνωση, σύνδεσμος στη σελίδα της συμμετοχής', () => {
    const event = engagementOpenItemToCalendarEvent(item(issuanceEngagement('eng_1'), '2026-11-20'));
    expect(event).toMatchObject({ allDay: true, source: 'engagement', eventType: 'document', entityId: 'eng_1', title: 'Διαμέρισμα 3 · Γραφείο Α' });
    expect(event?.href).toBe('/cases/eng_1');
    // Μετάλλαξη: η νέα πηγή προστίθεται στις επεξεργάσιμες ⇒ η μεταφορά θα έγραφε σε εργασία που δεν υπάρχει.
    expect(event && isCalendarEventEditable(event.source)).toBe(false);
  });

  it('υπογραφή ⇒ άλλο είδος γεγονότος· ταυτότητα ανά (συμμετοχή, είδος ημερομηνίας)', () => {
    const event = engagementOpenItemToCalendarEvent(item(caseEngagement('eng_2'), '2026-12-01'));
    expect(event).toMatchObject({ id: 'engagement:eng_2:signing', eventType: 'meeting' });
  });

  it('χωρίς ονόματα ⇒ τίτλος η ταυτότητα, ποτέ κενός', () => {
    const event = engagementOpenItemToCalendarEvent(item(caseEngagement('eng_3'), '2026-12-01', { hostName: null, propertyName: null }));
    expect(event?.title).toBe('eng_3');
  });
});
