/**
 * @fileoverview **ΤΟ ΕΣΩΤΕΡΙΚΟ ΚΑΛΥΜΜΑ** — «μπορεί ένα μακρόστενο σχήμα να πει *σε
 * περιέχω*;» *(ADR-846 §9 #11)*.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΥΠΑΡΧΕΙ — ΤΟ ΕΥΡΗΜΑ ΖΟΥΣΕ ΣΤΑ **ΔΕΔΟΜΕΝΑ**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Το ζωντανό περπάτημα της Φ5δ βρήκε ότι το γραφείο **δεν εμφανίζεται** στον ΔΗΜΟ
 * ΘΕΣΣΑΛΟΝΙΚΗΣ παρότι έχει εκεί **δύο** ακίνητα. Καμία από τις **528** άγκυρες δεν
 * μπορούσε να το δει, και ο λόγος είναι διδακτικός:
 *
 * > **όλες τροφοδοτούσαν ΚΑΤΑΣΚΕΥΑΣΜΕΝΑ `GeoFootprint` με ΥΓΙΕΣ `innerKm`.**
 *
 * Η αστοχία δεν ζούσε στη λογική — ζούσε στη σχέση ανάμεσα στο **σχήμα** ενός
 * πραγματικού ορίου και στην **αναπαράστασή** του. Ένα test που γράφει μόνο του τις
 * εισόδους του **δεν μπορεί** να βρει τέτοιο πράγμα.
 *
 * ⇒ Γι' αυτό εδώ οι είσοδοι είναι **σχήματα**, όχι αποτυπώματα: δίνουμε πολύγωνα με
 * τη **γεωμετρία που έσπασε** *(μακρόστενο, με τρύπα, με βραχίονες)* και ρωτάμε το
 * ίδιο ερώτημα που ρωτά η οθόνη.
 *
 * @module lib/geo/__tests__/geo-interior-cover
 */

import {
  DEFAULT_INTERIOR_COVER,
  footprintInteriorDiscs,
  interiorCircleCover,
  interiorContainsCircle,
} from '../geo-interior-cover';
import { geoRingsInscribedRadius, isPointInGeoRings } from '../geo-ring';
import { distanceMeters } from '../geo-distance';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

/** Ορθογώνιο από γωνία σε γωνία — ο πιο άμεσος τρόπος να γράψεις «σχήμα». */
function box(minLat: number, minLng: number, maxLat: number, maxLng: number): GeoOutline {
  return [
    { lat: minLat, lng: minLng },
    { lat: minLat, lng: maxLng },
    { lat: maxLat, lng: maxLng },
    { lat: maxLat, lng: minLng },
  ];
}

/**
 * 🔴 **Η ΓΕΩΜΕΤΡΙΑ ΠΟΥ ΕΣΠΑΣΕ**, σε καθαρή μορφή: λωρίδα ~11 χλμ × ~1,1 χλμ στο ύψος
 * της Θεσσαλονίκης. Ο μέγιστος εγγεγραμμένος κύκλος έχει ακτίνα ≈ **μισό πλάτος**,
 * δηλαδή δεν μπορεί να καλύψει παρά ένα κλάσμα του μήκους.
 */
const COASTAL_STRIP: readonly GeoOutline[] = [box(40.62, 22.88, 40.63, 23.01)];

/** Ένα «χοντρό» σχήμα, όπου **ένας** δίσκος αρκεί — ο παρονομαστής. */
const COMPACT_BLOB: readonly GeoOutline[] = [box(37.95, 23.70, 38.05, 23.82)];

/** Δακτύλιος: εξωτερικό τετράγωνο με **τρύπα** στη μέση. */
const WITH_HOLE: readonly GeoOutline[] = [
  box(39.0, 22.0, 39.2, 22.2),
  box(39.08, 22.08, 39.12, 22.12),
];

describe('ADR-846 §9 #11 — Α: η εγγύηση (κάθε δίσκος ΟΛΟΚΛΗΡΟΣ μέσα)', () => {
  const shapes: readonly [string, readonly GeoOutline[]][] = [
    ['λωρίδα', COASTAL_STRIP],
    ['συμπαγές', COMPACT_BLOB],
    ['με τρύπα', WITH_HOLE],
  ];

  it.each(shapes)('«%s» — κάθε δίσκος έχει κέντρο μέσα και ακτίνα ≤ απόσταση ακμής', (_n, rings) => {
    const { discs } = interiorCircleCover(rings);
    expect(discs.length).toBeGreaterThan(0);
    for (const disc of discs) {
      expect(isPointInGeoRings(disc.center, rings)).toBe(true);
      // Η ακτίνα δεν ξεπερνά τον μέγιστο εγγεγραμμένο σε αυτό το κέντρο.
      expect(disc.radiusKm).toBeLessThanOrEqual(geoRingsInscribedRadius(rings, disc.center) + 1e-9);
    }
  });

  it('🔒 ΚΑΝΕΝΑΣ δίσκος δεν ακουμπά την τρύπα — ο δακτύλιος δεν καταπίνεται', () => {
    const { discs } = interiorCircleCover(WITH_HOLE);
    const holeCentre: GeoPoint = { lat: 39.1, lng: 22.1 };
    for (const disc of discs) {
      const gapKm = distanceMeters(disc.center, holeCentre) / 1000;
      // Αν ο δίσκος έφτανε το κέντρο της τρύπας, θα την είχε καταπιεί.
      expect(gapKm).toBeGreaterThan(disc.radiusKm);
    }
  });
});

describe('ADR-846 §9 #11 — Β: η θεραπεία (το μακρόστενο ξαναμιλά)', () => {
  it('🔴 ΕΝΑΣ δίσκος καλύπτει ελάχιστο κλάσμα της λωρίδας — το σφάλμα, μετρημένο', () => {
    const { singleDiscCoverage } = interiorCircleCover(COASTAL_STRIP);
    expect(singleDiscCoverage).toBeLessThan(0.35);
  });

  it('✅ το κάλυμμα ανεβάζει την κάλυψη πολλαπλάσια', () => {
    const cover = interiorCircleCover(COASTAL_STRIP);
    expect(cover.discs.length).toBeGreaterThan(1);
    expect(cover.coverage).toBeGreaterThan(cover.singleDiscCoverage * 2);
  });

  it('🏆 Η ΚΑΡΔΙΑ ΤΟΥ ΕΥΡΗΜΑΤΟΣ: υπάρχουν σημεία που ΕΝΑΣ δίσκος αρνείται και το κάλυμμα δέχεται', () => {
    const cover = interiorCircleCover(COASTAL_STRIP);
    const single = cover.discs.slice(0, 1);

    // Σαρώνουμε τη λωρίδα κατά μήκος και μετράμε **πόσα** σημεία κερδίζονται.
    const rescued: GeoPoint[] = [];
    for (let step = 0; step <= 100; step += 1) {
      const probe: GeoPoint = { lat: 40.625, lng: 22.88 + (0.13 * step) / 100 };
      if (!isPointInGeoRings(probe, COASTAL_STRIP)) continue;
      const bySingle = interiorContainsCircle(single, probe, 0);
      const byCover = interiorContainsCircle(cover.discs, probe, 0);
      // 🔒 Ό,τι δεχόταν ο ένας δίσκος, το δέχεται ΚΑΙ το κάλυμμα — ποτέ παλινδρόμηση.
      if (bySingle) expect(byCover).toBe(true);
      if (!bySingle && byCover) rescued.push(probe);
    }

    // Το μακρόστενο σχήμα κερδίζει **ουσιαστικό** μέρος του μήκους του πίσω.
    expect(rescued.length).toBeGreaterThan(20);
  });

  it('⚠️ ΤΟ ΤΑΒΑΝΙ ΕΧΕΙ ΤΙΜΗΜΑ, ΚΑΙ ΔΗΛΩΝΕΤΑΙ: πολύ μακριά λωρίδα ΔΕΝ καλύπτεται πλήρως', () => {
    // 🔑 Αυτό **δεν είναι σφάλμα** — είναι το συντηρητικό «δεν ξέρω» που επιλέξαμε
    //    αντί για ψεύτικο «ναι». Με `maxDiscs` δίσκους ακτίνας ~μισό-πλάτος, ένα
    //    σχήμα αυθαίρετου μήκους δεν γίνεται να καλυφθεί ολόκληρο. Η άγκυρα υπάρχει
    //    ώστε το τίμημα να είναι **γραμμένο**, όχι να ανακαλυφθεί ξανά στην οθόνη.
    const cover = interiorCircleCover(COASTAL_STRIP);
    expect(cover.coverage).toBeLessThan(1);
    expect(cover.discs.length).toBeLessThanOrEqual(DEFAULT_INTERIOR_COVER.maxDiscs);
  });

  it('το συμπαγές σχήμα ΔΕΝ χρειάζεται κάλυμμα — ο ένας δίσκος φτάνει', () => {
    const { singleDiscCoverage } = interiorCircleCover(COMPACT_BLOB);
    expect(singleDiscCoverage).toBeGreaterThan(DEFAULT_INTERIOR_COVER.targetCoverage * 0.6);
  });
});

describe('ADR-846 §9 #11 — Γ: η συντηρητικότητα (ποτέ ψεύτικο «ναι»)', () => {
  it('🔒 σημείο ΕΞΩ από το σχήμα δεν γίνεται ποτέ δεκτό', () => {
    const cover = interiorCircleCover(COASTAL_STRIP);
    const outside: GeoPoint = { lat: 40.70, lng: 22.94 };
    expect(isPointInGeoRings(outside, COASTAL_STRIP)).toBe(false);
    expect(interiorContainsCircle(cover.discs, outside, 0)).toBe(false);
  });

  it('🔒 κύκλος που ΞΕΦΕΥΓΕΙ από τη λωρίδα απορρίπτεται, όσο κεντρικό κι αν είναι το κέντρο του', () => {
    const cover = interiorCircleCover(COASTAL_STRIP);
    const centre: GeoPoint = { lat: 40.625, lng: 22.945 };
    // Η λωρίδα έχει ημι-πλάτος ~0,55 χλμ· κύκλος 5 χλμ βγαίνει σίγουρα έξω.
    expect(interiorContainsCircle(cover.discs, centre, 5)).toBe(false);
  });

  it('⚠️ ο έλεγχος είναι ΑΝΑ ΔΙΣΚΟ, ποτέ αθροιστικός — η ένωση δεν μετρά', () => {
    // Δύο εφαπτόμενοι δίσκοι του 1 χλμ. Κύκλος 1,5 χλμ στο σημείο επαφής χωράει στην
    // **ένωση** αλλά σε **κανέναν** ξεχωριστά ⇒ η απάντηση πρέπει να είναι «όχι».
    const discs = [
      { center: { lat: 40.0, lng: 22.0 }, radiusKm: 1 },
      { center: { lat: 40.018, lng: 22.0 }, radiusKm: 1 },
    ];
    const touch: GeoPoint = { lat: 40.009, lng: 22.0 };
    expect(interiorContainsCircle(discs, touch, 1.5)).toBe(false);
  });
});

describe('ADR-846 §9 #11 — Δ: η συμβατότητα (k = 1 είναι η ΠΑΛΙΑ συμπεριφορά)', () => {
  it('χωρίς `interior`, ο αναγνώστης δίνει ΑΚΡΙΒΩΣ τον έναν δίσκο του `innerKm`', () => {
    const footprint = { center: { lat: 40.6, lng: 22.9 }, innerKm: 3, outerKm: 9 };
    expect(footprintInteriorDiscs(footprint)).toEqual([
      { center: { lat: 40.6, lng: 22.9 }, radiusKm: 3 },
    ]);
  });

  it('`innerKm === 0` χωρίς κάλυμμα ⇒ ΚΑΝΕΝΑΣ δίσκος — το «δεν μπορώ να ορκιστώ»', () => {
    const footprint = { center: { lat: 40.6, lng: 22.9 }, innerKm: 0, outerKm: 9 };
    expect(footprintInteriorDiscs(footprint)).toEqual([]);
    expect(interiorContainsCircle(footprintInteriorDiscs(footprint), { lat: 40.6, lng: 22.9 }, 0))
      .toBe(false);
  });

  it('όταν υπάρχει `interior`, ΑΥΤΟ απαντά — όχι το `innerKm`', () => {
    const interior = [{ center: { lat: 41.0, lng: 21.0 }, radiusKm: 2 }];
    const footprint = { center: { lat: 40.6, lng: 22.9 }, innerKm: 3, outerKm: 9, interior };
    expect(footprintInteriorDiscs(footprint)).toBe(interior);
  });

  it('κενό `interior` ΔΕΝ σβήνει τον δίσκο του `innerKm` — άδειος πίνακας ≠ δήλωση', () => {
    const footprint = { center: { lat: 40.6, lng: 22.9 }, innerKm: 3, outerKm: 9, interior: [] };
    expect(footprintInteriorDiscs(footprint)).toHaveLength(1);
  });
});

describe('ADR-846 §9 #11 — Ε: τα όρια που δηλώνονται', () => {
  it('σέβεται το ταβάνι δίσκων', () => {
    const cover = interiorCircleCover(COASTAL_STRIP, { ...DEFAULT_INTERIOR_COVER, maxDiscs: 3 });
    expect(cover.discs.length).toBeLessThanOrEqual(3);
  });

  it('δεν προσθέτει δίσκους κάτω από το ελάχιστο', () => {
    const cover = interiorCircleCover(COASTAL_STRIP, { ...DEFAULT_INTERIOR_COVER, minDiscKm: 0.5 });
    for (const disc of cover.discs) expect(disc.radiusKm).toBeGreaterThanOrEqual(0.5);
  });

  it('σχήμα χωρίς εμβαδό ⇒ κενό κάλυμμα, καμία εξαίρεση', () => {
    const degenerate: readonly GeoOutline[] = [[
      { lat: 40, lng: 22 }, { lat: 40, lng: 22 }, { lat: 40, lng: 22 },
    ]];
    expect(interiorCircleCover(degenerate).discs).toEqual([]);
  });

  it('οι δίσκοι βγαίνουν με ΦΘΙΝΟΥΣΑ ακτίνα — ο πρώτος είναι ο μέγιστος εγγεγραμμένος', () => {
    const { discs } = interiorCircleCover(COASTAL_STRIP);
    for (let i = 1; i < discs.length; i += 1) {
      expect(discs[i].radiusKm).toBeLessThanOrEqual(discs[i - 1].radiusKm);
    }
  });
});
