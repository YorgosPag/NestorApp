/**
 * @fileoverview **ΑΓΚΥΡΑ — Η ΚΑΜΕΡΑ ΑΚΟΛΟΥΘΕΙ ΤΗ ΔΗΛΩΣΗ** *(ADR-846 Φάση 4)*.
 * @related lib/agency/coverage-camera · components/geo/use-camera-frame · types/geo/camera-frame
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΥΜΠΤΩΜΑ ΠΟΥ ΕΠΙΒΙΩΝΕ ΔΥΟ ΦΑΣΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `PlaceMap` διαβάζει `center`/`initialZoom` **μία φορά**. Άρα ο επαγγελματίας που
 * άλλαζε βήμα ακτίνας *(Φ2)* έβλεπε τον κύκλο να μεγαλώνει **έξω από το κάδρο**, και
 * αυτός που επέστρεφε σε δημοσιευμένο πολύγωνο *(Φ3)* έβλεπε τον χάρτη στην αρχική
 * θέση με το σχήμα του **πουθενά**. Καμία από τις δύο δεν έσκαγε.
 *
 * ⚠️ **Η ερώτηση «έφτασε το prop;» ΔΕΝ ΤΟ ΠΙΑΝΕΙ** — το prop έφτανε μια χαρά. Η ερώτηση
 * είναι *«κουνήθηκε ο χάρτης;»*, και αυτό το αρχείο **εκτελεί** τον κύκλο ζωής και
 * μετρά **τι κλήθηκε πάνω στον χάρτη** — ίδιο ιδίωμα με το `use-focus-camera.test`.
 *
 * ⚠️ **Καμία εξάρτηση από MapLibre**: ο χάρτης εδώ είναι δύο `jest.fn()`.
 */

import React from 'react';
import { render } from '@testing-library/react';
import type { MapRef } from 'react-map-gl/maplibre';

import { useCameraFrame } from '@/components/geo/use-camera-frame';
import { useFocusCamera } from '@/components/geo/use-focus-camera';
import { COVERAGE_MAP_HEIGHT_PX, coverageCameraFrame } from '../coverage-camera';
import { asCoverageRadiusKm, type DeclaredCoverage } from '@/types/agency-coverage';
import type { CameraFrame } from '@/types/geo/camera-frame';
import type { GeoOutline } from '@/types/geo/coordinates';

const ATHENS = { lat: 37.9838, lng: 23.7275 } as const;

/** Το δοκιμαστικό τετράγωνο γύρω από Αθήνα/Πειραιά — ~519,8 τ.χλμ. */
const SQUARE: GeoOutline = [
  { lat: 38.0551, lng: 23.6081 },
  { lat: 38.0551, lng: 23.9597 },
  { lat: 37.9034, lng: 23.9597 },
  { lat: 37.9034, lng: 23.6081 },
];

function radius(km: number): DeclaredCoverage {
  const radiusKm = asCoverageRadiusKm(km);
  if (radiusKm === null) throw new Error(`Το ${km} δεν είναι νόμιμο βήμα ακτίνας`);
  return { circle: { center: ATHENS, radiusKm } };
}

function fakeMap() {
  const flyTo = jest.fn();
  const fitBounds = jest.fn();
  const ref = { current: { flyTo, fitBounds } as unknown as MapRef };
  return { ref, flyTo, fitBounds };
}

/** Σκέτο κέλυφος — ο κύκλος ζωής του React είναι το όργανο, όχι το DOM. */
function Harness({
  mapRef,
  frame,
}: {
  readonly mapRef: React.RefObject<MapRef | null>;
  readonly frame: CameraFrame | null;
}): React.ReactElement {
  useCameraFrame(mapRef, true, frame);
  return <div />;
}

// =============================================================================
// Κ1 — Η ΑΚΤΙΝΑ: ΚΑΘΕ ΑΛΛΑΓΗ ΒΗΜΑΤΟΣ ΑΞΙΖΕΙ ΠΤΗΣΗ
// =============================================================================

describe('Κ1 · ο κύκλος μένει στο κάδρο όταν αλλάζει το βήμα', () => {
  /** ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα το `fit` σε `initialZoom` ⇒ **κόκκινο**. */
  it('🔴 αλλαγή 10 → 50 χλμ ΞΑΝΑΠΕΤΑ την κάμερα, με ΜΙΚΡΟΤΕΡΟ ζουμ', () => {
    const { ref, flyTo } = fakeMap();
    const { rerender } = render(<Harness mapRef={ref} frame={coverageCameraFrame(radius(10))} />);
    expect(flyTo).toHaveBeenCalledTimes(1);

    rerender(<Harness mapRef={ref} frame={coverageCameraFrame(radius(50))} />);
    expect(flyTo).toHaveBeenCalledTimes(2);

    const [near] = flyTo.mock.calls[0] as [{ zoom: number }];
    const [far] = flyTo.mock.calls[1] as [{ zoom: number }];
    // Μεγαλύτερος κύκλος ⇒ **πιο μακριά** η κάμερα. Η φορά είναι το νόημα.
    expect(far.zoom).toBeLessThan(near.zoom);
  });

  /**
   * 🔑 **Η ταυτότητα ΚΑΤΑ ΤΙΜΗ**, όχι κατά αντικείμενο. Το καρέ χτίζεται μέσα σε render,
   * άρα είναι **νέο αντικείμενο κάθε φορά**· χωρίς την υπογραφή, ο χάρτης θα ζούσε σε
   * μόνιμη κίνηση σε κάθε πάτημα πλήκτρου του γονέα.
   */
  it('🔴 ΙΔΙΑ δήλωση ξανά ⇒ ΚΑΜΙΑ δεύτερη πτήση', () => {
    const { ref, flyTo } = fakeMap();
    const { rerender } = render(<Harness mapRef={ref} frame={coverageCameraFrame(radius(20))} />);
    rerender(<Harness mapRef={ref} frame={coverageCameraFrame(radius(20))} />);
    expect(flyTo).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Κ2 — ΤΟ ΠΟΛΥΓΩΝΟ: ΤΟ ΚΕΝΤΡΟ ΤΟΥ ΣΧΗΜΑΤΟΣ, ΟΧΙ Η ΠΡΩΤΗ ΚΟΡΥΦΗ
// =============================================================================

describe('Κ2 · το χαραγμένο σχήμα χωράει ολόκληρο', () => {
  it('🔴 η κάμερα πάει στο ΚΕΝΤΡΟ του αποτυπώματος, όχι σε κορυφή', () => {
    const frame = coverageCameraFrame({ outline: SQUARE });
    expect(frame?.kind).toBe('point');
    if (frame?.kind !== 'point') throw new Error('περιμέναμε καρέ σημείου');

    // Το κέντρο πέφτει **μέσα** στο τετράγωνο, και δεν ταυτίζεται με καμία κορυφή.
    expect(frame.point.lat).toBeGreaterThan(37.9034);
    expect(frame.point.lat).toBeLessThan(38.0551);
    for (const vertex of SQUARE) {
      expect(`${frame.point.lat},${frame.point.lng}`).not.toBe(`${vertex.lat},${vertex.lng}`);
    }
  });

  /**
   * ⚠️ **Ο κύκλος και το πολύγωνο απαντούν στην ΙΔΙΑ ερώτηση.** Το τετράγωνο έχει
   * περιγεγραμμένη ακτίνα ~19 χλμ, άρα το ζουμ του πρέπει να πέφτει **ανάμεσα** στα
   * ζουμ των 10 και 50 χλμ. Αν κάποιος έβαζε δεύτερη φόρμουλα για τα πολύγωνα, αυτό
   * θα έσπαγε — και δεν θα το έβλεπε καμία άλλη άγκυρα.
   */
  it('🔴 το ζουμ του πολυγώνου βγαίνει από τον ΙΔΙΟ SSoT με τον κύκλο', () => {
    const outline = coverageCameraFrame({ outline: SQUARE });
    const near = coverageCameraFrame(radius(10));
    const far = coverageCameraFrame(radius(50));
    if (outline?.kind !== 'point' || near?.kind !== 'point' || far?.kind !== 'point') {
      throw new Error('περιμέναμε τρία καρέ σημείου');
    }
    expect(outline.zoom).toBeLessThan(near.zoom);
    expect(outline.zoom).toBeGreaterThan(far.zoom);
  });
});

// =============================================================================
// Κ3 — «ΔΕΝ ΞΕΡΩ ΠΟΥ ΝΑ ΚΟΙΤΑΞΩ» ΣΗΜΑΙΝΕΙ «ΜΗΝ ΚΟΥΝΗΘΕΙΣ»
// =============================================================================

describe('Κ3 · δήλωση χωρίς γεωμετρία δεν κουνά την κάμερα', () => {
  it.each<[string, DeclaredCoverage | null]>([
    ['όλη η Ελλάδα', { nationwide: true }],
    ['διοικητικές οντότητες', { adminIds: ['municipality:4501'] }],
    ['καμία δήλωση', null],
  ])('🔴 «%s» ⇒ κανένα καρέ, καμία κίνηση', (_name, coverage) => {
    expect(coverageCameraFrame(coverage)).toBeNull();

    const { ref, flyTo, fitBounds } = fakeMap();
    render(<Harness mapRef={ref} frame={coverageCameraFrame(coverage)} />);
    // ⚠️ **Ούτε επαναφορά στην αρχή** — ο άνθρωπος κοιτάζει κάπου· δεν του το παίρνουμε.
    expect(flyTo).not.toHaveBeenCalled();
    expect(fitBounds).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Κ4 — ΜΙΑ ΜΗΧΑΝΗ ΚΙΝΗΣΗΣ, ΔΥΟ ΛΕΞΙΛΟΓΙΑ
// =============================================================================

describe('Κ4 · ο γεωκωδικοποιητής και η δήλωση ΜΟΙΡΑΖΟΝΤΑΙ την πτήση', () => {
  /**
   * 🔑 **Η ερώτηση που κανένα άλλο κριτήριο δεν κάνει**: *«υπάρχει δεύτερη υλοποίηση
   * πτήσης που μπορεί να αποκλίνει;»*. Οι τέσσερις αποφάσεις της κίνησης — διάρκεια,
   * περιθώριο, ταβάνι ζουμ, ταυτότητα κατά τιμή — είναι **όλες** πληρωμένες με
   * περιστατικό. Δύο αντίγραφά τους θα απέκλιναν σιωπηλά: ο ένας χάρτης θα πετούσε και
   * ο άλλος θα πηδούσε, **χωρίς κανείς να το αποφασίσει**.
   */
  it('🔴 ίδιο σημείο+ζουμ από τις ΔΥΟ διαδρομές ⇒ ΤΑΥΤΟΣΗΜΗ κλήση στον χάρτη', () => {
    const viaCoverage = fakeMap();
    const viaFocus = fakeMap();

    render(<Harness mapRef={viaCoverage.ref} frame={{ kind: 'point', point: ATHENS, zoom: 12 }} />);

    function FocusHarness(): React.ReactElement {
      useFocusCamera(viaFocus.ref, true, { point: ATHENS, accuracy: 'exact' });
      return <div />;
    }
    render(<FocusHarness />);

    const [fromCoverage] = viaCoverage.flyTo.mock.calls[0] as [Record<string, unknown>];
    const [fromFocus] = viaFocus.flyTo.mock.calls[0] as [Record<string, unknown>];

    // Ίδιο κέντρο, **ίδια διάρκεια** — το ζουμ διαφέρει γιατί το επιλέγει ο βαθμός.
    expect(fromCoverage.center).toEqual(fromFocus.center);
    expect(fromCoverage.duration).toBe(fromFocus.duration);
  });

  /**
   * 🔴 **Ο ΦΡΟΥΡΟΣ ΤΟΥ ΨΕΜΑΤΟΣ ΣΤΗΝ ΟΘΟΝΗ.** Το `PlaceFocus` κουβαλά βαθμό βεβαιότητας
   * και το `PlaceMap` τον **ζωγραφίζει ως φωτοστέφανο**. Αν κάποιος «ενοποιήσει» τα δύο
   * λεξιλόγια βάζοντας `accuracy` στο καρέ, η **δήλωση ανθρώπου** θα αποκτούσε οπτικά
   * περιθώριο σφάλματος **που δεν υπάρχει**. Το κριτήριο απαριθμεί τα κλειδιά.
   */
  it('🔴 το καρέ της εμβέλειας ΔΕΝ κουβαλά καμία έννοια βεβαιότητας', () => {
    const frame = coverageCameraFrame(radius(30));
    expect(frame).not.toBeNull();
    expect(Object.keys(frame!).sort()).toEqual(['kind', 'point', 'zoom']);
  });
});

// =============================================================================
// Κ5 — ΤΟ ΥΨΟΣ ΤΟΥ ΧΑΡΤΗ ΕΙΝΑΙ ΜΙΑ ΤΙΜΗ
// =============================================================================

describe('Κ5 · το ύψος δεν ζει σε τρία αντίγραφα', () => {
  /**
   * 🔴 Το `256` ήταν γραμμένο **τρεις** φορές *(δύο επιλογείς + η βιτρίνα)*, δίπλα σε
   * τρία `h-64` που έπρεπε να συμφωνούν **χωρίς κανέναν να το επιβάλλει**. Το ζουμ είναι
   * **συνάρτηση** του ύψους: μια αλλαγή σε μία οθόνη θα άφηνε το ζουμ της λάθος, και το
   * λάθος θα ήταν *«ο κύκλος δεν χωράει»* — ακριβώς το σύμπτωμα που θεραπεύουμε.
   */
  it('το ύψος συμφωνεί με την κλάση Tailwind που το συνοδεύει (h-64 = 16rem = 256px)', () => {
    expect(COVERAGE_MAP_HEIGHT_PX).toBe(256);
  });
});
