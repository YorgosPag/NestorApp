/**
 * ADR-464 Slice 3 — punching (EC2 §6.4) + one-way shear (EC2 §6.2.2) + diagnostics.
 *
 * Πιστοποιεί: (α) v_Rd,c SSoT (k-cap, ρl-cap, v_min floor), (β) διάτρηση (soil relief,
 * not-applicable χωρίς κολώνα, αστοχία σε λεπτό βαρυφορτωμένο πέδιλο), (γ) τέμνουσα
 * μονής διεύθυνσης, (δ) τον runner (punchingInadequate/oneWayShearInadequate, column FK).
 */

import { concreteShearResistanceMpa, computeFootingOneWayShear } from '../footing-shear';
import { computeFootingPunching } from '../footing-punching';
import { runFootingDesignChecks } from '../footing-design-checks';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import type { FootingDesignInput } from '../footing-design-types';
import type { Entity } from '../../../types/entities';

function input(overrides: Partial<FootingDesignInput> = {}): FootingDesignInput {
  return {
    widthMm: 4000,
    lengthMm: 4000,
    thicknessMm: 400,
    columnWidthMm: 400,
    columnDepthMm: 400,
    serviceLoad: { axialKn: 3000, momentXKnm: 0, momentYKnm: 0 },
    ulsLoad: { axialKn: 4050, momentXKnm: 0, momentYKnm: 0 },
    soilBearingCapacityKpa: 600,
    footingSelfWeightKn: 0,
    coverMm: 50,
    concreteGrade: 'C25/30',
    flexuralRatioL: 0.0013,
    ...overrides,
  };
}

// ─── v_Rd,c SSoT (EC2 §6.2.2) ─────────────────────────────────────────────────

describe('concreteShearResistanceMpa', () => {
  it('βασικός τύπος C25/30, d=450, ρl=0.5%', () => {
    // k=1+√(200/450)=1.667· vRdc=0.12·1.667·∛(100·0.005·25)=0.464
    expect(concreteShearResistanceMpa('C25/30', 450, 0.005)).toBeCloseTo(0.464, 2);
  });

  it('ρl πάνω από 2% → capped (ίδιο με ρl=0.02)', () => {
    expect(concreteShearResistanceMpa('C25/30', 450, 0.05)).toBeCloseTo(
      concreteShearResistanceMpa('C25/30', 450, 0.02),
      6,
    );
  });

  it('χαμηλό ρl → v_min floor', () => {
    // ρl=0 → vRdc τύπου=0 → επιστρέφει v_min=0.035·k^1.5·√fck
    expect(concreteShearResistanceMpa('C25/30', 450, 0)).toBeCloseTo(0.377, 2);
  });

  it('d ≤ 0 → 0', () => {
    expect(concreteShearResistanceMpa('C25/30', 0, 0.01)).toBe(0);
  });
});

// ─── Punching (EC2 §6.4) ──────────────────────────────────────────────────────

describe('computeFootingPunching', () => {
  it('λεπτό βαρυφορτωμένο πέδιλο → ανεπαρκές (v_Ed > v_Rd,c)', () => {
    const p = computeFootingPunching(input());
    expect(p.vEdMpa).toBeGreaterThan(p.vRdcMpa);
    expect(p.check.adequate).toBe(false);
    expect(p.controlPerimeterMm).toBeGreaterThan(0);
  });

  it('χωρίς διαστασιολογημένη κολώνα → αδρανές (adequate, μηδέν demand)', () => {
    const p = computeFootingPunching(input({ columnWidthMm: 0, columnDepthMm: 0 }));
    expect(p.vEdMpa).toBe(0);
    expect(p.check.adequate).toBe(true);
  });

  it('συμπαγές χοντρό πέδιλο → πλήρης ανακούφιση εδάφους → adequate', () => {
    // 2×2 πέδιλο, d μεγάλο: το περίγραμμα 2d ξεπερνά το ίχνος → relief capped → vEd≈0
    const p = computeFootingPunching(
      input({ widthMm: 2000, lengthMm: 2000, thicknessMm: 800, serviceLoad: { axialKn: 800, momentXKnm: 0, momentYKnm: 0 }, ulsLoad: { axialKn: 1080, momentXKnm: 0, momentYKnm: 0 } }),
    );
    expect(p.check.adequate).toBe(true);
  });
});

// ─── One-way shear (EC2 §6.2.2) ───────────────────────────────────────────────

describe('computeFootingOneWayShear', () => {
  it('λεπτό μεγάλο πέδιλο → ανεπαρκές', () => {
    const s = computeFootingOneWayShear(input());
    expect(Math.max(s.vEdXMpa, s.vEdYMpa)).toBeGreaterThan(s.vRdcMpa);
    expect(s.check.adequate).toBe(false);
  });

  it('κρίσιμη διατομή εκτός προβόλου (παχύ μικρό πέδιλο) → μηδέν τέμνουσα', () => {
    const s = computeFootingOneWayShear(
      input({ widthMm: 1200, lengthMm: 1200, thicknessMm: 700, ulsLoad: { axialKn: 500, momentXKnm: 0, momentYKnm: 0 } }),
    );
    expect(s.vEdXMpa).toBe(0);
    expect(s.check.adequate).toBe(true);
  });

  it('χωρίς κολώνα → αδρανές (adequate)', () => {
    const s = computeFootingOneWayShear(input({ columnWidthMm: 0, columnDepthMm: 0 }));
    expect(s.check.adequate).toBe(true);
  });
});

// ─── runFootingDesignChecks — punching + one-way (column FK) ──────────────────

function padFooting(): Entity {
  return {
    id: 'F1',
    type: 'foundation',
    params: {
      kind: 'pad',
      topElevationMm: -1000,
      thicknessMm: 400,
      width: 4000,
      length: 4000,
      position: { x: 0, y: 0, z: 0 },
      appliedLoad: { deadAxialKn: 3000, liveAxialKn: 0 },
    },
    geometry: { volume: 6.4, footprint: { vertices: [] } },
  } as unknown as Entity;
}

function columnOn(footingId: string | undefined): Entity {
  return {
    id: 'C1',
    type: 'column',
    params: { kind: 'rectangular', width: 400, depth: 400, height: 3000, sceneUnits: 'mm', footingId },
    geometry: { footprint: { vertices: [] } },
  } as unknown as Entity;
}

describe('runFootingDesignChecks — Slice 3 diagnostics', () => {
  it('attached κολώνα + λεπτό βαρυφορτωμένο → punching + one-way errors', () => {
    const diags = runFootingDesignChecks([padFooting(), columnOn('F1')], EUROCODE_PROVIDER, 600);
    expect(diags.find((d) => d.code === 'punchingInadequate')).toBeDefined();
    expect(diags.find((d) => d.code === 'oneWayShearInadequate')).toBeDefined();
    expect(diags.every((d) => d.severity === 'error')).toBe(true);
  });

  it('χωρίς attached κολώνα → καμία διάτρηση/τέμνουσα (advisory)', () => {
    const diags = runFootingDesignChecks([padFooting(), columnOn(undefined)], EUROCODE_PROVIDER, 600);
    expect(diags.find((d) => d.code === 'punchingInadequate')).toBeUndefined();
    expect(diags.find((d) => d.code === 'oneWayShearInadequate')).toBeUndefined();
  });
});
