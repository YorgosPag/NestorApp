/**
 * ADR-915 Φ5α — τα στάδια των ειδοποιήσεων του μητρώου, οι ακμές και το ημερολόγιο.
 *
 * 🔑 Οι γραμμές βγαίνουν από τον **αληθινό** πυρήνα (`documentRegistry`): η λήξη ορίζεται με την τυπωμένη ημερομηνία
 *    (`printedValidUntil`, χωρίς έκδοση ⇒ η λήξη είναι ακριβώς αυτή), ώστε κάθε όριο να είναι μία ημέρα.
 */

import { documentRegistry, type RegistryDocument, type RegistryRow } from '@/lib/document-validity/document-registry';
import type { DocumentRequirement } from '@/lib/document-validity/document-requirement';
import {
  advancedExpiryAlerts,
  alertLedgersEqual,
  currentExpiryAlerts,
  EXPIRY_ALERT_STAGES,
  expiryAlertLandingView,
  expiryAlertStageOf,
  expiryAlertsDigest,
  nextAlertLedger,
  type AlertLedger,
} from '@/lib/document-validity/expiry-alert-stage';

const AS_OF = '2026-10-15';
const READ = { kind: 'document-text', reader: 'pea-text' } as const;

function doc(id: string, until: string | null, extra: Partial<RegistryDocument> = {}): RegistryDocument {
  return {
    id, kind: 'energy-certificate', propertyId: `p-${id}`, origin: { kind: 'file', fileId: id },
    issuedOn: null, printedValidUntil: until, source: READ, pinned: false, ...extra,
  };
}

function rowsOf(documents: readonly RegistryDocument[], requirements: readonly DocumentRequirement[] = []): readonly RegistryRow[] {
  return documentRegistry({ documents, requirements, asOf: AS_OF }).rows;
}

const stageOf = (until: string | null) => expiryAlertStageOf(rowsOf([doc('f', until)])[0], AS_OF);

const GAP_BLOCK: DocumentRequirement = {
  documentKind: 'energy-certificate', subject: { propertyId: 'p-gap' }, process: { kind: 'conveyance', caseId: 'case-1' },
  neededOn: { kind: 'unscheduled' }, policy: 'block', warnWindowDays: 15,
  basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null }, presence: 'required', attestation: null,
};

describe('expiryAlertStageOf — τα σκαλιά (η τελευταία μέρα είναι μέσα)', () => {
  it.each([
    ['2026-10-14', 'expired'],
    ['2026-10-15', 'd0'],
    ['2026-10-16', 'd7'],
    ['2026-10-22', 'd7'],
    ['2026-10-23', 'd30'],
    ['2026-11-14', 'd30'],
    ['2026-11-15', 'lead'],
    ['2026-12-14', 'lead'],
  ])('λήξη %s ⇒ %s', (until, stage) => {
    expect(stageOf(until)).toBe(stage);
  });

  it('έξω από τις 60 ημέρες ανανέωσης του ΠΕΑ ⇒ τίποτα να ειπωθεί', () => {
    expect(stageOf('2026-12-15')).toBeNull();
  });

  it('άγνωστη λήξη ⇒ καμία ειδοποίηση (φαίνεται στη σελίδα, δεν έχει ακμή)', () => {
    expect(stageOf(null)).toBeNull();
  });

  it('αντικατεστημένη γραμμή ⇒ σιωπή, ακόμη κι αν έχει λήξει (την κουβαλά η τρέχουσα)', () => {
    const rows = rowsOf([
      doc('old', '2020-01-01', { propertyId: 'p1', issuedOn: '2010-01-01' }),
      doc('new', '2034-01-01', { propertyId: 'p1', issuedOn: '2024-01-01' }),
    ]);
    const old = rows.find((row) => row.kind === 'document' && row.document.id === 'old');
    expect(old?.state).toBe('superseded');
    expect(old && expiryAlertStageOf(old, AS_OF)).toBeNull();
  });

  it('κενό ⇒ `missing`', () => {
    const gap = rowsOf([], [GAP_BLOCK]).find((row) => row.kind === 'gap');
    expect(gap && expiryAlertStageOf(gap, AS_OF)).toBe('missing');
  });

  it('η σειρά των σταδίων ΕΙΝΑΙ η κατάταξη — `missing` το πιο επείγον, `lead` το λιγότερο', () => {
    expect(EXPIRY_ALERT_STAGES).toEqual(['lead', 'd30', 'd7', 'd0', 'expired', 'missing']);
  });
});

describe('advancedExpiryAlerts — ακμή, όχι στάθμη', () => {
  const current = () => currentExpiryAlerts(rowsOf([doc('a', '2026-10-20'), doc('b', '2026-11-01')]), AS_OF);

  it('πρώτη φορά ⇒ όλα είναι νέα', () => {
    expect(advancedExpiryAlerts(current(), {}).map((a) => a.rowId)).toEqual(['a', 'b']);
  });

  it('ίδιο στάδιο, ίδια λήξη ⇒ σιωπή', () => {
    const ledger = nextAlertLedger(current(), {}, true);
    expect(advancedExpiryAlerts(current(), ledger)).toEqual([]);
  });

  it('πιο επείγον στάδιο ⇒ ακμή ΜΟΝΟ γι\' αυτή τη γραμμή', () => {
    const ledger: AlertLedger = { a: { stage: 'd30', expiresOn: '2026-10-20' }, b: { stage: 'd30', expiresOn: '2026-11-01' } };
    expect(advancedExpiryAlerts(current(), ledger).map((a) => `${a.rowId}:${a.stage}`)).toEqual(['a:d7']);
  });

  it('ανανέωση (άλλη λήξη) ⇒ ξαναρχίζει, ακόμη κι αν το στάδιο είναι «χαμηλότερο»', () => {
    const ledger: AlertLedger = { a: { stage: 'expired', expiresOn: '2026-01-01' }, b: { stage: 'd30', expiresOn: '2026-11-01' } };
    expect(advancedExpiryAlerts(current(), ledger).map((a) => a.rowId)).toEqual(['a']);
  });

  it('ποτέ προς τα πίσω: ειπωμένο πιο επείγον στάδιο με ίδια λήξη ⇒ σιωπή', () => {
    const ledger: AlertLedger = { a: { stage: 'd0', expiresOn: '2026-10-20' }, b: { stage: 'd30', expiresOn: '2026-11-01' } };
    expect(advancedExpiryAlerts(current(), ledger)).toEqual([]);
  });
});

describe('nextAlertLedger — ό,τι ειπώθηκε, και τίποτα που δεν διαβάστηκε', () => {
  const current = () => currentExpiryAlerts(rowsOf([doc('a', '2026-10-20')]), AS_OF);
  const stale: AlertLedger = { gone: { stage: 'd30', expiresOn: '2026-11-01' } };

  it('πλήρες μητρώο ⇒ ακριβώς το σήμερα (γραμμή που έφυγε ξεχνιέται)', () => {
    expect(Object.keys(nextAlertLedger(current(), stale, true))).toEqual(['a']);
  });

  it('κομμένο μητρώο ⇒ συγχώνευση (γραμμή που δεν διαβάστηκε ΔΕΝ ξεχνιέται — αλλιώς αύριο ξαναστέλνεται)', () => {
    expect(Object.keys(nextAlertLedger(current(), stale, false)).sort()).toEqual(['a', 'gone']);
  });

  it('alertLedgersEqual — ίδιο ⇔ ίδιες γραμμές, στάδια και λήξεις', () => {
    const ledger = nextAlertLedger(current(), {}, true);
    expect(alertLedgersEqual(ledger, nextAlertLedger(current(), {}, true))).toBe(true);
    expect(alertLedgersEqual(ledger, { a: { stage: 'd30', expiresOn: '2026-10-20' } })).toBe(false);
    expect(alertLedgersEqual(ledger, {})).toBe(false);
  });
});

describe('expiryAlertsDigest — ντετερμινιστικό', () => {
  it('ίδιες ακμές ⇒ ίδιο αποτύπωμα· άλλο στάδιο ⇒ άλλο', () => {
    const alerts = currentExpiryAlerts(rowsOf([doc('a', '2026-10-20')]), AS_OF);
    expect(expiryAlertsDigest(alerts)).toBe(expiryAlertsDigest([...alerts]));
    expect(expiryAlertsDigest(alerts)).not.toBe(expiryAlertsDigest([{ ...alerts[0], stage: 'd0' }]));
  });
});

describe('expiryAlertLandingView — η στενότερη προβολή που χωρά ΚΑΘΕ γραμμή', () => {
  it('μόνο ΠΕΑ σε ώρα ανανέωσης ⇒ «Ώρα ανανέωσης»', () => {
    expect(expiryAlertLandingView(rowsOf([doc('a', '2026-10-20')]), AS_OF)).toBe('renewal-due');
  });

  it('μόνο κενό που μπλοκάρει ⇒ «Μπλοκάρουν»', () => {
    expect(expiryAlertLandingView(rowsOf([], [GAP_BLOCK]), AS_OF)).toBe('blocking');
  });

  it('μείγμα που καμία στενή προβολή δεν χωρά ⇒ «Όλα» (ποτέ προβολή που κρύβει γραμμή της ειδοποίησης)', () => {
    expect(expiryAlertLandingView(rowsOf([doc('a', '2026-10-20')], [GAP_BLOCK]), AS_OF)).toBe('all');
  });
});
