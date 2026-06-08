/**
 * ADR-427 — Sanitary Drainage Auto-Design (Slice 1): integration sanity-check.
 *
 * Realistic bathroom (bathtub + washbasin + WC) draining into a φρεάτιο
 * (drainage-collector), run end-to-end: Stage 0 recognition (registry) → designDrainage →
 * printed proposal (ΣDU, segments, DN growing toward the collector, slopes, descending z).
 * Proves the gravity engine composes on real fixtures.
 */

import type { Entity } from '../../../../types/entities';
import type { MepFixtureEntity, MepFixtureKind } from '../../../../bim/types/mep-fixture-types';
import { buildDefaultMepFixtureParams } from '../../../../hooks/drawing/mep-fixture-completion';
import { recognizeSceneFromRegistry } from '../../../recognition/recognition-engine';
import { RecognitionRegistry } from '../../../recognition/recognition-registry';
import { registerMepRecognition } from '../../../recognition/recognizers/mep-recognition';
import { designDrainage } from '../design-drainage';
import { peakWastewaterFlow, EN12056_DEMAND_STANDARD } from '../discharge-units';

function fixture(id: string, kind: MepFixtureKind, x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'sanitary', params } as MepFixtureEntity;
}

function collector(id: string, x: number, y: number): Entity {
  return {
    id,
    type: 'mep-manifold',
    layerId: 'plumbing',
    params: {
      kind: 'drainage-collector',
      position: { x, y, z: 0 },
      rotation: 0,
      connectors: [
        {
          connectorId: 'c-out-0',
          domain: 'pipe',
          flow: 'out',
          localPosition: { x: 0, y: 0, z: 0 },
          pipe: { systemClassification: 'sanitary-drainage', diameterMm: 110 },
        },
      ],
    },
  } as unknown as Entity;
}

describe('ADR-427 — integration on a realistic bathroom', () => {
  it('designs a gravity drainage network and reports a coherent proposal', () => {
    const scene: Entity[] = [
      collector('col', 200, 200),
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
    const proposal = designDrainage(model, scene, 'mm');

    // ── Report ────────────────────────────────────────────────────────────────
    const lines: string[] = [''];
    lines.push('═══ ADR-427 drainage proposal (realistic bathroom) ═══');
    for (const net of proposal.networks) {
      const trunks = net.segments.filter((s) => s.role === 'trunk');
      const branches = net.segments.filter((s) => s.role === 'branch');
      const dns = [...new Set(net.segments.map((s) => s.diameterMm))].sort((a, b) => a - b);
      const slopes = [...new Set(net.segments.map((s) => s.slopePercent))].sort((a, b) => a - b);
      const qww = peakWastewaterFlow(EN12056_DEMAND_STANDARD, net.totalDU);
      lines.push(
        `  DRAIN ΣDU=${net.totalDU} · Qww=${qww.toFixed(2)} l/s · ${net.servedTerminalIds.length} fixtures · ` +
          `${trunks.length} trunk + ${branches.length} branch · DN={${dns.join(',')}} · slopes%={${slopes.join(',')}}`,
      );
    }
    if (proposal.warnings.length) lines.push(`  warnings: ${proposal.warnings.join(' | ')}`);
    lines.push('══════════════════════════════════════════════════════');
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    // ── Invariants ──────────────────────────────────────────────────────────────
    expect(proposal.warnings).toHaveLength(0);
    expect(proposal.networks).toHaveLength(1);
    const net = proposal.networks[0];
    expect(net.totalDU).toBeCloseTo(3.3); // bathtub 0.8 + washbasin 0.5 + wc 2.0
    expect(net.servedTerminalIds).toHaveLength(3);

    // WC line ≥ DN100 the whole way (the trunk it discharges into included)
    const maxDN = Math.max(...net.segments.map((s) => s.diameterMm));
    expect(maxDN).toBeGreaterThanOrEqual(100);

    // growing toward the collector: max trunk DN ≥ max branch DN
    const maxTrunk = Math.max(...net.segments.filter((s) => s.role === 'trunk').map((s) => s.diameterMm));
    const maxBranch = Math.max(...net.segments.filter((s) => s.role === 'branch').map((s) => s.diameterMm));
    expect(maxTrunk).toBeGreaterThanOrEqual(maxBranch);

    // monotonic descent: collector invert is the global minimum elevation
    const minZ = Math.min(...net.segments.map((s) => s.startElevationMm));
    expect(minZ).toBeGreaterThanOrEqual(net.outfallInvertElevationMm);
  });
});
