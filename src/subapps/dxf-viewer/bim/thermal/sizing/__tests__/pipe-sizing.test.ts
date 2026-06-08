/**
 * ADR-422 L3 — tests για τον pipe-sizing engine (D5 velocity + friction).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Worked examples (νερό @~70°C: c=4187, ρ=977.8, μ=4.04e-4):
 *   Φ=10000 W, ΔΤ=10 K → ṁ = 10000/41870 = 0.23883 kg/s
 *                       → Q = ṁ/977.8 = 2.4426e-4 m³/s
 *                       → v(DN20,16→20mm inner) = Q/(π·0.01²) ≈ 0.7775 m/s
 */

import {
  computePipeMassFlow,
  computePipeVolumeFlow,
  pipeVelocity,
  pipeFriction,
} from '../pipe-sizing';
import { VELOCITY_FRICTION_STANDARD } from '../velocity-friction-standard';
import {
  WATER_SPECIFIC_HEAT_J_KGK,
  WATER_DENSITY_KG_M3,
  MAX_VELOCITY_M_S,
  MAX_FRICTION_PA_M,
  HEATING_DN_LADDER,
} from '../pipe-sizing-config';

describe('computePipeMassFlow', () => {
  it('ṁ = Φ/(c·ΔΤ) για Φ=10kW, ΔΤ=10K', () => {
    const m = computePipeMassFlow({ loadW: 10000, deltaTK: 10 });
    expect(m).toBeCloseTo(10000 / (WATER_SPECIFIC_HEAT_J_KGK * 10), 6);
    expect(m).toBeCloseTo(0.238834, 5);
  });

  it('μη-θετικό ΔΤ → 0 (guard, δεν πετά)', () => {
    expect(computePipeMassFlow({ loadW: 10000, deltaTK: 0 })).toBe(0);
    expect(computePipeMassFlow({ loadW: 10000, deltaTK: -5 })).toBe(0);
  });

  it('μη-θετικό/μη-πεπερασμένο φορτίο → 0', () => {
    expect(computePipeMassFlow({ loadW: 0, deltaTK: 10 })).toBe(0);
    expect(computePipeMassFlow({ loadW: Number.NaN, deltaTK: 10 })).toBe(0);
  });
});

describe('computePipeVolumeFlow', () => {
  it('Q = ṁ/ρ', () => {
    expect(computePipeVolumeFlow(0.238834)).toBeCloseTo(0.238834 / WATER_DENSITY_KG_M3, 9);
  });
  it('μη-θετική παροχή → 0', () => {
    expect(computePipeVolumeFlow(0)).toBe(0);
    expect(computePipeVolumeFlow(-1)).toBe(0);
  });
});

describe('pipeVelocity', () => {
  it('v = Q/A για Q=2.4426e-4, d_inner=20mm', () => {
    expect(pipeVelocity(2.4426e-4, 20)).toBeCloseTo(0.77746, 4);
  });
  it('μεγαλύτερη διάμετρος → μικρότερη ταχύτητα (ίδια παροχή)', () => {
    const q = 3e-4;
    expect(pipeVelocity(q, 32)).toBeLessThan(pipeVelocity(q, 16));
  });
});

describe('pipeFriction (Darcy–Weisbach)', () => {
  it('θετική για ρεαλιστική ροή· μεγαλύτερη διάμετρος → μικρότερη τριβή', () => {
    const v16 = pipeFriction(0.5, 16);
    const v32 = pipeFriction(0.5, 32);
    expect(v16).toBeGreaterThan(0);
    expect(v32).toBeLessThan(v16);
  });
  it('μηδενική ταχύτητα → 0', () => {
    expect(pipeFriction(0, 20)).toBe(0);
  });
});

describe('VELOCITY_FRICTION_STANDARD.diameterForFlow', () => {
  it('μικρή παροχή → μικρό DN, εντός ορίων v/R', () => {
    const sel = VELOCITY_FRICTION_STANDARD.diameterForFlow(0.00005);
    expect(sel.dnMm).toBe(15);
    expect(sel.velocityMS).toBeLessThanOrEqual(MAX_VELOCITY_M_S);
    expect(sel.frictionPaM).toBeLessThanOrEqual(MAX_FRICTION_PA_M);
    expect(sel.saturated).toBe(false);
  });

  it('μεγαλύτερη παροχή → μεγαλύτερο DN (μονοτονικά μη-φθίνον)', () => {
    const flows = [0.00005, 0.0002, 0.0005, 0.001];
    const dns = flows.map((q) => VELOCITY_FRICTION_STANDARD.diameterForFlow(q).dnMm);
    for (let i = 1; i < dns.length; i++) {
      expect(dns[i]).toBeGreaterThanOrEqual(dns[i - 1]!);
    }
  });

  it('υπερβολική παροχή → μεγαλύτερο DN + saturated:true', () => {
    const largest = HEATING_DN_LADDER[HEATING_DN_LADDER.length - 1]!;
    const sel = VELOCITY_FRICTION_STANDARD.diameterForFlow(0.05);
    expect(sel.dnMm).toBe(largest.dnMm);
    expect(sel.saturated).toBe(true);
  });
});
