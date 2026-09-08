/**
 * ADR-846 — **Η ΑΓΚΥΡΑ ΤΗΣ ΔΗΛΩΜΕΝΗΣ ΕΜΒΕΛΕΙΑΣ.**
 *
 * 🔴 **Τα ids είναι ΠΡΑΓΜΑΤΙΚΑ, από το ίδιο το αρχείο δεδομένων.** Ένα test με
 * `'region:1' → 'municipality:2'` φτιαγμένα στο χέρι επαληθεύει ότι ο **αλγόριθμος**
 * τρέχει· δεν επαληθεύει ότι το **σχήμα των ταυτοτήτων** που παράγει το
 * `administrative-hierarchy.json` περνά από αυτόν. Είναι η διαφορά που το ADR-777 §8.65
 * ονομάζει *«επαλήθευση πάνω σε πραγματική προβολή, όχι πάνω σε αντιγραμμένο
 * αλφαριθμητικό»*.
 *
 * 🔑 **Το σενάριο είναι ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΕΛΑΤΤΩΜΑ**: ο μπετατζής με έδρα στη **Θέρμη**
 * *(ΠΕ Θεσσαλονίκης)* που δουλεύει τη **Χαλκιδική** *(άλλη ΠΕ, ίδια Περιφέρεια)*.
 * Με το παλιό μοντέλο «έδρα + ακτίνα επισκέπτη» ήταν **δομικά** αόρατος στην Κασσάνδρα.
 */

import hierarchy from '@/data/administrative-hierarchy.json';
import {
  coverageMatches,
  coverageRelation,
  normalizeCoverageIds,
  type CoverageResolvers,
  type LineageResolver,
} from '../coverage-match';
import type { AdministrativeCoverage, DeclaredCoverage, ShowcaseWhere } from '@/types/agency-coverage';
import { NO_FOOTPRINTS } from '@/types/geo/admin-footprint';

// =============================================================================
// Η ΙΕΡΑΡΧΙΑ — από το ΠΡΑΓΜΑΤΙΚΟ αρχείο, με ένεση
// =============================================================================

interface RawEntity {
  readonly id: string;
  readonly p: string | null;
}

const BY_ID = new Map<string, RawEntity>(
  (hierarchy as { data: readonly RawEntity[] }).data.map((entity) => [entity.id, entity]),
);

/**
 * ⚠️ **Ξαναγράφεται εδώ επίτηδες, και ΔΕΝ είναι κλώνος του `lineageIdsOf`**: εκείνο
 * διαβάζει το **module cache του browser** *(που γεμίζει με `fetch`)*. Ένα test που
 * καλούσε εκείνο θα επαλήθευε τον **φορτωτή**· εδώ επαληθεύεται ο **κριτής**, και η
 * ιεραρχία είναι **είσοδος**. Η ισοδυναμία των δύο διαδρομών φυλάγεται από το
 * `lineage-parity` παρακάτω.
 */
const lineageOf: LineageResolver = (entityId) => {
  const lineage: string[] = [];
  let current = BY_ID.get(entityId);
  while (current) {
    lineage.push(current.id);
    current = current.p ? BY_ID.get(current.p) : undefined;
  }
  return lineage;
};

// Πραγματικές ταυτότητες (ΕΛΣΤΑΤ / Καλλικράτης)
const THERMI = 'municipality:0706'; // ΔΗΜΟΣ ΘΕΡΜΗΣ        (ΠΕ Θεσσαλονίκης)
const KASSANDRA = 'municipality:1303'; // ΔΗΜΟΣ ΚΑΣΣΑΝΔΡΑΣ (ΠΕ Χαλκιδικής)
const CHALKIDIKI = 'regional_unit:13'; // ΠΕ ΧΑΛΚΙΔΙΚΗΣ
const CENTRAL_MACEDONIA = 'region:112'; // ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ
const ATTICA = 'region:351'; // ΠΕΡΙΦΕΡΕΙΑ ΑΤΤΙΚΗΣ

const NATIONWIDE: DeclaredCoverage = { nationwide: true };
const declaring = (...adminIds: readonly string[]): AdministrativeCoverage => ({ adminIds });

/**
 * **Το ερώτημα ως ερώτημα** *(Φάση 2)*: ο κριτής δέχεται πλέον ολόκληρο το
 * {@link ShowcaseWhere}, γιατί ο επισκέπτης μπορεί να ρωτήσει **και με κύκλο**. Οι
 * παρακάτω έλεγχοι μιλούν όλοι για το **διοικητικό** σκέλος και δεν άλλαξαν σε τίποτα
 * άλλο πέρα από το περιτύλιγμα.
 */
const at = (adminId: string): ShowcaseWhere => ({ adminId });

/** Η ιεραρχία με ένεση + **δηλωμένη άγνοια** γεωμετρίας — τα μεικτά κελιά έχουν δικό τους αρχείο. */
const res = (lineage: typeof lineageOf): CoverageResolvers => ({
  lineageOf: lineage,
  footprintOf: NO_FOOTPRINTS,
});

// =============================================================================
// 0. ΤΑ ΔΕΔΟΜΕΝΑ ΛΕΝΕ Ο,ΤΙ ΝΟΜΙΖΟΥΜΕ
// =============================================================================

describe('ADR-846 · οι ταυτότητες υπάρχουν πραγματικά', () => {
  it.each([THERMI, KASSANDRA, CHALKIDIKI, CENTRAL_MACEDONIA, ATTICA])(
    'το %s υπάρχει στο administrative-hierarchy.json',
    (id) => {
      expect(BY_ID.has(id)).toBe(true);
    },
  );

  it('Θέρμη και Κασσάνδρα ανήκουν στην ΙΔΙΑ περιφέρεια αλλά ΔΙΑΦΟΡΕΤΙΚΕΣ ΠΕ', () => {
    // 🔑 Αν αυτό πάψει να ισχύει, το σενάριο του μπετατζή έπαψε να είναι το σενάριο —
    //    και όλα τα από κάτω επαληθεύουν κάτι άλλο απ' ό,τι νομίζουν.
    expect(lineageOf(THERMI)).toContain(CENTRAL_MACEDONIA);
    expect(lineageOf(KASSANDRA)).toContain(CENTRAL_MACEDONIA);
    expect(lineageOf(KASSANDRA)).toContain(CHALKIDIKI);
    expect(lineageOf(THERMI)).not.toContain(CHALKIDIKI);
  });

  it('η γενεαλογία περιλαμβάνει τον ΕΑΥΤΟ της, πρώτο', () => {
    expect(lineageOf(THERMI)[0]).toBe(THERMI);
  });
});

// =============================================================================
// 1. ΟΙ ΤΡΕΙΣ ΑΠΑΝΤΗΣΕΙΣ
// =============================================================================

describe('ADR-846 · coverageRelation — τρεις τιμές, αμοιβαία αποκλειόμενες', () => {
  it('δήλωση ΕΥΡΥΤΕΡΗ από το ερώτημα ⇒ within (το πραγματικό σενάριο)', () => {
    // Ο μπετατζής δήλωσε «Χαλκιδική»· ο επισκέπτης ρωτά «Κασσάνδρα».
    expect(coverageRelation(declaring(CHALKIDIKI), at(KASSANDRA), res(lineageOf))).toBe('within');
  });

  it('δήλωση ΣΤΕΝΟΤΕΡΗ από το ερώτημα ⇒ intersects (η κατεύθυνση που χανόταν)', () => {
    // Δήλωσε «Θέρμη»· ο επισκέπτης ρωτά χονδρικά «Κεντρική Μακεδονία». Τον θέλει.
    expect(coverageRelation(declaring(THERMI), at(CENTRAL_MACEDONIA), res(lineageOf))).toBe('intersects');
  });

  it('ΤΑΥΤΟΣΗΜΑ ⇒ within, ποτέ intersects — οι κάδοι μένουν αμοιβαία αποκλειόμενοι', () => {
    expect(coverageRelation(declaring(THERMI), at(THERMI), res(lineageOf))).toBe('within');
  });

  it('αδέλφια στο ίδιο επίπεδο ⇒ disjoint', () => {
    expect(coverageRelation(declaring(THERMI), at(KASSANDRA), res(lineageOf))).toBe('disjoint');
  });

  it('άλλη περιφέρεια ⇒ disjoint', () => {
    expect(coverageRelation(declaring(CENTRAL_MACEDONIA), at(ATTICA), res(lineageOf))).toBe('disjoint');
  });

  it('ΜΙΑ από πολλές δηλώσεις αρκεί', () => {
    const mixed = declaring(THERMI, CHALKIDIKI);
    expect(coverageRelation(mixed, at(KASSANDRA), res(lineageOf))).toBe('within');
  });

  it('«όλη η Ελλάδα» ⇒ within για ΚΑΘΕ ερώτημα, χωρίς να αγγίξει την ιεραρχία', () => {
    const exploding: LineageResolver = () => {
      throw new Error('η ιεραρχία ΔΕΝ πρέπει να ερωτηθεί για nationwide');
    };
    expect(coverageRelation(NATIONWIDE, at(KASSANDRA), res(exploding))).toBe('within');
    expect(coverageRelation(NATIONWIDE, at(ATTICA), res(exploding))).toBe('within');
  });

  it('καμία δήλωση ⇒ disjoint — η σιωπή ΔΕΝ ανταμείβεται με καθολική ορατότητα', () => {
    expect(coverageRelation(null, at(KASSANDRA), res(lineageOf))).toBe('disjoint');
  });

  it('«δεν ξέρω» (κενή γενεαλογία) ⇒ disjoint, και ο καλών ΔΕΝ εφαρμόζει τον άξονα', () => {
    const unloaded: LineageResolver = () => [];
    expect(coverageRelation(declaring(CHALKIDIKI), at(KASSANDRA), res(unloaded))).toBe('disjoint');
  });
});

describe('ADR-846 · coverageMatches', () => {
  it('συμφωνεί με το coverageRelation σε κάθε περίπτωση', () => {
    const cases: readonly [DeclaredCoverage | null, string][] = [
      [declaring(CHALKIDIKI), KASSANDRA],
      [declaring(THERMI), CENTRAL_MACEDONIA],
      [declaring(THERMI), KASSANDRA],
      [NATIONWIDE, ATTICA],
      [null, ATTICA],
    ];
    for (const [coverage, queryId] of cases) {
      const relation = coverageRelation(coverage, at(queryId), res(lineageOf));
      expect(coverageMatches(coverage, at(queryId), res(lineageOf))).toBe(relation !== 'disjoint');
    }
  });
});

// =============================================================================
// 2. Η ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ — αυτή που αντικαθιστά το πλαφόν των 20 του Google
// =============================================================================

describe('ADR-846 · normalizeCoverageIds', () => {
  it('ο απόγονος ΑΠΟΡΡΟΦΑΤΑΙ από τον πρόγονό του', () => {
    expect(normalizeCoverageIds([THERMI, CENTRAL_MACEDONIA], lineageOf)).toEqual([
      CENTRAL_MACEDONIA,
    ]);
  });

  it('απορροφά ανεξάρτητα από τη σειρά γραφής', () => {
    expect(normalizeCoverageIds([CENTRAL_MACEDONIA, THERMI], lineageOf)).toEqual([
      CENTRAL_MACEDONIA,
    ]);
  });

  it('απορροφά και σε ΑΠΟΣΤΑΣΗ δύο βαθμίδων (δήμος μέσα σε περιφέρεια)', () => {
    expect(normalizeCoverageIds([KASSANDRA, CHALKIDIKI], lineageOf)).toEqual([CHALKIDIKI]);
  });

  it('ΔΕΝ αγγίζει αδέλφια — δύο ανεξάρτητες περιοχές μένουν δύο', () => {
    expect(normalizeCoverageIds([THERMI, KASSANDRA], lineageOf)).toEqual([THERMI, KASSANDRA]);
  });

  it('αφαιρεί διπλότυπα', () => {
    expect(normalizeCoverageIds([THERMI, THERMI], lineageOf)).toEqual([THERMI]);
  });

  it('διατηρεί τη σειρά της πρώτης εμφάνισης', () => {
    expect(normalizeCoverageIds([KASSANDRA, ATTICA, THERMI], lineageOf)).toEqual([
      KASSANDRA,
      ATTICA,
      THERMI,
    ]);
  });

  it('είναι ΙΔΕΜΠΟΤΗΣ (N.7.2 #3)', () => {
    const once = normalizeCoverageIds([THERMI, CENTRAL_MACEDONIA, KASSANDRA], lineageOf);
    expect(normalizeCoverageIds(once, lineageOf)).toEqual(once);
  });

  it('ΔΙΑΤΗΡΕΙ άγνωστη ταυτότητα — η εγκυρότητα κρίνεται από τον γραφέα, όχι εδώ', () => {
    expect(normalizeCoverageIds(['municipality:ΑΝΥΠΑΡΚΤΟ'], lineageOf)).toEqual([
      'municipality:ΑΝΥΠΑΡΚΤΟ',
    ]);
  });

  it('η κανονικοποίηση ΔΕΝ αλλάζει καμία απάντηση του κριτή', () => {
    // 🔑 Αυτό είναι το νόημα της απορρόφησης: μικρότερη λίστα, **ταυτόσημη** σημασία.
    const raw = declaring(THERMI, CENTRAL_MACEDONIA);
    const normalized = declaring(...normalizeCoverageIds(raw.adminIds, lineageOf));
    for (const queryId of [THERMI, KASSANDRA, CHALKIDIKI, CENTRAL_MACEDONIA, ATTICA]) {
      expect(coverageMatches(normalized, at(queryId), res(lineageOf))).toBe(
        coverageMatches(raw, at(queryId), res(lineageOf)),
      );
    }
  });
});

// =============================================================================
// 3. Ο ΦΡΟΥΡΟΣ ΤΟΥ ΚΟΣΤΟΥΣ — γιατί ΔΕΝ αποθηκεύεται υποδέντρο
// =============================================================================

describe('ADR-846 · το μέγεθος που απέρριψε την αποθηκευμένη επέκταση', () => {
  it('το υποδέντρο μιας περιφέρειας είναι τριψήφιο-τετραψήφιο, όχι μονοψήφιο', () => {
    const children = new Map<string, string[]>();
    for (const entity of (hierarchy as { data: readonly RawEntity[] }).data) {
      if (entity.p === null) continue;
      const bucket = children.get(entity.p);
      if (bucket) bucket.push(entity.id);
      else children.set(entity.p, [entity.id]);
    }
    const countSubtree = (id: string): number =>
      1 + (children.get(id) ?? []).reduce((sum, child) => sum + countSubtree(child), 0);

    // ⚠️ Ο αριθμός θα αλλάξει σε επόμενη διοικητική μεταρρύθμιση — γι' αυτό ελέγχεται
    //    η **τάξη μεγέθους**, όχι η ακριβής τιμή. Η απόφαση εξαρτάται από το «εκατοντάδες
    //    ή χιλιάδες;», ποτέ από το «1850 ή 1851;».
    expect(countSubtree(CENTRAL_MACEDONIA)).toBeGreaterThan(500);
    // …ενώ η γενεαλογία που όντως αποθηκεύουμε/διασχίζουμε είναι πάντα μονοψήφια.
    expect(lineageOf(KASSANDRA).length).toBeLessThanOrEqual(8);
  });
});
