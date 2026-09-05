/**
 * @fileoverview **Η ΙΕΡΑΡΧΗΣΗ ΤΗΣ ΑΦΕΤΗΡΙΑΣ** — ADR-332 **D25 §πινέζα**.
 * @related utils/address/proximity-anchor · utils/address/address-list-center
 *
 * Η απόφαση έχει **τρία** σκαλιά και κάθε ένα κρύβει έναν τρόπο να χαλάσει σιωπηλά:
 * ο άνθρωπος να αγνοηθεί, το `NaN` να περάσει, ή η αποτυχία του πρώτου σκαλιού να
 * **καταπιεί** το δεύτερο.
 */

import { resolveProximityAnchor } from '../proximity-anchor';

/** Κέντρο Θεσσαλονίκης — το σημείο της **οντότητας** (οι άλλες διευθύνσεις). */
const ENTITY_POINT = { lat: 40.6401, lng: 22.9444 };
/** Καλαμαριά — εκεί που ο **άνθρωπος** έσυρε την πινέζα. */
const HUMAN_POINT = { lat: 40.5800, lng: 22.9500 };

const entityAddresses = [{ isPrimary: true, coordinates: ENTITY_POINT }];

describe('resolveProximityAnchor — ο άνθρωπος πάνω από τη συναγωγή', () => {
  it('η πινέζα που τοποθέτησε ο άνθρωπος ΝΙΚΑΕΙ το σημείο της οντότητας', () => {
    expect(
      resolveProximityAnchor({ humanPlacedPoint: HUMAN_POINT, addresses: entityAddresses }),
    ).toEqual(HUMAN_POINT);
  });

  it('χωρίς ανθρώπινη πινέζα, μιλά η οντότητα (η υποχώρηση του D23)', () => {
    expect(resolveProximityAnchor({ addresses: entityAddresses })).toEqual(ENTITY_POINT);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('πινέζα %s ⇒ δεν καταπίνει την οντότητα', (_label, point) => {
    expect(
      resolveProximityAnchor({ humanPlacedPoint: point, addresses: entityAddresses }),
    ).toEqual(ENTITY_POINT);
  });

  it('ούτε πινέζα ούτε θέση οντότητας ⇒ `undefined` — «δεν ξέρουμε», ποτέ μαντεψιά', () => {
    expect(resolveProximityAnchor({})).toBeUndefined();
    expect(resolveProximityAnchor({ addresses: [{ isPrimary: true }] })).toBeUndefined();
  });

  it('η ανθρώπινη πινέζα αρκεί ΜΟΝΗ ΤΗΣ — έργο χωρίς καμία αποθηκευμένη θέση', () => {
    expect(resolveProximityAnchor({ humanPlacedPoint: HUMAN_POINT, addresses: [] }))
      .toEqual(HUMAN_POINT);
  });
});

describe('resolveProximityAnchor — τα σκουπίδια δεν γίνονται αφετηρία', () => {
  /**
   * 🔴 **Η κρίσιμη διάκριση: άκυρο σκαλί ΥΠΟΧΩΡΕΙ, δεν ΤΕΡΜΑΤΙΖΕΙ.**
   *
   * Μια υλοποίηση που έγραφε `if ('humanPlacedPoint' in sources) return usablePoint(...)`
   * θα ήταν πράσινη σε κάθε άλλο έλεγχο αυτού του αρχείου και θα επέστρεφε `undefined`
   * εδώ — δηλαδή **μια χαλασμένη πινέζα θα έσβηνε τη γνωστή θέση του έργου**.
   */
  it.each([
    ['NaN', { lat: NaN, lng: 22.9 }],
    ['Infinity', { lat: 40.6, lng: Infinity }],
    ['-Infinity', { lat: -Infinity, lng: 22.9 }],
  ])('πινέζα με %s ⇒ ΥΠΟΧΩΡΕΙ στην οντότητα, δεν επιστρέφει κενό', (_label, point) => {
    expect(
      resolveProximityAnchor({ humanPlacedPoint: point, addresses: entityAddresses }),
    ).toEqual(ENTITY_POINT);
  });

  it('το `0` είναι ΥΠΑΡΚΤΗ συντεταγμένη, όχι απουσία (Κόλπος της Γουινέας)', () => {
    // Ο κλασικός ελεγχος αλήθειας (`if (!point.lat)`) θα πετούσε το μηδέν — και το
    // σφάλμα θα εμφανιζόταν μόνο για μία γραμμή γεωγραφικού πλάτους στον πλανήτη.
    expect(
      resolveProximityAnchor({ humanPlacedPoint: { lat: 0, lng: 0 }, addresses: entityAddresses }),
    ).toEqual({ lat: 0, lng: 0 });
  });
});
