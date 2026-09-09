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
import { ADMIN_FOOTPRINTS_SOURCE, footprintOf, readFootprint } from '../admin-footprints';
import { footprintRelation } from '../geo-shape-relation';
import { circleFootprint } from '../geo-footprint';
import { distanceMeters } from '../geo-distance';
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

  /**
   * 🔴 **ΑΥΤΟ ΤΟ TEST ΖΗΤΟΥΣΕ ΤΟ ΑΝΤΙΘΕΤΟ ΜΕΧΡΙ ΤΙΣ 2026-09-08** — απαιτούσε τα τρία
   * `id` να **μην** έχουν αποτύπωμα, γιατί ήταν **διφορούμενα**: ο ίδιος κωδικός
   * ανήκε σε δύο δήμους *(`0502` = ΝΕΣΤΟΥ **και** «ΝΟΤΙΩΝ ΤΖΟΥΜΕΡΚΩΝ»)*, και η άρνηση
   * ήταν το σωστό: εικασία θα έδινε τη γεωμετρία **του ενός στον άλλο**.
   *
   * ⚠️ **Η προσδοκία δεν «χαλάρωσε» — η ΑΙΤΙΑ έφυγε.** Η αμφισημία ήταν ελάττωμα
   * δεδομένων *(ένα script επινόησε κωδικούς πάνω σε υπαρκτούς δήμους, και έναν δήμο
   * που δεν υπάρχει)*, όχι ιδιότητα του κόσμου. Τώρα οι κωδικοί είναι μοναδικοί, οπότε
   * το τεστ ρωτά αυτό που πρέπει: **οι τρεις υπαρκτοί δήμοι πήραν πίσω το έδαφός τους**.
   * Την άρνηση σε πραγματική αμφισημία τη φυλάει ο ίδιος ο γεννήτορας (`buildIdIndex`).
   */
  it.each([
    ['ΔΗΜΟΣ ΝΕΣΤΟΥ', 'municipality:0502'],
    ['ΔΗΜΟΣ ΔΕΣΚΑΤΗΣ', 'municipality:1502'],
    ['ΔΗΜΟΣ ΠΑΞΩΝ', 'municipality:3202'],
  ])('ο %s ΞΑΝΑΕΧΕΙ αποτύπωμα — ήταν γεωγραφικά αόρατος λόγω σύγκρουσης κωδικού', (name, id) => {
    expect(idOf(name)).toBe(id);
    const footprint = footprintOf(id);
    expect(footprint).not.toBeNull();
    expect(footprint!.outerKm).toBeGreaterThan(0);
  });

  /**
   * 🔑 **Η ερώτηση που κανένα άλλο κριτήριο δεν κάνει**: *«μπορεί ΚΑΘΕ δήμος να βρεθεί
   * από κυκλικό ερώτημα;»*. Ένας δήμος χωρίς αποτύπωμα δεν σκάει — απαντά `unknown` για
   * πάντα, δηλαδή ο επαγγελματίας τον δηλώνει και **κανένας επισκέπτης δεν τον φτάνει**.
   * Μέχρι τη Φ4 έλειπαν **έντεκα**: τρεις από σύγκρουση κωδικού, επτά επειδή γεννήθηκαν
   * μετά τον Καλλικράτη *(συντίθενται πλέον από τις δημοτικές τους ενότητες)*, και ένας
   * επειδή **δεν υπήρχε**.
   */
  it('ΚΑΘΕ δήμος της ιεραρχίας έχει αποτύπωμα', () => {
    const without = hierarchy.data
      .filter((row) => row.l === 5)
      .filter((row) => footprintOf(row.id) === null)
      .map((row) => `${row.id} «${row.n}»`);

    expect(without).toEqual([]);
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

// ════════════════════════════════════════════════════════════════════════════
// 🔴 ADR-846 §9 #11 — ΤΟ ΚΑΛΥΜΜΑ ΠΡΕΠΕΙ ΝΑ ΠΕΡΑΣΕΙ ΤΟ ΣΥΝΟΡΟ ΤΗΣ ΑΝΑΓΝΩΣΗΣ
// ════════════════════════════════════════════════════════════════════════════
//
// **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ**: ο `readFootprint` κατασκεύαζε το αποτέλεσμα **ρητά**
// (`return { center, outerKm, innerKm }`) και **πετούσε σιωπηλά** το `interior`.
// Ο γεννήτορας παρήγαγε **1.050** καλύμματα / **12.794** δίσκους, οι άγκυρες της
// μηχανής ήταν **πράσινες**, και η επαλήθευση end-to-end **πέρασε** — γιατί έτρεχε
// σε `tsx`, **παρακάμπτοντας τον αναγνώστη**. Στην οθόνη **τίποτα δεν θα άλλαζε**.
//
// 🔑 Ένας **ρητός κατασκευαστής** είναι σιωπηλό φίλτρο: δεν σπάει, **παραλείπει**.
//    Αυτές οι άγκυρες ρωτούν το μόνο ερώτημα που τον πιάνει: *«φτάνει η δουλειά
//    ΜΕΧΡΙ ΤΟΝ ΚΑΤΑΝΑΛΩΤΗ;»* — μέσα από το **πραγματικό** αρχείο και τον
//    **πραγματικό** αναγνώστη, ποτέ από πλαστά δεδομένα.
describe('🔴 ADR-846 §9 #11 — το εσωτερικό κάλυμμα επιβιώνει της ανάγνωσης', () => {
  const THESSALONIKI = { lat: 40.6306898, lng: 22.9468742 };

  it('το `interior` ΦΤΑΝΕΙ στον καταναλωτή — δεν το τρώει ο αναγνώστης', () => {
    const snapshot = ADMIN_FOOTPRINTS_SOURCE.peek();
    expect(snapshot).not.toBeNull();
    const withCover = [...snapshot!.values()].filter((f) => f.interior !== undefined);
    expect(withCover.length).toBeGreaterThan(500);
  });

  it('🏆 ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ: το ακίνητο του κέντρου κρίνεται `within` — το ζωντανό εύρημα', () => {
    const footprint = footprintOf(idOf('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'));
    expect(footprint).not.toBeNull();
    // Ο ένας δίσκος του `innerKm` είναι **123 m** — αδύνατο να φτάσει τα 530 m.
    expect(footprint!.innerKm).toBeLessThan(0.3);
    expect(footprint!.interior?.length ?? 0).toBeGreaterThan(1);

    expect(
      footprintRelation(footprint!, circleFootprint({ center: THESSALONIKI, radiusKm: 0 })),
    ).toBe('within');
  });

  it('🔒 ΚΑΘΕ δίσκος του πραγματικού δέντρου χωρά στον περιγεγραμμένο του κύκλο', () => {
    const snapshot = ADMIN_FOOTPRINTS_SOURCE.peek()!;
    const offenders: string[] = [];
    for (const [adminId, footprint] of snapshot) {
      for (const disc of footprint.interior ?? []) {
        const gapKm = distanceMeters(footprint.center, disc.center) / 1000;
        if (gapKm + disc.radiusKm > footprint.outerKm + 0.05) offenders.push(adminId);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('⚠️ οντότητα ΧΩΡΙΣ κάλυμμα μένει ακριβώς όπως ήταν — καμία παλινδρόμηση', () => {
    const athens = footprintOf(idOf('ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ'));
    expect(athens).not.toBeNull();
    expect(athens!.interior).toBeUndefined();
    expect(
      footprintRelation(athens!, circleFootprint({ center: { lat: 37.98098, lng: 23.7333 }, radiusKm: 0 })),
    ).toBe('within');
  });

  // ⚠️ Οι δύο παρακάτω **εκτελούν** τον φρουρό με χαλασμένη είσοδο. Χωρίς αυτές ήταν
  //    αδρανής: μετάλλαξη που τον καταργούσε άφηνε τη σουίτα **πράσινη**.
  it('🔒 δίσκος που ΞΕΦΕΥΓΕΙ από τον περιγεγραμμένο απορρίπτεται — χαλασμένο αρχείο', () => {
    const row = {
      center: { lat: 40.0, lng: 22.0 },
      outerKm: 5,
      innerKm: 1,
      interior: [
        { center: { lat: 40.0, lng: 22.0 }, radiusKm: 2 },   // νόμιμος
        { center: { lat: 40.0, lng: 22.0 }, radiusKm: 900 }, // αδύνατος
      ],
    };
    const footprint = readFootprint(row);
    expect(footprint?.interior).toHaveLength(1);
    expect(footprint?.interior?.[0].radiusKm).toBe(2);
  });

  it('🔒 σκουπίδια στο `interior` δεν σπάνε τίποτα — πέφτουμε στον ΕΝΑ δίσκο', () => {
    const footprint = readFootprint({
      center: { lat: 40.0, lng: 22.0 },
      outerKm: 5,
      innerKm: 1,
      // 🔑 Το τελευταίο έχει **έγκυρο κέντρο** επίτηδες: αλλιώς απορριπτόταν νωρίτερα
      //    και ο έλεγχος ακτίνας έμενε **αδοκίμαστος** *(μετρημένο: μετάλλαξη που τον
      //    αφαιρούσε άφηνε τη σουίτα πράσινη)*.
      interior: [
        null,
        'χ',
        { center: { lat: 'α' } },
        { center: { lat: 40.0, lng: 22.0 }, radiusKm: -3 },
      ],
    });
    expect(footprint).not.toBeNull();
    expect(footprint!.interior).toBeUndefined();
    expect(footprint!.innerKm).toBe(1);
  });
});
