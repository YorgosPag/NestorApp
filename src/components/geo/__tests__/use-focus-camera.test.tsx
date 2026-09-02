/**
 * @fileoverview **ΑΓΚΥΡΑ — Η ΚΑΜΕΡΑ ΚΙΝΕΙΤΑΙ ΟΝΤΩΣ.**
 * @related components/geo/use-focus-camera.ts · lib/geo/geocoding-focus.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΜΟΝΗ ΑΓΚΥΡΑ ΠΟΥ ΘΑ ΕΙΧΕ ΠΙΑΣΕΙ ΤΗ ΒΛΑΒΗ ΤΗΣ 2026-09-02
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο χάρτης έδειχνε **Ομόνοια** για διεύθυνση **Θεσσαλονίκης**, και η αιτία είχε
 * **τρία** στρώματα. Τα δύο πρώτα *(κανείς δεν έδινε το σημείο· κανείς δεν περνούσε το
 * `center`)* πιάνονται από άγκυρα απόδοσης: «το prop έφτασε;».
 *
 * 🔑 **ΤΟ ΤΡΙΤΟ ΟΧΙ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΕΠΙΚΙΝΔΥΝΟ**: το σημείο περνούσε ως
 * **`initialViewState`** — τιμή που το react-map-gl διαβάζει **μία φορά**. Δηλαδή μια
 * «διόρθωση» που περνά το prop σωστά θα ήταν:
 *
 *   - ✅ μεταγλωττίσιμη
 *   - ✅ πράσινη σε **κάθε** άγκυρα απόδοσης *(«ναι, το `focus` έφτασε στο `<Map>`»)*
 *   - ❌ **και δεν θα έκανε απολύτως τίποτα** στην οθόνη
 *
 * Το ερώτημα *«έφτασε η τιμή;»* είναι **διαφορετικό** από το *«κουνήθηκε ο χάρτης;»*,
 * και μόνο το δεύτερο είναι η υπόσχεση προς τον άνθρωπο. Αυτό το αρχείο ρωτά το
 * δεύτερο: **εκτελεί** τον κύκλο ζωής και μετρά **τι κλήθηκε πάνω στον χάρτη**.
 *
 * ⚠️ **Καμία εξάρτηση από MapLibre**: ο χάρτης εδώ είναι δύο `jest.fn()`. Το ζητούμενο
 * δεν είναι αν το MapLibre ξέρει να πετάει — αυτό το ξέρει· είναι αν **του το ζητάμε**.
 */

import React from 'react';
import { render } from '@testing-library/react';
import type { MapRef } from 'react-map-gl/maplibre';

import { useFocusCamera } from '../use-focus-camera';
import type { PlaceFocus } from '@/lib/geo/geocoding-focus';

/** Θεσσαλονίκη — η διεύθυνση του περπατήματος. */
const SALONICA = { lat: 40.6403, lng: 22.9444 } as const;
/** Αθήνα — το `GEOGRAPHIC_CONFIG.DEFAULT_*` που έβλεπε ο άνθρωπος. */
const ATHENS = { lat: 37.9838, lng: 23.7275 } as const;

function fakeMap() {
  const flyTo = jest.fn();
  const fitBounds = jest.fn();
  const ref = { current: { flyTo, fitBounds } as unknown as MapRef };
  return { ref, flyTo, fitBounds };
}

/** Ένα σκέτο κέλυφος — ο κύκλος ζωής του React είναι το όργανο, όχι το DOM. */
function Harness({
  mapRef,
  ready,
  focus,
}: {
  readonly mapRef: React.RefObject<MapRef | null>;
  readonly ready: boolean;
  readonly focus: PlaceFocus | null;
}): React.ReactElement {
  useFocusCamera(mapRef, ready, focus);
  return <div />;
}

// =============================================================================
// Κ1 — Η ΠΤΗΣΗ ΣΥΜΒΑΙΝΕΙ, ΚΑΙ ΠΑΕΙ ΕΚΕΙ ΠΟΥ ΕΙΠΕ Ο ΑΝΘΡΩΠΟΣ
// =============================================================================

describe('Κ1 — ο χάρτης πηγαίνει στη διεύθυνση που εντοπίστηκε', () => {
  /** ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα το `focus` σε `initialViewState` ⇒ **κόκκινο**. */
  it('🔴 μια απάντηση `exact` ΚΙΝΕΙ την κάμερα στο σημείο της', () => {
    const { ref, flyTo } = fakeMap();

    render(
      <Harness mapRef={ref} ready focus={{ point: SALONICA, accuracy: 'exact' }} />,
    );

    expect(flyTo).toHaveBeenCalledTimes(1);
    expect(flyTo.mock.calls[0][0]).toMatchObject({
      center: [SALONICA.lng, SALONICA.lat],
      zoom: 18,
    });
  });

  /**
   * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΒΛΑΒΗΣ.** Χωρίς αυτό, η Κ1 θα ήταν πράσινη και
   * σε υλοποίηση που πετάει **πάντα στην ίδια θέση**.
   */
  it('🔴 δύο διαφορετικές διευθύνσεις δίνουν δύο ΔΙΑΦΟΡΕΤΙΚΟΥΣ προορισμούς', () => {
    const { ref, flyTo } = fakeMap();
    const view = render(
      <Harness mapRef={ref} ready focus={{ point: ATHENS, accuracy: 'exact' }} />,
    );
    view.rerender(
      <Harness mapRef={ref} ready focus={{ point: SALONICA, accuracy: 'exact' }} />,
    );

    expect(flyTo).toHaveBeenCalledTimes(2);
    expect(flyTo.mock.calls[0][0].center).toEqual([ATHENS.lng, ATHENS.lat]);
    expect(flyTo.mock.calls[1][0].center).toEqual([SALONICA.lng, SALONICA.lat]);
  });

  /**
   * 🔴 **ΤΟ ΦΡΕΝΟ ΤΟΥ ΒΡΟΧΟΥ.** Το `focus` είναι **νέο αντικείμενο σε κάθε απόδοση** του
   * γονέα (χτίζεται από τιμές φόρμας). Αν βρισκόταν στις εξαρτήσεις του effect, ο
   * χάρτης θα ξεκινούσε πτήση σε **κάθε πάτημα πλήκτρου** — μόνιμη κίνηση, και η ίδια
   * οικογένεια βλάβης με το `selector ?? []` του `reference_firestore_reactivity_hub`.
   */
  it('🔴 ΙΔΙΑ τιμή σε νέο αντικείμενο ΔΕΝ ξαναπετά — ταυτότητα κατά ΤΙΜΗ', () => {
    const { ref, flyTo } = fakeMap();
    const view = render(
      <Harness mapRef={ref} ready focus={{ point: { ...SALONICA }, accuracy: 'exact' }} />,
    );
    view.rerender(
      <Harness mapRef={ref} ready focus={{ point: { ...SALONICA }, accuracy: 'exact' }} />,
    );

    expect(flyTo).toHaveBeenCalledTimes(1);
  });

  /**
   * 🔑 Ίδιο σημείο, **άλλος βαθμός** ⇒ άλλη προβολή *και* άλλη ένδειξη. Μια υπογραφή
   * καρφωμένη μόνο στις συντεταγμένες θα το έχανε: ο χάρτης θα έμενε σε ζουμ κτιρίου
   * ενώ η απάντηση υποβαθμίστηκε σε «κέντρο οικισμού».
   */
  it('🔴 ίδιο σημείο με ΑΛΛΟΝ βαθμό ξαναπετά — η ακρίβεια είναι μέρος της ταυτότητας', () => {
    const { ref, flyTo } = fakeMap();
    const view = render(
      <Harness mapRef={ref} ready focus={{ point: SALONICA, accuracy: 'exact' }} />,
    );
    view.rerender(
      <Harness mapRef={ref} ready focus={{ point: SALONICA, accuracy: 'center' }} />,
    );

    expect(flyTo).toHaveBeenCalledTimes(2);
    expect(flyTo.mock.calls[1][0].zoom).toBe(13);
  });
});

// =============================================================================
// Κ2 — Η ΜΕΤΡΗΜΕΝΗ ΕΚΤΑΣΗ ΚΑΔΡΑΡΕΙ, ΚΑΙ Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΩΣΤΗ
// =============================================================================

describe('Κ2 — έκταση ⇒ `fitBounds`, με τη σειρά του χάρτη', () => {
  const EXTENT = { south: 40.60, north: 40.68, west: 22.90, east: 22.99 };

  /**
   * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ Η ΠΑΓΙΔΑ.** Ο Nominatim δίνει `[ν, β, δ, α]`· το MapLibre θέλει
   * `[[δ, ν], [α, β]]`. Μια αντιμετάθεση δεν πετάει σφάλμα — **στέλνει τον χάρτη σε
   * άλλο σημείο του πλανήτη**, ακριβώς το σχήμα που το `geo-geojson.ts` περιγράφει ως
   * *«τοποθετεί το κτίριο σε άλλη ήπειρο χωρίς να το πει κανείς»*.
   */
  it('🔴 κορνιζάρει την έκταση με ΝΟΤΙΟΔΥΤΙΚΑ πρώτα, ΒΟΡΕΙΟΑΝΑΤΟΛΙΚΑ δεύτερα', () => {
    const { ref, fitBounds, flyTo } = fakeMap();

    render(
      <Harness
        mapRef={ref}
        ready
        focus={{ point: SALONICA, accuracy: 'approximate', extent: EXTENT }}
      />,
    );

    expect(flyTo).not.toHaveBeenCalled();
    expect(fitBounds).toHaveBeenCalledTimes(1);
    expect(fitBounds.mock.calls[0][0]).toEqual([
      [EXTENT.west, EXTENT.south],
      [EXTENT.east, EXTENT.north],
    ]);
  });

  /**
   * ⚠️ **Το φρένο του ζουμ.** Χωρίς `maxZoom`, ένας δρόμος 40 μέτρων θα κάδραρε στο
   * μέγιστο και θα έδειχνε **δύο κτίρια** — προβολή που υπονοεί βεβαιότητα κτιρίου ενώ
   * ο βαθμός λέει «δρόμος». Η κάμερα δεν επιτρέπεται να διαψεύδει την ένδειξη.
   */
  it('🔴 δεν πλησιάζει τόσο ώστε μια ΠΕΡΙΟΧΗ να μοιάζει με σημείο', () => {
    const { ref, fitBounds } = fakeMap();

    render(
      <Harness
        mapRef={ref}
        ready
        focus={{ point: SALONICA, accuracy: 'interpolated', extent: EXTENT }}
      />,
    );

    expect(fitBounds.mock.calls[0][1]).toMatchObject({ maxZoom: 17 });
  });
});

// =============================================================================
// Κ3 — ΚΑΜΙΑ ΕΝΤΟΛΗ ΣΕ ΧΑΡΤΗ ΠΟΥ ΔΕΝ ΑΚΟΥΕΙ
// =============================================================================

describe('Κ3 — η πτήση περιμένει τον χάρτη', () => {
  /**
   * 🔴 **Η ΒΛΑΒΗ ΠΟΥ ΕΜΦΑΝΙΖΕΤΑΙ ΜΟΝΟ ΣΤΟΝ ΑΡΓΟ ΥΠΟΛΟΓΙΣΤΗ.** Μια απάντηση που φτάνει
   * όσο κατεβαίνει το στυλ θα έπεφτε στο κενό — σιωπηλά, και **μερικές φορές**.
   */
  it('🔴 πριν το `onLoad` δεν στέλνεται ΚΑΜΙΑ εντολή — και μετά στέλνεται', () => {
    const { ref, flyTo } = fakeMap();
    const focus: PlaceFocus = { point: SALONICA, accuracy: 'exact' };

    const view = render(<Harness mapRef={ref} ready={false} focus={focus} />);
    expect(flyTo).not.toHaveBeenCalled();

    view.rerender(<Harness mapRef={ref} ready focus={focus} />);
    expect(flyTo).toHaveBeenCalledTimes(1);
  });

  it('χωρίς απάντηση, ο χάρτης μένει εκεί που τον άφησε ο άνθρωπος', () => {
    const { ref, flyTo, fitBounds } = fakeMap();

    render(<Harness mapRef={ref} ready focus={null} />);

    expect(flyTo).not.toHaveBeenCalled();
    expect(fitBounds).not.toHaveBeenCalled();
  });
});
