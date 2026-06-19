/**
 * ADR-499 §C v1 — torsion-capacity (`plasticTorsionalResistanceKnm`): βασικό T_Rd,max
 * ορθογώνιας RC διατομής (EC2 §6.3.2, θλιπτήρας σκυροδέματος).
 */

import { plasticTorsionalResistanceKnm } from '../torsion-capacity';
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
