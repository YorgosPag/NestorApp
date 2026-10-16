/**
 * ADR-915 Φ5β — η αλυσίδα υπευθυνότητας και η κλιμάκωση: **ποιος** μαθαίνει **ποια** ακμή, **γιατί**, και ότι καμία
 * ακμή δεν «καταπίνεται» από υπεύθυνο που έφυγε (το ομολογημένο κενό του Ironclad).
 */

import {
  escalationEdges,
  isEscalationEligible,
  responsibilityOf,
  routeExpiryAlerts,
  type OfficeResponsibilityFacts,
} from '@/lib/document-validity/expiry-alert-routing';
import type { AlertLedger, ExpiryAlert } from '@/lib/document-validity/expiry-alert-stage';

const alert = (rowId: string, stage: ExpiryAlert['stage'], blocking = false, expiresOn: string | null = '2026-11-01'): ExpiryAlert =>
  ({ rowId, stage, expiresOn, blocking });

function office(overrides: Partial<OfficeResponsibilityFacts> = {}): OfficeResponsibilityFacts {
  return {
    activeUids: new Set(['u_resp', 'u_pm', 'u_doc', 'u_admin']),
    documentManagers: ['u_doc'],
    administrators: ['u_admin'],
    properties: {
      p_explicit: { explicitUid: 'u_resp', projectUids: ['u_pm'] },
      p_project: { explicitUid: null, projectUids: ['u_pm'] },
      p_bare: { explicitUid: null, projectUids: [] },
    },
    ...overrides,
  };
}

describe('responsibilityOf — η αλυσίδα, ο πρώτος ΕΝΕΡΓΟΣ κρίκος κερδίζει', () => {
  it.each([
    ['p_explicit', ['u_resp'], 'explicit'],
    ['p_project', ['u_pm'], 'project'],
    ['p_bare', ['u_doc'], 'document-manager'],
    ['p_unknown', ['u_doc'], 'document-manager'],
  ])('%s ⇒ %j (%s)', (propertyId, uids, source) => {
    expect(responsibilityOf(propertyId, office())).toEqual({ uids, source });
  });

  it('γραμμή χωρίς ακίνητο ⇒ κρίκοι γραφείου', () => {
    expect(responsibilityOf(null, office())?.source).toBe('document-manager');
  });

  it('κανένας υπεύθυνος εγγράφων ⇒ οι διαχειριστές (η συμπεριφορά της Φ5α)', () => {
    expect(responsibilityOf('p_bare', office({ documentManagers: [] }))).toEqual({ uids: ['u_admin'], source: 'administrator' });
  });

  it('🔴 υπεύθυνος που ΕΦΥΓΕ ⇒ πέφτει στον επόμενο κρίκο, ποτέ σιωπή', () => {
    const departed = office({ activeUids: new Set(['u_pm', 'u_doc', 'u_admin']) });
    expect(responsibilityOf('p_explicit', departed)).toEqual({ uids: ['u_pm'], source: 'project' });
  });

  it('🔴 «υπεύθυνος» που δεν είναι μέλος του χώρου (ξένος μισθωτής) ⇒ δεν μετρά', () => {
    const foreign = office({ properties: { p: { explicitUid: 'u_other_tenant', projectUids: [] } } });
    expect(responsibilityOf('p', foreign)?.source).toBe('document-manager');
  });

  it('κανένας ενεργός πουθενά ⇒ `null`', () => {
    expect(responsibilityOf('p_explicit', office({ activeUids: new Set() }))).toBeNull();
  });
});

describe('κλιμάκωση — μόνο ό,τι έληξε ή μπλοκάρει, μία φορά ανά λήξη', () => {
  it.each([
    [alert('a', 'expired'), true],
    [alert('a', 'd7', true), true],
    [alert('a', 'missing', true, null), true],
    [alert('a', 'missing', false, null), false],
    [alert('a', 'd30'), false],
    [alert('a', 'lead'), false],
    [alert('a', 'd0'), false],
  ])('%j ⇒ %s', (candidate, eligible) => {
    expect(isEscalationEligible(candidate)).toBe(eligible);
  });

  it('ήδη κλιμακωμένη με την ίδια λήξη ⇒ καμία ακμή· ανανέωση ⇒ ξανά', () => {
    const said: AlertLedger = { a: { stage: 'expired', expiresOn: '2026-11-01', escalated: true } };
    expect(escalationEdges([alert('a', 'expired')], said)).toEqual([]);
    expect(escalationEdges([alert('a', 'expired', false, '2026-12-01')], said)).toHaveLength(1);
  });

  it('ειπωμένη στον υπεύθυνο αλλά ΟΧΙ στη διοίκηση ⇒ ακμή κλιμάκωσης', () => {
    const said: AlertLedger = { a: { stage: 'expired', expiresOn: '2026-11-01', escalated: false } };
    expect(escalationEdges([alert('a', 'expired')], said)).toHaveLength(1);
  });
});

describe('routeExpiryAlerts — μία σύνοψη ανά άνθρωπο, ΜΟΝΟ με τις δικές του γραμμές', () => {
  const propertyOfRow = (rowId: string) => rowId.split('#')[0];

  it('κάθε υπεύθυνος παίρνει μόνο τη δική του γραμμή, με τον λόγο της', () => {
    const plan = routeExpiryAlerts({
      fresh: [alert('p_explicit#1', 'd30'), alert('p_project#1', 'd30')],
      escalations: [], office: office(), propertyOfRow,
    });
    expect(plan.digests.map((d) => [d.recipientUid, d.alerts.map((a) => a.rowId), d.reasons])).toEqual([
      ['u_pm', ['p_project#1'], { 'p_project#1': 'project' }],
      ['u_resp', ['p_explicit#1'], { 'p_explicit#1': 'explicit' }],
    ]);
    expect(plan.unroutable).toEqual([]);
  });

  it('ληγμένο ⇒ υπεύθυνος ΚΑΙ διοίκηση (κλιμάκωση), και μόνο οι κλιμακωμένες σημαδεύονται', () => {
    const expired = alert('p_explicit#1', 'expired');
    const plan = routeExpiryAlerts({ fresh: [expired], escalations: [expired], office: office(), propertyOfRow });
    expect(plan.digests.map((d) => [d.recipientUid, d.reasons[expired.rowId]])).toEqual([
      ['u_admin', 'escalation'],
      ['u_resp', 'explicit'],
    ]);
    expect(plan.escalated).toEqual(['p_explicit#1']);
  });

  it('διαχειριστής που είναι ήδη ο υπεύθυνος ⇒ ΜΙΑ γραμμή, όχι δύο', () => {
    const expired = alert('p_bare#1', 'expired');
    const plan = routeExpiryAlerts({
      fresh: [expired], escalations: [expired], office: office({ documentManagers: [] }), propertyOfRow,
    });
    expect(plan.digests).toHaveLength(1);
    expect(plan.digests[0]).toMatchObject({ recipientUid: 'u_admin', reasons: { 'p_bare#1': 'administrator' } });
  });

  it('κανένας διαχειριστής ⇒ η κλιμάκωση ΔΕΝ σημαδεύεται (αύριο ξαναδοκιμάζει)', () => {
    const expired = alert('p_explicit#1', 'expired');
    const plan = routeExpiryAlerts({
      fresh: [], escalations: [expired], office: office({ administrators: [] }), propertyOfRow,
    });
    expect(plan.digests).toEqual([]);
    expect(plan.escalated).toEqual([]);
  });

  it('🔴 ακμή που κανείς δεν μπορεί να μάθει ⇒ δηλώνεται `unroutable`, ποτέ σιωπηλή απώλεια', () => {
    const plan = routeExpiryAlerts({
      fresh: [alert('p_bare#1', 'd30')], escalations: [], office: office({ activeUids: new Set() }), propertyOfRow,
    });
    expect(plan.unroutable).toEqual(['p_bare#1']);
  });
});
