/**
 * ADR-720 — **ένα σημείο αποτύπωσης χωρίς υψόμετρο είναι δεδομένο, όχι σφάλμα.**
 *
 * ── Γιατί υπάρχει αυτό το αρχείο ────────────────────────────────────────────────────────────
 * Ο εισαγωγέας πετούσε **κάθε** γραμμή CSV χωρίς υψόμετρο (`topo-column-mapping`: `z === null →
 * return null`). Σε πραγματικό τοπογραφικό αυτές είναι ακριβώς οι **κορυφές του οικοπέδου**:
 * μετρημένο 2026-07-28, **7 από τις 9** κορυφές του ορίου ήταν σημεία του CSV (ταύτιση 2,2–6,4 mm)
 * και **ΚΑΜΙΑ** δεν είχε υψόμετρο. Το φίλτρο κρατούσε κυρίως σημεία των όμορων — γι' αυτό «οι
 * κορυφές έπεφταν έξω από το οικόπεδο». Δεν ήταν σφάλμα θέσης· ήταν σιωπηλή διαγραφή.
 *
 * Κανένα από τα 517 προϋπάρχοντα tests δεν μπορούσε να το δει, για τον ίδιο λόγο που το ADR-718
 * χρειάστηκε δικό του αρχείο: **όλα τα fixtures είχαν υψόμετρο παντού**. Ένα σιωπηλό φίλτρο είναι
 * αόρατο σε δεδομένα που δεν το ενεργοποιούν ποτέ.
 *
 * ⚠️ Ο κανόνας αυτού του αρχείου: **κάθε test πρέπει να σκάει αν αφαιρεθεί η διόρθωσή του**
 * (mutation-verified). Ένα test που περνά και πριν και μετά δεν καλύπτει τίποτα — είναι σχόλιο.
 *
 * Οι καταναλωτές (ασυνέχειες, λαβές, QA, ετικέτες, παραδοτέα) ζουν στο δίδυμο αρχείο
 * `topo-planimetric-consumers.test.ts` — εκεί όπου χρειάζεται και γεωαναφορά.
 *
 * @see ../topo-point-elevation — η SSoT που ελέγχεται εδώ
 * @see docs/centralized-systems/reference/adrs/ADR-720-survey-points-without-elevation.md
 */

import { describeElevationCoverage, hasElevation, surfacePointsOf } from '../topo-point-elevation';
import { applyColumnMapping } from '../topo-column-mapping';
import { getOrderPresetMapping } from '../topo-order-presets';
import { readDelimitedText } from '../topo-delimited-reader';
import { buildTin } from '../tin-builder';
import { computeLocalOrigin } from '../topo-local-origin';
import type { TopoPoint } from '../topo-types';

const M = 1000;

/** Ένα μετρημένο σημείο. */
const at = (x: number, y: number, z: number): TopoPoint => ({ x: x * M, y: y * M, z: z * M });
/** Ένα σημείο μετρημένο **μόνο σε θέση** — π.χ. κορυφή οικοπέδου. */
const corner = (x: number, y: number): TopoPoint => ({ x: x * M, y: y * M });

// ─── Η SSoT: πότε ένα σημείο «έχει υψόμετρο» ───────────────────────────────────

describe('hasElevation — το κατηγόρημα που κρατά το `?? 0` έξω από τον κώδικα', () => {
  it('ΝΑΙ για μετρημένο υψόμετρο — συμπεριλαμβανομένου του ΜΗΔΕΝ', () => {
    expect(hasElevation(at(1, 2, 3))).toBe(true);
    // 🔴 Το κρίσιμο: `z: 0` είναι **μέτρηση στη στάθμη της θάλασσας**, όχι απουσία. Μια υλοποίηση
    // με `if (!point.z)` θα το έκοβε από την επιφάνεια — δηλαδή θα έσβηνε αληθινά δεδομένα σε
    // κάθε παράκτιο έργο, ακριβώς εκεί όπου το υψόμετρο μηδέν είναι το συνηθέστερο.
    expect(hasElevation({ x: 0, y: 0, z: 0 })).toBe(true);
    expect(hasElevation({ x: 0, y: 0, z: -1500 })).toBe(true); // υπόγειο / εκσκαφή
  });

  it('ΟΧΙ για απουσία — και ΟΧΙ για NaN που ξέφυγε από parser', () => {
    expect(hasElevation(corner(1, 2))).toBe(false);
    expect(hasElevation({ x: 0, y: 0, z: undefined })).toBe(false);
    // Ένας NaN κόμβος δηλητηριάζει τον CDT πολύ πιο σιωπηλά από έναν απόντα (ADR-537).
    expect(hasElevation({ x: 0, y: 0, z: Number.NaN })).toBe(false);
    expect(hasElevation({ x: 0, y: 0, z: Number.POSITIVE_INFINITY })).toBe(false);
  });
});

describe('surfacePointsOf — το ΕΝΑ φίλτρο', () => {
  it('κρατά μόνο τα μετρημένα, με τη σειρά τους', () => {
    const points = [at(0, 0, 10), corner(1, 1), at(2, 2, 12)];
    expect(surfacePointsOf(points).map((p) => p.z)).toEqual([10 * M, 12 * M]);
  });

  it('επιστρέφει την ΙΔΙΑ αναφορά όταν όλα είναι μετρημένα (αλλιώς σπάει το memo)', () => {
    // Το `topo-surface` απομνημονεύει με **ταυτότητα** του ορισμού. Ένα φίλτρο που φτιάχνει νέο
    // ισοδύναμο πίνακα σε κάθε ανάγνωση θα ξανάχτιζε τον CDT σε κάθε κλήση — δηλαδή θα ακύρωνε
    // την πιο ακριβή βελτιστοποίηση του υποσυστήματος, χωρίς κανένα ορατό σύμπτωμα πέρα από FPS.
    const points = [at(0, 0, 10), at(1, 1, 11)];
    expect(surfacePointsOf(points)).toBe(points);
  });
});

describe('describeElevationCoverage — τα νούμερα που λέει ο οδηγός', () => {
  it('χωρίζει το σύνολο σε μετρημένα / δισδιάστατα', () => {
    expect(describeElevationCoverage([at(0, 0, 1), corner(1, 1), corner(2, 2)]))
      .toEqual({ total: 3, withElevation: 1, planimetricOnly: 2 });
  });

  it('κενή αποτύπωση → μηδενικά, όχι NaN', () => {
    expect(describeElevationCoverage([])).toEqual({ total: 0, withElevation: 0, planimetricOnly: 0 });
  });
});

// ─── Η επιφάνεια: το δισδιάστατο σημείο ΕΙΝΑΙ εκεί, αλλά ΔΕΝ την ορίζει ────────

describe('buildTin — η επιφάνεια αγνοεί τα δισδιάστατα σημεία (Carlson «Non-Surface»)', () => {
  it('δεν γίνονται κόμβοι: ούτε θέση, ούτε υψόμετρο στην TIN', () => {
    const surface = buildTin([at(0, 0, 10), at(10, 0, 10), at(0, 10, 10), corner(5, 5)]);

    // 🔴 Χωρίς το φίλτρο, το `corner(5,5)` θα έμπαινε με `z: undefined` → `elevations` με
    // `undefined`/NaN → τρίγωνα-σκουπίδια γύρω από την **κορυφή του οικοπέδου**, δηλαδή ακριβώς
    // εκεί που μετριούνται οι όγκοι εκσκαφής. Ένας κρατήρας που τιμολογείται.
    expect(surface.positions).toHaveLength(3);
    expect(surface.elevations).toEqual([10 * M, 10 * M, 10 * M]);
    expect(surface.elevations.every(Number.isFinite)).toBe(true);
    expect(surface.bounds.minZ).toBe(10 * M);
    expect(surface.bounds.maxZ).toBe(10 * M);
  });

  it('αποτύπωση ΜΟΝΟ με δισδιάστατα σημεία → κενή επιφάνεια, ποτέ επίπεδο ψέμα στο z=0', () => {
    // Το αρχείο «μόνο κορυφές οικοπέδου». Το σωστό είναι «δεν ξέρω το έδαφος», όχι «το έδαφος
    // είναι οριζόντιο στο μηδέν» — το δεύτερο θα έδινε όγκους εκσκαφής με σιγουριά.
    const surface = buildTin([corner(0, 0), corner(10, 0), corner(10, 10), corner(0, 10)]);
    expect(surface.triangles).toHaveLength(0);
    expect(surface.positions).toHaveLength(0);
  });

  it('το δισδιάστατο σημείο δεν μετακινεί το LOCAL origin της τριγωνοποίησης', () => {
    // Το origin υπάρχει για να σμικρύνει τα μεγέθη **που τριγωνοποιούνται** (ADR-635). Ένα σημείο
    // που δεν δίνει κόμβο δεν δικαιούται να μετακινήσει το πλαίσιο των κόμβων.
    const measured = [at(100, 100, 5), at(110, 100, 5), at(100, 110, 5)];
    const withCorner = buildTin([corner(0, 0), ...measured]);
    expect(withCorner.origin).toEqual(computeLocalOrigin(measured));
    expect(withCorner.origin).toEqual(buildTin(measured).origin);
  });

  it('μια πραγματική μεικτή αποτύπωση τριγωνοποιείται κανονικά γύρω από τα δισδιάστατα', () => {
    const measured = [at(0, 0, 10), at(20, 0, 11), at(20, 20, 12), at(0, 20, 11)];
    const corners = [corner(5, 5), corner(15, 15)]; // κορυφές οικοπέδου ΜΕΣΑ στην αποτύπωση
    const surface = buildTin([...measured, ...corners]);

    expect(surface.positions).toHaveLength(4);
    expect(surface.triangles.length).toBeGreaterThan(0);
    expect(surface.elevations.every(Number.isFinite)).toBe(true);
  });
});

// ─── ΤΟ ACCEPTANCE TEST ────────────────────────────────────────────────────────

/**
 * Το αρχείο του Giorgio, στη μορφή του: `id; Ανατολή; Βορράς; Υψόμ;`, διαχωριστικό `;`, δεκαδικό
 * κόμμα, και **οι περισσότερες γραμμές με κενή στήλη υψομέτρου**.
 *
 * Οι πραγματικές αναλογίες: 93 σημεία, από τα οποία **33 με υψόμετρο** και **60 χωρίς**.
 */
function eyosmosCsv(withZ: number, withoutZ: number): string {
  const lines = ['Σημείο;Ανατολή;Βορράς;Υψόμετρο'];
  for (let i = 0; i < withZ; i++) {
    lines.push(`${i + 1};407${700 + i},841;4502${400 + i},799;${(12 + i / 100).toFixed(3).replace('.', ',')}`);
  }
  for (let i = 0; i < withoutZ; i++) {
    lines.push(`${withZ + i + 1};407${700 + i},123;4502${390 + i},456;`);
  }
  return lines.join('\n');
}

describe('🎯 ACCEPTANCE — το αρχείο ΕΥΟΣΜΟΣ47: 93 γραμμές, 33 με υψόμετρο', () => {
  const parsed = () => readDelimitedText(eyosmosCsv(33, 60));

  it('εισάγει ΚΑΙ ΤΑ 93 και δεν παραλείπει ΚΑΜΙΑ γραμμή', () => {
    const table = parsed();
    const { points, skipped } = applyColumnMapping(table, getOrderPresetMapping('PENZ')!);

    // Πριν το ADR-720: `points.length === 33` και `skipped.length === 60`.
    // Ο οδηγός έγραφε «33 σημεία · 60 γραμμές θα παραλειφθούν» — και οι 60 ήταν το οικόπεδο.
    expect(points).toHaveLength(93);
    expect(skipped).toEqual([]);
  });

  it('ο οδηγός λέει «93 σημεία (33 με υψόμετρο / 60 δισδιάστατα)»', () => {
    const { points } = applyColumnMapping(parsed(), getOrderPresetMapping('PENZ')!);
    expect(describeElevationCoverage(points)).toEqual({
      total: 93,
      withElevation: 33,
      planimetricOnly: 60,
    });
  });

  it('η επιφάνεια χτίζεται από τα 33 — τα 60 είναι εκεί αλλά δεν την ορίζουν', () => {
    const { points } = applyColumnMapping(parsed(), getOrderPresetMapping('PENZ')!);
    const surface = buildTin(points);

    expect(surfacePointsOf(points)).toHaveLength(33);
    expect(surface.elevations).toHaveLength(33);
    expect(surface.elevations.every(Number.isFinite)).toBe(true);
    // Και η ταυτότητα του σημείου επιβιώνει: η αρίθμηση του τοπογράφου είναι ό,τι θα δει ο χρήστης.
    expect(points[92]!.pointNumber).toBe('93');
    expect(hasElevation(points[92]!)).toBe(false);
  });
});
