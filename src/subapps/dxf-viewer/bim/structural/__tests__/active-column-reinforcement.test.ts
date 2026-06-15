/**
 * ADR-456/460 (Giorgio 2026-06-16) — real-time auto-reinforce SSoT
 * (`resolveActiveColumnReinforcement`).
 *
 * Verifies:
 *   - auto-mode ⇒ ο οπλισμός είναι DERIVED από την τρέχουσα γεωμετρία (αλλαγή
 *     διαστάσεων → φρέσκο code-suggested design, χωρίς επανάκληση κουμπιού).
 *   - manual-mode (`auto:false` / absent) ⇒ το stored design ΔΕΝ αλλάζει στο resize.
 *   - detailing prefs (τύπος συνδετήρα) διατηρούνται κατά το auto re-derive.
 */

import { resolveActiveColumnReinforcement } from '../section-context';
import { resolveStructuralCode } from '../codes';
import type { ColumnParams } from '../../types/column-types';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';

const provider = resolveStructuralCode('eurocode');

function baseParams(width: number, depth: number, reinforcement?: ColumnReinforcement): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    anchor: 'center',
    width,
    depth,
    height: 3000,
    sceneUnits: 'mm',
    ...(reinforcement ? { reinforcement } : {}),
  } as ColumnParams;
}

/** Συνολικό εμβαδόν διαμήκους χάλυβα = πλήθος × εμβαδόν μίας ράβδου (proxy του design). */
function steelArea(r: ColumnReinforcement): number {
  const d = r.longitudinal.diameterMm;
  return r.longitudinal.count * Math.PI * (d / 2) ** 2;
}

describe('resolveActiveColumnReinforcement — auto-derive (Giorgio 2026-06-16)', () => {
  it('auto-mode: μεγαλύτερη διατομή → περισσότερος (φρέσκος) διαμήκης χάλυβας', () => {
    const seed = provider.suggestColumnReinforcement({ widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 });
    const auto: ColumnReinforcement = { ...seed, auto: true };

    const small = resolveActiveColumnReinforcement(baseParams(400, 400, auto), provider)!;
    const big = resolveActiveColumnReinforcement(baseParams(800, 800, auto), provider)!;

    expect(small.auto).toBe(true);
    expect(big.auto).toBe(true);
    // Min-ρ × (4× εμβαδόν) ⇒ ουσιωδώς περισσότερος χάλυβας στη μεγάλη διατομή.
    expect(steelArea(big)).toBeGreaterThan(steelArea(small));
  });

  it('manual-mode (auto:false): το design ΔΕΝ αλλάζει στο resize', () => {
    const seed = provider.suggestColumnReinforcement({ widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 });
    const manual: ColumnReinforcement = { ...seed, auto: false };

    const a = resolveActiveColumnReinforcement(baseParams(400, 400, manual), provider)!;
    const b = resolveActiveColumnReinforcement(baseParams(800, 800, manual), provider)!;

    expect(a).toBe(manual); // referentially unchanged
    expect(steelArea(b)).toBe(steelArea(manual));
  });

  it('absent reinforcement → undefined (κανείς δεν ζωγραφίζει)', () => {
    expect(resolveActiveColumnReinforcement(baseParams(400, 400), provider)).toBeUndefined();
  });

  it('auto re-derive διατηρεί τον τύπο συνδετήρα (detailing pref)', () => {
    const seed = provider.suggestColumnReinforcement({ widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 });
    const auto: ColumnReinforcement = { ...seed, stirrups: { ...seed.stirrups, type: 'closed-hooked' }, auto: true };
    const out = resolveActiveColumnReinforcement(baseParams(600, 600, auto), provider)!;
    expect(out.stirrups.type).toBe('closed-hooked');
  });
});
