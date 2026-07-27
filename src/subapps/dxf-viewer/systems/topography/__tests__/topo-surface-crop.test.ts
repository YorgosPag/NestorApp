/**
 * ADR-718 — ο κόμβος: το ΕΝΑ `getTopoSurface()` υπακούει στην κοπή, ώστε κάθε καταναλωτής
 * (κάτοψη, ισοϋψείς, 3Δ, cap, εμβαδά, όγκοι) να την υπακούει **χωρίς να αλλάξει γραμμή**.
 *
 * Αυτό που φυλάει αυτό το αρχείο δεν είναι η αριθμητική της κοπής (αυτή ζει στο
 * `tin-clip-to-boundary.test.ts`) αλλά τα **συμβόλαια γύρω της**:
 *   • η κοπή απαιτεί ΚΑΙ διακόπτη ΚΑΙ όριο — ένα από τα δύο δεν φτάνει·
 *   • το `getTopoSurfaceFull()` μένει ανεπηρέαστο, γιατί πάνω του κρέμεται η **εξαγωγή** του
 *     τοπογράφου· αν κοβόταν κι εκείνη, ο πελάτης θα έπαιρνε μικρότερη αποτύπωση από τη μετρημένη·
 *   • η κοπή **δεν ξανα-τριγωνοποιεί** (το πάνω πάτωμα του memo δεν αγγίζει το κάτω).
 */

import { getTopoSurface, getTopoSurfaceFull, invalidateTopoSurface } from '../topo-surface';
import { setTopoPoints, setTopoBoundary, setTopoCrop, clearTopo } from '../TopoPointStore';
import type { Point2D } from '../../../rendering/types/Types';
import type { TopoPoint } from '../topo-types';

const M = 1000;

/** Επίπεδη σχάρα 20 m × 20 m — 36 σημεία, αρκετά για πολλά τρίγωνα. */
function surveyPoints(): TopoPoint[] {
  const pts: TopoPoint[] = [];
  for (let gx = 0; gx <= 5; gx++) {
    for (let gy = 0; gy <= 5; gy++) {
      pts.push({ x: gx * 4 * M, y: gy * 4 * M, z: 1 * M + gx * 100 });
    }
  }
  return pts;
}

const HALF: Point2D[] = [
  { x: 0, y: 0 },
  { x: 10 * M, y: 0 },
  { x: 10 * M, y: 20 * M },
  { x: 0, y: 20 * M },
];

function planArea(triangleCount: 'full' | 'cropped'): number {
  const s = triangleCount === 'full' ? getTopoSurfaceFull() : getTopoSurface();
  let total = 0;
  for (const [i, j, k] of s.triangles) {
    const [ax, ay] = s.positions[i]!;
    const [bx, by] = s.positions[j]!;
    const [cx, cy] = s.positions[k]!;
    total += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  }
  return total / (M * M);
}

beforeEach(() => {
  clearTopo();
  invalidateTopoSurface();
  setTopoPoints(surveyPoints());
});

describe('getTopoSurface — πότε κόβει', () => {
  it('χωρίς όριο και χωρίς διακόπτη → ολόκληρη η μετρημένη επιφάνεια (400 m²)', () => {
    expect(planArea('cropped')).toBeCloseTo(400, 6);
  });

  it('όριο επιλεγμένο αλλά διακόπτης ΚΛΕΙΣΤΟΣ → δεν κόβει (το όριο μετρά μόνο όγκους)', () => {
    setTopoBoundary({ vertices: HALF });
    expect(planArea('cropped')).toBeCloseTo(400, 6);
  });

  it('διακόπτης ΑΝΟΙΧΤΟΣ αλλά χωρίς όριο → δεν κόβει (δεν ξέρει πού)', () => {
    setTopoCrop({ enabled: true });
    expect(planArea('cropped')).toBeCloseTo(400, 6);
  });

  it('διακόπτης ΚΑΙ όριο → κόβει (200 m²)', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });
    expect(planArea('cropped')).toBeCloseTo(200, 6);
  });

  it('σβήσιμο του διακόπτη επαναφέρει ΑΚΡΙΒΩΣ την αρχική επιφάνεια', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });
    expect(planArea('cropped')).toBeCloseTo(200, 6);

    setTopoCrop({ enabled: false });
    expect(planArea('cropped')).toBeCloseTo(400, 6);
    expect(getTopoSurface()).toBe(getTopoSurfaceFull()); // η ΙΔΙΑ instance, όχι αντίγραφο
  });
});

describe('getTopoSurfaceFull — τα δεδομένα του τοπογράφου', () => {
  it('μένει ΑΚΟΜΜΑΤΙΑΣΤΗ όσο κι αν είναι ενεργή η κοπή (η εξαγωγή δεν κόβεται ποτέ)', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });

    expect(planArea('cropped')).toBeCloseTo(200, 6);
    expect(planArea('full')).toBeCloseTo(400, 6);
  });
});

describe('το διώροφο memo', () => {
  it('η κοπή ΔΕΝ ξανα-τριγωνοποιεί — η μετρημένη επιφάνεια μένει η ίδια instance', () => {
    const before = getTopoSurfaceFull();

    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });
    getTopoSurface(); // πυροδοτεί την κοπή

    expect(getTopoSurfaceFull()).toBe(before);
  });

  it('δύο διαδοχικές κλήσεις με ίδιο όριο δίνουν την ΙΔΙΑ κομμένη instance (μηδέν re-clip)', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });
    expect(getTopoSurface()).toBe(getTopoSurface());
  });

  it('αλλαγή ορίου παράγει ΝΕΑ κομμένη επιφάνεια (το memo δεν κολλάει στο παλιό)', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });
    const first = getTopoSurface();

    setTopoBoundary({ vertices: [{ x: 0, y: 0 }, { x: 5 * M, y: 0 }, { x: 5 * M, y: 20 * M }, { x: 0, y: 20 * M }] });
    const second = getTopoSurface();

    expect(second).not.toBe(first);
    expect(planArea('cropped')).toBeCloseTo(100, 6);
  });

  it('επεξεργασία της αποτύπωσης ενόσω η κοπή είναι ενεργή ξαναχτίζει ΚΑΙ τα δύο πατώματα', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });
    const first = getTopoSurface();

    setTopoPoints([...surveyPoints(), { x: 2 * M, y: 2 * M, z: 5 * M }]);
    expect(getTopoSurface()).not.toBe(first);
    expect(planArea('cropped')).toBeCloseTo(200, 6); // ίδιο αποτύπωμα, νέα υψόμετρα
  });
});
