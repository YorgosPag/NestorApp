/**
 * @fileoverview **ΑΓΚΥΡΑ — Η ΕΝΔΕΙΞΗ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ ΓΙΑ ΤΟ ΤΙ ΞΕΡΟΥΜΕ.**
 * @related lib/geo/geocoding-focus.ts · lib/geo/geo-ring.ts · ADR-777 §7 (Α5)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΚΛΑΣΗ, ΟΧΙ ΔΕΙΓΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η βλάβη της 2026-09-02 δεν ήταν *«ο χάρτης δεν κουνήθηκε»*. Ήταν ότι μια επιφάνεια
 * μπορούσε να δείξει **πινέζα** πάνω σε αποτέλεσμα που σήμαινε *«κάπου μέσα σε αυτή
 * την πόλη»* — και **τίποτα** δεν θα κοκκίνιζε. Η ένδειξη είναι **ισχυρισμός γνώσης**,
 * και ένας ισχυρισμός χωρίς άγκυρα είναι σχόλιο.
 *
 * 🔑 **Η άγκυρα της εξάντλησης είναι η σημαντικότερη εδώ**: κάθε βαθμός του
 * `GEOCODING_ACCURACIES` κρίνεται **από τον ίδιο τον πίνακα**, όχι από χειρόγραφη
 * λίστα. Αν αύριο προστεθεί βαθμός, ο μεταγλωττιστής σταματά στο `FALLBACK` **και**
 * αυτό το αρχείο τον δοκιμάζει αυτόματα — δύο ανεξάρτητα όργανα για την ίδια σιωπή.
 */

import { focusPresentation, shapeHasHalo, shapeHasPin, type PlaceFocus } from '../geocoding-focus';
import { geoCircleOutline } from '../geo-ring';
import { distanceMeters } from '../geo-distance';
import { GEOCODING_ACCURACIES, type GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

/** Θεσσαλονίκη — ο τόπος του περπατήματος που βρήκε τη βλάβη. */
const POINT = { lat: 40.6403, lng: 22.9444 } as const;

const focusOf = (accuracy: GeocodingAccuracy, extent?: GeoBoundingBox): PlaceFocus => ({
  point: POINT,
  accuracy,
  ...(extent === undefined ? {} : { extent }),
});

// =============================================================================
// Κ1 — Η ΠΙΝΕΖΑ ΕΙΝΑΙ ΙΣΧΥΡΙΣΜΟΣ, ΚΑΙ ΤΟΝ ΚΑΝΕΙ ΜΟΝΟ ΕΝΑΣ ΒΑΘΜΟΣ
// =============================================================================

describe('Κ1 — το σχήμα έρχεται από τον SSoT της Α5, όχι από εδώ', () => {
  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΔΙΚΟ ΜΑΣ ΛΑΘΟΣ** (2026-09-02). Η πρώτη γραφή αυτού
   * του module δήλωσε **δικό της** λεξιλόγιο (`'point' | 'area'`) και έδινε **σκέτο
   * κύκλο** στον δρόμο — ενώ ο πίνακας της **Α5** λέει ρητά `pin-with-ring`. Δύο
   * λεξιλόγια για την ίδια ερώτηση **είχαν ήδη διαφωνήσει** πριν δουν οθόνη.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα σε τοπικό `accuracy === 'exact' ? 'point' : 'area'` ⇒ **κόκκινο**.
   */
  it('🔴 ο ΔΡΟΜΟΣ παίρνει πινέζα ΚΑΙ δακτύλιο — όχι το ένα από τα δύο', () => {
    const street = focusPresentation(focusOf('interpolated'));

    expect(street.shape).toBe('pin-with-ring');
    expect(shapeHasPin(street.shape)).toBe(true);
    expect(shapeHasHalo(street.shape)).toBe(true);
  });

  it('🔴 ο `center` ΔΕΝ παίρνει ΠΟΤΕ πινέζα, και ξεχωρίζει από τη συνοικία', () => {
    const settlement = focusPresentation(focusOf('center'));
    const suburb = focusPresentation(focusOf('approximate'));

    expect(shapeHasPin(settlement.shape)).toBe(false);
    expect(settlement.shape).toBe('shaded-city');
    // Δύο ΔΙΑΦΟΡΕΤΙΚΑ σχήματα: η πρώτη γραφή τα ισοπέδωνε και τα δύο σε «area».
    expect(suburb.shape).toBe('shaded-circle');
    expect(settlement.shape).not.toBe(suburb.shape);
  });

  it('🔴 ο `exact` παίρνει σκέτη πινέζα — καμία επιφύλαξη να ζωγραφιστεί', () => {
    const roof = focusPresentation(focusOf('exact'));
    expect(roof.shape).toBe('pin');
    expect(shapeHasPin(roof.shape)).toBe(true);
    expect(shapeHasHalo(roof.shape)).toBe(false);
  });

  /**
   * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ ΨΕΜΑΤΟΣ.** Χωρίς αυτό, ένα σχήμα με επιφύλαξη αλλά χωρίς
   * ακτίνα θα περνούσε τα παραπάνω και θα ζωγράφιζε **τίποτα**: η επιφύλαξη θα
   * εξαφανιζόταν σιωπηλά και ο άνθρωπος θα έβλεπε γυμνό χάρτη — «καμία αμφιβολία».
   */
  it('🔴 κάθε σχήμα με επιφύλαξη κουβαλά ΑΚΤΙΝΑ', () => {
    for (const accuracy of GEOCODING_ACCURACIES) {
      const { shape, uncertaintyMetres } = focusPresentation(focusOf(accuracy));
      if (shapeHasHalo(shape)) expect(uncertaintyMetres).toBeGreaterThan(0);
      else expect(uncertaintyMetres).toBeNull();
    }
  });

  /** Κάθε βαθμός του λεξιλογίου έχει προβολή — ο πίνακας ρωτιέται, δεν αντιγράφεται. */
  it('η αλυσίδα καλύπτει ΟΛΟ το λεξιλόγιο, χωρίς χειρόγραφη λίστα', () => {
    for (const accuracy of GEOCODING_ACCURACIES) {
      const presentation = focusPresentation(focusOf(accuracy));
      expect(presentation.frame.kind).toBe('zoom');
      if (presentation.frame.kind === 'zoom') {
        expect(presentation.frame.zoom).toBeGreaterThan(0);
      }
    }
  });
});

// =============================================================================
// Κ2 — Η ΜΕΤΡΗΣΗ ΝΙΚΑ ΤΟΝ ΠΙΝΑΚΑ, ΠΑΝΤΑ ΚΑΙ ΜΟΝΟΔΡΟΜΑ
// =============================================================================

describe('Κ2 — η μετρημένη έκταση υπερισχύει του πίνακα', () => {
  /** Δύο δρόμοι με **τον ίδιο βαθμό** και εντελώς διαφορετικό μέγεθος. */
  const TINY: GeoBoundingBox = { south: 40.6400, north: 40.6406, west: 22.9441, east: 22.9447 };
  const HUGE: GeoBoundingBox = { south: 40.60, north: 40.68, west: 22.90, east: 22.99 };

  /** ⛔ ΜΕΤΑΛΛΑΞΗ: αγνόησε το `focus.extent` ⇒ **κόκκινο**. */
  it('🔴 ίδιος βαθμός + άλλη έκταση ⇒ ΑΛΛΗ προβολή — αυτό ο πίνακας δεν μπορεί', () => {
    const tiny = focusPresentation(focusOf('interpolated', TINY));
    const huge = focusPresentation(focusOf('interpolated', HUGE));

    expect(tiny.frame).toEqual({ kind: 'extent', extent: TINY });
    expect(huge.frame).toEqual({ kind: 'extent', extent: HUGE });
    // Το ουσιώδες: **δεν** είναι η ίδια απάντηση, παρότι ο βαθμός ταυτίζεται.
    expect(huge.uncertaintyMetres).toBeGreaterThan((tiny.uncertaintyMetres ?? 0) * 10);
  });

  it('χωρίς έκταση, πέφτει στον πίνακα — και το δηλώνει ως `zoom`', () => {
    const framed = focusPresentation(focusOf('approximate'));
    expect(framed.frame.kind).toBe('zoom');
    expect(framed.uncertaintyMetres).toBe(500);
  });

  /**
   * 🔑 **Η στέγη ΔΕΝ κορνιζάρεται από την έκταση**, ακόμη κι όταν ο πάροχος τη στέλνει
   * (το περίγραμμα του κτιρίου): ένα `fitBounds` σε κτίριο 12 μέτρων θα ζουμάριζε τόσο
   * που ο άνθρωπος θα έχανε κάθε αναγνωρίσιμο σημείο γύρω — προβολή τεχνικά σωστή και
   * πρακτικά τυφλή.
   */
  it('🔑 ο `exact` αγνοεί την έκταση και μένει στο ζουμ κτιρίου', () => {
    const presentation = focusPresentation(focusOf('exact', TINY));
    expect(presentation.frame).toEqual({ kind: 'zoom', zoom: 18 });
    expect(presentation.uncertaintyMetres).toBeNull();
  });

  /** Η ακτίνα **περικλείει** την έκταση — δες `extentRadiusMetres`. */
  it('η ακτίνα περικλείει την έκταση, δεν λείπει από αυτήν', () => {
    const { uncertaintyMetres } = focusPresentation(focusOf('center', HUGE));
    const halfHeight =
      distanceMeters({ lat: HUGE.south, lng: HUGE.west }, { lat: HUGE.north, lng: HUGE.west }) / 2;

    expect(uncertaintyMetres).toBeGreaterThanOrEqual(halfHeight);
  });
});

// =============================================================================
// Κ3 — Ο ΚΥΚΛΟΣ ΕΙΝΑΙ ΟΝΤΩΣ ΚΥΚΛΟΣ, ΣΕ ΜΕΤΡΑ
// =============================================================================

describe('Κ3 — ο κύκλος της αβεβαιότητας', () => {
  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γράψε τον κύκλο σε **μοίρες** αντί για μέτρα ⇒ **κόκκινο**.
   *
   * 🔑 Είναι η κλασική σιωπηλή βλάβη: σε γεωγραφικό πλάτος 40° ένας «κύκλος» σταθερής
   * γωνιακής ακτίνας είναι **έλλειψη** — 1,3 φορές πιο πλατιά από ψηλή. Θα φαινόταν
   * σχεδόν σωστός, και θα υπόσχονταν άλλη απόσταση οριζόντια από κάθετα.
   */
  it('🔴 κάθε κορυφή απέχει την ΑΚΤΙΝΑ από το κέντρο — σε μέτρα, όχι μοίρες', () => {
    const ring = geoCircleOutline(POINT, 500);
    expect(ring).not.toBeNull();

    for (const vertex of ring ?? []) {
      expect(distanceMeters(POINT, vertex)).toBeCloseTo(500, 0);
    }
  });

  it('είναι σχήμα, όχι σημείο — αρκετές κορυφές ώστε να διαβάζεται ως κύκλος', () => {
    expect((geoCircleOutline(POINT, 100) ?? []).length).toBe(64);
  });

  /**
   * 🔑 **Μη θετική ακτίνα ⇒ `null`, ΠΟΤΕ δακτύλιος 64 ταυτόσημων κορυφών.** Ο δεύτερος
   * θα περνούσε κάθε έλεγχο πλήθους και θα ζωγράφιζε το τίποτα — «σχήμα» που υπάρχει
   * στα δεδομένα και λείπει από την οθόνη.
   */
  it('🔴 ακτίνα μηδέν ή αρνητική δεν γίνεται εκφυλισμένο σχήμα', () => {
    expect(geoCircleOutline(POINT, 0)).toBeNull();
    expect(geoCircleOutline(POINT, -5)).toBeNull();
    expect(geoCircleOutline(POINT, Number.NaN)).toBeNull();
  });
});
