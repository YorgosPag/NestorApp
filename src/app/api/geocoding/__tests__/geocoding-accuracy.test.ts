/**
 * Άγκυρες της **ΑΚΡΙΒΕΙΑΣ** — η συνάρτηση που είχε **μηδέν** άγκυρες.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΙΝΑΙ ΣΟΒΑΡΟ ΟΤΙ ΕΛΕΙΠΑΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η {@link determineAccuracy} κρίνει την ακρίβεια **κάθε** γεωκωδικοποιημένης
 * διεύθυνσης του έργου, και η έξοδός της οδηγεί — μέσω του `listingMapShape` (Α5,
 * κανόνας 27) — **το σχήμα στον δημόσιο χάρτη**. Δηλαδή ένα λάθος εδώ δεν είναι
 * εσωτερικό: ζωγραφίζεται στον επισκέπτη ως ισχυρισμός γνώσης.
 *
 * Αναζήτηση του ονόματος μέσα σε φακέλους `__tests__` → **0** μέχρι τις 2026-09-02.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΒΡΕΘΗΚΕ ΠΕΡΠΑΤΩΝΤΑΣ, ΟΧΙ ΔΙΑΒΑΖΟΝΤΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο Giorgio πληκτρολόγησε **«Σαμοθράκης 16, 56334»** και ρώτησε γιατί ο χάρτης δείχνει
 * **κύκλο μεγάλης ακτίνας** αντί για το σημείο. Η απάντηση ήταν ότι ο δρόμος
 * «Σαμοθράκης» (`highway=residential`) βαθμολογούνταν ως **συνοικία** — γιατί η παλιά
 * συνθήκη ταίριαζε το `type === 'residential'` **χωρίς να ρωτήσει το `class`**, όπου
 * το ίδιο όνομα σημαίνει δρόμο, κτίριο ή ζώνη γης.
 */

/* global describe, it, expect */

import { determineAccuracy } from '../geocoding-engine-helpers';

type Result = Parameters<typeof determineAccuracy>[0];

const hit = (fields: Partial<Result>): Result =>
  ({ lat: '40.64', lon: '22.94', display_name: 'x', ...fields }) as Result;

// =============================================================================
// Κ1 — ΤΟ ΤΡΙΠΛΑ ΑΜΦΙΣΗΜΟ `residential`
// =============================================================================

describe('Κ1 — το `residential` κρίνεται από το `class`, ποτέ μόνο του', () => {
  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα στο `type === 'residential' ⇒ approximate` ⇒ **κόκκινο σε 2/3**.
   *
   * 🔑 Οι τρεις γραμμές είναι **η ίδια τιμή `type`** με τρεις σημασίες. Μια δοκιμή που
   * έλεγχε μόνο μία από αυτές θα ήταν πράσινη πάνω στο σφάλμα.
   */
  it('🔴 `highway=residential` είναι ΔΡΟΜΟΣ — αυτό ήταν η βλάβη της 02/09', () => {
    expect(determineAccuracy(hit({ class: 'highway', type: 'residential', place_rank: 26 })))
      .toBe('interpolated');
  });

  it('🔴 `building=residential` είναι ΚΤΙΡΙΟ — υποβαθμιζόταν κατά ΔΥΟ βαθμίδες', () => {
    expect(determineAccuracy(hit({ class: 'building', type: 'residential', place_rank: 30 })))
      .toBe('exact');
  });

  it('`landuse=residential` είναι όντως ΖΩΝΗ — η μόνη από τις τρεις που ήταν σωστή', () => {
    expect(determineAccuracy(hit({ class: 'landuse', type: 'residential', place_rank: 22 })))
      .toBe('approximate');
  });
});

// =============================================================================
// Κ2 — Η ΕΠΙΣΗΜΗ ΚΛΙΜΑΚΑ ΝΙΚΑ ΤΑ ΟΝΟΜΑΤΑ
// =============================================================================

describe('Κ2 — `place_rank`: η κλίμακα του παρόχου', () => {
  /** ⛔ ΜΕΤΑΛΛΑΞΗ: αγνόησε το `place_rank` ⇒ **κόκκινο**. */
  it('🔴 άγνωστη ετικέτα με βαθμίδα διεύθυνσης δίνει `exact` — χωρίς να ξέρουμε το όνομα', () => {
    expect(determineAccuracy(hit({ class: 'κάτι', type: 'άγνωστο', place_rank: 30 })))
      .toBe('exact');
  });

  it('η κλίμακα καλύπτει και τις τέσσερις βαθμίδες, στα όριά τους', () => {
    expect(determineAccuracy(hit({ place_rank: 28 }))).toBe('exact');
    expect(determineAccuracy(hit({ place_rank: 27 }))).toBe('interpolated');
    expect(determineAccuracy(hit({ place_rank: 26 }))).toBe('interpolated');
    expect(determineAccuracy(hit({ place_rank: 25 }))).toBe('approximate');
    expect(determineAccuracy(hit({ place_rank: 20 }))).toBe('approximate');
    expect(determineAccuracy(hit({ place_rank: 19 }))).toBe('center');
    expect(determineAccuracy(hit({ place_rank: 8 }))).toBe('center');
  });

  /**
   * 🔑 **Ο ΑΡΙΘΜΟΣ ΕΙΝΑΙ ΑΠΟΔΕΙΞΗ, Η ΒΑΘΜΙΔΑ ΕΝΔΕΙΞΗ.** Το Nominatim προσαρτά διεύθυνση
   * σε αντικείμενα που δεν βαθμολογούνται ως διευθύνσεις (ένα κατάστημα, μια είσοδος).
   * Αν ξέρουμε τον αριθμό, ξέρουμε πού είναι — και η βαθμίδα δεν το αναιρεί.
   */
  it('🔴 δηλωμένος αριθμός νικά ΚΑΙ τη βαθμίδα', () => {
    expect(
      determineAccuracy(hit({ class: 'shop', type: 'bakery', place_rank: 20, address: { house_number: '16' } })),
    ).toBe('exact');
  });
});

// =============================================================================
// Κ3 — Η ΕΦΕΔΡΕΙΑ, ΟΤΑΝ ΛΕΙΠΕΙ Η ΒΑΘΜΙΔΑ
// =============================================================================

describe('Κ3 — χωρίς `place_rank`, τα ονόματα ρωτούν το `class`', () => {
  /**
   * 🔴 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ ΕΦΕΔΡΕΙΑΣ.** Χωρίς αυτόν, η Κ1/Κ2 θα ήταν πράσινες σε
   * υλοποίηση που πέφτει σιωπηλά στο `'center'` όποτε λείπει βαθμίδα — υποβάθμιση
   * κάθε μη τυπικής απάντησης σε «μόνο πόλη», που **μοιάζει με δεδομένο**.
   */
  it('🔴 δρόμος χωρίς βαθμίδα μένει δρόμος, δεν πέφτει σε «μόνο πόλη»', () => {
    expect(determineAccuracy(hit({ class: 'highway', type: 'residential' }))).toBe('interpolated');
    expect(determineAccuracy(hit({ class: 'highway', type: 'tertiary' }))).toBe('interpolated');
  });

  it('κτίριο και διεύθυνση χωρίς βαθμίδα δίνουν `exact`', () => {
    expect(determineAccuracy(hit({ class: 'building', type: 'yes' }))).toBe('exact');
    expect(determineAccuracy(hit({ class: 'place', type: 'house' }))).toBe('exact');
  });

  it('ό,τι δεν αναγνωρίζεται μένει `center` — η ειλικρινής άγνοια', () => {
    expect(determineAccuracy(hit({ class: 'place', type: 'city' }))).toBe('center');
    expect(determineAccuracy(hit({}))).toBe('center');
  });
});
