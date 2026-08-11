/**
 * @fileoverview Άγκυρες για τα **τρία ερωτήματα προς το OSM** (ADR-777 §13.4 · §14.4).
 * @related lib/geo/osm/osm-building.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΔΟΚΙΜΑΖΕΤΑΙ, ΚΑΙ ΓΙΑΤΙ ΜΕ ΠΛΑΣΤΟ ΜΕΤΑΦΟΡΕΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **σχήμα** των τριών ερωτημάτων επαληθεύτηκε σε **πραγματικό Overpass**
 * (2026-08-11, way 27931128 στη Θεσσαλονίκη): το `out geom tags` **δεν** δίνει
 * `center`· το `out center tags` το δίνει· και το `out geom` επιστρέφει δακτύλιο με
 * **επαναλαμβανόμενη** πρώτη κορυφή. Αυτές οι τρεις μετρήσεις είναι τα **δεδομένα**
 * των παρακάτω άγκυρων — δηλαδή τα σταθερά δεν είναι επινοημένα, είναι **κατεγραμμένα**.
 *
 * Το δίκτυο πλαστογραφείται ώστε οι άγκυρες να κρίνουν **τη λογική μας** (ποιο κτίριο
 * νικά · πώς διαβάζονται οι ετικέτες · πού μπαίνει το νομικό όριο) και όχι τη
 * διαθεσιμότητα ενός δημόσιου διακομιστή.
 */

import type { OverpassElement } from '../overpass-client';

jest.mock('../overpass-client', () => ({
  overpassQuerySeconds: () => 6,
  runOverpassQueryStrict: jest.fn(),
  runOverpassQuery: jest.fn(),
}));

import { runOverpassQueryStrict } from '../overpass-client';
import {
  fetchOsmBuildingOutline,
  findOsmBuildingAt,
  verifyOsmBuilding,
} from '../osm-building';

const mockedQuery = runOverpassQueryStrict as jest.MockedFunction<typeof runOverpassQueryStrict>;

function answers(elements: readonly OverpassElement[]): void {
  mockedQuery.mockResolvedValue({ ok: true, elements });
}

function failsToAnswer(): void {
  mockedQuery.mockResolvedValue({ ok: false, reason: 'unavailable' });
}

/** Τετράγωνο way με **επαναλαμβανόμενη** πρώτη κορυφή, όπως το γράφει το OSM. */
function squareWay(
  id: number,
  half: number,
  tags: Record<string, string> = { building: 'yes' },
): OverpassElement {
  const lat = 40.6400;
  const lng = 22.9440;
  const ring = [
    { lat: lat - half, lon: lng - half },
    { lat: lat - half, lon: lng + half },
    { lat: lat + half, lon: lng + half },
    { lat: lat + half, lon: lng - half },
  ];
  return { type: 'way', id, geometry: [...ring, ring[0]], tags };
}

const CLICK = { lat: 40.6400, lng: 22.9440 };

beforeEach(() => {
  mockedQuery.mockReset();
});

// =============================================================================
describe('findOsmBuildingAt — «ποιο κτίριο πάτησα;»', () => {
  it('Κ1 — το σημείο μέσα σε ένα κτίριο το βρίσκει, και ο δακτύλιος ΔΕΝ επαναλαμβάνει κορυφή', async () => {
    answers([squareWay(1, 0.0005)]);

    const pick = await findOsmBuildingAt(CLICK);

    expect(pick.kind).toBe('found');
    if (pick.kind !== 'found') return;
    expect(pick.fact.elementId).toBe('1');
    // Το OSM έστειλε 5 κορυφές (κλειστό)· ο `GeoOutline` ορίζει 4.
    expect(pick.outline).toHaveLength(4);
  });

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ §13.3.** Το κριτήριο είναι **περιεκτικότητα**, όχι εγγύτητα: ένα
   * κτίριο δίπλα, όσο κοντά κι αν είναι, **δεν** είναι αυτό που πάτησε ο άνθρωπος. Αν
   * κάποιος αντικαταστήσει τη δοκιμή με «πλησιέστερο», αυτή γίνεται κόκκινη.
   */
  it('Κ2 — κτίριο ΔΙΠΛΑ (όχι από κάτω) ΔΕΝ επιλέγεται — εγγύτητα ΔΕΝ είναι ταυτότητα', async () => {
    const neighbour: OverpassElement = {
      type: 'way',
      id: 2,
      tags: { building: 'yes' },
      geometry: [
        { lat: 40.6410, lon: 22.9450 },
        { lat: 40.6410, lon: 22.9455 },
        { lat: 40.6415, lon: 22.9455 },
        { lat: 40.6415, lon: 22.9450 },
        { lat: 40.6410, lon: 22.9450 },
      ],
    };
    answers([neighbour]);

    expect((await findOsmBuildingAt(CLICK)).kind).toBe('none');
  });

  it('Κ3 — όταν το σημείο περιέχεται σε δύο, νικά το ΜΙΚΡΟΤΕΡΟ (πιο συγκεκριμένο)', async () => {
    answers([squareWay(10, 0.0020), squareWay(11, 0.0004)]);

    const pick = await findOsmBuildingAt(CLICK);

    expect(pick.kind).toBe('found');
    if (pick.kind !== 'found') return;
    expect(pick.fact.elementId).toBe('11');
  });

  it('Κ4 — `building=no` σημαίνει ΡΗΤΑ «δεν είναι κτίριο»', async () => {
    answers([squareWay(3, 0.0005, { building: 'no' })]);
    expect((await findOsmBuildingAt(CLICK)).kind).toBe('none');
  });

  /** 🔴 «Δεν απάντησε» **δεν** είναι «δεν υπάρχει» — §14.4. */
  it('Κ5 — αποτυχία δικτύου δίνει `unavailable`, ΠΟΤΕ `none`', async () => {
    failsToAnswer();
    expect((await findOsmBuildingAt(CLICK)).kind).toBe('unavailable');
  });
});

// =============================================================================
describe('verifyOsmBuilding — η επαλήθευση πηγής του §14.4', () => {
  it('Κ6 — υπαρκτό κτίριο: το σημείο έρχεται από το `center` του Overpass', async () => {
    answers([
      {
        type: 'way',
        id: 27931128,
        center: { lat: 40.6404419, lon: 22.9450709 },
        tags: { building: 'yes', 'addr:street': 'Εγνατία', 'addr:housenumber': '147' },
      },
    ]);

    const verdict = await verifyOsmBuilding('way', '27931128');

    expect(verdict.kind).toBe('verified');
    if (verdict.kind !== 'verified') return;
    expect(verdict.fact.point).toEqual({ lat: 40.6404419, lng: 22.9450709 });
    expect(verdict.fact.address.street).toBe('Εγνατία');
    expect(verdict.fact.address.houseNumber).toBe('147');
  });

  it('Κ7 — τρεις ΔΙΑΦΟΡΕΤΙΚΕΣ αρνήσεις, καμία δεν συμπτύσσεται', async () => {
    answers([]);
    expect((await verifyOsmBuilding('way', '1')).kind).toBe('absent');

    answers([{ type: 'way', id: 1, center: { lat: 40.64, lon: 22.94 }, tags: { highway: 'residential' } }]);
    expect((await verifyOsmBuilding('way', '1')).kind).toBe('not-a-building');

    failsToAnswer();
    expect((await verifyOsmBuilding('way', '1')).kind).toBe('unavailable');
  });

  /**
   * ⚠️ Μετρημένο σε πραγματικά δεδομένα OSM Θεσσαλονίκης:
   * `addr:housenumber: "53,60"` — **δύο** αριθμοί σε ένα πεδίο. Τα **αριθμητικά**
   * πεδία δεν επιτρέπεται να «σώσουν ό,τι μπορούν», γιατί το αποτέλεσμα γράφεται στο
   * κοινό επίπεδο Α **ως γεγονός**.
   */
  it('Κ8 — βρόμικες αριθμητικές ετικέτες γίνονται `null`, ποτέ μισοδιαβασμένος αριθμός', async () => {
    answers([
      {
        type: 'way',
        id: 1,
        center: { lat: 40.64, lon: 22.94 },
        tags: {
          building: 'yes',
          'building:levels': '4-6',
          start_date: 'C19',
          'addr:housenumber': '53,60',
        },
      },
    ]);

    const verdict = await verifyOsmBuilding('way', '1');
    expect(verdict.kind).toBe('verified');
    if (verdict.kind !== 'verified') return;

    expect(verdict.fact.floorsAboveGround).toBeNull();
    expect(verdict.fact.constructionYear).toBeNull();
    // ⚠️ Ο **αριθμός διεύθυνσης** μένει ως έχει: είναι κείμενο διεύθυνσης, όχι μέγεθος.
    expect(verdict.fact.address.houseNumber).toBe('53,60');
  });

  it('Κ9 — καθαροί ακέραιοι διαβάζονται', async () => {
    answers([
      {
        type: 'way',
        id: 1,
        center: { lat: 40.64, lon: 22.94 },
        tags: { building: 'apartments', 'building:levels': '6', start_date: '1978' },
      },
    ]);

    const verdict = await verifyOsmBuilding('way', '1');
    if (verdict.kind !== 'verified') throw new Error('αναμενόταν verified');
    expect(verdict.fact.floorsAboveGround).toBe(6);
    expect(verdict.fact.constructionYear).toBe(1978);
  });
});

// =============================================================================
describe('fetchOsmBuildingOutline — ζωντανή γεωμετρία, ΠΟΤΕ αποθηκευμένη', () => {
  it('Κ10 — `way` δίνει δακτύλιο χωρίς επανάληψη κορυφής', async () => {
    answers([squareWay(1, 0.0005)]);
    const fetched = await fetchOsmBuildingOutline('way', '1');

    expect(fetched.kind).toBe('outline');
    if (fetched.kind !== 'outline') return;
    expect(fetched.outline).toHaveLength(4);
  });

  /**
   * 🔶 **Δηλωμένο όριο με μετρημένο αριθμό**: οι σχέσεις είναι **0,24 %** των κτιρίων
   * (38 972 ways έναντι 93 relations, Θεσσαλονίκη ~7×6 km). Ρητή κατάσταση, και
   * **χωρίς καν να ρωτήσει** το δίκτυο.
   */
  it('Κ11 — `relation` και `node` δίνουν ΡΗΤΟ `no-shape`, χωρίς καν να ρωτήσουν', async () => {
    expect((await fetchOsmBuildingOutline('relation', '1')).kind).toBe('no-shape');
    expect((await fetchOsmBuildingOutline('node', '1')).kind).toBe('no-shape');
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΖΩΝΤΑΝΟ ΣΦΑΛΜΑ** (2026-08-11).
   *
   * Η πρώτη γραφή επέστρεφε `GeoOutline | null` και **συγχώνευε** το «δεν έχει σχήμα»
   * με το «δεν απάντησε». Η σουίτα ήταν **πράσινη**: κάθε άγκυρα ρωτούσε *«πήρα
   * δακτύλιο;»*, καμία *«τι σημαίνει το `null`;»*.
   *
   * Το βρήκε **ζωντανή δοκιμή** — το δημόσιο Overpass μας έκοψε (όριο **2 slots ανά
   * IP**) και η διαδρομή απάντησε *«αυτό το κτίριο δεν έχει σχήμα»* για περίγραμμα
   * που είχαμε δει **δύο λεπτά νωρίτερα**. Είναι η ίδια αστοχία που το `Κ7` παραπάνω
   * φρουρεί για την **επαλήθευση** — γραμμένη λίγες γραμμές πιο κάτω, από τον ίδιο
   * συγγραφέα, στο ίδιο commit.
   */
  it('Κ12 — αδυναμία δικτύου δίνει `unavailable`, ΠΟΤΕ `no-shape`', async () => {
    failsToAnswer();
    expect((await fetchOsmBuildingOutline('way', '1')).kind).toBe('unavailable');
  });

  it('Κ13 — στοιχείο που έσβησε δίνει `no-shape` (το OSM απάντησε: δεν υπάρχει)', async () => {
    answers([]);
    expect((await fetchOsmBuildingOutline('way', '1')).kind).toBe('no-shape');
  });
});
