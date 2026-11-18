/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §45.21 (3) — **η απάντηση στο αίτημα νέας ημερομηνίας αφήνει ίχνος στο ιστορικό**.
 *   Μετρήθηκε ζωντανά (16/11/2026): αποδοχή και απόρριψη γράφονταν ΙΔΙΑ («05/12/2026 → —»), χωρίς αιτιολογία.
 *   Οι εγγραφές χτίζονται με τον ΠΡΑΓΜΑΤΙΚΟ μειωτή· μόνο ο γραφέας του ιστορικού είναι ψεύτικος. Συνθετικά δεδομένα.
 */

import {
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
  type IssuanceStage,
} from '@/lib/document-validity/issuance-assignment';
import type { QuoteTerms } from '@/lib/document-validity/issuance-quote';
import { recordIssuanceAudit, type IssuanceTransition } from '@/services/document-registry/issuance-assignment-audit.server';
import type { IssuanceWrite } from '@/services/document-registry/issuance-assignments.server';
import { officeLedger } from '@/services/document-registry/issuance-ledger';

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
}));

const { EntityAuditService } = require('@/services/entity-audit.service') as { EntityAuditService: { recordChange: jest.Mock } };

const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false,
  validUntil: '2026-12-31', scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: null,
};
const SETUP: readonly IssuanceAction[] = [
  { kind: 'propose', professional: { kind: 'contact', contactId: 'cont_pro' }, credential: { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-1' } },
  { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null },
  { kind: 'quote', terms: TERMS },
  { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_lead', quoteRevision: 1, ownerAttestation: null },
];

const at = (day: number): string => `2026-11-${String(day).padStart(2, '0')}T09:00:00.000Z`;
const office = (day: number): IssuanceActor => ({ kind: 'office', uid: 'uid_agent', nowIso: at(day) });
const engagement = (day: number): IssuanceActor => ({ kind: 'engagement', engagementId: 'eng_1', uid: 'uid_pro', nowIso: at(day) });

function step(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor): IssuanceAssignmentRecord {
  const reduced = reduceIssuance('energy-certificate', record, null, action, actor);
  if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
  return reduced.record;
}

function pendingRequest(): IssuanceAssignmentRecord {
  const accepted = SETUP.reduce<IssuanceAssignmentRecord | null>((record, action, i) => step(record, action, office(i + 2)), null);
  if (accepted === null) throw new Error('no record');
  return step(accepted, { kind: 'request-delivery-change', dueOn: '2026-11-20', reason: 'Καθυστέρηση πρόσβασης' }, engagement(10));
}

const STAGE: IssuanceStage = 'accepted';

function write(action: IssuanceAction): IssuanceWrite {
  return {
    ledger: officeLedger('comp_alfa'),
    writer: { kind: 'office', uid: 'uid_agent', name: 'Γραφείο', expectedStage: STAGE },
    property: { id: 'prop_1', scope: 'property', name: 'ΔΟΚΙΜΗ' },
    documentKind: 'energy-certificate',
    latestIssuedOn: null,
    action,
    names: {},
    nowIso: at(11),
  };
}

async function changesOf(previous: IssuanceAssignmentRecord, action: IssuanceAction): Promise<unknown> {
  const next = step(previous, action, office(11));
  const transition: IssuanceTransition = { previous, next, previousStage: STAGE, nextStage: STAGE };
  EntityAuditService.recordChange.mockClear();
  await recordIssuanceAudit(write(action), transition);
  return EntityAuditService.recordChange.mock.calls[0]?.[0]?.changes;
}

describe('ADR-915 §45.21 — η απάντηση στο αίτημα νέας ημερομηνίας στο ιστορικό', () => {
  it('🔴 απόρριψη ⇒ «αίτημα: ημέρα → —» ΚΑΙ «απάντηση: — → declined» ΚΑΙ η αιτιολογία', async () => {
    const changes = await changesOf(pendingRequest(), { kind: 'decline-delivery-change', reason: 'Η προθεσμία δεσμεύει τον ιδιοκτήτη' });
    expect(changes).toEqual([
      { field: 'energyCertificateIssuanceDeliveryChangeRequest', oldValue: '2026-11-20', newValue: null },
      { field: 'energyCertificateIssuanceDeliveryChangeAnswer', oldValue: null, newValue: 'declined' },
      { field: 'energyCertificateIssuanceDeliveryChangeDeclineReason', oldValue: null, newValue: 'Η προθεσμία δεσμεύει τον ιδιοκτήτη' },
    ]);
  });

  it('αποδοχή (με ΑΛΛΗ ημέρα) ⇒ «απάντηση: — → accepted», χωρίς γραμμή αιτιολογίας απόρριψης', async () => {
    const changes = await changesOf(pendingRequest(), { kind: 'schedule-delivery', dueOn: '2026-11-18', reason: 'Συμφωνήθηκε' });
    expect(changes).toEqual(expect.arrayContaining([
      { field: 'energyCertificateIssuanceDeliveryChangeRequest', oldValue: '2026-11-20', newValue: null },
      { field: 'energyCertificateIssuanceDeliveryChangeAnswer', oldValue: null, newValue: 'accepted' },
    ]));
    expect(JSON.stringify(changes)).not.toContain('DeclineReason');
  });
});

describe('ADR-943 Φ4 — τα χρήματα της ανάθεσης στο ιστορικό (κλείνει και το κενό §42.6)', () => {
  const ADVANCED: QuoteTerms = { ...TERMS, advance: { amountMinor: 4_000, policy: 'moderate', inspectionValueMinor: 1_500 } };
  const DECIDE = SETUP[3];
  const SYSTEM = (day: number): IssuanceActor => ({ kind: 'system', source: 'payments', nowIso: at(day) });

  function quoted(): IssuanceAssignmentRecord {
    const actions = SETUP.slice(0, 3).map((action) => (action.kind === 'quote' ? { kind: 'quote' as const, terms: ADVANCED } : action));
    const record = actions.reduce<IssuanceAssignmentRecord | null>((current, action, i) => step(current, action, office(i + 2)), null);
    if (record === null) throw new Error('no record');
    return record;
  }

  async function transitionChanges(previous: IssuanceAssignmentRecord, next: IssuanceAssignmentRecord): Promise<unknown> {
    EntityAuditService.recordChange.mockClear();
    await recordIssuanceAudit(write(DECIDE), { previous, next, previousStage: 'quoted', nextStage: 'accepted' });
    return EntityAuditService.recordChange.mock.calls[0]?.[0]?.changes;
  }

  it('η έγκριση γράφει σύνολο, προκαταβολή (ευρώ, ουδέτερα ως προς γλώσσα) και «αναμένεται πληρωμή»', async () => {
    const before = quoted();
    const changes = await transitionChanges(before, step(before, DECIDE, office(6)));
    expect(changes).toEqual(expect.arrayContaining([
      { field: 'energyCertificateIssuanceQuoteTotal', oldValue: null, newValue: '124.00' },
      { field: 'energyCertificateIssuanceAdvanceAmount', oldValue: null, newValue: '40.00' },
      { field: 'energyCertificateIssuanceAdvanceState', oldValue: null, newValue: 'awaiting-payment' },
    ]));
  });

  it('η πληρωμή γράφει «σε κράτηση» και το ρητό αίτημα έναρξης (Κ-6)· ποτέ ξανά τα αμετάβλητα ποσά', async () => {
    const approved = step(quoted(), DECIDE, office(6));
    const funded = step(approved, { kind: 'advance-funded', amountMinor: 4_000, paymentReference: 'pmt_1', withdrawalWaiverAt: at(7) }, SYSTEM(7));
    const changes = await transitionChanges(approved, funded);
    expect(changes).toEqual(expect.arrayContaining([
      { field: 'energyCertificateIssuanceAdvanceState', oldValue: 'awaiting-payment', newValue: 'held' },
      { field: 'energyCertificateIssuanceWithdrawalWaiver', oldValue: null, newValue: at(7) },
    ]));
    expect(JSON.stringify(changes)).not.toContain('QuoteTotal');
  });
});
