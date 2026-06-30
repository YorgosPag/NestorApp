/**
 * ADR-397 / ADR-357 — rotation POLAR + AutoAlign ίχνη (SSoT parity με τη σχεδίαση).
 *
 * Επαληθεύει ότι το `resolveRotationTracking` αλυσιδώνει ΤΑ ΙΔΙΑ primitives με το
 * `drawing-hover-handler`: POLAR/ORTHO angle-lock γύρω από το pivot (`resolveOrthoPolarStep`)
 * → alignment override (`resolveAlignmentTracking`). Καμία παράλληλη μηχανή.
 */
import { resolveRotationTracking } from '../rotation-tracking-overlay';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';

describe('resolveRotationTracking (ADR-397 — POLAR/AutoAlign στην περιστροφή)', () => {
  const ortho0 = cadToggleState.isOrthoOn();
  const polar0 = cadToggleState.isPolarOn();
  afterEach(() => cadToggleState.set(ortho0, polar0));

  const pivot = { x: 0, y: 0 };

  it('POLAR on → κουμπώνει τη γωνία γύρω από το pivot (cursor ~επί του άξονα → 0°)', () => {
    cadToggleState.set(false, true); // ortho off, polar on
    // atan2(0.2, 10) ≈ 1.15° < 3° tolerance → κουμπώνει στο πλησιέστερο 15-πλάσιο (0°).
    const res = resolveRotationTracking(pivot, { x: 10, y: 0.2 }, 1, null);
    expect(res.polar?.isSnapped).toBe(true);
    expect(res.polar?.snappedAngle).toBe(0);
    // ο cursor κουμπώνει στον άξονα → y ~0 (η περιστροφή τον ακολουθεί 1:1).
    expect(Math.abs(res.cursor.y)).toBeLessThan(1e-6);
  });

  it('POLAR/ORTHO off → polar=null, ο cursor μένει αμετάβλητος (καμία αλλαγή sweep)', () => {
    cadToggleState.set(false, false);
    const cursor = { x: 7, y: 3 };
    const res = resolveRotationTracking(pivot, cursor, 1, null);
    expect(res.polar).toBeNull();
    expect(res.cursor).toEqual(cursor);
  });

  it('χωρίς anchors (sceneEntities=null, κενό acquired store) → tracking=null', () => {
    cadToggleState.set(false, false);
    const res = resolveRotationTracking(pivot, { x: 5, y: 5 }, 1, null);
    expect(res.tracking).toBeNull();
  });
});
