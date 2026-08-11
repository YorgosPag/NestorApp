/**
 * @fileoverview Άγκυρες για τη **μοναδική πόρτα γραφής του επιπέδου Α** (ADR-777).
 * @related services/places/public-place-write.service.ts · SPEC-777A §13.3 · §13.5 · §14.5
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΡΟΥΡΕΙΤΑΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Άγκυρα | Υπόσχεση |
 * |---|---|
 * | Κ1-Κ3 | **μία ταυτότητα ανά φυσικό κτίριο** (§14.5) — idempotency μέσω φυσικού κλειδιού OSM |
 * | Κ4 | γη και κτίριο γεννιούνται **μαζί** — ποτέ ξένο κλειδί στο πουθενά |
 * | Κ5-Κ6 | η **εγγύτητα ΡΩΤΑΕΙ**, δεν αποφασίζει (§13.3) |
 * | Κ7 | «δεν κοίταξα όλους» **δεν** γίνεται «δεν υπάρχει» |
 * | Κ8-Κ10 | οι αρνήσεις της πηγής ταξιδεύουν **ξεχωριστές** |
 * | Κ11 | η **πράξη** της συγχώνευσης (§14.3) |
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { PublicBuilding, PublicLand } from '@/types/geo/public-place';
import { FakeFirestore } from './fake-firestore';

jest.mock('../place-source-verification', () => ({
  verifyPlaceClaim: jest.fn(),
}));

import { verifyPlaceClaim } from '../place-source-verification';
import { attestPlace, resolvePlace } from '../public-place-write.service';
import type { ResolvedPlaceFacts } from '@/lib/places/place-facts';

const mockedVerify = verifyPlaceClaim as jest.MockedFunction<typeof verifyPlaceClaim>;

const AT = '2026-08-11T10:00:00.000Z';
const CLICK = { gesture: 'picked-osm-building', elementType: 'way', elementId: '27931128' } as const;
const PIN = { gesture: 'dropped-pin', point: { lat: 40.6405, lng: 22.9410 } } as const;

const OSM_FACTS: ResolvedPlaceFacts = {
  provenance: 'osm',
  point: { lat: 40.6404, lng: 22.9450 },
  outline: null,
  osmRef: { elementType: 'way', elementId: '27931128', seenAt: AT },
  accuracy: null,
  displayAddress: 'Εγνατία 147, Θεσσαλονίκη',
  floorsAboveGround: null,
  constructionYear: null,
};

const PIN_FACTS: ResolvedPlaceFacts = {
  provenance: 'manual',
  point: { lat: 40.6405, lng: 22.9410 },
  outline: null,
  osmRef: null,
  accuracy: null,
  displayAddress: null,
  floorsAboveGround: null,
  constructionYear: null,
};

function verifies(facts: ResolvedPlaceFacts): void {
  mockedVerify.mockResolvedValue({ kind: 'verified', facts });
}

let db: FakeFirestore;
const asAdmin = (): AdminFirestore => db as unknown as AdminFirestore;

beforeEach(() => {
  db = new FakeFirestore();
  mockedVerify.mockReset();
});

// =============================================================================
describe('resolvePlace — ταυτότητα κατ’ απαίτηση, ΜΙΑ ανά φυσικό κτίριο', () => {
  it('Κ1 — πρώτη φορά: γεννιέται γη + κτίριο με ΔΙΚΕΣ ΜΑΣ ταυτότητες, ποτέ OSM id', async () => {
    verifies(OSM_FACTS);

    const result = await resolvePlace(asAdmin(), { claim: CLICK, target: 'building' }, AT);

    expect(result.kind).toBe('resolved');
    if (result.kind !== 'resolved') return;
    expect(result.created).toBe(true);
    expect(result.ref.landId).toMatch(/^land_/);
    expect(result.ref.buildingId).toMatch(/^pbld_/);
    // 🔴 §13.2 — η ταυτότητα ΔΕΝ είναι ποτέ το OSM id.
    expect(result.ref.buildingId).not.toContain('27931128');
  });

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ §14.5**: *«μία ταυτότητα ανά φυσικό κτίριο … το ταίριασμα
   * γίνεται δυνατό **επειδή** το Α είναι ένα»*. Δύο άνθρωποι που πάτησαν το **ίδιο**
   * way πάτησαν **το ίδιο πράγμα** — και αν πάρουν δύο ταυτότητες, η ζήτηση του ενός
   * δεν θα συναντήσει ποτέ την προσφορά του άλλου (ADR-749, στην πιο ακριβή μορφή).
   */
  it('Κ2 — δεύτερη φορά ΙΔΙΟ στοιχείο OSM: ΙΔΙΑ ταυτότητα, χωρίς νέα έγγραφα', async () => {
    verifies(OSM_FACTS);
    const first = await resolvePlace(asAdmin(), { claim: CLICK, target: 'building' }, AT);
    const second = await resolvePlace(asAdmin(), { claim: CLICK, target: 'building' }, AT);

    if (first.kind !== 'resolved' || second.kind !== 'resolved') throw new Error('αναμενόταν resolved');
    expect(second.ref).toEqual(first.ref);
    expect(second.created).toBe(false);
    expect(db.all(COLLECTIONS.PUBLIC_LANDS)).toHaveLength(1);
    expect(db.all(COLLECTIONS.PUBLIC_BUILDINGS)).toHaveLength(1);
  });

  it('Κ3 — πρώτος ζήτησε ΟΙΚΟΠΕΔΟ, δεύτερος ΚΤΙΡΙΟ: μία γη, ένα κτίριο πάνω της', async () => {
    verifies(OSM_FACTS);
    const asLand = await resolvePlace(asAdmin(), { claim: CLICK, target: 'land' }, AT);
    const asBuilding = await resolvePlace(asAdmin(), { claim: CLICK, target: 'building' }, AT);

    if (asLand.kind !== 'resolved' || asBuilding.kind !== 'resolved') throw new Error('resolved');
    expect(asLand.ref.buildingId).toBeNull();
    expect(asBuilding.ref.landId).toBe(asLand.ref.landId);
    expect(asBuilding.ref.buildingId).toMatch(/^pbld_/);
    expect(db.all(COLLECTIONS.PUBLIC_LANDS)).toHaveLength(1);
  });

  /** 🔴 Ένα κτίριο χωρίς τη γη του είναι ξένο κλειδί στο πουθενά — **για όλους**. */
  it('Κ4 — το κτίριο δείχνει ΠΑΝΤΑ σε υπαρκτή γη', async () => {
    verifies(OSM_FACTS);
    await resolvePlace(asAdmin(), { claim: CLICK, target: 'building' }, AT);

    const [land] = db.all<PublicLand>(COLLECTIONS.PUBLIC_LANDS);
    const [building] = db.all<PublicBuilding>(COLLECTIONS.PUBLIC_BUILDINGS);
    expect(building.landId).toBe(land.id);
  });
});

// =============================================================================
describe('resolvePlace — η εγγύτητα ΡΩΤΑΕΙ, δεν αποφασίζει (§13.3)', () => {
  /** Γη με **σχήμα**, ώστε η ερώτηση να απαντηθεί με περιεκτικότητα και όχι απόσταση. */
  function seedDrawnLand(): void {
    db.seed(COLLECTIONS.PUBLIC_LANDS, 'land_existing', {
      id: 'land_existing',
      position: {
        kind: 'known',
        provenance: 'drawn',
        point: { lat: 40.6405, lng: 22.9410 },
        locatedAt: AT,
        outline: [
          { lat: 40.6400, lng: 22.9400 },
          { lat: 40.6400, lng: 22.9420 },
          { lat: 40.6410, lng: 22.9420 },
          { lat: 40.6410, lng: 22.9400 },
        ],
      },
      displayAddress: 'Υπάρχον οικόπεδο',
      areaSqm: null,
      createdAt: AT,
      updatedAt: AT,
    });
  }

  it('Κ5 — πινέζα ΜΕΣΑ σε γνωστό περίγραμμα ⇒ ΕΡΩΤΗΣΗ, καμία γραφή', async () => {
    seedDrawnLand();
    verifies(PIN_FACTS);

    const result = await resolvePlace(asAdmin(), { claim: PIN, target: 'land' }, AT);

    expect(result.kind).toBe('duplicate-candidate');
    if (result.kind !== 'duplicate-candidate') return;
    expect(result.existing.landId).toBe('land_existing');
    expect(db.writes).toBe(0);
  });

  it('Κ6 — ο άνθρωπος απαντά «είναι άλλο» ⇒ νέα ταυτότητα', async () => {
    seedDrawnLand();
    verifies(PIN_FACTS);

    const result = await resolvePlace(
      asAdmin(),
      { claim: PIN, target: 'land', distinctFromNearby: true },
      AT,
    );

    expect(result.kind).toBe('resolved');
    expect(db.all(COLLECTIONS.PUBLIC_LANDS)).toHaveLength(2);
  });

  /**
   * 🔴 **«Δεν κοίταξα όλους» ΔΕΝ είναι «δεν υπάρχει».** Προτιμάται η ρητή άρνηση από
   * τη σιωπηλή γέννηση δεύτερης ταυτότητας: ο άνθρωπος ξαναδοκιμάζει, ένα διπλότυπο
   * δεν ξαναδοκιμάζεται.
   */
  it('Κ7 — εξαντλημένο όριο ανάγνωσης ⇒ άρνηση, ΠΟΤΕ σιωπηλή γέννηση', async () => {
    for (let i = 0; i < 500; i++) {
      db.seed(COLLECTIONS.PUBLIC_LANDS, `land_${i}`, {
        id: `land_${i}`,
        position: { kind: 'known', provenance: 'manual', point: { lat: 40.6405, lng: 22.9410 }, locatedAt: AT },
        displayAddress: null,
        areaSqm: null,
        createdAt: AT,
        updatedAt: AT,
      });
    }
    verifies(PIN_FACTS);

    const result = await resolvePlace(asAdmin(), { claim: PIN, target: 'land' }, AT);

    expect(result).toEqual({ kind: 'unavailable', reason: 'duplicate-check' });
    expect(db.writes).toBe(0);
  });

  /**
   * ⚠️ Γη που ξέρουμε **μόνο ως σημείο** δεν έχει «μέσα». Το να ρωτούσαμε «πόσο
   * κοντά;» θα ήταν η **εικασία εγγύτητας** που απαγορεύει το §13.3 — οπότε δεν
   * ρωτιέται, και η απάντηση είναι ειλικρινής.
   */
  it('Κ8 — γη ΧΩΡΙΣ σχήμα δεν γεννά ερώτηση διπλότυπου, όσο κοντά κι αν είναι', async () => {
    db.seed(COLLECTIONS.PUBLIC_LANDS, 'land_point_only', {
      id: 'land_point_only',
      position: { kind: 'known', provenance: 'manual', point: { lat: 40.6405, lng: 22.9410 }, locatedAt: AT },
      displayAddress: null,
      areaSqm: null,
      createdAt: AT,
      updatedAt: AT,
    });
    verifies(PIN_FACTS);

    expect((await resolvePlace(asAdmin(), { claim: PIN, target: 'land' }, AT)).kind).toBe('resolved');
  });
});

// =============================================================================
describe('resolvePlace — οι αρνήσεις ταξιδεύουν ΞΕΧΩΡΙΣΤΕΣ', () => {
  it('Κ9 — δομικό ελάττωμα ⇒ `malformed` με το ΟΝΟΜΑ του', async () => {
    mockedVerify.mockResolvedValue({ kind: 'malformed', defect: 'outline-self-intersecting' });

    expect(await resolvePlace(asAdmin(), { claim: PIN, target: 'land' }, AT)).toEqual({
      kind: 'malformed',
      defect: 'outline-self-intersecting',
    });
    expect(db.writes).toBe(0);
  });

  it('Κ10 — άρνηση πηγής ⇒ `rejected`· αδυναμία πηγής ⇒ `unavailable`. ΠΟΤΕ το ίδιο', async () => {
    mockedVerify.mockResolvedValue({ kind: 'rejected', reason: 'osm-absent' });
    expect(await resolvePlace(asAdmin(), { claim: CLICK, target: 'building' }, AT)).toEqual({
      kind: 'rejected',
      reason: 'osm-absent',
    });

    mockedVerify.mockResolvedValue({ kind: 'unavailable' });
    expect(await resolvePlace(asAdmin(), { claim: CLICK, target: 'building' }, AT)).toEqual({
      kind: 'unavailable',
      reason: 'source',
    });
  });
});

// =============================================================================
describe('attestPlace — η ΠΡΑΞΗ της συγχώνευσης (§14.3)', () => {
  it('Κ11 — ισχυρότερη πηγή ανεβαίνει στο κοινό· η ασθενέστερη ΟΧΙ', async () => {
    db.seed(COLLECTIONS.PUBLIC_LANDS, 'land_1', {
      id: 'land_1',
      position: { kind: 'known', provenance: 'geocoded', point: { lat: 40.0, lng: 22.0 }, locatedAt: AT, accuracy: 'center' },
      displayAddress: null,
      areaSqm: null,
      createdAt: AT,
      updatedAt: AT,
    });

    verifies(OSM_FACTS);
    const up = await attestPlace(asAdmin(), { landId: 'land_1', buildingId: null }, CLICK, AT);

    expect(up.kind).toBe('resolved');
    if (up.kind !== 'resolved') return;
    expect(up.merged).toContain('position');

    // …και τώρα μια ασθενέστερη πρόταση δεν αλλάζει τίποτα.
    verifies(PIN_FACTS);
    const down = await attestPlace(asAdmin(), { landId: 'land_1', buildingId: null }, PIN, AT);

    if (down.kind !== 'resolved') throw new Error('αναμενόταν resolved');
    expect(down.merged).toEqual([]);
  });

  it('Κ12 — πρόταση για γη που δεν υπάρχει ⇒ ρητή αστοχία, όχι σιωπηλή δημιουργία', async () => {
    verifies(OSM_FACTS);
    const result = await attestPlace(asAdmin(), { landId: 'land_ghost', buildingId: null }, CLICK, AT);

    expect(result).toEqual({ kind: 'failed', message: 'NO_SUCH_LAND' });
    expect(db.all(COLLECTIONS.PUBLIC_LANDS)).toHaveLength(0);
  });
});
