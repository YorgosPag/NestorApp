/**
 * ADR-782 §17 — οι άγκυρες της **ΜΙΑΣ** λίστας εισόδων.
 *
 * 🔴 Γιατί υπάρχει: μέχρι τις 2026-08-10 η λίστα ήταν γραμμένη **μόνο** μέσα στον ζωγράφο του 2Δ,
 * και ο ζωγράφος του 3Δ άκουγε **μηδέν** από τις τέσσερις πηγές. Σε σκηνή on-demand αυτό σημαίνει
 * ότι ο χάρτης δεν εμφανιζόταν **ποτέ** στην τρισδιάστατη προβολή: τα πλακίδια έφταναν μετά το
 * πρώτο καρέ και κανείς δεν ζητούσε δεύτερο.
 *
 * 🔑 **Μία δοκιμή ανά πηγή, ονομαστικά.** Ένας συγκεντρωτικός έλεγχος «ειδοποιεί σε αλλαγή» θα
 * έμενε πράσινος αν έσβηνε **μία** πηγή από τη λίστα — δηλαδή θα κάλυπτε ακριβώς το σχήμα της
 * βλάβης που κυνηγά. Σβήνοντας οποιαδήποτε γραμμή του `SOURCES` κοκκινίζει **ακριβώς μία**.
 *
 * Οι τρεις από τις τέσσερις πηγές οδηγούνται **αληθινά** (πραγματικά stores). Ο cache πλακιδίων
 * είναι mock-αρισμένος γιατί η εκπομπή του γεννιέται από `Image.onload`, που στο jsdom δεν
 * συμβαίνει — και μια δοκιμή που περιμένει δίκτυο δεν είναι άγκυρα, είναι λαχείο.
 */

const tileListeners = new Set<() => void>();
let tileUnsubscribeCalls = 0;

jest.mock('../basemap-tile-cache', () => ({
  subscribeTileReady: (listener: () => void) => {
    tileListeners.add(listener);
    return () => {
      tileUnsubscribeCalls += 1;
      tileListeners.delete(listener);
    };
  },
}));

import { getBasemapPaintVersion, subscribeBasemapPaint } from '../basemap-invalidation';
import { resetBasemapStore, setBasemapEnabled, setBasemapOpacity, setBasemapSource } from '../basemap-store';
import { setApproximateAnchor } from '../basemap-availability';
import {
  registerBasemapAttributionSurface,
  resetBasemapAttributionSurfaces,
} from '../basemap-attribution-surface';

/** Άφιξη πλακιδίου, όπως θα την εξέπεμπε ο cache όταν αποκωδικοποιηθεί μια εικόνα. */
function emitTileReady(): void {
  for (const listener of [...tileListeners]) listener();
}

beforeEach(() => {
  // Πρώτα η επαναφορά, μετά οι εγγραφές: η ίδια η επαναφορά ειδοποιεί, και θα μετριόταν ως αλλαγή.
  resetBasemapStore();
  setApproximateAnchor(null);
  resetBasemapAttributionSurfaces();
  tileUnsubscribeCalls = 0;
});

describe('subscribeBasemapPaint — μία λίστα εισόδων, δύο καταναλωτές (ADR-782 §17)', () => {
  it('🎯 Ι1: ο ΔΙΑΚΟΠΤΗΣ/αδιαφάνεια/πάροχος ειδοποιεί', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBasemapPaint(listener);

    setBasemapEnabled(true);
    setBasemapOpacity(0.5);
    setBasemapSource('osm-standard');

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('🎯 Ι2: η ΔΙΑΘΕΣΙΜΟΤΗΤΑ (κατά προσέγγιση άγκυρα) ειδοποιεί', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBasemapPaint(listener);

    setApproximateAnchor({ lat: 40.66, lon: 22.9, originKey: 'test' });

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('🎯 Ι3: η ΕΠΙΦΑΝΕΙΑ ΑΠΟΔΟΣΗΣ ειδοποιεί — αλλιώς ο χάρτης μένει σβηστός μέχρι άσχετη αλλαγή', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBasemapPaint(listener);

    const unregister = registerBasemapAttributionSurface('test-surface');

    expect(listener).toHaveBeenCalled();
    unregister();
    unsubscribe();
  });

  it('🎯 Ι4: η ΑΦΙΞΗ ΠΛΑΚΙΔΙΟΥ ειδοποιεί — η πηγή που έλειπε ολόκληρη από το 3Δ', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBasemapPaint(listener);

    emitTileReady();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('Ι5: ο μετρητής προχωρά σε κάθε αλλαγή και μένει σταθερός χωρίς αλλαγή', () => {
    const unsubscribe = subscribeBasemapPaint(() => {});
    const before = getBasemapPaintVersion();

    emitTileReady();
    const after = getBasemapPaintVersion();

    expect(after).toBeGreaterThan(before);
    expect(getBasemapPaintVersion()).toBe(after); // καμία αλλαγή ⇒ ίδια τιμή (getSnapshot σταθερό)
    unsubscribe();
  });

  it('Ι6: ο τελευταίος που φεύγει αποδεσμεύει τις πηγές — καμία μόνιμη διαρροή ακροατών', () => {
    const first = subscribeBasemapPaint(() => {});
    const second = subscribeBasemapPaint(() => {});

    first();
    expect(tileUnsubscribeCalls).toBe(0); // υπάρχει ακόμη καταναλωτής — μην κόψεις τις πηγές
    second();
    expect(tileUnsubscribeCalls).toBe(1);
    expect(tileListeners.size).toBe(0);
  });

  it('Ι7: ακροατής που απεγγράφεται ΜΕΣΑ στην ειδοποίηση δεν χαλάει τη διάσχιση', () => {
    const survivor = jest.fn();
    // Το 3Δ στρώμα ζει σε imperative κύκλο ζωής και μπορεί να φύγει οποιαδήποτε στιγμή.
    const unsubscribeSelf = subscribeBasemapPaint(() => unsubscribeSelf());
    const unsubscribeSurvivor = subscribeBasemapPaint(survivor);

    expect(() => emitTileReady()).not.toThrow();
    expect(survivor).toHaveBeenCalledTimes(1);
    unsubscribeSurvivor();
  });
});
