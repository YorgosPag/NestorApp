/**
 * Άγκυρες για το «**το σχήμα ΕΙΝΑΙ η ακρίβεια**» (ADR-777 Α5, κανόνας 27).
 *
 * 🔑 Η σημαντικότερη ομάδα εδώ δεν είναι τα έξι σχήματα — είναι η **Κ4**: ότι ο
 * μετρητής της λογιστικής και ο χάρτης απαντούν από **την ίδια** συνάρτηση. Αν
 * αποκτήσουν δεύτερο κριτήριο, η οθόνη θα λέει «11 στον χάρτη» δείχνοντας 10, που
 * είναι ακριβώς το ψέμα που ο κανόνας 27 απαγορεύει.
 */

import { listingMapShape, isMappedShape, type ListingMapShape } from '../listing-map-shape';
import type { ListingPosition } from '@/types/public-listing';
import { ledgerBalances } from '@/types/public-listing';

const AT = '2026-08-10T10:00:00.000Z';
const POINT = { lat: 40.6401, lng: 22.9444 } as const;

function geocoded(accuracy: 'exact' | 'interpolated' | 'approximate' | 'center'): ListingPosition {
  return { kind: 'known', provenance: 'geocoded', point: POINT, locatedAt: AT, accuracy };
}

describe('Κ1 — τα έξι σχήματα της Α5', () => {
  it('γεωκωδικοποιημένο ΑΚΡΙΒΕΣ ⇒ πινέζα', () => {
    expect(listingMapShape(geocoded('exact'))).toBe('pin');
  });

  it('δρόμος χωρίς αριθμό ⇒ πινέζα με δακτύλιο', () => {
    expect(listingMapShape(geocoded('interpolated'))).toBe('pin-with-ring');
  });

  it('συνοικία ⇒ σκιασμένος κύκλος', () => {
    expect(listingMapShape(geocoded('approximate'))).toBe('shaded-circle');
  });

  it('🔴 ΜΟΝΟ ΠΟΛΗ ⇒ σκιασμένη πόλη, ΠΟΤΕ πινέζα — το ελάττωμα που γέννησε το αρχείο', () => {
    expect(listingMapShape(geocoded('center'))).toBe('shaded-city');
    expect(listingMapShape(geocoded('center'))).not.toBe('pin');
  });

  it('πινέζα ανθρώπου ⇒ πινέζα', () => {
    expect(listingMapShape({ kind: 'known', provenance: 'manual', point: POINT, locatedAt: AT })).toBe('pin');
  });

  it('άγνωστη θέση ⇒ κανένα σχήμα', () => {
    expect(listingMapShape({ kind: 'unknown', reason: 'never-asked' })).toBe('none');
    expect(listingMapShape({ kind: 'unknown', reason: 'owner-declined' })).toBe('none');
  });
});

describe('Κ2 — «Θεσσαλονίκη» και «Εγνατίας 147» ΔΕΝ ζωγραφίζονται ίδια', () => {
  it('οι δύο ακρίβειες δίνουν ΔΙΑΦΟΡΕΤΙΚΟ σχήμα, όχι διαφορετικό χρώμα', () => {
    const cityOnly = listingMapShape(geocoded('center'));
    const exactStreet = listingMapShape(geocoded('exact'));
    expect(cityOnly).not.toBe(exactStreet);
  });

  it('ΚΑΜΙΑ ακρίβεια δεν παράγει το ίδιο σχήμα με άλλη — και οι τέσσερις είναι διακριτές', () => {
    const shapes = (['exact', 'interpolated', 'approximate', 'center'] as const).map((a) =>
      listingMapShape(geocoded(a))
    );
    expect(new Set(shapes).size).toBe(4);
  });
});

describe('Κ3 — το σχήμα ακολουθεί ό,τι ΚΡΑΤΑΜΕ, όχι ό,τι υπόσχεται η κατηγορία', () => {
  it('survey ΧΩΡΙΣ αποθηκευμένο περίγραμμα ⇒ πινέζα (δεν επινοείται σχήμα)', () => {
    expect(listingMapShape({ kind: 'known', provenance: 'survey', point: POINT, locatedAt: AT })).toBe('pin');
  });

  it('survey ΜΕ περίγραμμα ⇒ περίγραμμα', () => {
    const withOutline: ListingPosition = {
      kind: 'known', provenance: 'survey', point: POINT, locatedAt: AT,
      outline: [POINT, { lat: 40.641, lng: 22.945 }, { lat: 40.642, lng: 22.944 }],
    };
    expect(listingMapShape(withOutline)).toBe('outline');
  });

  it('κενό περίγραμμα ΔΕΝ μετράει ως σχήμα — άδειος πίνακας δεν είναι γεωμετρία', () => {
    const empty: ListingPosition = {
      kind: 'known', provenance: 'drawn', point: POINT, locatedAt: AT, outline: [],
    };
    expect(listingMapShape(empty)).toBe('pin');
  });

  it('🔑 OSM: πινέζα χωρίς ζωντανό περίγραμμα, περίγραμμα ΜΕ αυτό — και το ODbL μένει άθικτο', () => {
    const osm: ListingPosition = {
      kind: 'known', provenance: 'osm', point: POINT, locatedAt: AT,
      osmRef: { elementType: 'way', elementId: '123', seenAt: AT },
    };
    expect(listingMapShape(osm)).toBe('pin');
    expect(listingMapShape(osm, [POINT, { lat: 40.641, lng: 22.945 }])).toBe('outline');
  });
});

describe('Κ4 — ο μετρητής και ο χάρτης απαντούν από ΤΗΝ ΙΔΙΑ συνάρτηση', () => {
  const ALL: ListingMapShape[] = ['outline', 'pin', 'pin-with-ring', 'shaded-circle', 'shaded-city', 'none'];

  it('«χαρτογραφημένο» σημαίνει ακριβώς «έχει σχήμα» — καμία τρίτη απάντηση', () => {
    expect(ALL.filter(isMappedShape)).toEqual(['outline', 'pin', 'pin-with-ring', 'shaded-circle', 'shaded-city']);
    expect(ALL.filter((s) => !isMappedShape(s))).toEqual(['none']);
  });

  it('η λογιστική κλείνει όταν οι δύο κάδοι προκύπτουν από το ίδιο κριτήριο', () => {
    const positions: ListingPosition[] = [
      geocoded('exact'), geocoded('center'),
      { kind: 'unknown', reason: 'never-asked' },
      { kind: 'unknown', reason: 'owner-declined' },
    ];
    const shapes = positions.map((p) => listingMapShape(p));
    const mapped = shapes.filter(isMappedShape).length;
    expect(ledgerBalances({ total: positions.length, mapped, unmapped: positions.length - mapped })).toBe(true);
    expect(mapped).toBe(2);
  });

  it('🔴 λογιστική που ΔΕΝ κλείνει ανιχνεύεται — ο φρουρός δεν είναι διακοσμητικός', () => {
    expect(ledgerBalances({ total: 14, mapped: 11, unmapped: 2 })).toBe(false);
  });
});

describe('Κ5 — άγνωστη κατάσταση ΣΚΑΕΙ με όνομα, δεν πέφτει σε «κανένα σχήμα»', () => {
  it('άγνωστη προέλευση ⇒ σφάλμα, ΟΧΙ σιωπηλό «none»', () => {
    const rogue = { kind: 'known', provenance: 'telepathy', point: POINT, locatedAt: AT } as unknown as ListingPosition;
    // ⚠️ Το μήνυμα είναι **αγγλικό επίτηδες**: είναι μήνυμα προγραμματιστή σε `src/lib`,
    // δεν φτάνει ποτέ σε οθόνη (σύμβαση N.11). Η άγκυρα κλειδώνει ότι **ονομάζει** την
    // αιτία — όχι τη γλώσσα.
    expect(() => listingMapShape(rogue)).toThrow(/unknown position provenance/);
  });

  it('άγνωστη ακρίβεια ⇒ σφάλμα με όνομα', () => {
    const rogue = { kind: 'known', provenance: 'geocoded', point: POINT, locatedAt: AT, accuracy: 'vibes' } as unknown as ListingPosition;
    expect(() => listingMapShape(rogue)).toThrow(/unknown geocoder accuracy/);
  });

  it('🔑 γιατί έχει σημασία: ένα σιωπηλό «none» θα ΜΕΤΡΙΟΤΑΝ ως «χωρίς δηλωμένη θέση»', () => {
    // Δηλαδή το σφάλμα θα φορούσε τη στολή έγκυρης κατάστασης και θα έμπαινε στον
    // μετρητή σαν αληθινό — η λογιστική θα «έκλεινε» πάνω σε βλάβη.
    const rogue = { kind: 'known', provenance: 'telepathy', point: POINT, locatedAt: AT } as unknown as ListingPosition;
    let counted = 0;
    try { if (!isMappedShape(listingMapShape(rogue))) counted += 1; } catch { /* σωστά */ }
    expect(counted).toBe(0);
  });
});
