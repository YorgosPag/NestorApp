/**
 * ADR-782 §23 — άγκυρες `Φ1`-`Φ9` του **πλαισίου υποβάθρου**.
 *
 * 🔴 Η `Φ3` είναι η **βαθμονόμηση**, όχι διακόσμηση: πριν από αυτό το module η κατάσταση
 * «κατά προσέγγιση» έδινε προβολέα `null` — δηλαδή χαρτί ≡ κόσμος — και ο χάρτης ζωγραφιζόταν
 * γύρω από το ΕΓΣΑ'87 `(0,0)`. Η `Φ3β` το δείχνει **όπως το βλέπει ο χρήστης**: ζητά τα πλακίδια
 * που θα κατέβαιναν και ρωτά **πού πάνω στη Γη** κάθονται. Ένας έλεγχος που κοίταζε μόνο ότι ο
 * προβολέας «δεν είναι null» θα περνούσε και με λάθος σημείο.
 *
 * ⚠️ Η `Φ4` είναι το αναλλοίωτο που **παραβιάστηκε**: «δηλώνω θέση ⟺ ξέρω πού». Είναι γραμμένη
 * ως βρόχος πάνω σε **όλες** τις καταστάσεις και όχι ως τρεις χωριστοί ισχυρισμοί, ώστε μια
 * τέταρτη πηγή θέσης να μην μπορεί να προστεθεί χωρίς να περάσει από εδώ.
 */

import { setGeoReference } from '../../geo-referencing/geo-reference-store';
import type { GeoReference } from '../../geo-referencing/geo-transform';
import { setProjectAnchor, type ApproximateAnchor } from '../basemap-availability';
import {
  getBasemapAvailability,
  getBasemapDisplayProjector,
  getBasemapFrame,
  subscribeBasemapFrame,
} from '../basemap-frame';
import {
  clearBasemapPlacement,
  setBasemapPlacement,
  resetBasemapPlacementStore,
} from '../basemap-placement-store';
import { geographicToWorldMm, worldMmToGeographic } from '../basemap-projection';
import { chooseZoomLevel, tilesForDisplayRect } from '../basemap-tile-model';
import { BASEMAP_SOURCES, DEFAULT_BASEMAP_SOURCE_ID } from '../basemap-source';
import { tileFractionToGeographic } from '../web-mercator';

/** Ένα πραγματικό σημείο της περιοχής μελέτης — πλατεία Αριστοτέλους, Θεσσαλονίκη. */
const THESSALONIKI = { lat: 40.6326, lon: 22.9412 } as const;

/**
 * Το **ήδη δηλωμένο** όριο του υπολειπόμενου μετάβασης-επιστροφής της αλυσίδας WGS84 ⇄ ΕΓΣΑ'87.
 *
 * ⚠️ Δεν είναι αριθμός αυτού του αρχείου: είναι **ακριβώς** το `toBeLessThan(0.01)` της άγκυρας
 * `Μ2β` (`basemap-projection.test.ts`), όπου το ίδιο υπολειπόμενο μετριέται **απομονωμένο** και
 * τεκμηριώνεται η αιτία του (η μετάθεση datum αλλάζει και το ελλειψοειδές ύψος). Μετρημένο ~1,6 mm
 * στην Αθήνα, ~2,1 mm εδώ. Ένα δικό μας, στενότερο κατώφλι θα ήταν **δεύτερη αλήθεια** για το ίδιο
 * φυσικό μέγεθος — και θα έσπαγε σε κάθε σημείο της Ελλάδας εκτός από αυτό που δοκιμάσαμε.
 */
const CHAIN_ROUND_TRIP_MM = 10;

function anchorAt(lat: number, lon: number): ApproximateAnchor {
  return { lat, lon, originKey: 'projectAddressGeocoded' };
}

function anchor(a: ApproximateAnchor): void {
  setProjectAnchor({ kind: 'anchored', anchor: a });
}

beforeEach(() => {
  setGeoReference(null);
  setProjectAnchor(null);
  resetBasemapPlacementStore();
});

describe('ADR-782 §23 — πλαίσιο υποβάθρου', () => {
  it('Φ1 — καμία πηγή θέσης ⇒ κανένα πλαίσιο, κατάσταση «άγνωστη»', () => {
    expect(getBasemapFrame()).toBeNull();
    expect(getBasemapAvailability()).toBe('unknown');
    expect(getBasemapDisplayProjector()).toBeNull();
  });

  it('Φ2 — δηλωμένη γεωαναφορά ⇒ πλαίσιο «geo-reference», κατάσταση «ακριβής»', () => {
    const geo: GeoReference = { originWorld: { x: 407_000_000, y: 4_500_000_000 }, rotationDeg: 12 };
    setGeoReference(geo);

    const frame = getBasemapFrame();
    expect(frame).toEqual({ source: 'geo-reference', geo });
    expect(getBasemapAvailability()).toBe('exact');
  });

  it('Φ3 — άγκυρα χωρίς γεωαναφορά ⇒ ο προβολέας τοποθετεί την ΑΡΧΗ του σχεδίου στην άγκυρα', () => {
    anchor(anchorAt(THESSALONIKI.lat, THESSALONIKI.lon));

    expect(getBasemapAvailability()).toBe('approximate');
    const projector = getBasemapDisplayProjector();
    expect(projector).not.toBeNull();
    // Ταυτοτικός προβολέας εδώ **είναι** η βλάβη: σημαίνει «χαρτί ≡ κόσμος» ⇒ ΕΓΣΑ'87 (0,0).
    expect(projector!.isIdentity).toBe(false);

    // Τι κόσμος κάθεται στην τοπική αρχή; — **ακριβώς** η άγκυρα, στα όρια της διπλής ακρίβειας.
    const world = projector!.unproject(0, 0);
    const expected = geographicToWorldMm(THESSALONIKI.lat, THESSALONIKI.lon);
    expect(world.x).toBeCloseTo(expected.x, 6);
    expect(world.y).toBeCloseTo(expected.y, 6);

    // Και σε ανθρώπινους όρους: γυρίζοντας σε μοίρες, ξαναβρίσκουμε το ίδιο σημείο — μέσα στο
    // **δηλωμένο** υπόλοιπο της αλυσίδας. ⚠️ Το υπόλοιπο ΔΕΝ είναι χαλαρωμένο κατώφλι: είναι η
    // ίδια ~1,6 mm μετάβασης-επιστροφής που κλειδώνει ήδη η άγκυρα `Μ2β` (ADR-782 §12), και
    // οφείλεται στη μετάθεση datum. Γραμμένο σε **χιλιοστά** και όχι σε δεκαδικά μοιρών, γιατί
    // ένα «toBeCloseTo(…, 9)» θα έκρυβε το μέγεθος πίσω από έναν αριθμό ψηφίων.
    const back = worldMmToGeographic(world.x, world.y);
    const reprojected = geographicToWorldMm(back.lat, back.lon);
    expect(Math.hypot(reprojected.x - world.x, reprojected.y - world.y))
      .toBeLessThan(CHAIN_ROUND_TRIP_MM);
  });

  it('Φ3β — τα πλακίδια που θα κατέβαιναν κάθονται στη Θεσσαλονίκη, όχι στο ΕΓΣΑ (0,0)', () => {
    anchor(anchorAt(THESSALONIKI.lat, THESSALONIKI.lon));
    const projector = getBasemapDisplayProjector();

    // Ορατό ~200 m γύρω από την αρχή του σχεδίου, σε canonical mm.
    const rect = { minX: -100_000, maxX: 100_000, minY: -100_000, maxY: 100_000 };
    const source = BASEMAP_SOURCES[DEFAULT_BASEMAP_SOURCE_ID];
    const zoom = chooseZoomLevel({
      pixelsPerMm: 0.002,
      devicePixelRatio: 1,
      latitude: THESSALONIKI.lat,
      source,
    });
    const selection = tilesForDisplayRect(rect, zoom, projector);

    expect(selection.tiles.length).toBeGreaterThan(0);
    for (const tile of selection.tiles) {
      const centre = tileFractionToGeographic(tile.x + 0.5, tile.y + 0.5, tile.z);
      expect(Math.abs(centre.lat - THESSALONIKI.lat)).toBeLessThan(0.02);
      expect(Math.abs(centre.lon - THESSALONIKI.lon)).toBeLessThan(0.02);
    }
  });

  it('Φ4 — αναλλοίωτο: κατάσταση ≠ «άγνωστη» ⟺ υπάρχει πλαίσιο', () => {
    const cases: readonly (() => void)[] = [
      () => undefined,
      () => anchor(anchorAt(THESSALONIKI.lat, THESSALONIKI.lon)),
      () => {
        anchor(anchorAt(THESSALONIKI.lat, THESSALONIKI.lon));
        setBasemapPlacement({ originWorld: { x: 1_000, y: 2_000 }, rotationDeg: 30 });
      },
      () => setGeoReference({ originWorld: { x: 5, y: 7 }, rotationDeg: 0 }),
      () => setProjectAnchor({ kind: 'refused', reason: 'no-address' }),
    ];

    for (const arrange of cases) {
      setGeoReference(null);
      setProjectAnchor(null);
      resetBasemapPlacementStore();
      arrange();

      const known = getBasemapAvailability() !== 'unknown';
      expect(getBasemapFrame() !== null).toBe(known);
      expect(getBasemapDisplayProjector() !== null).toBe(known);
    }
  });

  it('Φ5 — η χειροκίνητη τοποθέτηση υπερισχύει της άγκυρας', () => {
    anchor(anchorAt(THESSALONIKI.lat, THESSALONIKI.lon));
    const manual: GeoReference = { originWorld: { x: 123_456, y: 654_321 }, rotationDeg: -17 };
    setBasemapPlacement(manual);

    expect(getBasemapFrame()).toEqual({ source: 'manual-placement', geo: manual });
    // Παραμένει **κατά προσέγγιση**: η ένδειξη δεν επιτρέπεται να σβήσει επειδή το έσυρε άνθρωπος.
    expect(getBasemapAvailability()).toBe('approximate');

    clearBasemapPlacement();
    expect(getBasemapFrame()?.source).toBe('project-anchor');
  });

  it('Φ6 — η δηλωμένη γεωαναφορά υπερισχύει της χειροκίνητης τοποθέτησης (δεν τη σβήνει)', () => {
    anchor(anchorAt(THESSALONIKI.lat, THESSALONIKI.lon));
    setBasemapPlacement({ originWorld: { x: 1, y: 2 }, rotationDeg: 3 });
    const geo: GeoReference = { originWorld: { x: 407_000_000, y: 4_500_000_000 }, rotationDeg: 0 };
    setGeoReference(geo);

    expect(getBasemapFrame()).toEqual({ source: 'geo-reference', geo });

    // Η τοποθέτηση **επιβιώνει** — αν σβηνόταν, η αναίρεση της γεωαναφοράς θα έχανε τη δουλειά.
    setGeoReference(null);
    expect(getBasemapFrame()?.source).toBe('manual-placement');
  });

  it('Φ7 — σταθερή ταυτότητα με αμετάβλητες εισόδους (αλλιώς `useSyncExternalStore` σε βρόχο)', () => {
    anchor(anchorAt(THESSALONIKI.lat, THESSALONIKI.lon));

    expect(getBasemapFrame()).toBe(getBasemapFrame());
    expect(getBasemapDisplayProjector()).toBe(getBasemapDisplayProjector());

    const before = getBasemapFrame();
    setBasemapPlacement({ originWorld: { x: 9, y: 9 }, rotationDeg: 1 });
    expect(getBasemapFrame()).not.toBe(before);
  });

  it('Φ8 — το σημείο της άγκυρας προβάλλεται ΑΚΡΙΒΩΣ στην τοπική αρχή', () => {
    anchor(anchorAt(THESSALONIKI.lat, THESSALONIKI.lon));
    const world = geographicToWorldMm(THESSALONIKI.lat, THESSALONIKI.lon);

    const display = getBasemapDisplayProjector()!.project(world.x, world.y);
    expect(display.x).toBeCloseTo(0, 6);
    expect(display.y).toBeCloseTo(0, 6);
  });

  it('Φ9 — η εγγραφή ακούει ΚΑΙ ΤΙΣ ΤΡΕΙΣ πηγές (αλλιώς ο χάρτης μένει σιωπηλά παγωμένος)', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeBasemapFrame(() => seen.push(getBasemapAvailability()));

    anchor(anchorAt(THESSALONIKI.lat, THESSALONIKI.lon));
    expect(seen).toHaveLength(1);

    setBasemapPlacement({ originWorld: { x: 4, y: 5 }, rotationDeg: 6 });
    expect(seen).toHaveLength(2);

    setGeoReference({ originWorld: { x: 7, y: 8 }, rotationDeg: 9 });
    expect(seen).toHaveLength(3);

    unsubscribe();
    clearBasemapPlacement();
    expect(seen).toHaveLength(3);
  });
});
