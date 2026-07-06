/**
 * Tests για τους καθαρούς helpers της «κάθετης γραμμής» (ADR-060, Revit-grade 2-click):
 *   · `projectOntoPerpendicularAxis` — προβολή cursor στον κλειδωμένο κάθετο άξονα (dot-product):
 *      η γραμμή μένει ΠΑΝΤΑ κάθετη, το πρόσημο δίνει την πλευρά, το μέτρο το μήκος.
 *   · `resolvePerpendicularAxisLock` — 1ο κλικ: αντλεί βάση + `faceFrame.perpDir` από τον ΚΟΙΝΟ
 *      face-snap εγκέφαλο (`resolveLineFaceSnapAt`) — εδώ mock-άρεται ώστε το test να μένει pure.
 */

import { projectOntoPerpendicularAxis, resolvePerpendicularAxisLock } from '../line-perpendicular-preview-helpers';
import type { PerpendicularAxisLock } from '../../../bim/placement/perpendicular-axis-lock-store';

// Mock ΜΟΝΟ το face-snap entry point· κρατά το test ανεξάρτητο από scene/store μηχανισμό.
jest.mock('../line-preview-helpers', () => ({
  resolveLineFaceSnapAt: jest.fn(),
}));
import { resolveLineFaceSnapAt } from '../line-preview-helpers';
const mockedFaceSnap = resolveLineFaceSnapAt as jest.MockedFunction<typeof resolveLineFaceSnapAt>;

describe('projectOntoPerpendicularAxis — hard κάθετο κλείδωμα', () => {
  // Κλειδωμένος άξονας: βάση (10,20), κάθετη φορά = +Y (μοναδιαίο).
  const lock: PerpendicularAxisLock = { base: { x: 10, y: 20 }, dir: { x: 0, y: 1 } };

  it('προβάλλει τον cursor πάνω στον άξονα (κρατά x της βάσης, y ακολουθεί)', () => {
    // cursor εκτός άξονα → η προβολή πέφτει στον κάθετο άξονα (x = base.x).
    expect(projectOntoPerpendicularAxis({ x: 55, y: 70 }, lock)).toEqual({ x: 10, y: 70 });
  });

  it('το μέτρο της προβολής = μήκος κατά μήκος του άξονα', () => {
    const p = projectOntoPerpendicularAxis({ x: 999, y: 50 }, lock); // t = (50-20)*1 = 30
    expect(p).toEqual({ x: 10, y: 50 });
  });

  it('αρνητικό πρόσημο = αντίθετη πλευρά της βάσης', () => {
    const p = projectOntoPerpendicularAxis({ x: -3, y: 5 }, lock); // t = (5-20) = -15
    expect(p).toEqual({ x: 10, y: 5 });
  });

  it('δουλεύει με πλάγιο (μοναδιαίο) κάθετο διάνυσμα', () => {
    const s = Math.SQRT1_2; // 45°
    const diag: PerpendicularAxisLock = { base: { x: 0, y: 0 }, dir: { x: s, y: s } };
    const p = projectOntoPerpendicularAxis({ x: 2, y: 0 }, diag); // t = 2*s → σημείο (t*s, t*s) = (1,1)
    expect(p.x).toBeCloseTo(1, 9);
    expect(p.y).toBeCloseTo(1, 9);
  });
});

describe('resolvePerpendicularAxisLock — καταγραφή άξονα στο 1ο κλικ', () => {
  afterEach(() => mockedFaceSnap.mockReset());

  it('επιστρέφει null όταν δεν υπάρχει παρειά κοντά (ελεύθερη γραμμή)', () => {
    mockedFaceSnap.mockReturnValue(null);
    expect(resolvePerpendicularAxisLock({ x: 5, y: 5 }, 'mm')).toBeNull();
  });

  it('αντλεί βάση = flush foot (snap.start) + dir = faceFrame.perpDir', () => {
    mockedFaceSnap.mockReturnValue({
      start: { x: 100, y: 200 },
      end: { x: 100, y: 500 },
      // μόνο το perpDir διαβάζεται από τον helper — τα υπόλοιπα πεδία αδιάφορα εδώ.
      faceFrame: { perpDir: { x: 0, y: 1 } },
    } as unknown as ReturnType<typeof resolveLineFaceSnapAt>);
    const lock = resolvePerpendicularAxisLock({ x: 120, y: 260 }, 'mm');
    expect(lock).toEqual({ base: { x: 100, y: 200 }, dir: { x: 0, y: 1 } });
  });
});
