/**
 * ADR-491 — γέφυρα FEM ροπής → M-N οπλισμός κολόνας (section-context + reinforce-patch).
 *
 * Επαληθεύει ότι ο `designMomentOverrideKnm` (η πραγματική ροπή του φορέα, π.χ. πρόβολος
 * → wL²/2 στη στήριξη) ρέει μέχρι τον ΥΠΑΡΧΟΝΤΑ suggester (ADR-472 S4) και αυξάνει τον
 * διαμήκη οπλισμό — ΧΩΡΙΣ νέο M-N engine. Κανόνας: `M_Ed = max(N_Ed·e₀, M_FEM)`.
 */

import {
  buildColumnSectionContextFromParams,
  resolveActiveColumnReinforcement,
} from '../section-context';
import { buildReinforcePatch } from '../reinforce-patch';
import { resolveStructuralCode } from '../codes';
import type { Entity } from '../../types/entities';
import type { ColumnParams } from '../../types/column-types';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';

const provider = resolveStructuralCode('eurocode');

/** Κολώνα 400×400 με ουσιαστικό αξονικό φορτίο (ώστε να ενεργοποιείται ο M-N σχεδιασμός). */
function loadedParams(reinforcement?: ColumnReinforcement): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    anchor: 'center',
    width: 400,
    depth: 400,
    height: 3000,
    sceneUnits: 'mm',
    appliedLoad: { deadAxialKn: 3000, liveAxialKn: 1000 },
    ...(reinforcement ? { reinforcement } : {}),
  } as ColumnParams;
}

function steelArea(r: ColumnReinforcement): number {
  return r.longitudinal.count * Math.PI * (r.longitudinal.diameterMm / 2) ** 2;
}

describe('section-context — designMomentOverrideKnm (ADR-491)', () => {
  it('M_Ed = max(N·e₀, M_FEM): μεγάλη FEM ροπή υπερισχύει της ονομαστικής', () => {
    const ctx = buildColumnSectionContextFromParams(loadedParams(), 300);
    expect(ctx.designMomentKnm).toBe(300);
  });

  it('μικρή FEM ροπή < ονομαστική → κρατά την ονομαστική e₀ (μηδέν regression)', () => {
    const nominal = buildColumnSectionContextFromParams(loadedParams()).designMomentKnm ?? 0;
    expect(nominal).toBeGreaterThan(0);
    const ctx = buildColumnSectionContextFromParams(loadedParams(), 1);
    expect(ctx.designMomentKnm).toBe(nominal); // 1 < nominal → max = nominal
  });

  it('χωρίς override → ακριβώς η σημερινή ονομαστική συμπεριφορά', () => {
    const a = buildColumnSectionContextFromParams(loadedParams()).designMomentKnm;
    const b = buildColumnSectionContextFromParams(loadedParams(), undefined).designMomentKnm;
    expect(a).toBe(b);
  });
});

describe('resolveActiveColumnReinforcement — FEM moment → περισσότερος χάλυβας (ADR-491)', () => {
  it('η FEM ροπή προβόλου αυξάνει τον διαμήκη οπλισμό', () => {
    const seed = provider.suggestColumnReinforcement(buildColumnSectionContextFromParams(loadedParams()));
    const auto: ColumnReinforcement = { ...seed, auto: true };

    const e0Only = resolveActiveColumnReinforcement(loadedParams(auto), provider)!;
    const withFem = resolveActiveColumnReinforcement(loadedParams(auto), provider, 400)!;

    expect(withFem.auto).toBe(true);
    expect(steelArea(withFem)).toBeGreaterThan(steelArea(e0Only));
  });
});

describe('buildReinforcePatch — columnFemMomentKnm (ADR-491)', () => {
  function columnEntity(): Entity {
    return { id: 'col-1', type: 'column', params: loadedParams() } as unknown as Entity;
  }

  it('absent reinforcement + FEM ροπή → περισσότερος οπλισμός από e₀-only', () => {
    const e0 = buildReinforcePatch(columnEntity(), provider, undefined, undefined);
    const fem = buildReinforcePatch(columnEntity(), provider, undefined, 400);
    expect(e0).not.toBeNull();
    expect(fem).not.toBeNull();
    const e0R = (e0!.next as ColumnParams).reinforcement!;
    const femR = (fem!.next as ColumnParams).reinforcement!;
    expect(steelArea(femR)).toBeGreaterThan(steelArea(e0R));
  });
});
