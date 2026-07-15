/**
 * performDetailedHitTest capability coverage (ADR-587 Φ10 — seam C).
 *
 * Το τρίτο seam της αλυσίδας hover/κλικ, και το **μόνο με γενναιόδωρο default**: χωρίς
 * per-type handler ο τύπος ΔΕΝ εξαφανίζεται — δέχεται το pick με ακρίβεια-bbox (το broad
 * phase έχει ήδη επιβεβαιώσει ότι το σημείο είναι μέσα στο AABB).
 *
 * ⚠️ **Συνειδητή ασυμμετρία, τεκμηριωμένη — ΟΧΙ bug προς «διόρθωση».** Αν το γυρίζαμε σε
 * `null` (όπως τα άλλα δύο seams), κάθε τύπος χωρίς ακριβές test θα γινόταν ΜΗ-επιλέξιμος:
 * θα σπάγαμε τη σκάλα, τα MEP, τα έπιπλα. Το σωστό ερώτημα δεν είναι «γιατί δεν είναι null;»
 * αλλά «ποιοι τύποι είναι bbox-only, και το ξέρουμε;». Αυτό ακριβώς καρφώνει το partition
 * παρακάτω: νέος renderable τύπος → σπάει → κάποιος αποφασίζει ΣΥΝΕΙΔΗΤΑ σε ποια πλευρά ανήκει.
 */

// Firebase auth mock — τα type barrels (text-box / BIM projections) αγγίζουν auth στο import path.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { performDetailedHitTest, NARROW_HIT_TEST_SUPPORTED_TYPES } from '../hit-test-entity-tests';
import { RENDERABLE_ENTITY_TYPES } from '../../contract/renderable-entity-type';
import { makeEntityModel } from './renderable-entity-fixtures';
import type { Entity } from '../../../types/entities';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();
const asEntity = (type: string): Entity => makeEntityModel(type) as unknown as Entity;

/** Renderable τύποι με ΑΚΡΙΒΕΣ narrow-phase test (σφιχτότερο από το AABB). */
const PRECISE = [
  // CAD: απόσταση-από-γεωμετρία ή polygon containment.
  'line', 'circle', 'arc', 'polyline', 'lwpolyline', 'rectangle', 'rect',
  'text', 'mtext', 'angle-measurement', 'dimension', 'xline', 'ray', 'hatch',
  // Annotations: το AABB τους έχει άδειες γωνίες (κυκλικό σύμβολο / περιστραμμένη μπάρα ή
  // ταμπέλα / περιστραμμένη εικόνα) — χωρίς ακριβές test θα φωτίζονταν από το πουθενά.
  'annotation-symbol', 'scale-bar', 'opening-info-tag', 'image',
  // BIM με cached outline/footprint → point-in-polygon (ADR-363 Bug 1: αλλιώς ο τοίχος
  // κέρδιζε πάντα το άνοιγμα, γιατί και τα δύο δέχονταν το ίδιο bbox pick).
  'opening', 'slab-opening', 'slab', 'wall', 'column', 'beam', 'foundation',
  'floor-finish', 'wall-covering', 'space-separator',
  // ADR-662 Φάση 2β (Δρόμος Γ) — topo surface: point-in-polygon footprint containment
  // (σφιχτότερο από το AABB — κλικ έξω από το μη-κυρτό περίγραμμα δεν επιλέγει).
  'topo-surface',
] as const;

/**
 * Renderable τύποι που πέφτουν ΣΥΝΕΙΔΗΤΑ στο permissive bbox fallback. Επιλέξιμοι —
 * απλώς με ακρίβεια AABB αντί για ακριβές περίγραμμα. Ο λόγος ανά ομάδα:
 */
const BBOX_FALLBACK = [
  // Καμπύλες/σημεία χωρίς narrow-phase υλοποίηση. Το AABB τους είναι σφιχτό ούτως ή άλλως
  // (η έλλειψη γεμίζει το bbox της· το σημείο ΕΙΝΑΙ το bbox του).
  'ellipse', 'spline', 'point',
  // Σκάλα: ακριβές test σε πατήματα/φουρούσια = ξεχωριστό ratchet (ADR-363 σχόλιο). Μέχρι
  // τότε bbox — επιλέξιμη, απλώς όχι «ανάμεσα στα σκαλοπάτια».
  'stair',
  // Path/mesh-based BIM: το footprint δεν είναι cached ως polygon εδώ (railing = διαδρομή,
  // roof = κεκλιμένες έδρες, furniture = mesh). Το geometry.bbox δίνει ήδη σφιχτό AABB.
  'railing', 'roof', 'furniture', 'floorplan-symbol',
  // Αναλυτικός χώρος: το κλικ οπουδήποτε μέσα στο κουτί του ΕΙΝΑΙ η επιθυμητή σημασιολογία.
  'thermal-space',
  // Point-based MEP: μικρά σύμβολα — το AABB τους ΕΙΝΑΙ πρακτικά το σχήμα τους.
  'mep-fixture', 'electrical-panel', 'mep-manifold', 'mep-radiator', 'mep-boiler',
  'mep-water-heater', 'mep-segment', 'mep-fitting', 'mep-underfloor',
] as const;

describe('narrow-phase hit-test coverage — ζωντανό registry ↔ descriptor domain (ADR-587 Φ10)', () => {
  it('PRECISE ∪ BBOX_FALLBACK = RENDERABLE_ENTITY_TYPES (exhaustive + disjoint)', () => {
    const partition = [...PRECISE, ...BBOX_FALLBACK];
    expect(new Set(partition).size).toBe(partition.length); // disjoint
    expect(asSorted(partition)).toEqual(asSorted([...RENDERABLE_ENTITY_TYPES])); // exhaustive
  });

  it('το PRECISE golden συμφωνεί με το ζωντανό registry (καμία σιωπηλή προσθαφαίρεση handler)', () => {
    const renderable = new Set<string>(RENDERABLE_ENTITY_TYPES);
    const livePrecise = NARROW_HIT_TEST_SUPPORTED_TYPES.filter((t) => renderable.has(t));
    expect(asSorted(livePrecise)).toEqual(asSorted([...PRECISE]));
  });

  it.each(BBOX_FALLBACK)('fallback pin: "%s" ΠΑΡΑΜΕΝΕΙ επιλέξιμο (permissive bbox pick, όχι null)', (type) => {
    // Η ασυμμετρία με τα seams A/B: εδώ το «δεν ξέρω» ΔΕΝ σημαίνει «δεν υπάρχει».
    const hit = performDetailedHitTest(asEntity(type), { x: 50, y: 25 }, 5);
    expect(hit).not.toBeNull();
    expect(hit!.hitType).toBe('entity');
  });

  it('precise pin: το ακριβές test ΑΣΤΟΧΕΙ μακριά από τη γεωμετρία (εκεί που το bbox θα δεχόταν)', () => {
    // Η εικόνα: 100×50 στο (0,0). Μέσα → hit· πολύ έξω → miss. Ένας bbox-only τύπος θα
    // δεχόταν οτιδήποτε το broad phase του έδινε — γι' αυτό η ακρίβεια μετράει.
    const image = asEntity('image');
    expect(performDetailedHitTest(image, { x: 50, y: 25 }, 1)).not.toBeNull();
    expect(performDetailedHitTest(image, { x: 5000, y: 5000 }, 1)).toBeNull();
  });

  it('άγνωστος τύπος → permissive fallback (το broad phase έχει ήδη αποφανθεί)', () => {
    const unknown = { id: 'x', type: 'totally-unknown', layerId: 'L' } as unknown as Entity;
    expect(performDetailedHitTest(unknown, { x: 0, y: 0 }, 1)).toEqual({
      hitType: 'entity',
      hitPoint: { x: 0, y: 0 },
    });
  });
});
