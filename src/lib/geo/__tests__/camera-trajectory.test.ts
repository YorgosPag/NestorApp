/**
 * @fileoverview **ΑΓΚΥΡΑ — ΤΟ ΟΡΓΑΝΟ ΞΕΧΩΡΙΖΕΙ ΠΤΗΣΗ, ΠΗΔΗΜΑ ΚΑΙ ΣΥΡΣΙΜΟ.**
 * @related lib/geo/camera-trajectory.ts · app/(bare)/test-harness/camera-motion
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΟΙ ΔΙΑΔΡΟΜΕΣ ΕΙΝΑΙ **ΧΕΙΡΟΓΡΑΦΕΣ** ΚΑΙ ΟΧΙ ΚΑΤΑΓΕΓΡΑΜΜΕΝΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αν οι διαδρομές έβγαιναν από τον πραγματικό χάρτη, το όργανο θα δοκιμαζόταν **με ό,τι
 * ο χάρτης τυχαίνει να κάνει σήμερα** — δηλαδή θα επικύρωνε τη σημερινή συμπεριφορά, όχι
 * την **ερώτηση**. Είναι ακριβώς το λάθος που έκανε η προηγούμενη άγκυρα, όταν απαίτησε
 * `maxDuration: expect.any(Number)` και **επικύρωσε τη βλάβη**.
 *
 * ⇒ Εδώ γράφονται **τρεις διαδρομές που ξέρουμε τι είναι**, και το όργανο πρέπει να τις
 * ξεχωρίσει. Ο πραγματικός χάρτης δοκιμάζεται **αλλού** *(harness + Playwright)*, και
 * δίνει **δεδομένα**, όχι κρίση.
 */

import {
  cameraTrajectory,
  didFly,
  readsAsJourney,
  LONG_HOP_DEGREES,
  MIN_ARC_DEPTH,
  MIN_PERCEPTIBLE_MS,
  type CameraSample,
} from '../camera-trajectory';

const ATHENS = { lat: 38.0160, lng: 23.7616 } as const;
const SALONICA = { lat: 40.6403, lng: 22.9444 } as const;

/** Γραμμική παρεμβολή ανάμεσα σε δύο σημεία, για να χτίζονται διαδρομές με το χέρι. */
const at = (t: number, from: typeof ATHENS, to: typeof SALONICA) => ({
  lat: from.lat + (to.lat - from.lat) * t,
  lng: from.lng + (to.lng - from.lng) * t,
});

/**
 * **ΠΤΗΣΗ** — ζουμάρει έξω ως το 8, μεταφέρεται, ξαναζουμάρει μέσα. Η υπογραφή van Wijk.
 * Δύο επιπλέον ακίνητα καρέ στο τέλος: ο δειγματολήπτης συνεχίζει μετά την προσγείωση.
 */
const FLIGHT: CameraSample[] = [
  { ms: 0,    zoom: 12, ...at(0,    ATHENS, SALONICA) },
  { ms: 500,  zoom: 10, ...at(0.15, ATHENS, SALONICA) },
  { ms: 1000, zoom: 8,  ...at(0.40, ATHENS, SALONICA) },
  { ms: 1500, zoom: 8,  ...at(0.60, ATHENS, SALONICA) },
  { ms: 2000, zoom: 10, ...at(0.85, ATHENS, SALONICA) },
  { ms: 2400, zoom: 12, ...at(1,    ATHENS, SALONICA) },
  { ms: 2900, zoom: 12, ...at(1,    ATHENS, SALONICA) },
  { ms: 3400, zoom: 12, ...at(1,    ATHENS, SALONICA) },
];

/** **ΠΗΔΗΜΑ** — ακριβώς η βλάβη του `maxDuration`: φτάνει σωστά, σε ένα καρέ. */
const TELEPORT: CameraSample[] = [
  { ms: 0,    zoom: 12, ...at(0, ATHENS, SALONICA) },
  { ms: 1,    zoom: 12, ...at(1, ATHENS, SALONICA) },
  { ms: 500,  zoom: 12, ...at(1, ATHENS, SALONICA) },
  { ms: 1000, zoom: 12, ...at(1, ATHENS, SALONICA) },
];

/** **ΣΥΡΣΙΜΟ** — σωστή διάρκεια, αλλά **ποτέ** δεν ζουμάρει έξω. */
const DRAG: CameraSample[] = [
  { ms: 0,    zoom: 12, ...at(0,    ATHENS, SALONICA) },
  { ms: 800,  zoom: 12, ...at(0.33, ATHENS, SALONICA) },
  { ms: 1600, zoom: 12, ...at(0.66, ATHENS, SALONICA) },
  { ms: 2400, zoom: 12, ...at(1,    ATHENS, SALONICA) },
  { ms: 2900, zoom: 12, ...at(1,    ATHENS, SALONICA) },
];

describe('Α. Η διάρκεια μετριέται ως «πότε ΣΤΑΜΑΤΗΣΕ», όχι «πότε σταμάτησα να κοιτάω»', () => {
  it('🔴 τα ακίνητα καρέ μετά την προσγείωση ΔΕΝ μετρούν στη διάρκεια', () => {
    /*
      Χωρίς αυτή τη διάκριση κάθε διαδρομή «θα διαρκούσε» όσο ο δειγματολήπτης, και το
      **πήδημα θα περνούσε για πτήση** — 1000 ms αντί για 1.
    */
    expect(cameraTrajectory(FLIGHT).durationMs).toBe(2400);
    expect(cameraTrajectory(TELEPORT).durationMs).toBe(1);
  });

  it('άδεια διαδρομή δεν σκάει, και δεν ισχυρίζεται κίνηση', () => {
    const empty = cameraTrajectory([]);
    expect(empty).toEqual({ durationMs: 0, frames: 0, arcDepth: 0, spanDegrees: 0 });
    expect(didFly(empty)).toBe(false);
  });
});

describe('Β. «Πέταξε;» — η ερώτηση που καμία από τις 13 πράσινες άγκυρες δεν έκανε', () => {
  it('🔴 ΤΟ ΠΗΔΗΜΑ ΚΟΚΚΙΝΙΖΕΙ — αυτό ακριβώς έφυγε στην παραγωγή με το `3d0d715e`', () => {
    expect(didFly(cameraTrajectory(TELEPORT))).toBe(false);
  });

  it('η πτήση και το σύρσιμο περνούν — και τα δύο ΚΙΝΟΥΝΤΑΙ', () => {
    expect(didFly(cameraTrajectory(FLIGHT))).toBe(true);
    expect(didFly(cameraTrajectory(DRAG))).toBe(true);
  });

  it('το κατώφλι κάθεται ΑΝΑΜΕΣΑ στους δύο μετρημένους πληθυσμούς', () => {
    /*
      🔑 Δεν ζητείται ακρίβεια — ζητείται **διαχωρισμός**. Οι σπασμένες πτήσεις μετρήθηκαν
      **1–2 ms**, οι υγιείς **733–3.824 ms**. Ένα κατώφλι οπουδήποτε ανάμεσά τους κάνει
      τη δουλειά· ένα κατώφλι έξω από το διάστημα την ακυρώνει σιωπηλά.
    */
    expect(MIN_PERCEPTIBLE_MS).toBeGreaterThan(2);
    expect(MIN_PERCEPTIBLE_MS).toBeLessThan(733);
  });
});

describe('Γ. 🏆 «Διαβάζεται ως ταξίδι;» — εκεί που Compose/Flutter σταματούν', () => {
  it('🔴 ΤΟ ΣΥΡΣΙΜΟ ΚΟΚΚΙΝΙΖΕΙ, ΠΑΡΟΛΟ ΠΟΥ Η ΔΙΑΡΚΕΙΑ ΤΟΥ ΕΙΝΑΙ ΣΩΣΤΗ', () => {
    /*
      🔑 **Η ΚΑΡΔΙΑ ΤΟΥ ΟΡΓΑΝΟΥ.** Το σύρσιμο έχει **ίδια διάρκεια** με την πτήση (2400 ms)
      και **ίδιο τέρμα**. Κάθε έλεγχος διάρκειας ή τελικής κατάστασης το περνά. Όμως ο
      άνθρωπος χάνει τα πάντα από τα μάτια του στη μέση, γιατί ο χάρτης δεν ανέβηκε ποτέ
      ψηλά. **Μόνο** το σχήμα της διαδρομής τα ξεχωρίζει.
    */
    const drag = cameraTrajectory(DRAG);
    expect(didFly(drag)).toBe(true);
    expect(drag.durationMs).toBe(cameraTrajectory(FLIGHT).durationMs);
    expect(readsAsJourney(drag)).toBe(false);
  });

  it('η πτήση περνά, και το βύθισμα μετριέται από ΚΑΙ ΤΑ ΔΥΟ άκρα', () => {
    const flight = cameraTrajectory(FLIGHT);
    expect(flight.arcDepth).toBe(4); // 12 → 8
    expect(readsAsJourney(flight)).toBe(true);
  });

  it('⚠️ ανηφορικό ζουμ ΔΕΝ περνά για καμπύλη — το βύθισμα δεν γίνεται ποτέ αρνητικό', () => {
    /*
      Μια κίνηση που απλώς ζουμάρει **μέσα** (12 → 17) δεν έχει καμπύλη· αν το `arcDepth`
      μετρούσε «διαφορά από την αρχή», θα έβγαζε αρνητικό και η σύγκριση θα περνούσε κατά
      λάθος σε κάποιον μελλοντικό χειρισμό.
    */
    const zoomIn = cameraTrajectory([
      { ms: 0,   zoom: 12, ...ATHENS },
      { ms: 600, zoom: 15, ...ATHENS },
      { ms: 900, zoom: 17, ...ATHENS },
      { ms: 1400, zoom: 17, ...ATHENS },
    ]);
    expect(zoomIn.arcDepth).toBe(0);
    expect(readsAsJourney(zoomIn)).toBe(false);
  });
});

describe('Δ. Το εύρος του άλματος — ποιος ΔΙΚΑΙΟΥΤΑΙ να απαιτήσει καμπύλη', () => {
  it('το μεγάλο άλμα ξεπερνά το όριο, το κοντινό όχι', () => {
    /*
      ⚠️ Χωρίς αυτόν τον διαχωρισμό η πύλη θα απαιτούσε καμπύλη και σε μετακίνηση δύο
      τετραγώνων — όπου ο van Wijk **σωστά** δεν βυθίζει το ζουμ. Θα ήταν λάθος απαίτηση,
      και θα οδηγούσε σε «διόρθωση» που χαλάει τις κοντινές κινήσεις.
    */
    expect(cameraTrajectory(FLIGHT).spanDegrees).toBeGreaterThan(LONG_HOP_DEGREES);

    const shortHop = cameraTrajectory([
      { ms: 0,   zoom: 12, lat: 38.0160, lng: 23.7616 },
      { ms: 400, zoom: 13, lat: 38.0000, lng: 23.7500 },
      { ms: 800, zoom: 14, lat: 37.9838, lng: 23.7420 },
      { ms: 1300, zoom: 14, lat: 37.9838, lng: 23.7420 },
    ]);
    expect(shortHop.spanDegrees).toBeLessThan(LONG_HOP_DEGREES);
    expect(didFly(shortHop)).toBe(true);
  });

  it('ένα επίπεδο ζουμ = διπλάσια κλίμακα· λιγότερο δεν είναι «από ψηλά»', () => {
    expect(MIN_ARC_DEPTH).toBeGreaterThanOrEqual(1);
  });
});
