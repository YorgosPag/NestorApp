/**
 * length-angle-hud-gate — SSoT predicate tests.
 *
 * Κλειδώνει τον καθολικό κανόνα: το status-bar toggle «ΜΗΚΟΣ/ΓΩΝΙΑ»
 * (cadToggleState.dimHudOn) είναι η ΜΟΝΗ πηγή αλήθειας για την ορατότητα
 * ΟΛΩΝ των length/angle HUD ενδείξεων (DXF + BIM, σχεδίαση + grip-drag, 2D + 3D).
 * Το `isLengthAngleHudVisible()` πρέπει να καθρεφτίζει πιστά το `setDimHud(...)`.
 *
 * @see ../length-angle-hud-gate.ts — το predicate υπό δοκιμή
 * @see ../cad-toggle-state.ts — SSoT του toggle (dimHudOn) + status-bar writer
 */
import { cadToggleState } from '../cad-toggle-state';
import { isLengthAngleHudVisible } from '../length-angle-hud-gate';

describe('length-angle-hud-gate', () => {
  beforeEach(() => {
    // Επαναφορά στο canonical default (ON) μεταξύ των tests.
    cadToggleState.setDimHud(true);
  });

  it('1. default: ορατό όταν το toggle είναι ON', () => {
    cadToggleState.setDimHud(true);
    expect(isLengthAngleHudVisible()).toBe(true);
  });

  it('2. κρύβεται καθολικά όταν setDimHud(false)', () => {
    cadToggleState.setDimHud(false);
    expect(isLengthAngleHudVisible()).toBe(false);
  });

  it('3. ακολουθεί το cadToggleState σε εναλλαγές ON→OFF→ON', () => {
    cadToggleState.setDimHud(true);
    expect(isLengthAngleHudVisible()).toBe(true);

    cadToggleState.setDimHud(false);
    expect(isLengthAngleHudVisible()).toBe(false);

    cadToggleState.setDimHud(true);
    expect(isLengthAngleHudVisible()).toBe(true);
  });

  it('4. καθρεφτίζει ακριβώς το isDimHudOn() (SSoT parity)', () => {
    cadToggleState.setDimHud(false);
    expect(isLengthAngleHudVisible()).toBe(cadToggleState.isDimHudOn());

    cadToggleState.setDimHud(true);
    expect(isLengthAngleHudVisible()).toBe(cadToggleState.isDimHudOn());
  });

  it('5. το gate είναι ανεξάρτητο από ortho/polar/snap/dynInput', () => {
    cadToggleState.set(true, false);
    cadToggleState.setSnap(true, 50);
    cadToggleState.setDynInput(true);

    cadToggleState.setDimHud(false);
    expect(isLengthAngleHudVisible()).toBe(false);

    cadToggleState.setDimHud(true);
    expect(isLengthAngleHudVisible()).toBe(true);
  });
});
