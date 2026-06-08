/**
 * ADR-426 — Water-Supply Auto-Design (Slice 1): integration sanity-check.
 *
 * Realistic bathroom (bathtub + washbasin + WC) with a cold + hot manifold, run
 * end-to-end: Stage 0 recognition (registry) → designWaterSupply → printed proposal
 * (networks, segments, DN, cumulative LU). Proves the engine composes on real fixtures.
 */

import type { Entity } from '../../../../types/entities';
import type { MepFixtureEntity, MepFixtureKind } from '../../../../bim/types/mep-fixture-types';
import type { PlumbingSystemClassification } from '../../../../bim/types/mep-connector-types';
import { buildDefaultMepFixtureParams } from '../../../../hooks/drawing/mep-fixture-completion';
import { recognizeSceneFromRegistry } from '../../../recognition/recognition-engine';
import { RecognitionRegistry } from '../../../recognition/recognition-registry';
import { registerMepRecognition } from '../../../recognition/recognizers/mep-recognition';
import { designWaterSupply } from '../design-water-supply';

function fixture(id: string, kind: MepFixtureKind, x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'sanitary', params } as MepFixtureEntity;
}

function manifold(id: string, x: number, y: number, c: PlumbingSystemClassification): Entity {
  return {
    id,
    type: 'mep-manifold',
    layerId: 'plumbing',
    params: {
      position: { x, y, z: 0 },
      rotation: 0,
      connectors: [
        { connectorId: 'm-out-0', domain: 'pipe', flow: 'out', localPosition: { x: 0, y: 0, z: 0 }, pipe: { systemClassification: c, diameterMm: 28 } },
      ],
    },
  } as unknown as Entity;
}

describe('ADR-426 — integration on a realistic bathroom', () => {
  it('designs cold + hot networks and reports a coherent proposal', () => {
    const scene: Entity[] = [
      manifold('m-cold', 200, 200, 'domestic-cold-water'),
      manifold('m-hot', 200, 320, 'domestic-hot-water'),
      fixture('tub', 'bathtub', 1500, 1000),
      fixture('wb', 'washbasin', 600, 1600),
      fixture('wc', 'wc', 1800, 1600),
    ];

    const registry = new RecognitionRegistry();
    registerMepRecognition(registry);
    const model = recognizeSceneFromRegistry(
      { entities: scene, storeyId: 'floor-1', sceneUnits: 'mm' },
      registry,
    );
    const proposal = designWaterSupply(model, scene);

    // ── Report ────────────────────────────────────────────────────────────────
    const lines: string[] = [''];
    lines.push('═══ ADR-426 water-supply proposal (realistic bathroom) ═══');
    for (const net of proposal.networks) {
      const trunks = net.segments.filter((s) => s.role === 'trunk');
      const branches = net.segments.filter((s) => s.role === 'branch');
      const dns = [...new Set(net.segments.map((s) => s.diameterMm))].sort((a, b) => a - b);
      lines.push(
        `  ${net.service.toUpperCase().padEnd(5)} ΣLU=${net.totalLU} · ${net.servedTerminalIds.length} fixtures · ` +
          `${trunks.length} trunk + ${branches.length} branch · DN={${dns.join(',')}}`,
      );
    }
    if (proposal.warnings.length) lines.push(`  warnings: ${proposal.warnings.join(' | ')}`);
    lines.push('═════════════════════════════════════════════════════════');
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    // ── Invariants ──────────────────────────────────────────────────────────────
    expect(proposal.networks.map((n) => n.service).sort()).toEqual(['cold', 'hot']);
    expect(proposal.warnings).toHaveLength(0);
    const cold = proposal.networks.find((n) => n.service === 'cold')!;
    expect(cold.totalLU).toBe(6); // bathtub 4 + washbasin 1 + wc 1
    const hot = proposal.networks.find((n) => n.service === 'hot')!;
    expect(hot.totalLU).toBe(5); // bathtub 4 + washbasin 1 (WC has no hot)
    // diminishing trunk: the max trunk DN ≥ any branch DN
    const maxTrunk = Math.max(...cold.segments.filter((s) => s.role === 'trunk').map((s) => s.diameterMm));
    const maxBranch = Math.max(...cold.segments.filter((s) => s.role === 'branch').map((s) => s.diameterMm));
    expect(maxTrunk).toBeGreaterThanOrEqual(maxBranch);
  });
});
