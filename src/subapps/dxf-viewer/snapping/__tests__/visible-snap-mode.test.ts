/**
 * Regression lock — `isVisibleSnapMode` SSoT (2026-07-04).
 *
 * ΓΙΑΤΙ: το κριτήριο «ορατή/σκληρή έλξη» (grid & guide = σιωπηλά, κάθε άλλο mode = ορατό) ήταν
 * σκορπισμένο inline σε ≥3 σημεία. Κεντρικοποιήθηκε σε `isVisibleSnapMode` και το καταναλώνουν:
 *   • `isSnapMarkerVisible`  → πότε ζωγραφίζεται η fux (SnapIndicatorOverlay, corner-projection-snap)
 *   • `isVisibleIndicatorSnap` (column placement)
 *   • το line-tool 1ο-κλικ gate (`useDrawingHandlers`) → «η πραγματική κορυφή νικάει το flush»
 *   • το OTRACK acquire (`drawing-hover-handler`) → anchor μόνο από ορατή έλξη (όχι grid/guide)
 *
 * Έτσι «παρακάμπτεται το flush» ⟺ «φαίνεται η fux» — ΕΞ ΟΡΙΣΜΟΥ συγχρονισμένα. Αυτό το test κλειδώνει
 * το κριτήριο ώστε να μην ξαναγυρίσει σε inline απόκλιση (π.χ. `!== 'grid'` μόνο, που άφηνε το guide να
 * παρακάμπτει το flush χωρίς ορατή fux).
 */

import { isVisibleSnapMode, isSnapMarkerVisible } from '../extended-types';

describe('isVisibleSnapMode (SSoT — «τι βλέπει/κλείδωσε ρητά ο χρήστης»)', () => {
  it('τα ΣΙΩΠΗΛΑ modes (grid/guide) → false (δεν φαίνεται fux, δεν παρακάμπτει flush)', () => {
    expect(isVisibleSnapMode('grid')).toBe(false);
    expect(isVisibleSnapMode('guide')).toBe(false);
  });

  it('κάθε πραγματικό geometric OSNAP → true', () => {
    for (const mode of ['endpoint', 'intersection', 'midpoint', 'center', 'quadrant', 'perpendicular', 'nearest', 'node']) {
      expect(isVisibleSnapMode(mode)).toBe(true);
    }
  });

  it('κενό/άγνωστο input → false (fail-safe)', () => {
    expect(isVisibleSnapMode(null)).toBe(false);
    expect(isVisibleSnapMode(undefined)).toBe(false);
    expect(isVisibleSnapMode('')).toBe(false);
  });

  it('`isSnapMarkerVisible` delegates στο ΙΔΙΟ κριτήριο (fux ⟺ visible mode)', () => {
    const at = { x: 1, y: 2 };
    expect(isSnapMarkerVisible({ type: 'endpoint', point: at })).toBe(true);
    expect(isSnapMarkerVisible({ type: 'grid', point: at })).toBe(false);
    expect(isSnapMarkerVisible({ type: 'guide', point: at })).toBe(false);
    expect(isSnapMarkerVisible(null)).toBe(false);
    expect(isSnapMarkerVisible({ type: 'endpoint', point: undefined } as never)).toBe(false);
  });
});
