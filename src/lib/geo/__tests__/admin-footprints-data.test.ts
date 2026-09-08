/**
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ ΠΑΝΩ ΣΤΑ ΠΡΑΓΜΑΤΙΚΑ ΔΕΔΟΜΕΝΑ** — ADR-846 Φάση 2.5.
 *
 * Οι υπόλοιπες άγκυρες *(`coverage-footprint-match.test.ts`, 17 tests)* κρίνουν τη
 * **λογική** με συνθετικά αποτυπώματα. Αυτή τρέχει τον **πραγματικό αναγνώστη** πάνω στο
 * **παραγόμενο αρχείο** — δηλαδή απαντά στην ερώτηση που κανένα συνθετικό test δεν
 * μπορεί: *«είναι τα δεδομένα που ΔΙΑΝΕΜΟΥΜΕ σωστά;»*.
 *
 * 🔑 **Το `fetch` δείχνει στον δίσκο, όχι σε mock δεδομένα.** Ένα mock θα επικύρωνε τη
 * φαντασία μας· εδώ περνά **το ίδιο αρχείο** που φτάνει στον φυλλομετρητή, μέσα από
 * **τον ίδιο** κώδικα ανάγνωσης και επικύρωσης.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { coverageRelation } from '@/lib/agency/coverage-match';
import { asCoverageRadiusKm } from '@/types/agency-coverage';
import { ADMIN_FOOTPRINTS_SOURCE, footprintOf } from '../admin-footprints';
import { lineageIdsOf } from '@/hooks/useAdministrativeHierarchy';

const FOOTPRINTS_PATH = join(process.cwd(), 'public', 'data', 'admin-footprints.json');
const HIERARCHY_PATH = join(process.cwd(), 'public', 'data', 'administrative-hierarchy.json');

interface HierarchyRow {
  readonly id: string;
  readonly n: string;
  readonly l: number;
}

const hierarchy = JSON.parse(readFileSync(HIERARCHY_PATH, 'utf8')) as { data: HierarchyRow[] };

/** Το `id` μιας οντότητας από το **όνομά** της — τα ονόματα είναι σταθερά, τα ids όχι. */
function idOf(name: string): string {
  const row = hierarchy.data.find((entry) => entry.n === name);
  if (row === undefined) throw new Error(`Δεν βρέθηκε στην ιεραρχία: ${name}`);
  return row.id;
}

const RESOLVERS = { lineageOf: lineageIdsOf, footprintOf };

beforeAll(async () => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.endsWith('/data/admin-footprints.json')) throw new Error(`Απρόσμενο fetch: ${url}`);
    return { json: async () => JSON.parse(readFileSync(FOOTPRINTS_PATH, 'utf8')) } as Response;
  }) as typeof fetch;

  await ADMIN_FOOTPRINTS_SOURCE.load();
});

describe('το παραγόμενο αρχείο αποτυπωμάτων', () => {
  it('φορτώνεται από τον πραγματικό αναγνώστη και δεν είναι άδειο', () => {
    expect(ADMIN_FOOTPRINTS_SOURCE.peek()?.size ?? 0).toBeGreaterThan(7000);
  });

  it('🔒 outer >= inner >= 0 σε ΚΑΘΕ γραμμή — ο εγκλεισμός από τον οποίο κρέμεται κάθε απόδειξη', () => {
    const snapshot = ADMIN_FOOTPRINTS_SOURCE.peek();
    expect(snapshot).not.toBeNull();

    for (const [adminId, footprint] of snapshot!) {
      expect(footprint.innerKm).toBeGreaterThanOrEqual(0);
      expect(footprint.outerKm).toBeGreaterThanOrEqual(footprint.innerKm);
      expect(Number.isFinite(footprint.center.lat)).toBe(true);
      expect(Number.isFinite(footprint.center.lng)).toBe(true);
      // Κάθε κέντρο μέσα στο περίγραμμα της Ελλάδας — πιάνει αντιστροφή lat/lng.
      expect(footprint.center.lat).toBeGreaterThan(34);
      expect(footprint.center.lat).toBeLessThan(42);
      expect(footprint.center.lng).toBeGreaterThan(19);
      expect(footprint.center.lng).toBeLessThan(30);
      expect(adminId).toMatch(/^[a-z_]+:/);
    }
  });

  it('ο Δήμος Θέρμης έχει outer > inner > 0 και το κέντρο του πέφτει στην Π.Ε. Θεσσαλονίκης', () => {
    const thermi = footprintOf(idOf('ΔΗΜΟΣ ΘΕΡΜΗΣ'));
    const unit = footprintOf(idOf('ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ'));

    expect(thermi).not.toBeNull();
    expect(unit).not.toBeNull();
    expect(thermi!.outerKm).toBeGreaterThan(thermi!.innerKm);
    expect(thermi!.innerKm).toBeGreaterThan(0);

    // Ο δήμος χωράει ολόκληρος μέσα στον περικλείοντα κύκλο της Π.Ε. του.
    const gapKm =
      Math.hypot(
        (thermi!.center.lat - unit!.center.lat) * 111.195,
        (thermi!.center.lng - unit!.center.lng) * 111.195 * Math.cos((40.5 * Math.PI) / 180),
      );
    expect(gapKm + thermi!.outerKm).toBeLessThanOrEqual(unit!.outerKm);
  });

  it('οι διφορούμενοι κωδικοί ΔΕΝ πήραν αποτύπωμα — η εικασία θα ήταν χειρότερη από την άγνοια', () => {
    // `municipality:0502` ανήκει και στον ΔΗΜΟ ΝΕΣΤΟΥ και στον ΔΗΜΟ ΝΟΤΙΩΝ ΤΖΟΥΜΕΡΚΩΝ.
    expect(footprintOf('municipality:0502')).toBeNull();
    expect(footprintOf('municipality:1502')).toBeNull();
    expect(footprintOf('municipality:3202')).toBeNull();
  });

  it('οντότητα που δεν υπάρχει δίνει null, ποτέ σκουπίδι', () => {
    expect(footprintOf('municipality:ΔΕΝ-ΥΠΑΡΧΕΙ')).toBeNull();
    expect(footprintOf('')).toBeNull();
  });
});

describe('🏆 ΤΟ ΣΕΝΑΡΙΟ ΠΟΥ ΔΙΚΑΙΟΛΟΓΕΙ ΟΛΗ ΤΗ ΦΑΣΗ — 30 χλμ γύρω από τη Θέρμη', () => {
  // Ο επαγγελματίας δήλωσε ακτίνα 30 χλμ με κέντρο μέσα στον Δήμο Θέρμης.
  const declared = {
    circle: { center: { lat: 40.5407, lng: 23.0195 }, radiusKm: asCoverageRadiusKm(30) },
  };

  it('«Δήμος Κασσάνδρας» ⇒ ΑΠΟΔΕΔΕΙΓΜΕΝΟ disjoint (πριν τη Φ2.5 ήταν «δεν ξέρω»)', () => {
    const relation = coverageRelation(declared, { adminId: idOf('ΔΗΜΟΣ ΚΑΣΣΑΝΔΡΑΣ') }, RESOLVERS);
    expect(relation).toBe('disjoint');
  });

  it('«Δήμος Θέρμης» ⇒ within — τον καλύπτει ΟΛΟΚΛΗΡΟ', () => {
    const relation = coverageRelation(declared, { adminId: idOf('ΔΗΜΟΣ ΘΕΡΜΗΣ') }, RESOLVERS);
    expect(relation).toBe('within');
  });

  it('«Περιφερειακή Ενότητα Θεσσαλονίκης» ⇒ intersects — μέρος της, και το λέει', () => {
    const relation = coverageRelation(
      declared,
      { adminId: idOf('ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ') },
      RESOLVERS,
    );
    expect(relation).toBe('intersects');
  });

  it('🔑 Η ΑΝΤΙΣΤΡΟΦΗ ΚΑΤΕΥΘΥΝΣΗ: δηλωμένος δήμος εναντίον ΚΥΚΛΙΚΟΥ ερωτήματος', () => {
    const declaredArea = { adminIds: [idOf('ΔΗΜΟΣ ΘΕΡΜΗΣ')] };

    // Ερώτημα 2 χλμ γύρω από το κέντρο της Θέρμης ⇒ μέσα στον εγγεγραμμένο ⇒ within.
    const inside = coverageRelation(
      declaredArea,
      { circle: { center: footprintOf(idOf('ΔΗΜΟΣ ΘΕΡΜΗΣ'))!.center, radiusKm: 2 } },
      RESOLVERS,
    );
    expect(inside).toBe('within');

    // Ερώτημα 5 χλμ γύρω από την Καλαμάτα ⇒ πολύ μακριά ⇒ disjoint.
    const faraway = coverageRelation(
      declaredArea,
      { circle: { center: { lat: 37.0389, lng: 22.1142 }, radiusKm: 5 } },
      RESOLVERS,
    );
    expect(faraway).toBe('disjoint');
  });
});
