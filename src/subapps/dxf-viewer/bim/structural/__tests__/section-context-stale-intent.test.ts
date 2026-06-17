/**
 * ADR-472 S3 — Stale-intent invalidation (buildReinforcePatch re-study).
 *
 * Επιβεβαιώνει τη νέα συμπεριφορά του `buildReinforcePatch` για κολόνα/δοκάρι:
 *   (α) auto:true + αλλαγμένο φορτίο → re-design (patch≠null, περισσότερος χάλυβας)·
 *   (β) manual (`auto:false`) → ΠΟΤΕ overwrite (patch=null — Revit user wins)·
 *   (γ) convergence/idempotent: ίδιο φορτίο 2× → 2η φορά patch=null (no-oscillation)·
 *   (δ) absent → suggest όπως σήμερα (patch με `auto:true`)·
 *   (ε) `columnReinforcementMateriallyDiffers` / `beamReinforcementMateriallyDiffers`.
 *
 * Πέδιλα/εδαφόπλακα: αμετάβλητα (idempotent skip, ADR-464) — δεν ελέγχονται εδώ.
 */

import {
  buildReinforcePatch,
  columnReinforcementMateriallyDiffers,
  beamReinforcementMateriallyDiffers,
} from '../section-context';
import { EUROCODE_PROVIDER } from '../codes/eurocode-provider';
import { barAreaMm2 } from '../rebar-catalog';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
} from '../../../hooks/drawing/column-completion';
import { completeBeamFromTwoClicks } from '../../../hooks/drawing/beam-completion';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type { AppliedMemberLoad } from '../loads/structural-loads-types';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';

const provider = EUROCODE_PROVIDER;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Υψηλό αξονικό (ULS ≈ 1.35·2500 + 1.5·600 ≈ 4275 kN ≫ χωρητικότητα σκυρ. 400² C25/30). */
const HEAVY_AXIAL: AppliedMemberLoad = { deadAxialKn: 2500, liveAxialKn: 600 };
const HEAVY_LINE: AppliedMemberLoad = { deadAxialKn: 220, liveAxialKn: 80 };

function makeColumn(overrides: Partial<ColumnParams> = {}): ColumnEntity {
  const params = { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), width: 400, depth: 400, ...overrides };
  const r = buildColumnEntity(params as ColumnParams, 'C1');
  if (!r.ok) throw new Error('column build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

function makeBeam(reinforcement?: BeamReinforcement, appliedLoad?: AppliedMemberLoad): BeamEntity {
  const r = completeBeamFromTwoClicks({ x: 0, y: 0 }, { x: 6000, y: 0 }, 'L1');
  if (!r.ok) throw new Error('beam build failed: ' + r.hardErrors.join(','));
  return {
    ...r.entity,
    params: {
      ...r.entity.params,
      ...(reinforcement ? { reinforcement } : {}),
      ...(appliedLoad ? { appliedLoad } : {}),
    },
  };
}

/** Min-detailing seed (γεωμετρία-μόνο, χωρίς φορτίο) → stored auto reinforcement. */
function columnMinSeed(): ColumnReinforcement {
  const seed = provider.suggestColumnReinforcement({ widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 });
  return { ...seed, auto: true };
}
function beamMinSeed(): BeamReinforcement {
  const seed = provider.suggestBeamReinforcement({ widthMm: 300, depthMm: 500, spanMm: 6000, grossAreaMm2: 150000, supportType: 'simple' });
  return { ...seed, auto: true };
}

const colSteelMm2 = (r: ColumnReinforcement): number => r.longitudinal.count * barAreaMm2(r.longitudinal.diameterMm);
const beamBottomMm2 = (r: BeamReinforcement): number => r.bottom.count * barAreaMm2(r.bottom.diameterMm);

const asColumnReinf = (params: ColumnParams | undefined): ColumnReinforcement | undefined =>
  (params as { reinforcement?: ColumnReinforcement } | undefined)?.reinforcement;

// ─── (α) auto:true + load change → re-design ─────────────────────────────────

describe('ADR-472 S3 — κολόνα: auto:true re-derive σε αλλαγή φορτίου', () => {
  it('(α) stored min-detailing + βαρύ φορτίο → patch με περισσότερο χάλυβα', () => {
    const col = makeColumn({ reinforcement: columnMinSeed(), appliedLoad: HEAVY_AXIAL });
    const patch = buildReinforcePatch(col, provider);

    expect(patch).not.toBeNull();
    const fresh = asColumnReinf(patch!.next)!;
    expect(fresh.auto).toBe(true);
    expect(colSteelMm2(fresh)).toBeGreaterThan(colSteelMm2(columnMinSeed()));
  });

  it('(β) manual (auto:false) → ΠΟΤΕ overwrite (patch=null) ακόμη και με βαρύ φορτίο', () => {
    const manual: ColumnReinforcement = { ...columnMinSeed(), auto: false };
    const col = makeColumn({ reinforcement: manual, appliedLoad: HEAVY_AXIAL });
    expect(buildReinforcePatch(col, provider)).toBeNull();
  });

  it('(γ) convergence: ίδιο φορτίο 2× → 2η φορά patch=null (no-oscillation)', () => {
    // 1η: absent → load-aware patch.
    const col1 = makeColumn({ appliedLoad: HEAVY_AXIAL });
    const patch1 = buildReinforcePatch(col1, provider);
    expect(patch1).not.toBeNull();
    const derived = asColumnReinf(patch1!.next)!;

    // 2η: stored = το ίδιο derived, ίδιο φορτίο → μηδέν diff → null.
    const col2 = makeColumn({ reinforcement: derived, appliedLoad: HEAVY_AXIAL });
    expect(buildReinforcePatch(col2, provider)).toBeNull();
  });

  it('(δ) absent reinforcement → patch με auto:true (όπως σήμερα)', () => {
    const col = makeColumn();
    const patch = buildReinforcePatch(col, provider);
    expect(patch).not.toBeNull();
    expect(asColumnReinf(patch!.next)!.auto).toBe(true);
  });
});

// ─── δοκάρι (parity) ─────────────────────────────────────────────────────────

describe('ADR-472 S3 — δοκάρι: auto:true re-derive σε αλλαγή φορτίου', () => {
  it('(α) stored min-detailing + βαρύ γραμμικό φορτίο → patch με περισσότερο κάτω χάλυβα', () => {
    const beam = makeBeam(beamMinSeed(), HEAVY_LINE);
    const patch = buildReinforcePatch(beam, provider);

    expect(patch).not.toBeNull();
    const fresh = (patch!.next as { reinforcement?: BeamReinforcement }).reinforcement!;
    expect(fresh.auto).toBe(true);
    expect(beamBottomMm2(fresh)).toBeGreaterThanOrEqual(beamBottomMm2(beamMinSeed()));
  });

  it('(β) manual (auto:false) → patch=null', () => {
    const beam = makeBeam({ ...beamMinSeed(), auto: false }, HEAVY_LINE);
    expect(buildReinforcePatch(beam, provider)).toBeNull();
  });

  it('(γ) convergence: ίδιο φορτίο 2× → 2η φορά patch=null', () => {
    const beam1 = makeBeam(undefined, HEAVY_LINE);
    const patch1 = buildReinforcePatch(beam1, provider);
    expect(patch1).not.toBeNull();
    const derived = (patch1!.next as { reinforcement?: BeamReinforcement }).reinforcement!;

    const beam2 = makeBeam(derived, HEAVY_LINE);
    expect(buildReinforcePatch(beam2, provider)).toBeNull();
  });

  it('(δ) absent → patch με auto:true', () => {
    const beam = makeBeam();
    const patch = buildReinforcePatch(beam, provider);
    expect(patch).not.toBeNull();
    expect((patch!.next as { reinforcement?: BeamReinforcement }).reinforcement!.auto).toBe(true);
  });
});

// ─── (ε) Convergence-guard pure helpers ──────────────────────────────────────

describe('ADR-472 S3 — materiallyDiffers (exact, μηδέν float tolerance)', () => {
  const colA: ColumnReinforcement = {
    longitudinal: { count: 8, diameterMm: 20 },
    stirrups: { diameterMm: 8, spacingMm: 200, type: 'closed-hooked' },
    coverMm: 30,
    auto: true,
  };

  it('κολόνα: ίδιο count+Ø → false (detailing pref αδιάφορο)', () => {
    const same: ColumnReinforcement = { ...colA, stirrups: { ...colA.stirrups, type: 'spiral' }, crossTiePattern: 'grid' };
    expect(columnReinforcementMateriallyDiffers(colA, same)).toBe(false);
  });
  it('κολόνα: διαφορετικό count → true', () => {
    expect(columnReinforcementMateriallyDiffers(colA, { ...colA, longitudinal: { count: 12, diameterMm: 20 } })).toBe(true);
  });
  it('κολόνα: διαφορετικό Ø → true', () => {
    expect(columnReinforcementMateriallyDiffers(colA, { ...colA, longitudinal: { count: 8, diameterMm: 25 } })).toBe(true);
  });

  const beamA: BeamReinforcement = {
    bottom: { count: 3, diameterMm: 16 },
    top: { count: 2, diameterMm: 16 },
    stirrups: { diameterMm: 8, spacingMm: 200 },
    coverMm: 30,
    auto: true,
  };

  it('δοκάρι: ίδιες στρώσεις → false', () => {
    expect(beamReinforcementMateriallyDiffers(beamA, { ...beamA, stirrups: { ...beamA.stirrups, legs: 4 } })).toBe(false);
  });
  it('δοκάρι: αλλαγή κάτω στρώσης → true', () => {
    expect(beamReinforcementMateriallyDiffers(beamA, { ...beamA, bottom: { count: 5, diameterMm: 16 } })).toBe(true);
  });
  it('δοκάρι: αλλαγή άνω στρώσης → true', () => {
    expect(beamReinforcementMateriallyDiffers(beamA, { ...beamA, top: { count: 2, diameterMm: 20 } })).toBe(true);
  });
});
