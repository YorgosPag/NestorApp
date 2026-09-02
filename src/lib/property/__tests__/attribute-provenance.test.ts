/**
 * **Η ΑΓΚΥΡΑ ΤΗΣ ΠΡΟΕΛΕΥΣΗΣ ΧΑΡΑΚΤΗΡΙΣΤΙΚΟΥ** — ADR-842 Α6 + **Α7**.
 *
 * Δύο ερωτήματα, και το δεύτερο είναι ο λόγος που υπάρχει το αρχείο:
 *  1. *«ποια πηγή νικά;»* — {@link outranksForAttribute}
 *  2. 🔴 *«φεύγει αυτό δημόσια;»* — {@link isPubliclyPresentable}
 *
 * Το (2) είναι το σημείο όπου ο Νέστωρ είναι **αυστηρότερος** από τους μεγάλους
 * παίκτες: Zillow/Trulia δημοσιεύουν συμπεράσματα computer-vision αυτούσια· εδώ ένα
 * `inferred` **δεν είναι γεγονός** μέχρι να το εγκρίνει άνθρωπος. Αν αυτή η άγκυρα
 * πρασινίσει ενώ το `confirmedAt` αγνοείται, η υπόσχεση έχει σπάσει σιωπηλά.
 *
 * @see ADR-842 §5 · docs/centralized-systems/reference/adrs/ADR-842-property-attributes-and-provenance.md
 */

import {
  ATTRIBUTE_PROVENANCES,
  attributeProvenanceRank,
  outranksForAttribute,
  isPubliclyPresentable,
  preferStrongerAttribute,
  type AttributeProvenance,
  type SourcedAttribute,
} from '../attribute-provenance';

const AT = '2026-09-02T10:00:00.000Z';

const measured: SourcedAttribute<number> = {
  provenance: 'measured',
  value: 95,
  sourceRef: 'dxf:plan-01',
  at: AT,
};
const declared: SourcedAttribute<number> = { provenance: 'declared', value: 88, at: AT };
const inferredRaw: SourcedAttribute<number> = {
  provenance: 'inferred',
  value: 90,
  confidence: 0.82,
  confirmedAt: null,
  at: AT,
};
const inferredConfirmed: SourcedAttribute<number> = { ...inferredRaw, confirmedAt: AT };

describe('ADR-842 Α6 · το λεξιλόγιο προέλευσης', () => {
  it('έχει ακριβώς τρεις προελεύσεις, χωρίς διπλότυπα', () => {
    expect(ATTRIBUTE_PROVENANCES).toHaveLength(3);
    expect([...new Set(ATTRIBUTE_PROVENANCES)]).toHaveLength(3);
  });

  it('ο κατάλογος είναι ΠΑΡΑΓΟΜΕΝΟΣ — κάθε τιμή έχει βαθμίδα', () => {
    for (const provenance of ATTRIBUTE_PROVENANCES) {
      expect(Number.isFinite(attributeProvenanceRank(provenance))).toBe(true);
    }
  });

  it('🔑 μετρημένο > δηλωμένο > συμπερασμένο', () => {
    expect(attributeProvenanceRank('measured')).toBeGreaterThan(
      attributeProvenanceRank('declared'),
    );
    expect(attributeProvenanceRank('declared')).toBeGreaterThan(
      attributeProvenanceRank('inferred'),
    );
  });

  it('🔴 το μοντέλο ΔΕΝ σβήνει τη δήλωση του ανθρώπου', () => {
    expect(outranksForAttribute('inferred', 'declared')).toBe(false);
    expect(outranksForAttribute('measured', 'declared')).toBe(true);
  });

  it('καμία προηγούμενη γνώση ⇒ κάθε πηγή γίνεται δεκτή', () => {
    for (const provenance of ATTRIBUTE_PROVENANCES) {
      expect(outranksForAttribute(provenance, null)).toBe(true);
    }
  });

  it('⚠️ ισοβαθμία ⇒ ΟΧΙ — η δεύτερη δήλωση δεν σβήνει την πρώτη', () => {
    for (const provenance of ATTRIBUTE_PROVENANCES) {
      expect(outranksForAttribute(provenance, provenance)).toBe(false);
    }
  });
});

describe('🔴 ADR-842 Α7 · τι επιτρέπεται να φτάσει στον αγοραστή', () => {
  it('μετρημένο από σχέδιο φεύγει δημόσια', () => {
    expect(isPubliclyPresentable(measured)).toBe(true);
  });

  it('δηλωμένο από άνθρωπο φεύγει δημόσια', () => {
    expect(isPubliclyPresentable(declared)).toBe(true);
  });

  it('🔴 ΣΥΜΠΕΡΑΣΜΕΝΟ ΧΩΡΙΣ ΕΓΚΡΙΣΗ ΑΝΘΡΩΠΟΥ **ΔΕΝ** ΦΕΥΓΕΙ', () => {
    expect(isPubliclyPresentable(inferredRaw)).toBe(false);
  });

  it('συμπερασμένο ΜΕ έγκριση ανθρώπου φεύγει', () => {
    expect(isPubliclyPresentable(inferredConfirmed)).toBe(true);
  });

  it('⚠️ η εμπιστοσύνη του μοντέλου ΔΕΝ αντικαθιστά την έγκριση', () => {
    // Ακόμη και στο 99,9% — «σχεδόν σίγουρο» δεν είναι «κάποιος το είδε».
    const almostCertain: SourcedAttribute<number> = { ...inferredRaw, confidence: 0.999 };
    expect(isPubliclyPresentable(almostCertain)).toBe(false);
  });
});

describe('ποια εκδοχή του ίδιου χαρακτηριστικού κρατάμε', () => {
  it('τίποτα υπάρχον ⇒ κρατάμε το εισερχόμενο', () => {
    expect(preferStrongerAttribute(null, declared)).toBe(declared);
  });

  it('το σχέδιο νικά τη δήλωση', () => {
    expect(preferStrongerAttribute(declared, measured)).toBe(measured);
  });

  it('🔴 το μάντεμα ΔΕΝ νικά τη δήλωση — και επιστρέφει το ΙΔΙΟ αντικείμενο', () => {
    expect(preferStrongerAttribute(declared, inferredRaw)).toBe(declared);
  });

  it('ισοβαθμία κρατά το υπάρχον', () => {
    const other: SourcedAttribute<number> = { ...declared, value: 77 };
    expect(preferStrongerAttribute(declared, other)).toBe(declared);
  });
});

describe('συμβόλαιο καθαρότητας', () => {
  it('καμία συνάρτηση δεν διαβάζει ρολόι — η στιγμή έρχεται από τον καλούντα', () => {
    // Αν κάποια συνάρτηση καλούσε `new Date()` μέσα της, η απάντηση θα άλλαζε με τον
    // χρόνο και δεν θα ελεγχόταν. Ίδιος κανόνας με το `isOwnerPropertyOnTheMarket`.
    const first = isPubliclyPresentable(inferredRaw);
    const again = isPubliclyPresentable(inferredRaw);
    expect(first).toBe(again);
    expect(preferStrongerAttribute(declared, measured)).toBe(
      preferStrongerAttribute(declared, measured),
    );
  });

  it('η κατάταξη δεν αποθηκεύεται — μόνο η σύγκριση έχει νόημα', () => {
    const ranks = ATTRIBUTE_PROVENANCES.map((p: AttributeProvenance) =>
      attributeProvenanceRank(p),
    );
    // Αυστηρά φθίνουσα στη σειρά δήλωσης: measured, declared, inferred.
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });
});
