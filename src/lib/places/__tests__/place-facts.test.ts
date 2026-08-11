/**
 * @fileoverview Άγκυρες για τον **κανόνα συγχώνευσης του §14.3** και το όριο του ODbL.
 * @related lib/places/place-facts.ts · lib/location/location-provenance.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ ΤΟ ΠΙΟ ΚΡΙΣΙΜΟ ΤΗΣ ΣΥΝΕΔΡΙΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το επίπεδο Α το βλέπουν **όλοι** (§14.4). Ένα λάθος στην κατάταξη δεν χαλάει μια
 * οθόνη — **ξαναγράφει την πραγματικότητα για κάθε χρήστη ταυτόχρονα**. Οι δύο
 * αστοχίες που φρουρούνται εδώ ονομαστικά:
 *
 * 1. **Π1** — χρήση της σκάλας του §21.4 ως σειρά αξιοπιστίας.
 * 2. **ODbL** — περίγραμμα OSM που καταλήγει σε αποθηκευμένη θέση.
 */

import {
  mergeIntoBuilding,
  mergeIntoLand,
  newPublicBuilding,
  newPublicLand,
  placeAddressLine,
  positionFrom,
  type ResolvedPlaceFacts,
} from '../place-facts';
import type { GeoOutline } from '@/types/geo/coordinates';

const AT = '2026-08-11T10:00:00.000Z';
const LATER = '2026-08-12T10:00:00.000Z';

const SQUARE: GeoOutline = [
  { lat: 40.6400, lng: 22.9400 },
  { lat: 40.6400, lng: 22.9420 },
  { lat: 40.6410, lng: 22.9420 },
  { lat: 40.6410, lng: 22.9400 },
];

const BASE = {
  point: { lat: 40.6405, lng: 22.9410 },
  outline: null,
  osmRef: null,
  accuracy: null,
  displayAddress: null,
  floorsAboveGround: null,
  constructionYear: null,
} as const;

const osmFacts = (over: Partial<ResolvedPlaceFacts> = {}): ResolvedPlaceFacts => ({
  ...BASE,
  provenance: 'osm',
  osmRef: { elementType: 'way', elementId: '27931128', seenAt: AT },
  ...over,
});

const drawnFacts = (over: Partial<ResolvedPlaceFacts> = {}): ResolvedPlaceFacts => ({
  ...BASE,
  provenance: 'drawn',
  outline: SQUARE,
  ...over,
});

const geocodedFacts = (over: Partial<ResolvedPlaceFacts> = {}): ResolvedPlaceFacts => ({
  ...BASE,
  provenance: 'geocoded',
  accuracy: 'center',
  ...over,
});

// =============================================================================
describe('positionFrom — το νομικό όριο του §13.4 ως ΔΟΜΗ', () => {
  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ODbL.** Ακόμη κι όταν ο καλών **έχει** το περίγραμμα στα χέρια
   * του (το είδαμε ζωντανά για να διαλέξουμε κτίριο), η θέση με προέλευση `osm`
   * **δεν το κουβαλά**. Ο τύπος το κάνει αδύνατο· αυτή η άγκυρα το κάνει **ορατό**.
   */
  it('Κ1 — προέλευση `osm` ΔΕΝ αποθηκεύει περίγραμμα, ακόμη κι αν του δοθεί', () => {
    const position = positionFrom(osmFacts({ outline: SQUARE }), AT);

    expect(position.kind).toBe('known');
    expect(position).not.toHaveProperty('outline');
  });

  it('Κ2 — προέλευση `drawn` ΑΠΟΘΗΚΕΥΕΙ περίγραμμα (δικά μας δεδομένα, §13.4)', () => {
    const position = positionFrom(drawnFacts(), AT);
    expect(position).toHaveProperty('outline', SQUARE);
  });

  /**
   * ⚠️ Ο τύπος `PlacePosition` απαιτεί `accuracy` στον κλάδο `geocoded` — και μια
   * θέση χωρίς αυτήν δεν είναι «λίγο χειρότερη», είναι **ανέκφραστη**. Το `unknown`
   * είναι η ρητή κατάσταση της Α5, ποτέ `lat: 0, lng: 0`.
   */
  it('Κ3 — `geocoded` χωρίς ακρίβεια γίνεται ΡΗΤΑ «άγνωστη θέση», ποτέ σημείο-ψέμα', () => {
    expect(positionFrom(geocodedFacts({ accuracy: null }), AT)).toEqual({ kind: 'unknown' });
  });

  it('Κ4 — `osm` χωρίς αναφορά γίνεται ΡΗΤΑ «άγνωστη θέση»', () => {
    expect(positionFrom(osmFacts({ osmRef: null }), AT)).toEqual({ kind: 'unknown' });
  });
});

// =============================================================================
describe('mergeIntoLand — ο κανόνας του §14.3', () => {
  const geocodedLand = () => newPublicLand('land_1', geocodedFacts(), AT);
  const osmLand = () => newPublicLand('land_1', osmFacts(), AT);

  it('Κ5 — ισχυρότερη πηγή νικά: `osm` (3) πάνω σε `geocoded` (1)', () => {
    const { land, changed } = mergeIntoLand(geocodedLand(), osmFacts(), LATER);

    expect(changed).toContain('position');
    expect(land.position.kind === 'known' && land.position.provenance).toBe('osm');
    expect(land.updatedAt).toBe(LATER);
  });

  /**
   * 🔴 **Η ΚΑΡΔΙΑ ΤΟΥ §14.4.** «Το τελευταίο νικά» σε **κοινό** επίπεδο σημαίνει ότι
   * ο τελευταίος που πάτησε αποθήκευση ξαναγράφει την πραγματικότητα για **όλους**.
   * Η ισοβαθμία απορρίπτεται ώστε η σύγκρουση να μείνει **ορατή**.
   */
  it('Κ6 — ΙΣΟΒΑΘΜΙΑ ⇒ ΚΑΜΙΑ αλλαγή (δύο `osm` που διαφωνούν)', () => {
    const other = osmFacts({
      point: { lat: 41.0, lng: 23.0 },
      osmRef: { elementType: 'way', elementId: '999', seenAt: LATER },
    });

    const { land, changed } = mergeIntoLand(osmLand(), other, LATER);

    expect(changed).toEqual([]);
    expect(land.updatedAt).toBe(AT);
    expect(land.position.kind === 'known' && land.position.point.lat).toBeCloseTo(40.6405, 4);
  });

  it('Κ7 — ασθενέστερη πηγή ΔΕΝ σβήνει ισχυρότερη: `drawn` (2) πάνω σε `osm` (3)', () => {
    const { changed } = mergeIntoLand(osmLand(), drawnFacts(), LATER);
    expect(changed).not.toContain('position');
  });

  /**
   * 🔴 **Π1 — Η ΑΓΚΥΡΑ ΠΟΥ ΚΡΑΤΑ ΤΗ ΣΚΑΛΑ ΕΞΩ ΑΠΟ ΤΟΝ ΚΑΝΟΝΑ.**
   *
   * Στη σκάλα του §21.4 το `drawn` είναι **σκαλοπάτι 3** και το `osm` **σκαλοπάτι 4**·
   * στην **κατάταξη** όμως το `osm` είναι **3** και το `drawn` **2**. Οι δύο σειρές
   * **δεν** συμπίπτουν αριθμητικά, και το Κ7 παραπάνω περνά με **οποιαδήποτε** από τις
   * δύο. Αυτή εδώ ξεχωρίζει: η **γεωκωδικοποίηση** είναι σκαλοπάτι **1** και κατάταξη
   * **1**, ενώ το `manual` είναι σκαλοπάτι **2** και κατάταξη **2** — αλλά το
   * `survey` είναι σκαλοπάτι **6** και κατάταξη **4**, δηλαδή αν κάποιος συνέκρινε
   * **σκαλοπάτια**, ένα `document-only` (σκαλοπάτι **5**) θα ξεπερνούσε το `osm`.
   *
   * Επειδή το `document-only` **δεν είναι** προέλευση θέσης, ο μόνος τρόπος να
   * αποδειχθεί ότι ο κανόνας δεν κοιτάζει σκαλοπάτια είναι το ζεύγος όπου οι δύο
   * σειρές **αντιστρέφονται**: `drawn` (σκαλοπάτι 3 · κατάταξη 2) έναντι `manual`
   * (σκαλοπάτι 2 · κατάταξη 2) ⇒ **ισοβαθμία**, όχι νίκη του σκαλοπατιού 3.
   */
  it('Π1 — `drawn` ΔΕΝ ξεπερνά `manual` στη ΘΕΣΗ: ισόβαθμα, παρότι ψηλότερο σκαλοπάτι', () => {
    const manualLand = newPublicLand('land_1', { ...BASE, provenance: 'manual' }, AT);
    const { land, changed } = mergeIntoLand(manualLand, drawnFacts(), LATER);

    expect(changed).not.toContain('position');
    expect(land.position.kind === 'known' && land.position.provenance).toBe('manual');
  });

  /**
   * 🔑 **ΚΑΘΕ ΠΕΔΙΟ ΑΚΟΛΟΥΘΕΙ ΤΟΝ ΔΙΚΟ ΤΟΥ ΚΑΝΟΝΑ** — και αυτό **δεν** είναι
   * παράπλευρη συνέπεια, είναι κατά γράμμα το §14.3: *«κάθε πεδίο κουβαλά
   * **προέλευση**»*. Η θέση ισοβαθμεί και **μένει**· το εμβαδόν ήταν **άγνωστο** και
   * κάθε πηγή ανεβαίνει πάνω στο άγνωστο.
   *
   * ⚠️ Η άγκυρα γράφτηκε επειδή η πρώτη εκδοχή της Π1 απαιτούσε **κενό** `changed` και
   * απέτυχε — αποκαλύπτοντας ότι το «τίποτα δεν άλλαξε» ήταν **λάθος περιγραφή** της
   * σωστής συμπεριφοράς. Ένα test που θα «διορθωνόταν» χαλαρώνοντας τον κανόνα θα
   * είχε σβήσει πραγματική γνώση.
   *
   * 🔶 **Δηλωμένη συνέπεια τομέα**: επειδή `manual` και `drawn` ισοβαθμούν, ένας
   * άνθρωπος που πρώτα έβαλε πινέζα και μετά ζωγράφισε **δεν** αναβαθμίζει το σχήμα
   * της θέσης του — κερδίζει μόνο το εμβαδόν. Η κατάταξη είναι απόφαση του Β1
   * (§14.3: *«δηλωμένο από χρήστη»* = **μία** βαθμίδα) και **δεν αλλάζει εδώ σιωπηλά**.
   */
  it('Π1β — …αλλά το ΕΜΒΑΔΟΝ ανεβαίνει, γιατί ήταν άγνωστο', () => {
    const manualLand = newPublicLand('land_1', { ...BASE, provenance: 'manual' }, AT);
    expect(manualLand.areaSqm).toBeNull();

    const { land, changed } = mergeIntoLand(manualLand, drawnFacts(), LATER);

    expect(changed).toEqual(['areaSqm']);
    expect(land.areaSqm?.source).toBe('drawn');
  });

  it('Κ8 — άγνωστη θέση ⇒ ΚΑΘΕ προέλευση ανεβαίνει', () => {
    const blank = newPublicLand('land_1', geocodedFacts({ accuracy: null }), AT);
    expect(blank.position.kind).toBe('unknown');

    const { changed } = mergeIntoLand(blank, geocodedFacts(), LATER);
    expect(changed).toContain('position');
  });

  /**
   * ⚠️ Μια ισχυρότερη πηγή **θέσης** που δεν ξέρει διεύθυνση δεν επιτρέπεται να
   * **σβήσει** μια γνωστή: η νίκη αφορά τη θέση, όχι τη διαγραφή ό,τι άλλο υπήρχε.
   */
  it('Κ9 — ισχυρότερη θέση ΧΩΡΙΣ διεύθυνση δεν σβήνει την υπάρχουσα', () => {
    const withAddress = newPublicLand(
      'land_1',
      geocodedFacts({ displayAddress: 'Εγνατία 147, Θεσσαλονίκη' }),
      AT,
    );

    const { land, changed } = mergeIntoLand(withAddress, osmFacts({ displayAddress: null }), LATER);

    expect(changed).toContain('position');
    expect(changed).not.toContain('displayAddress');
    expect(land.displayAddress).toBe('Εγνατία 147, Θεσσαλονίκη');
  });

  it('Κ10 — το ΕΜΒΑΔΟΝ βγαίνει από το σχήμα, δεν ζητιέται', () => {
    const land = newPublicLand('land_1', drawnFacts(), AT);
    expect(land.areaSqm?.source).toBe('drawn');
    expect(land.areaSqm?.value).toBeGreaterThan(1000);
  });
});

// =============================================================================
describe('mergeIntoBuilding — γεγονότα, όχι μόνο θέση', () => {
  it('Κ11 — ισχυρότερη πηγή γεγονότος αντικαθιστά ορόφους', () => {
    const declared = newPublicBuilding(
      'pbld_1',
      'land_1',
      { ...BASE, provenance: 'manual', floorsAboveGround: 4 },
      AT,
    );

    const { building, changed } = mergeIntoBuilding(
      declared,
      osmFacts({ floorsAboveGround: 6 }),
      LATER,
    );

    expect(changed).toContain('floorsAboveGround');
    expect(building.floorsAboveGround?.value).toBe(6);
  });

  it('Κ12 — γεγονός που ΔΕΝ ξέρουμε δεν σβήνει αυτό που ξέρουμε', () => {
    const known = newPublicBuilding(
      'pbld_1',
      'land_1',
      osmFacts({ floorsAboveGround: 6 }),
      AT,
    );

    const { building } = mergeIntoBuilding(known, drawnFacts(), LATER);
    expect(building.floorsAboveGround?.value).toBe(6);
  });

  /** 🔶 Δηλωμένο: η **χρήση** χρειάζεται χαρτογράφηση προς κλειστό λεξιλόγιο (N.11). */
  it('Κ13 — το `useCode` γεννιέται ΠΑΝΤΑ null, ποτέ ωμή τιμή OSM', () => {
    expect(newPublicBuilding('pbld_1', 'land_1', osmFacts(), AT).useCode).toBeNull();
  });
});

// =============================================================================
describe('placeAddressLine — μία σύνθεση για δύο πηγές', () => {
  it('Κ14 — χωρίς οδό ⇒ null (η πόλη ΔΕΝ είναι διεύθυνση)', () => {
    expect(placeAddressLine({ street: null, houseNumber: null, city: 'Θεσσαλονίκη', postalCode: '54624' }))
      .toBeNull();
    expect(placeAddressLine({ street: '  ', houseNumber: null, city: 'Θεσσαλονίκη', postalCode: null }))
      .toBeNull();
  });

  it('Κ15 — με οδό συνθέτει, και ο Τ.Κ. παίρνει την ελληνική μορφή', () => {
    const line = placeAddressLine({
      street: 'Εγνατία',
      houseNumber: '147',
      city: 'Θεσσαλονίκη',
      postalCode: '54624',
    });

    expect(line).toContain('Εγνατία');
    expect(line).toContain('147');
    expect(line).toContain('546 24');
  });
});
