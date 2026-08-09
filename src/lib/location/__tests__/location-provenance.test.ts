/**
 * Άγκυρες για το SSoT προέλευσης θέσης — ADR-777 / SPEC-777A §13.3 · §14.3 · §21.4.
 *
 * 🔴 ΟΙ ΠΙΝΑΚΕΣ ΠΡΟΣΔΟΚΙΩΝ ΕΙΝΑΙ ΧΕΙΡΟΓΡΑΦΟΙ, ΕΠΙΤΗΔΕΣ. Καμία προσδοκία δεν
 * παράγεται από τα ίδια κατηγορήματα που ελέγχει — αλλιώς ο παρονομαστής θα ήταν ο
 * κριτής και η μετάλλαξη θα μετακινούσε **και τα δύο** (μάθημα ADR-777 Β0, παγίδα #4).
 */

import {
  LOCATION_PROVENANCES,
  locationProvenanceRank,
  outranksForLocation,
  locationKnowledgeStep,
  hasKnownPosition,
  placeFactRank,
  outranksForFact,
  type LocationProvenance,
  type PlaceFactSource,
} from '../location-provenance';

// ============================================================================
// Μ0 — ΤΟ ΛΕΞΙΛΟΓΙΟ ΕΙΝΑΙ ΚΛΕΙΣΤΟ ΚΑΙ ΠΛΗΡΕΣ
// ============================================================================

describe('Μ0 — το λεξιλόγιο', () => {
  /** Χειρόγραφο. Νέα προέλευση ⇒ αυτό το test πέφτει ΠΡΙΝ προλάβει να ξεχαστεί. */
  const EXPECTED: readonly LocationProvenance[] = [
    'geocoded',
    'manual',
    'drawn',
    'osm',
    'survey',
    'bim',
  ];

  it('περιέχει ακριβώς έξι προελεύσεις θέσης', () => {
    expect([...LOCATION_PROVENANCES].sort()).toEqual([...EXPECTED].sort());
  });

  it("ΔΕΝ περιέχει το 'document-only' — έγγραφο δεν είναι θέση (§21.4 σκαλοπάτι 5)", () => {
    expect(LOCATION_PROVENANCES).not.toContain('document-only' as LocationProvenance);
  });
});

// ============================================================================
// Κ1 — Η ΙΕΡΑΡΧΙΑ ΤΟΥ §14.3, ΓΡΑΜΜΕΝΗ ΧΕΙΡΟΓΡΑΦΑ
// ============================================================================

describe('Κ1 — μετρημένο > δημόσιος χάρτης > δηλωμένο (§14.3)', () => {
  /** Χειρόγραφος πίνακας βαθμίδων — ΟΧΙ αντιγραφή από τη μηχανή. */
  const EXPECTED_RANK: Readonly<Record<LocationProvenance, number>> = {
    survey: 4,
    bim: 4,
    osm: 3,
    drawn: 2,
    manual: 2,
    geocoded: 1,
  };

  it.each(Object.entries(EXPECTED_RANK))('%s έχει βαθμίδα %s', (provenance, rank) => {
    expect(locationProvenanceRank(provenance as LocationProvenance)).toBe(rank);
  });

  it('το μετρημένο ξεπερνά τον δημόσιο χάρτη', () => {
    expect(outranksForLocation('survey', 'osm')).toBe(true);
    expect(outranksForLocation('bim', 'osm')).toBe(true);
  });

  it('ο δημόσιος χάρτης ξεπερνά το δηλωμένο', () => {
    expect(outranksForLocation('osm', 'manual')).toBe(true);
    expect(outranksForLocation('osm', 'drawn')).toBe(true);
  });

  it('🔴 το geocoded ΔΕΝ σβήνει πινέζα ανθρώπου', () => {
    // Η αιτία που το `geocoded` πήρε δική του, χαμηλότερη βαθμίδα: μια αυτόματη
    // γεωκωδικοποίηση δεν επιτρέπεται να ξαναγράψει σημείο που δήλωσε άνθρωπος.
    expect(outranksForLocation('geocoded', 'manual')).toBe(false);
    expect(outranksForLocation('geocoded', 'drawn')).toBe(false);
  });
});

// ============================================================================
// Κ2 — ΙΣΟΒΑΘΜΙΑ ⇒ ΟΧΙ. Η ΣΥΓΚΡΟΥΣΗ ΜΕΝΕΙ ΟΡΑΤΗ
// ============================================================================

describe('Κ2 — ισοβαθμία δεν αντικαθιστά', () => {
  it('δύο μετρημένες πηγές δεν ξεπερνούν η μία την άλλη', () => {
    expect(outranksForLocation('survey', 'bim')).toBe(false);
    expect(outranksForLocation('bim', 'survey')).toBe(false);
  });

  it('δύο δηλωμένες πηγές δεν ξεπερνούν η μία την άλλη', () => {
    expect(outranksForLocation('manual', 'drawn')).toBe(false);
    expect(outranksForLocation('drawn', 'manual')).toBe(false);
  });

  it('η ίδια πηγή δεν ξεπερνά τον εαυτό της', () => {
    for (const provenance of LOCATION_PROVENANCES) {
      expect(outranksForLocation(provenance, provenance)).toBe(false);
    }
  });
});

// ============================================================================
// Κ3 — ΤΟ ΑΓΝΩΣΤΟ ΔΕΝ ΣΥΝΑΓΩΝΙΖΕΤΑΙ (Α5)
// ============================================================================

describe('Κ3 — άγνωστη θέση', () => {
  it('κάθε προέλευση ανεβαίνει πάνω στο άγνωστο', () => {
    for (const provenance of LOCATION_PROVENANCES) {
      expect(outranksForLocation(provenance, null)).toBe(true);
    }
  });

  it('hasKnownPosition ξεχωρίζει το άγνωστο από κάθε πηγή', () => {
    expect(hasKnownPosition(null)).toBe(false);
    for (const provenance of LOCATION_PROVENANCES) {
      expect(hasKnownPosition(provenance)).toBe(true);
    }
  });
});

// ============================================================================
// Κ4 — 🔴 Η ΚΕΝΤΡΙΚΗ ΑΓΚΥΡΑ: Η ΣΚΑΛΑ ΔΕΝ ΕΙΝΑΙ ΑΞΙΟΠΙΣΤΙΑ
// ============================================================================

describe('Κ4 — σκαλοπάτι 5 (έγγραφο) vs σκαλοπάτι 4 (osm)', () => {
  it('το έγγραφο δίνει ψηλότερο ΣΚΑΛΟΠΑΤΙ από το osm', () => {
    // §21.4: «ανεβάζει τοπογραφικό PDF» = σκαλοπάτι 5· «διαλέγει κτίριο OSM» = 4.
    expect(locationKnowledgeStep(null, true)).toBe(5);
    expect(locationKnowledgeStep('osm', false)).toBe(4);
  });

  it('🔴 ΑΛΛΑ το έγγραφο δεν δίνει ΚΑΜΙΑ θέση — άρα δεν αγγίζει την κατάταξη', () => {
    // Αυτό είναι ΟΛΟΚΛΗΡΟΣ ο λόγος που σκάλα και κατάταξη είναι δύο συναρτήσεις.
    // Αν ενοποιούνταν, το «έγγραφο» (5) θα ξεπερνούσε το «osm» (4) και ένα
    // ΑΝΥΠΑΡΚΤΟ στοιχείο θέσης θα έσβηνε ένα ΥΠΑΡΚΤΟ — σιωπηλά, για όλους.
    expect(hasKnownPosition(null)).toBe(false);
    expect(outranksForLocation('osm', null)).toBe(true);
  });

  it('η σκάλα επιστρέφει το ΨΗΛΟΤΕΡΟ από όσα έδωσε ο άνθρωπος', () => {
    // Μηχανικός με τοπογραφικό DXF (6) που έχει ΚΑΙ ανεβάσει PDF (5) ⇒ 6.
    expect(locationKnowledgeStep('survey', true)).toBe(6);
    // Χρήστης με σημείο από διεύθυνση (1) που ανέβασε PDF (5) ⇒ 5.
    expect(locationKnowledgeStep('geocoded', true)).toBe(5);
  });

  it('μηδέν είναι το κάτω άκρο, όχι σκαλοπάτι (Α5)', () => {
    expect(locationKnowledgeStep(null, false)).toBe(0);
  });
});

// ============================================================================
// Κ5 — Η ΣΚΑΛΑ ΤΟΥ §21.4, ΧΕΙΡΟΓΡΑΦΑ
// ============================================================================

describe('Κ5 — αντιστοίχιση προέλευσης σε σκαλοπάτι', () => {
  const EXPECTED_STEP: ReadonlyArray<readonly [LocationProvenance, number]> = [
    ['geocoded', 1],
    ['manual', 2],
    ['drawn', 3],
    ['osm', 4],
    ['survey', 6],
    ['bim', 6],
  ];

  it.each(EXPECTED_STEP)('%s ⇒ σκαλοπάτι %i', (provenance, step) => {
    expect(locationKnowledgeStep(provenance, false)).toBe(step);
  });

  it('κανένα σκαλοπάτι δεν βγαίνει εκτός 0..6', () => {
    for (const provenance of [...LOCATION_PROVENANCES, null]) {
      for (const hasDoc of [true, false]) {
        const step = locationKnowledgeStep(provenance, hasDoc);
        expect(step).toBeGreaterThanOrEqual(0);
        expect(step).toBeLessThanOrEqual(6);
      }
    }
  });
});

// ============================================================================
// Κ6 — ΓΕΓΟΝΟΤΑ: ΤΟ 'declared' ΕΙΝΑΙ ΒΑΘΜΙΔΑ «ΔΗΛΩΜΕΝΟ», ΟΧΙ ΝΕΟ ΛΕΞΙΛΟΓΙΟ
// ============================================================================

describe('Κ6 — προέλευση γεγονότος (§14.3)', () => {
  it("το 'declared' μοιράζεται τη βαθμίδα των manual/drawn", () => {
    expect(placeFactRank('declared')).toBe(placeFactRank('manual'));
    expect(placeFactRank('declared')).toBe(placeFactRank('drawn'));
  });

  it('κάθε προέλευση θέσης είναι έγκυρη και ως προέλευση γεγονότος', () => {
    for (const provenance of LOCATION_PROVENANCES) {
      const asFact: PlaceFactSource = provenance;
      expect(placeFactRank(asFact)).toBe(locationProvenanceRank(provenance));
    }
  });

  it('το μετρημένο και το δημόσιο ξεπερνούν το δηλωμένο', () => {
    expect(outranksForFact('survey', 'declared')).toBe(true);
    expect(outranksForFact('osm', 'declared')).toBe(true);
  });

  it('🔴 δήλωση χρήστη δεν σβήνει δήλωση άλλου χρήστη', () => {
    expect(outranksForFact('declared', 'declared')).toBe(false);
    expect(outranksForFact('declared', 'manual')).toBe(false);
  });

  it('πάνω στο άγνωστο, κάθε πηγή γεγονότος ανεβαίνει', () => {
    expect(outranksForFact('declared', null)).toBe(true);
  });
});
