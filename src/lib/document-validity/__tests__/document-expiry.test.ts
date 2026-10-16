/**
 * ADR-915 Φ1 — ο ΕΝΑΣ υπολογισμός λήξης, και η ισοτιμία των καταναλωτών του.
 *
 * 🔴 Η άγκυρα που λείπει από πριν: αγγελία (`certificateValidUntil`) και μεταβίβαση (`deriveChecklist`) ρωτούσαν την ίδια
 * ερώτηση με άλλη μονάδα (120 μήνες vs 3650 ημέρες) και απαντούσαν **τρεις μέρες** διαφορετικά. Εδώ τρέχουν **και οι δύο**
 * πάνω στην ίδια είσοδο — μια μελλοντική δεύτερη αλήθεια κοκκινίζει αυτό το αρχείο.
 */

import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import { DOCUMENT_KINDS, documentKindSpec } from '@/config/document-validity/document-validity';
import { deriveChecklist } from '@/lib/conveyance/derive-checklist';
import { testFacts, testRows } from '@/lib/conveyance/__fixtures__/case-rows-fixture';
import { certificateValidUntil } from '@/lib/energy-certificate/energy-certificate';
import { legalityKindSpec } from '@/lib/legality/legality-claim';
import { documentExpiry, ruleExpires, ruleExpiresOn } from '../document-expiry';

const PEA = documentKindSpec('energy-certificate').rule;

/** Η ημέρα λήξης που βλέπει ο κατάλογος μεταβίβασης για ένα αποδεκτό ΠΕΑ με αυτή την έκδοση. */
function conveyanceExpiresOn(issuedOn: string): string | null {
  const item = getChecklistItem('energy_certificate');
  if (!item) throw new Error('energy_certificate missing from catalog');
  const review = { verdict: 'accepted' as const, fileId: null, fileFingerprint: null, issuedOn, printedValidUntil: null, reason: null, reviewedBy: 'u', reviewedAt: 't' };
  const { rows } = deriveChecklist({
    rows: testRows([item]), facts: testFacts({}), overrides: { energy_certificate: { review } }, evidence: [], sealed: [],
    today: '2026-10-14', targetSigningDate: null, viewer: 'host',
  });
  return rows[0].expiresOn;
}

describe('ruleExpiresOn — μήνες ημερολογίου, η τελευταία μέρα μέσα', () => {
  it.each([
    ['2026-07-16', '2036-07-16'],
    ['2016-01-31', '2026-01-31'],
    ['2024-02-29', '2034-02-28'], // δίσεκτη ⇒ ψαλίδισμα, ποτέ 1η Μαρτίου
  ])('ΠΕΑ %s ⇒ %s', (issuedOn, expected) => {
    expect(ruleExpiresOn(PEA, issuedOn)).toBe(expected);
  });

  it('ημέρες: πραγματική αριθμητική ημερών', () => {
    expect(ruleExpiresOn({ kind: 'days', days: 30 }, '2026-01-31')).toBe('2026-03-02');
  });

  it.each([
    [{ kind: 'none' as const }],
    [{ kind: 'act_day' as const }],
    [{ kind: 'unverified' as const }],
  ])('%o ⇒ καμία ημερομηνία (null = «δεν ξέρουμε», ποτέ «ισχύει»)', (rule) => {
    expect(ruleExpiresOn(rule, '2026-01-01')).toBeNull();
  });

  it('αδιάβαστη έκδοση ⇒ null', () => {
    expect(ruleExpiresOn(PEA, null)).toBeNull();
    expect(ruleExpiresOn(PEA, '2026-02-30')).toBeNull();
    expect(ruleExpiresOn(PEA, '16/07/2026')).toBeNull();
  });
});

describe('🔴 ΙΣΟΤΙΜΙΑ — αγγελία και μεταβίβαση λένε την ΙΔΙΑ μέρα', () => {
  it.each(['2026-07-16', '2016-10-06', '2024-02-29', '2016-01-31', '2019-12-31'])('έκδοση %s', (issuedOn) => {
    const listing = certificateValidUntil(issuedOn);
    expect(listing).not.toBeNull();
    expect(conveyanceExpiresOn(issuedOn)).toBe(listing);
  });
});

describe('documentExpiry — τυπωμένη λήξη vs κανόνας (Α4)', () => {
  it('μόνο κανόνας', () => {
    expect(documentExpiry({ rule: PEA, issuedOn: '2026-03-01' })).toEqual({ expiresOn: '2036-03-01', source: 'rule', discrepancy: null });
  });

  it('μόνο τυπωμένη (άγνωστη έκδοση)', () => {
    expect(documentExpiry({ rule: PEA, issuedOn: null, printedValidUntil: '2036-03-01' }))
      .toEqual({ expiresOn: '2036-03-01', source: 'printed', discrepancy: null });
  });

  it('συμφωνούν ⇒ καμία ασυμφωνία', () => {
    expect(documentExpiry({ rule: PEA, issuedOn: '2026-03-01', printedValidUntil: '2036-03-01' }).discrepancy).toBeNull();
  });

  it('διαφορά μίας μέρας ⇒ ανοχή, νικά η νωρίτερη', () => {
    expect(documentExpiry({ rule: PEA, issuedOn: '2026-03-01', printedValidUntil: '2036-02-29' }))
      .toEqual({ expiresOn: '2036-02-29', source: 'printed', discrepancy: null });
  });

  it('το έγγραφο λέει νωρίτερα ⇒ νικά το έγγραφο ΚΑΙ το λέμε', () => {
    expect(documentExpiry({ rule: PEA, issuedOn: '2026-03-01', printedValidUntil: '2031-03-01' })).toEqual({
      expiresOn: '2031-03-01', source: 'printed', discrepancy: { rule: '2036-03-01', printed: '2031-03-01' },
    });
  });

  it('ο κανόνας λέει νωρίτερα ⇒ νικά ο κανόνας ΚΑΙ το λέμε (ποτέ «ισχύει» όταν μία πηγή λέει «έληξε»)', () => {
    expect(documentExpiry({ rule: PEA, issuedOn: '2026-03-01', printedValidUntil: '2040-03-01' })).toEqual({
      expiresOn: '2036-03-01', source: 'rule', discrepancy: { rule: '2036-03-01', printed: '2040-03-01' },
    });
  });

  it('έγγραφο που δεν λήγει ⇒ καμία λήξη, ό,τι κι αν γράφει', () => {
    expect(documentExpiry({ rule: { kind: 'none' }, issuedOn: '2026-03-01', printedValidUntil: '2030-01-01' }).expiresOn).toBeNull();
  });
});

describe('ΕΝΑΣ κανόνας — οι καταναλωτές ΠΑΙΡΝΟΥΝ, δεν ξαναγράφουν', () => {
  it('η γραμμή ΠΕΑ του καταλόγου μεταβίβασης ΕΙΝΑΙ ο κανόνας του καταλόγου ισχύος', () => {
    expect(getChecklistItem('energy_certificate')?.validity).toBe(PEA);
    expect(getChecklistItem('building_identity')?.validity).toBe(documentKindSpec('building-identity').rule);
  });

  it('το `expires` της νομιμότητας παράγεται από τον κανόνα', () => {
    expect(legalityKindSpec('energy-performance').expires).toBe(ruleExpires(PEA));
    expect(legalityKindSpec('building-identity').expires).toBe(ruleExpires(documentKindSpec('building-identity').rule));
  });

  it('ο διάλογος ελέγχου ΖΗΤΑ έκδοση για το ΠΕΑ (`hasValidity` = `ruleExpires`) — αλλιώς η λήξη δεν υπολογίζεται ποτέ', () => {
    const rule = getChecklistItem('energy_certificate')?.validity;
    expect(rule && ruleExpires(rule)).toBe(true);
    expect(ruleExpires({ kind: 'none' })).toBe(false);
    expect(ruleExpires({ kind: 'act_day' })).toBe(false);
  });

  it('κάθε είδος έχει πηγή', () => {
    for (const kind of DOCUMENT_KINDS) expect(documentKindSpec(kind).statute.length).toBeGreaterThan(0);
  });
});
