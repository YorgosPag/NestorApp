/**
 * ΑΓΚΥΡΕΣ — **η κληρονομιά αρχικής θέσης** (ADR-777 §8.58.7)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δύο ιδιότητες που **δεν φαίνονται ποτέ στην οθόνη** και σπάνε σιωπηλά:
 *
 * 1. **Η ΛΗΘΗ** (Θ5). Χωρίς `forgetPhotoPosition`, ο πίνακας μεγαλώνει με κάθε αγγελία
 *    που πέρασε ποτέ από την οθόνη. Διαρροή που **καμία** οπτική επιθεώρηση δεν βλέπει
 *    και μόνο η πραγματική χρήση μεγαλώνει.
 * 2. **ΤΟ ΨΑΛΙΔΙΣΜΑ** (Θ4). Ο κατάλογος είναι **ζωντανός**: μια αγγελία μπορεί να χάσει
 *    φωτογραφίες ενώ η κάρτα της είναι στην οθόνη. Χωρίς όριο, η φούσκα θα ζητούσε να
 *    κυλήσει σε slide **που δεν υπάρχει** — και θα έμενε λευκή.
 */

import {
  notePhotoPosition,
  forgetPhotoPosition,
  photoPositionFor,
} from '../listing-photo-position';

const A = 'prop_a0000001-7777-4aaa-8aaa-000000000001';
const B = 'prop_b0000002-7777-4aaa-8aaa-000000000002';

// ⚠️ Ο πίνακας είναι singleton επιπέδου module: χωρίς αυτό, η σειρά εκτέλεσης των
//    δοκιμών θα ήταν κρυφή είσοδος — δηλαδή δοκιμές που περνούν μόνες και πέφτουν μαζί.
afterEach(() => {
  forgetPhotoPosition(A);
  forgetPhotoPosition(B);
});

describe('ADR-777 §8.58.7 — «από ποια φωτογραφία ξεκινά η φούσκα;»', () => {
  it('Θ1 — άγνωστη αγγελία ⇒ η ΠΡΩΤΗ, ποτέ σφάλμα', () => {
    // Το `0` δεν είναι προεπιλογή από τεμπελιά: όταν η κάρτα δεν ξεφυλλίστηκε ποτέ,
    // «η πρώτη» ΕΙΝΑΙ η σωστή απάντηση.
    expect(photoPositionFor(A, 5)).toBe(0);
  });

  it('Θ2 — ό,τι δήλωσε η κάρτα, το διαβάζει η φούσκα', () => {
    notePhotoPosition(A, 3);
    expect(photoPositionFor(A, 5)).toBe(3);
  });

  it('Θ3 — οι αγγελίες δεν μπερδεύονται μεταξύ τους', () => {
    notePhotoPosition(A, 3);
    notePhotoPosition(B, 1);

    expect(photoPositionFor(A, 5)).toBe(3);
    expect(photoPositionFor(B, 5)).toBe(1);
  });

  it('Θ4 — 🔴 Ο ΖΩΝΤΑΝΟΣ ΚΑΤΑΛΟΓΟΣ: η αγγελία έχασε φωτογραφίες ⇒ ΠΡΩΤΗ, ποτέ ανύπαρκτο slide', () => {
    notePhotoPosition(A, 4);

    // Ήταν 6 φωτογραφίες, έγιναν 2. Το `4` δείχνει σε slide που δεν υπάρχει.
    expect(photoPositionFor(A, 2)).toBe(0);
    // Και το ακριβές όριο: ο δείκτης `2` σε σύνολο `2` είναι ήδη εκτός (0,1).
    notePhotoPosition(A, 2);
    expect(photoPositionFor(A, 2)).toBe(0);
    notePhotoPosition(A, 1);
    expect(photoPositionFor(A, 2)).toBe(1);
  });

  it('Θ5 — 🔴 Η ΛΗΘΗ: η κάρτα έφυγε ⇒ η γραμμή σβήνει, και η επόμενη ερώτηση απαντά «πρώτη»', () => {
    notePhotoPosition(A, 3);
    expect(photoPositionFor(A, 5)).toBe(3);

    forgetPhotoPosition(A);

    // «Δεν ξέρω» είναι **σωστότερη** απάντηση από «τι κοίταζε κάποτε»: αν η κάρτα δεν
    // είναι στο DOM, δεν υπάρχει «μόλις τώρα».
    expect(photoPositionFor(A, 5)).toBe(0);
  });

  it('Θ6 — αγγελία ΧΩΡΙΣ φωτογραφίες ⇒ 0, χωρίς να ρωτηθεί ο πίνακας', () => {
    notePhotoPosition(A, 3);
    expect(photoPositionFor(A, 0)).toBe(0);
  });

  it('Θ7 — 🔴 ΜΗΔΕΝ ΣΥΝΔΡΟΜΗΤΕΣ: το άρθρωμα ΔΕΝ εκθέτει `subscribe` — η απουσία είναι η απόφαση', () => {
    /*
      Ένα `subscribe` εδώ θα ξανάφερνε τον αμφίδρομο συγχρονισμό που το §8.58.7
      απέρριψε — από την πίσω πόρτα, και χωρίς να το προσέξει κανείς σε αναθεώρηση.
      Η άγκυρα **εκτελεί** την απαγόρευση αντί να τη γράψει σε σχόλιο.
    */
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const surface = require('../listing-photo-position') as Record<string, unknown>;

    expect(Object.keys(surface).sort()).toEqual([
      'forgetPhotoPosition',
      'notePhotoPosition',
      'photoPositionFor',
    ]);
  });
});
