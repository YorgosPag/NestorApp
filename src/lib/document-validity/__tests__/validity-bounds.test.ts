/**
 * ⚓ ADR-915 §14 — νόμιμα όρια λήξης + «τυπωμένη λήξη μέσα στα όρια» + «εκδώστε από X».
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | `end-of-month` → `new Date(Date.UTC(year, month - 1, 0))` | Β2 (μήνας πριν) |
 * | `enfia-cycle`: `key < central` → `key <= central` | Β3 (η ίδια η ημέρα της κεντρικής) |
 * | `printedRuleExpiry`: χωρίς τυπωμένη ⇒ το ανώτατο | Π1 (`floor`, ποτέ ανώτατο) |
 * | `printedRuleExpiry`: χωρίς έλεγχο ανώτατου | Π3 |
 * | `coveringIssueFrom`: επιστρέφει την υποψήφια χωρίς επαλήθευση | Κ2 (31 Μαρτίου) |
 */

import { DOCUMENT_KIND_SPECS, documentKindSpec } from '@/config/document-validity/document-validity';
import { documentExpiry, ruleExpires, ruleExpiresOn } from '@/lib/document-validity/document-expiry';
import { boundExpiresOn, coveringIssueFrom } from '@/lib/document-validity/validity-bounds';

const TAX = documentKindSpec('tax-clearance').rule;
const INSURANCE = documentKindSpec('insurance-clearance').rule;
const ENFIA = documentKindSpec('enfia-certificate').rule;

describe('Β — τα όρια', () => {
  it('Β1 μήνες: ίδιος υπολογισμός με τον κανόνα `months` (σύμπτυξη στο τέλος του μήνα)', () => {
    expect(boundExpiresOn({ kind: 'months', months: 1 }, '2026-01-31')).toBe('2026-02-28');
    expect(boundExpiresOn({ kind: 'months', months: 2 }, '2026-10-01')).toBe('2026-12-01');
  });

  it('Β2 τέλος μήνα: Φεβρουάριος δίσεκτου και μη, Δεκέμβριος', () => {
    expect(boundExpiresOn({ kind: 'end-of-month' }, '2024-02-10')).toBe('2024-02-29');
    expect(boundExpiresOn({ kind: 'end-of-month' }, '2026-02-10')).toBe('2026-02-28');
    expect(boundExpiresOn({ kind: 'end-of-month' }, '2026-12-05')).toBe('2026-12-31');
  });

  it('Β3 κύκλος ΕΝΦΙΑ: πριν την κεντρική ⇒ η παραμονή της · από αυτήν ⇒ 31/12 · άγνωστο έτος ⇒ null', () => {
    expect(boundExpiresOn({ kind: 'enfia-cycle' }, '2026-02-01')).toBe('2026-03-14');
    expect(boundExpiresOn({ kind: 'enfia-cycle' }, '2026-03-15')).toBe('2026-12-31');
    expect(boundExpiresOn({ kind: 'enfia-cycle' }, '2025-06-01')).toBeNull();
  });

  it('Β4 χωρίς ή με άκυρη έκδοση ⇒ null («δεν ξέρουμε»)', () => {
    expect(boundExpiresOn({ kind: 'end-of-year' }, null)).toBeNull();
    expect(boundExpiresOn({ kind: 'end-of-year' }, '2026-02-30')).toBeNull();
    expect(boundExpiresOn({ kind: 'end-of-year' }, '2026-05-01')).toBe('2026-12-31');
  });
});

describe('Π — κανόνας `printed`: η τυπωμένη λήξη είναι η αλήθεια, μέσα στα νόμιμα όρια', () => {
  const tax = (printedValidUntil: string | null, issuedOn: string | null = '2026-10-01') =>
    documentExpiry({ rule: TAX, issuedOn, printedValidUntil });

  it('Π1 χωρίς τυπωμένη ⇒ το ΚΑΤΩΤΑΤΟ, ως `floor` («τουλάχιστον έως»)', () => {
    expect(tax(null)).toEqual({ expiresOn: '2026-11-01', source: 'floor', discrepancy: null });
    expect(ruleExpiresOn(TAX, '2026-10-01')).toBe('2026-11-01');
  });

  it('Π2 τυπωμένη μέσα στα όρια (1 ή 2 μήνες, ανάλογα με τις οφειλές) ⇒ αυτή, χωρίς ασυμφωνία', () => {
    expect(tax('2026-11-01')).toEqual({ expiresOn: '2026-11-01', source: 'printed', discrepancy: null });
    expect(tax('2026-12-01')).toEqual({ expiresOn: '2026-12-01', source: 'printed', discrepancy: null });
  });

  it('Π3 τυπωμένη ΠΕΡΑ από το ανώτατο ⇒ το ανώτατο + ασυμφωνία (ποτέ «σε ισχύ» πέρα από τον νόμο)', () => {
    expect(tax('2027-01-15')).toEqual({ expiresOn: '2026-12-01', source: 'rule', discrepancy: { rule: '2026-12-01', printed: '2027-01-15' } });
  });

  it('Π4 τυπωμένη ΚΑΤΩ από το κατώτατο ⇒ η τυπωμένη (η νωρίτερη κερδίζει, Α4) + ασυμφωνία', () => {
    expect(tax('2026-10-20')).toEqual({ expiresOn: '2026-10-20', source: 'printed', discrepancy: { rule: '2026-11-01', printed: '2026-10-20' } });
  });

  it('Π5 χωρίς έκδοση: η τυπωμένη μόνη της · χωρίς τίποτα ⇒ άγνωστη', () => {
    expect(tax('2026-11-20', null)).toEqual({ expiresOn: '2026-11-20', source: 'printed', discrepancy: null });
    expect(tax(null, null)).toEqual({ expiresOn: null, source: null, discrepancy: null });
  });

  it('Π6 ΕΦΚΑ: κατώτατο = τέλος μήνα έκδοσης (Βεβαίωση Οφειλής) · ανώτατο 6 μήνες', () => {
    expect(documentExpiry({ rule: INSURANCE, issuedOn: '2026-10-05' })).toEqual({ expiresOn: '2026-10-31', source: 'floor', discrepancy: null });
    expect(documentExpiry({ rule: INSURANCE, issuedOn: '2026-10-05', printedValidUntil: '2027-04-05' }).discrepancy).toBeNull();
  });

  it('Π7 ΕΝΦΙΑ σε έτος χωρίς γνωστή κεντρική έκδοση ⇒ άγνωστη χωρίς τυπωμένη, όχι μαντεψιά', () => {
    expect(documentExpiry({ rule: ENFIA, issuedOn: '2025-06-01' })).toEqual({ expiresOn: null, source: null, discrepancy: null });
    expect(documentExpiry({ rule: ENFIA, issuedOn: '2025-06-01', printedValidUntil: '2025-12-31' }).expiresOn).toBe('2025-12-31');
  });

  it('Π8 κάθε `printed` λήγει (`ruleExpires`) — το ζητά ο διάλογος ελέγχου', () => {
    const printed = Object.values(DOCUMENT_KIND_SPECS).filter((spec) => spec.rule.kind === 'printed');
    expect(printed).toHaveLength(3);
    for (const spec of printed) expect(ruleExpires(spec.rule)).toBe(true);
  });
});

describe('Κ — «εκδώστε από X»: η νωρίτερη έκδοση που ΕΓΓΥΗΜΕΝΑ καλύπτει την υπογραφή', () => {
  it('Κ1 φορολογική: ένας μήνας πριν — το κατώτατο, γιατί μόνο αυτό υπόσχεται ο νόμος', () => {
    expect(coveringIssueFrom(TAX, '2026-12-15')).toBe('2026-11-15');
  });

  it('Κ2 σύμπτυξη τέλους μήνα: για υπογραφή 31/3 η 28/2 ΔΕΝ φτάνει (λήγει 28/3) ⇒ 1/3', () => {
    expect(coveringIssueFrom(TAX, '2026-03-31')).toBe('2026-03-01');
  });

  it('Κ3 ΕΦΚΑ: από την 1η του μήνα της υπογραφής', () => {
    expect(coveringIssueFrom(INSURANCE, '2026-12-15')).toBe('2026-12-01');
  });

  it('Κ4 ΕΝΦΙΑ: πριν την κεντρική ⇒ από 1/1 · μετά ⇒ από την κεντρική · άγνωστο έτος ⇒ null', () => {
    expect(coveringIssueFrom(ENFIA, '2026-02-20')).toBe('2026-01-01');
    expect(coveringIssueFrom(ENFIA, '2026-12-15')).toBe('2026-03-15');
    expect(coveringIssueFrom(ENFIA, '2027-05-01')).toBeNull();
  });

  it('Κ5 ΠΕΑ (120 μήνες) · κανόνες χωρίς εγγύηση ⇒ null', () => {
    expect(coveringIssueFrom(documentKindSpec('energy-certificate').rule, '2036-07-16')).toBe('2026-07-16');
    expect(coveringIssueFrom({ kind: 'unverified' }, '2026-12-15')).toBeNull();
    expect(coveringIssueFrom({ kind: 'none' }, '2026-12-15')).toBeNull();
    expect(coveringIssueFrom(TAX, 'κάποτε')).toBeNull();
  });

  it('Κ6 ιδιότητα: η έκδοση της απάντησης καλύπτει, η προηγούμενη μέρα ΟΧΙ', () => {
    for (const needed of ['2026-01-31', '2026-02-28', '2026-03-31', '2026-07-01', '2026-12-31']) {
      const from = coveringIssueFrom(TAX, needed);
      if (from === null) throw new Error(needed);
      expect((ruleExpiresOn(TAX, from) ?? '') >= needed).toBe(true);
      const dayBefore = new Date(`${from}T00:00:00Z`);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      expect((ruleExpiresOn(TAX, dayBefore.toISOString().slice(0, 10)) ?? '9999-12-31') < needed).toBe(true);
    }
  });
});
