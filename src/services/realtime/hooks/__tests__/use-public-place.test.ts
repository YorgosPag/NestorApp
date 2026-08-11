/**
 * @fileoverview **Η ΚΡΙΣΗ ΤΗΣ ΑΝΑΓΝΩΣΗΣ ΤΟΥ ΕΠΙΠΕΔΟΥ Α** — έξι καταστάσεις, καμία σιωπηλή.
 * @related ADR-777 · SPEC-777A §13.7.3 (Β3) · §13.7.2 #5 · services/realtime/hooks/usePublicPlace
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΑΡΚΟΥΣΕ ΝΑ ΓΡΑΦΤΕΙ ΣΩΣΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Β2 πλήρωσε το μάθημα **μέσα στο αρχείο που το τεκμηριώνει**: το
 * `fetchOsmBuildingOutline` συγχώνευε *«δεν έχει σχήμα»* με *«δεν απάντησε»*, **11
 * άγκυρες ήταν πράσινες**, και το βρήκε **ζωντανή δοκιμή** — γιατί όλες ρωτούσαν
 * *«πήρα δακτύλιο;»* και **καμία** *«τι σημαίνει το `null`;»*.
 *
 * Εδώ η αντίστοιχη παγίδα είναι το `dangling-building`: μια γη που υπάρχει με κτίριο
 * που δεν υπάρχει **μοιάζει** με «γη χωρίς κτίριο» — και εκείνο είναι απολύτως νόμιμο
 * (*«ζητώ οικόπεδο για αντιπαροχή»*). Συγχωνευμένα, η οθόνη θα έλεγε ήρεμα «γη χωρίς
 * κτίριο» για **κάθε σπασμένο δεσμό**, και κανείς δεν θα το μάθαινε ποτέ.
 *
 * ⚠️ **Η κρίση δοκιμάζεται ως ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ** επίτηδες: μέσα σε `useEffect` θα
 * μπορούσε να ελεγχθεί μόνο με προσομοίωση Firestore, δηλαδή σε κόσμο που δεν υπάρχει.
 */

import {
  classifyPlaceDocuments,
  placeDisplayAddress,
  type PublicPlaceLookup,
} from '../usePublicPlace';
import type { PlaceRef, PublicBuilding, PublicLand } from '@/types/geo/public-place';

const AT = '2026-08-11T12:00:00.000Z';

/** Η **πραγματική** γη του dev Firestore, σε σχήμα — όχι επινοημένο δείγμα. */
const LAND: PublicLand = {
  id: 'land_0cb5cbb6-bb31-4954-a7f9-8e8f9ac00a00',
  position: {
    kind: 'known',
    provenance: 'osm',
    point: { lat: 40.6403, lng: 22.9444 },
    locatedAt: AT,
    osmRef: { elementType: 'way', elementId: '27931128', seenAt: AT },
  },
  displayAddress: 'Στέφανου Δραγούμη, 8',
  areaSqm: null,
  createdAt: AT,
  updatedAt: AT,
};

const BUILDING: PublicBuilding = {
  id: 'pbld_24b3a8d7-2e56-40e6-8053-9c1628b425bf',
  landId: LAND.id,
  footprint: {
    kind: 'known',
    provenance: 'osm',
    point: { lat: 40.6403, lng: 22.9444 },
    locatedAt: AT,
    osmRef: { elementType: 'way', elementId: '27931128', seenAt: AT },
  },
  floorsAboveGround: { value: 6, source: 'osm', attestedAt: AT },
  constructionYear: null,
  useCode: null,
  createdAt: AT,
  updatedAt: AT,
};

const REF_WITH_BUILDING: PlaceRef = { landId: LAND.id, buildingId: BUILDING.id };
const REF_LAND_ONLY: PlaceRef = { landId: LAND.id, buildingId: null };

// =============================================================================
// Κ — Η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ ΤΗΣ ΚΡΙΣΗΣ
// =============================================================================

describe('Κ — κάθε συνδυασμός εγγράφων απαντιέται ΡΗΤΑ', () => {
  it('Κ1 — γη + κτίριο, και τα δύο ζητήθηκαν ⇒ `found` με τα δύο', () => {
    expect(classifyPlaceDocuments(REF_WITH_BUILDING, LAND, BUILDING)).toEqual({
      state: 'found',
      land: LAND,
      building: BUILDING,
    });
  });

  it('Κ2 — ο δεσμός δείχνει σε ΓΗ ⇒ `found` με `building: null`, και είναι ΝΟΜΙΜΟ', () => {
    // *«ζητώ οικόπεδο για αντιπαροχή σε αυτό το τετράγωνο»* — δεν έχει κτίριο και δεν
    // πρέπει να αναγκαστεί να επινοήσει ένα (`PlaceRef.buildingId`).
    expect(classifyPlaceDocuments(REF_LAND_ONLY, LAND, null)).toEqual({
      state: 'found',
      land: LAND,
      building: null,
    });
  });

  it('Κ3 — η ΓΗ δεν υπάρχει ⇒ `absent`, ό,τι κι αν βρέθηκε αλλού', () => {
    expect(classifyPlaceDocuments(REF_WITH_BUILDING, null, BUILDING)).toEqual({ state: 'absent' });
  });

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΔΙΝΕΙ ΑΠΟΔΕΙΞΗ ΖΩΗΣ ΣΤΟΝ ΤΡΙΤΟ ΚΛΑΔΟ** (ADR-749 §5).
   *
   * Χωρίς αυτήν, ο κλάδος `dangling-building` θα ήταν φρουρός που **κανείς δεν
   * πυροδότησε ποτέ** — και το χειρότερο είδος: γραμμένος σωστά, τεκμηριωμένος, και
   * αναποδείκτος.
   */
  it('🔴 Κ4 — ζητήθηκε ΚΤΙΡΙΟ και δεν υπάρχει ⇒ `dangling-building`, ΠΟΤΕ «γη χωρίς κτίριο»', () => {
    const verdict = classifyPlaceDocuments(REF_WITH_BUILDING, LAND, null);

    expect(verdict).toEqual({ state: 'dangling-building', land: LAND });
    // …και **δεν** μπερδεύεται με τη νόμιμη περίπτωση του Κ2.
    expect(verdict).not.toEqual(classifyPlaceDocuments(REF_LAND_ONLY, LAND, null));
  });

  it('Κ5 — η διάκριση αλλάζει ΤΙ ΚΑΝΕΙ η οθόνη: «διάλεξε ξανά» vs καμία ενέργεια', () => {
    const broken = classifyPlaceDocuments(REF_WITH_BUILDING, LAND, null);
    const legitimate = classifyPlaceDocuments(REF_LAND_ONLY, LAND, null);

    expect(broken.state).toBe('dangling-building');
    expect(legitimate.state).toBe('found');
  });
});

// =============================================================================
// Δ — Η ΔΙΕΥΘΥΝΣΗ: ΤΟ ΠΡΟΣΩΠΟ ΤΟΥ ΤΟΠΟΥ
// =============================================================================

describe('Δ — η διεύθυνση διαβάζεται από τη ΓΗ, και η απουσία της λέγεται', () => {
  it('🔑 Δ1 — αυτό ακριβώς που ο άνθρωπος έβλεπε ως `pbld_24b3a8d7…`', () => {
    expect(placeDisplayAddress(classifyPlaceDocuments(REF_WITH_BUILDING, LAND, BUILDING))).toBe(
      'Στέφανου Δραγούμη, 8',
    );
  });

  it('Δ2 — η γη κρατά τη διεύθυνση (Α1): αρκεί η γη, χωρίς κτίριο', () => {
    expect(placeDisplayAddress(classifyPlaceDocuments(REF_LAND_ONLY, LAND, null))).toBe(
      'Στέφανου Δραγούμη, 8',
    );
  });

  /**
   * ⚠️ Μετρήθηκε ότι μόλις **46 %** των κτιρίων στο κέντρο της Θεσσαλονίκης έχουν
   * διεύθυνση (SPEC-777A §13.7.2 #2). Το `null` **δεν** είναι σπάνια περίπτωση προς
   * σιωπή — είναι **η μισή αγορά**, και η οθόνη οφείλει να το πει.
   */
  it('Δ3 — τόπος χωρίς διεύθυνση ⇒ `null`, ώστε η οθόνη να το ΠΕΙ', () => {
    const anonymous: PublicLand = { ...LAND, displayAddress: null };
    expect(placeDisplayAddress(classifyPlaceDocuments(REF_LAND_ONLY, anonymous, null))).toBeNull();
  });

  /**
   * 🔴 Η κενή συμβολοσειρά διαβάζεται ως *«λύθηκε και είναι κενή»* — ο ίδιος
   * ακριβώς λόγος που το `PublicLand.displayAddress` απαγορεύει το `''` στον τύπο του.
   * Αν περνούσε, η οθόνη θα ζωγράφιζε **κενή γραμμή** αντί για «χωρίς διεύθυνση».
   */
  it('🔴 Δ4 — κενή/λευκή διεύθυνση ΔΕΝ είναι διεύθυνση', () => {
    const blank: PublicLand = { ...LAND, displayAddress: '   ' };
    expect(placeDisplayAddress(classifyPlaceDocuments(REF_LAND_ONLY, blank, null))).toBeNull();
  });

  it('Δ5 — καμία διεύθυνση από καταστάσεις που δεν έχουν γη', () => {
    const states: PublicPlaceLookup[] = [
      { state: 'idle' },
      { state: 'loading' },
      { state: 'absent' },
      { state: 'error', message: 'boom' },
    ];
    for (const state of states) expect(placeDisplayAddress(state)).toBeNull();
  });
});
