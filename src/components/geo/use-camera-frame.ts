'use client';

/**
 * @fileoverview **Η ΜΙΑ ΚΙΝΗΣΗ ΤΗΣ ΚΑΜΕΡΑΣ** — το ένα σημείο που μετακινεί τον χάρτη.
 * @related types/geo/camera-frame · components/geo/use-focus-camera · lib/agency/coverage-camera
 * @module components/geo/use-camera-frame
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΒΛΑΒΗ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ — ΚΑΙ ΓΙΑΤΙ ΗΤΑΝ **ΑΟΡΑΤΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο άνθρωπος πάτησε «Εντοπισμός» για διεύθυνση **Θεσσαλονίκης** και ο χάρτης έδειχνε
 * **Πλατεία Ομονοίας** — μετρημένο 2026-09-02. Το τρίτο και **επικίνδυνο** αίτιο: το
 * `PlaceMap` περνούσε τη θέση ως **`initialViewState`** — τιμή που το react-map-gl
 * διαβάζει **μία φορά, στην προσάρτηση**. Ο χάρτης έχει ήδη γεννηθεί όταν πατιέται το
 * κουμπί. ⚠️ Άρα η προφανής διόρθωση *(«πέρασε το σημείο ως `center`»)* θα ήταν αλλαγή
 * που **μεταγλωττίζεται, περνά κάθε άγκυρα, και δεν κάνει απολύτως τίποτα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΞΗΧΘΗ ΑΠΟ ΤΟ `use-focus-camera` (ADR-846 Φ4)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **δηλωμένη εμβέλεια** χρειάζεται ακριβώς αυτή την κίνηση — και **δεν επιτρέπεται**
 * να δανειστεί το `PlaceFocus`, που κουβαλά βαθμό βεβαιότητας γεωκωδικοποιητή και τον
 * **ζωγραφίζει**. Οι δύο επιλογές ήταν «δεύτερο hook» ή «μία μηχανή, δύο μεταφραστές».
 *
 * ⛔ Το δεύτερο hook θα ήταν το sibling clone του **N.18** στη χειρότερη μορφή: **τέσσερις**
 * αποφάσεις πληρωμένες με περιστατικό *(διάρκεια `900ms`, περιθώριο `48px`, ταβάνι ζουμ
 * `17`, ταυτότητα **κατά τιμή**)* αντιγραμμένες, με βεβαιότητα ότι θα αποκλίνουν — ο ένας
 * χάρτης θα πετούσε και ο άλλος θα πηδούσε, χωρίς κανείς να το αποφασίσει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΠΡΟΤΥΠΟ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΓΝΩΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η τεκμηρίωση του react-map-gl λέει ρητά *«use `map.easeTo()` / `map.flyTo()` instead
 * of the older transition props»*, και ταυτόχρονα προειδοποιεί ότι οι **επιτακτικές**
 * κλήσεις αποκλίνουν από τα props. Η γραμμή εδώ είναι ρητή: **επιτακτική μόνο η κίνηση
 * της κάμερας** — μια πράξη με **διάρκεια**, που κανένα prop δεν εκφράζει — και
 * **δηλωτικό ό,τι ζωγραφίζεται** (πινέζα, κύκλος, περίγραμμα). **Καμία γεωμετρία δεν
 * μπαίνει από εδώ.**
 */

import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';

import { cameraFlight, cameraFraming, type CameraIntent } from '@/lib/geo/camera-motion';
import { cameraFrameSignature, type CameraFrame } from '@/types/geo/camera-frame';
import { extentBounds, type ExtentBounds } from '@/lib/maps/extent-bounds';

/**
 * 🔑 **ΟΙ ΤΡΕΙΣ ΣΤΑΘΕΡΕΣ ΕΦΥΓΑΝ ΑΠΟ ΕΔΩ** *(`FLIGHT_MS = 900` · `FIT_PADDING = 48` ·
 * `AREA_MAX_ZOOM = 17`)*. Δεν ήταν λάθος **τιμές** — ήταν λάθος **τόπος**: η ίδια
 * απόφαση γραφόταν άλλες τρεις φορές σε γειτονικές οθόνες, με άλλους αριθμούς.
 *
 * ⚠️ **Και η διάρκεια δεν μεταφέρθηκε, ΚΑΤΑΡΓΗΘΗΚΕ**: τα `900 ms` έκαναν ένα άλμα 200
 * μέτρων και ένα άλμα 400 χιλιομέτρων να διαρκούν το ίδιο, **ακυρώνοντας** τον van Wijk
 * που η ίδια η βιβλιοθήκη υλοποιεί. Δες `lib/geo/camera-motion.ts`.
 */

/**
 * Το καδράρισμα **έκτασης** — ΕΝΑ, για τη γέννηση και για την πτήση. Ο γεωκωδικοποιητής, η δηλωμένη εμβέλεια και το
 * όριο δήμου δείχνουν **ονομασμένη περιοχή** γύρω από **πινέζα**: τρεις ερωτήσεις, τρεις δηλωμένες απαντήσεις.
 */
function extentFraming(intent: CameraIntent) {
  return cameraFraming(intent, 'pin', 'area');
}

/** Η θέση γέννησης του `<Map>` (`initialViewState` του react-map-gl) — βλ. {@link cameraBirthView}. */
export type CameraBirthView =
  | { readonly latitude: number; readonly longitude: number; readonly zoom: number }
  | {
      readonly bounds: ExtentBounds;
      readonly fitBoundsOptions: { readonly padding: number; readonly maxZoom: number };
    };

/**
 * **Ο ΧΑΡΤΗΣ ΓΕΝΝΙΕΤΑΙ ΗΔΗ ΣΤΟ ΚΑΡΕ** — δεν ανοίγει κάπου αλλού για να πετάξει εκεί (ADR-847 §9.5).
 *
 * 🔴 **Μετρημένο 2026-09-29, `/area/municipality:0701`**: ο χάρτης άνοιγε στο `BUILDING_ZOOM` (18) στο κέντρο του bbox
 * — για παραλιακό δήμο, **θάλασσα** — και μόνο μετά το `load` πετούσε στην έκταση: **36 αιτήματα πλακιδίων** z19/18/17
 * που κανείς δεν είδε, και ~3 s κίνησης σε σελίδα που ο άνθρωπος μόλις άνοιξε. Google Maps / Zillow ανοίγουν
 * **απευθείας** στην έκταση.
 *
 * 🔑 Ίδιο `padding`/`maxZoom` με την πτήση (`extentFraming`), χωρίς διάρκεια: το react-map-gl εφαρμόζει τα `bounds`
 * στην κατασκευή με `duration: 0` — ο χάρτης **δεν** χρειάζεται `load` για να ξέρει πού κοιτά.
 */
export function cameraBirthView(frame: CameraFrame): CameraBirthView {
  if (frame.kind === 'point') {
    return { latitude: frame.point.lat, longitude: frame.point.lng, zoom: frame.zoom };
  }
  const { padding, maxZoom } = extentFraming('arrive');
  return { bounds: extentBounds(frame.extent), fitBoundsOptions: { padding, maxZoom } };
}

/**
 * **Κινεί την κάμερα όποτε αλλάζει το ΚΑΡΕ** — ποτέ σε κάθε απόδοση.
 *
 * @param mapRef — το `ref` του `<Map>`
 * @param ready — ο χάρτης φόρτωσε· πριν από αυτό κάθε `flyTo` πέφτει στο κενό
 * @param frame — πού να κοιτάξει, ή `null` όταν κανείς δεν ζήτησε τίποτα
 * @param bornWith — το καρέ με το οποίο **γεννήθηκε** ο χάρτης ({@link cameraBirthView}), ή `null`
 */
export function useCameraFrame(
  mapRef: React.RefObject<MapRef | null>,
  ready: boolean,
  frame: CameraFrame | null,
  bornWith: CameraFrame | null = null,
): void {
  /**
   * 🔑 **ΤΑΥΤΟΤΗΤΑ ΚΑΤΑ ΤΙΜΗ, ΟΧΙ ΤΟ ΑΝΤΙΚΕΙΜΕΝΟ ΣΤΙΣ ΕΞΑΡΤΗΣΕΙΣ.** Το καρέ χτίζεται
   * μέσα σε render, άρα είναι **νέο αντικείμενο κάθε φορά**. Στις εξαρτήσεις θα ξανάτρεχε
   * την πτήση σε **κάθε** πάτημα πλήκτρου — ο χάρτης σε μόνιμη κίνηση. Είναι το ίδιο
   * σχήμα που ο `PlaceChooser` τεκμηριώνει για το `settledRef` και που το
   * `reference_firestore_reactivity_hub` καταγράφει ως αιτία βρόχου (`selector ?? []`).
   */
  const signature = cameraFrameSignature(frame);

  /**
   * ⚠️ **Η ΤΕΛΕΥΤΑΙΑ ΤΙΜΗ, ΔΙΑΒΑΣΜΕΝΗ ΤΗ ΣΤΙΓΜΗ ΤΗΣ ΠΤΗΣΗΣ.** Το `frame` λείπει
   * επίτηδες από τις εξαρτήσεις (δες παραπάνω)· ένα κλείσιμο πάνω σε παλιό αντικείμενο
   * θα πετούσε σε **προηγούμενο** καρέ με τη σωστή υπογραφή — δηλαδή θα ήταν σωστό και
   * μπαγιάτικο ταυτόχρονα. Ίδιο ιδίωμα «*event-time read via getter, όχι snapshot*»
   * με τον κανόνα 2 της ADR-040.
   */
  const latest = useRef(frame);
  latest.current = frame;

  /**
   * 🔑 **Η ΥΠΟΓΡΑΦΗ ΤΗΣ ΓΕΝΝΗΣΗΣ, ΚΑΤΑΝΑΛΩΝΕΤΑΙ ΜΙΑ ΦΟΡΑ.** Ο χάρτης βρίσκεται ήδη εκεί· μια πτήση προς το ίδιο καρέ
   * θα ήταν κίνηση του τίποτα. Σβήνεται στην **πρώτη** απόφαση μετά το `ready` — ό,τι κι αν αποφασιστεί — ώστε ένα
   * μεταγενέστερο A→B→A να ξαναπετά στο A. Το `null` στο μεταξύ (*«μην κουνηθείς»*) δεν την καταναλώνει.
   */
  const born = useRef(cameraFrameSignature(bornWith));

  useEffect(() => {
    const map = mapRef.current;
    const current = latest.current;
    if (map === null || !ready || current === null) return;

    const alreadyThere = signature === born.current;
    born.current = null;
    if (alreadyThere) return;

    if (current.kind === 'extent') {
      map.fitBounds(extentBounds(current.extent), extentFraming('travel'));
      return;
    }

    map.flyTo({
      center: [current.point.lng, current.point.lat],
      zoom: current.zoom,
      ...cameraFlight('travel'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- δες παραπάνω: ταυτότητα ΚΑΤΑ ΤΙΜΗ
  }, [signature, ready, mapRef]);
}
