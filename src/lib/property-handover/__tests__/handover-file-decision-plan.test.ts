/**
 * ADR-916 §7 Ζ23–Ζ29 — η απόφαση του γραφείου ανά αρχείο: η κρίση κατάταξης τη σέβεται **πρώτη** μετά το Πρωτόκολλο, και
 * κουμπί + πόρτα βγαίνουν από **μία** συνάρτηση.
 */

import {
  automaticHandoverDispositionOf,
  handoverCandidateFromDocument,
  handoverDispositionBasisOf,
  handoverDispositionOf,
  isHandoverDeliverableDocument,
  type HandoverCandidateFile,
} from '../handover-disposition';
import { handoverFileDecisionOf, handoverFileDecisionOfferOf } from '../handover-file-decision-plan';
import { readFileHandoverDecision } from '../file-handover-decision';
import {
  HANDOVER_FILE_SCENARIOS,
  scenarioPreviewFileOf,
} from '@/components/property-handover-office/testing/handover-file-decision-scenarios';
import { HANDOVER_FILE_DECISION_CHOICES } from '@/types/property-handover-file-decision';

const DECIDED_AT = '2026-10-23T09:00:00.000Z';
const decision = (disposition: 'deliver' | 'internal') => ({ disposition, reason: 'Ελέγχθηκε από τον νομικό', decidedBy: 'u1', decidedAt: DECIDED_AT });

function file(overrides: Partial<HandoverCandidateFile> = {}): HandoverCandidateFile {
  return { entityType: 'property', purpose: 'document', domain: 'sales', category: 'documents', status: 'ready', lifecycleState: 'active', isDeleted: false, ...overrides };
}

describe('Ζ23 — η απόφαση γραφείου νικά κάθε κανόνα ΚΑΤΑΤΑΞΗΣ, όχι το Πρωτόκολλο ούτε την επιλεξιμότητα', () => {
  it.each([
    ['εμπιστευτικό', { classification: 'confidential' as const }],
    ['τομέας γραφείου', { domain: 'accounting' as const }],
    ['κατηγορία `documents`', {}],
    ['κατηγορία `invoices`', { category: 'invoices' as const }],
  ])('%s + «Παραδίδεται» ⇒ deliver (basis office-decision)', (_label, patch) => {
    expect(handoverDispositionBasisOf(file({ ...patch, handoverDecision: decision('deliver') }))).toEqual({ disposition: 'deliver', basis: 'office-decision' });
  });

  it('«Μένει εσωτερικό» σε σχέδιο (κατηγορία deliver) ⇒ internal', () => {
    expect(handoverDispositionOf(file({ category: 'floorplans', handoverDecision: decision('internal') }))).toBe('internal');
  });

  it('το Πρωτόκολλο μένει internal ΑΚΟΜΗ και με απόφαση «Παραδίδεται» (βρόχος αναθεωρήσεων)', () => {
    const protocol = { protocolId: 'phpr_1', handoverId: 'phov_1', revision: 1 };
    expect(handoverDispositionBasisOf(file({ handoverProtocolOf: protocol, handoverDecision: decision('deliver') }))).toEqual({ disposition: 'internal', basis: 'protocol' });
  });

  it('κάδος + «Παραδίδεται» ⇒ ΜΗ παραδοτέο (η επιλεξιμότητα κρίνεται πριν)', () => {
    expect(isHandoverDeliverableDocument({ ...file({ handoverDecision: decision('deliver') }), isDeleted: true })).toBe(false);
    expect(isHandoverDeliverableDocument({ ...file({ handoverDecision: decision('deliver') }) })).toBe(true);
  });

  it('«Αυτόματα» = η κρίση ΧΩΡΙΣ την απόφαση', () => {
    expect(automaticHandoverDispositionOf(file({ handoverDecision: decision('deliver') }))).toBe('review');
    expect(handoverDispositionBasisOf(file({ category: 'photos' }))).toEqual({ disposition: 'deliver', basis: 'category' });
  });
});

describe('Ζ24 — άγνωστη απόφαση στο έγγραφο ⇒ αδιάβαστο ⇒ «θέλουν απόφαση» (ποτέ σιωπηλά πουθενά)', () => {
  it.each([
    ['άγνωστη διάθεση', { ...decision('deliver'), disposition: 'review' }],
    ['χωρίς αιτιολογία', { ...decision('deliver'), reason: '' }],
    ['χωρίς δρώντα', { ...decision('deliver'), decidedBy: undefined }],
    ['όχι αντικείμενο', 'deliver'],
  ])('%s ⇒ null', (_label, raw) => {
    expect(readFileHandoverDecision(raw)).toBeNull();
    expect(handoverCandidateFromDocument({ ...file(), handoverDecision: raw })).toBeNull();
  });

  it('απούσα (`null` στο Firestore) ⇒ καμία απόφαση, κανονική κρίση', () => {
    expect(handoverCandidateFromDocument({ ...file(), handoverDecision: null })?.handoverDecision).toBeUndefined();
  });
});

describe('Ζ25–Ζ27 — η κρίση της πόρτας', () => {
  const state = (candidate: HandoverCandidateFile, delivered = false) => ({ candidate, delivered });
  const ask = { choice: 'deliver' as const, expected: null, confirmConfidential: false };

  it('Ζ25 — εμπιστευτικό: «Παραδίδεται» χωρίς επιβεβαίωση ⇒ άρνηση · με ⇒ apply · «Μένει εσωτερικό» δεν τη ζητά', () => {
    const confidential = file({ classification: 'confidential' });
    expect(handoverFileDecisionOf(state(confidential), ask)).toEqual({ kind: 'refused', reason: 'confidential-unconfirmed' });
    expect(handoverFileDecisionOf(state(confidential), { ...ask, confirmConfidential: true })).toEqual({ kind: 'apply', next: 'deliver' });
    expect(handoverFileDecisionOf(state(confidential), { ...ask, choice: 'internal' })).toEqual({ kind: 'apply', next: 'internal' });
  });

  it('Ζ26 — παραδομένο: μόνο ό,τι καταλήγει σε deliver · «Αυτόματα» που καταλήγει review ⇒ άρνηση', () => {
    expect(handoverFileDecisionOf(state(file({ category: 'photos' }), true), { ...ask, choice: 'internal' })).toEqual({ kind: 'refused', reason: 'already-delivered' });
    const pinned = file({ handoverDecision: decision('deliver') });
    expect(handoverFileDecisionOf(state(pinned, true), { ...ask, choice: 'automatic', expected: 'deliver' })).toEqual({ kind: 'refused', reason: 'already-delivered' });
    expect(handoverFileDecisionOfferOf(state(pinned, true))).toEqual({ kind: 'blocked', reason: 'already-delivered' });
    const photo = file({ category: 'photos', handoverDecision: decision('deliver') });
    expect(handoverFileDecisionOf(state(photo, true), { ...ask, choice: 'automatic', expected: 'deliver' })).toEqual({ kind: 'apply', next: null });
  });

  it('Ζ27 — `stale`: άλλη αναμενόμενη απόφαση ⇒ άρνηση· ιδεμπότητα ΠΡΙΝ το stale', () => {
    const internal = file({ handoverDecision: decision('internal') });
    expect(handoverFileDecisionOf(state(internal), { ...ask, expected: null })).toEqual({ kind: 'refused', reason: 'stale' });
    expect(handoverFileDecisionOf(state(internal), { ...ask, choice: 'internal', expected: null })).toEqual({ kind: 'unchanged' });
    expect(handoverFileDecisionOf(state(file()), { ...ask, choice: 'automatic' })).toEqual({ kind: 'unchanged' });
  });

  it('Πρωτόκολλο · αδιάβαστο · ανεπίλεκτο ⇒ ονομασμένες αρνήσεις', () => {
    const protocol = file({ handoverProtocolOf: { protocolId: 'p', handoverId: 'h', revision: 1 } });
    expect(handoverFileDecisionOf(state(protocol), ask)).toEqual({ kind: 'refused', reason: 'protocol-file' });
    expect(handoverFileDecisionOf({ candidate: null, delivered: false }, ask)).toEqual({ kind: 'refused', reason: 'unrecognised' });
    expect(handoverFileDecisionOf(state(file({ isDeleted: true })), ask)).toEqual({ kind: 'refused', reason: 'file-unknown' });
  });
});

describe('Ζ29 — κουμπί ΚΑΙ πόρτα από ΜΙΑ κρίση, σε ΚΑΘΕ σενάριο της γκαλερί', () => {
  it.each(HANDOVER_FILE_SCENARIOS.map((scenario) => [scenario.id, scenario] as const))('%s', (_id, scenario) => {
    const row = scenarioPreviewFileOf(scenario);
    const expected = row.decision?.disposition ?? null;
    for (const choice of HANDOVER_FILE_DECISION_CHOICES) {
      const verdict = handoverFileDecisionOf(scenario, { choice, expected, confirmConfidential: true });
      const offered = row.offer.kind === 'open' && row.offer.choices.includes(choice);
      // Προσφέρεται ⇔ η πόρτα το ΕΦΑΡΜΟΖΕΙ· ό,τι δεν προσφέρεται η πόρτα το αρνείται ή το βρίσκει ήδη να ισχύει.
      expect(verdict.kind === 'apply').toBe(offered);
    }
  });

  it('ο πίνακας καλύπτει κάθε μορφή της προσφοράς και κάθε λόγο κατάταξης', () => {
    const rows = HANDOVER_FILE_SCENARIOS.map(scenarioPreviewFileOf);
    expect(new Set(rows.map((row) => row.basis))).toEqual(new Set(['category', 'confidential', 'office-domain', 'office-decision', 'protocol', 'unrecognised']));
    const blocked = rows.flatMap((row) => (row.offer.kind === 'blocked' ? [row.offer.reason] : []));
    expect(new Set(blocked)).toEqual(new Set(['already-delivered', 'protocol-file', 'unrecognised']));
    expect(rows.some((row) => row.offer.kind === 'open' && row.offer.deliverNeedsConfirmation)).toBe(true);
  });
});
