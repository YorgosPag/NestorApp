/**
 * ADR-684 Φ4-C — unit tests για την ΑΤΟΕ ταξινόμηση του παραμετρικού στερεού (§4.3).
 *
 * Ο διαχωριστής είναι ο `structuralRole` (metadata), ΟΧΙ το kind (πάντα 'generic'): δομικό → RC m³,
 * διακοσμητικό/απόν → καμία γραμμή (mirror ανανάθετου imported-mesh, §10.2). Fail-closed.
 */

import { resolveGenericSolidMapping, resolveAtoeMapping } from '../bim-to-atoe-mapping';

describe('resolveGenericSolidMapping — δομικό vs διακοσμητικό', () => {
  it('δομικό → σκυρόδεμα OIK-2.03 m³', () => {
    const m = resolveGenericSolidMapping('structural');
    expect(m).not.toBeNull();
    expect(m?.categoryCode).toBe('OIK-2.03');
    expect(m?.unit).toBe('m3');
  });

  it('διακοσμητικό → null (καμία αυτόματη γραμμή)', () => {
    expect(resolveGenericSolidMapping('decorative')).toBeNull();
  });

  it('απόν / άγνωστο / μη-string → null (fail-closed)', () => {
    expect(resolveGenericSolidMapping(undefined)).toBeNull();
    expect(resolveGenericSolidMapping(null)).toBeNull();
    expect(resolveGenericSolidMapping('garbage')).toBeNull();
    expect(resolveGenericSolidMapping(42)).toBeNull();
  });
});

describe('resolveAtoeMapping — το generic-solid ΔΕΝ λύνεται από τον kind-πίνακα', () => {
  it("entityType 'generic-solid' → null (διαχωρίζεται εκτός πίνακα, όπως imported-mesh)", () => {
    expect(resolveAtoeMapping('generic-solid', 'generic')).toBeNull();
  });
});
