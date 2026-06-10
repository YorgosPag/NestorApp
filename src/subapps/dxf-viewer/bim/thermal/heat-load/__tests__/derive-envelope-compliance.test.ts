/**
 * ADR-422 L6 — tests για το read-model ελέγχου συμμόρφωσης κελύφους ΚΕΝΑΚ
 * (derive-envelope-compliance). jest globals (describe/it/expect) — ΟΧΙ vitest.
 *
 * Επιβεβαιώνει: per-boundary ✓/✗ έναντι U_max ζώνης, gating εξωτ. κελύφους
 * (γειτονικά → skip), σύνοψη πλήθους (checked/compliant), και ντετερμινιστική
 * ταξινόμηση ανά spaceId.
 */

import { deriveEnvelopeCompliance } from '../derive-envelope-compliance';
import type {
  BoundaryHeatLoss,
  SpaceHeatLoadResult,
} from '../heat-load-types';

function boundary(
  kind: BoundaryHeatLoss['kind'],
  condition: BoundaryHeatLoss['condition'],
  uValue: number,
): BoundaryHeatLoss {
  return { kind, condition, uValue, area: 10, factor: 1, lossW: 0, thermalBridgeW: 0 };
}

function spaceResult(spaceId: string, boundaries: BoundaryHeatLoss[]): SpaceHeatLoadResult {
  return {
    spaceId,
    deltaTC: 20,
    transmissionW: 0,
    ventilationW: 0,
    infiltrationW: 0,
    designedVentilationW: 0,
    thermalBridgeW: 0,
    reheatW: 0,
    totalW: 0,
    specificLoadWperM2: 0,
    boundaries,
  };
}

describe('deriveEnvelopeCompliance', () => {
  it('checks external-envelope boundaries against the zone U_max (✓/✗)', () => {
    const results = new Map<string, SpaceHeatLoadResult>([
      [
        'sp-1',
        spaceResult('sp-1', [
          boundary('wall', 'external-air', 0.6), // > 0.45 (B) ⇒ ✗
          boundary('window', 'external-air', 2.5), // ≤ 2.6 (B) ⇒ ✓
        ]),
      ],
    ]);

    const out = deriveEnvelopeCompliance(results, 'B');

    expect(out.zone).toBe('B');
    expect(out.checkedCount).toBe(2);
    expect(out.compliantCount).toBe(1);

    const wall = out.rows.find((r) => r.kind === 'wall');
    expect(wall?.uMax).toBe(0.45);
    expect(wall?.compliant).toBe(false);

    const window = out.rows.find((r) => r.kind === 'window');
    expect(window?.uMax).toBe(2.6);
    expect(window?.compliant).toBe(true);
  });

  it('gates out non-envelope boundaries (adjacent/unheated)', () => {
    const results = new Map<string, SpaceHeatLoadResult>([
      [
        'sp-1',
        spaceResult('sp-1', [
          boundary('wall', 'adjacent-heated', 5), // εκτός ΚΕΝΑΚ ⇒ skip
          boundary('wall', 'unheated', 5), // εκτός ΚΕΝΑΚ ⇒ skip
          boundary('floor', 'ground', 0.5), // εδάφους ⇒ ελέγχεται
        ]),
      ],
    ]);

    const out = deriveEnvelopeCompliance(results, 'B');

    expect(out.checkedCount).toBe(1);
    expect(out.rows[0].kind).toBe('floor');
    expect(out.rows[0].compliant).toBe(true); // 0.5 ≤ 0.9 (B)
  });

  it('aggregates across spaces sorted by spaceId', () => {
    const results = new Map<string, SpaceHeatLoadResult>([
      ['sp-2', spaceResult('sp-2', [boundary('wall', 'external-air', 0.3)])],
      ['sp-1', spaceResult('sp-1', [boundary('roof', 'external-air', 0.9)])],
    ]);

    const out = deriveEnvelopeCompliance(results, 'B');

    expect(out.rows.map((r) => r.spaceId)).toEqual(['sp-1', 'sp-2']);
    expect(out.checkedCount).toBe(2);
    expect(out.compliantCount).toBe(1); // roof 0.9 > 0.45 ⇒ ✗ · wall 0.3 ≤ 0.45 ⇒ ✓
  });

  it('returns empty result for spaces with no checkable boundaries', () => {
    const results = new Map<string, SpaceHeatLoadResult>([
      ['sp-1', spaceResult('sp-1', [])],
    ]);
    const out = deriveEnvelopeCompliance(results, 'A');
    expect(out.rows).toHaveLength(0);
    expect(out.checkedCount).toBe(0);
    expect(out.compliantCount).toBe(0);
  });
});
