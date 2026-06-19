/**
 * ADR-499 §C v1 + §6.3-a — torsion-capacity: βασικό T_Rd,max (`plasticTorsionalResistanceKnm`),
 * ιδιότητες ισοδύναμου σωλήνα (`torsionTubeProperties`) και αλληλεπίδραση διάτμησης-στρέψης
 * (`shearTorsionUtilization`) ορθογώνιας RC διατομής (EC2 §6.3.2).
 */

import {
  plasticTorsionalResistanceKnm,
  torsionTubeProperties,
  shearTorsionUtilization,
} from '../torsion-capacity';
import { concreteFcdMpa } from '../../concrete-grades';

const FCD_C25 = concreteFcdMpa('C25/30'); // ≈ 16.67 MPa

describe('plasticTorsionalResistanceKnm', () => {
  it('έγκυρη διατομή 250×400 C25/30 → θετική αντοχή ~σωστής τάξης (~40 kNm)', () => {
    const tRd = plasticTorsionalResistanceKnm(250, 400, FCD_C25);
    expect(tRd).toBeGreaterThan(20);
    expect(tRd).toBeLessThan(80);
  });

  it('μεγαλύτερη διατομή → μεγαλύτερη αντοχή (μονοτονία)', () => {
    const small = plasticTorsionalResistanceKnm(250, 400, FCD_C25);
    const big = plasticTorsionalResistanceKnm(400, 600, FCD_C25);
    expect(big).toBeGreaterThan(small);
  });

  it('μεγαλύτερη κατηγορία σκυροδέματος → μεγαλύτερη αντοχή', () => {
    const c25 = plasticTorsionalResistanceKnm(300, 500, concreteFcdMpa('C25/30'));
    const c35 = plasticTorsionalResistanceKnm(300, 500, concreteFcdMpa('C35/45'));
    expect(c35).toBeGreaterThan(c25);
  });

  it('εκφυλισμένη διατομή (μηδενικό πλάτος/βάθος/fcd) → 0', () => {
    expect(plasticTorsionalResistanceKnm(0, 400, FCD_C25)).toBe(0);
    expect(plasticTorsionalResistanceKnm(250, 0, FCD_C25)).toBe(0);
    expect(plasticTorsionalResistanceKnm(250, 400, 0)).toBe(0);
  });
});

describe('torsionTubeProperties (EC2 §6.3.2 ισοδύναμος σωλήνας)', () => {
  it('250×400 → t_ef=A/u, A_k=(b−t_ef)(h−t_ef), u_k=2((b−t_ef)+(h−t_ef))', () => {
    const tube = torsionTubeProperties(250, 400);
    expect(tube).not.toBeNull();
    if (!tube) return;
    const tEf = (250 * 400) / (2 * (250 + 400)); // ≈ 76.92 mm
    expect(tube.tEfMm).toBeCloseTo(tEf, 4);
    expect(tube.akMm2).toBeCloseTo((250 - tEf) * (400 - tEf), 2);
    expect(tube.ukMm).toBeCloseTo(2 * ((250 - tEf) + (400 - tEf)), 2);
  });

  it('είναι το SSoT του T_Rd,max (ίδιο A_k·t_ef ⇒ ίδια αντοχή με την inline)', () => {
    const tube = torsionTubeProperties(300, 500);
    expect(tube).not.toBeNull();
    if (!tube) return;
    const expectedKnm = (2 * 0.6 * 0.5 * FCD_C25 * tube.akMm2 * tube.tEfMm) / 1e6;
    expect(plasticTorsionalResistanceKnm(300, 500, FCD_C25)).toBeCloseTo(expectedKnm, 6);
  });

  it('εκφυλισμένη διατομή → null', () => {
    expect(torsionTubeProperties(0, 400)).toBeNull();
    expect(torsionTubeProperties(250, 0)).toBeNull();
  });
});

describe('shearTorsionUtilization (EC2 §6.3.2(4) αλληλεπίδραση)', () => {
  it('= T_Ed/T_Rd,max + V_Ed/V_Rd,max', () => {
    expect(shearTorsionUtilization(20, 40, 50, 200)).toBeCloseTo(20 / 40 + 50 / 200, 6);
  });

  it('≤ 1 όταν επαρκής, > 1 όταν ανεπαρκής διατομή', () => {
    expect(shearTorsionUtilization(10, 40, 50, 200)).toBeLessThanOrEqual(1);
    expect(shearTorsionUtilization(35, 40, 150, 200)).toBeGreaterThan(1);
  });

  it('μη-θετική αντοχή → Infinity (ανέφικτο, ο sizer συνεχίζει να μεγαλώνει)', () => {
    expect(shearTorsionUtilization(10, 0, 50, 200)).toBe(Infinity);
    expect(shearTorsionUtilization(10, 40, 50, 0)).toBe(Infinity);
  });
});
