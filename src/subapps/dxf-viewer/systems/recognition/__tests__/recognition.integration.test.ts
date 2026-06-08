/**
 * ADR-425 — Stage 0 Recognition: integration sanity-check on a REALISTIC plan.
 *
 * Builds a small apartment (bathroom + separate WC + kitchen + living) with walls
 * as real scene entities and sanitary fixtures via the REAL app factory
 * (`buildDefaultMepFixtureParams`), plus a manifold source, then runs the full
 * registry pipeline (`registerMepRecognition` → `recognizeSceneFromRegistry`) and
 * prints a human-readable report. Proves the pieces COMPOSE on a real-shaped plan,
 * beyond the minimal unit fixtures.
 */

import type { Entity, LWPolylineEntity } from '../../../types/entities';
import type { MepFixtureEntity, MepFixtureKind } from '../../../bim/types/mep-fixture-types';
import { buildDefaultMepFixtureParams } from '../../../hooks/drawing/mep-fixture-completion';
import { recognizeSceneFromRegistry } from '../recognition-engine';
import { RecognitionRegistry } from '../recognition-registry';
import { registerMepRecognition } from '../recognizers/mep-recognition';
import { isRecognizedTerminal, isRecognizedSource } from '../recognizers/mep-recognized-types';

function room(id: string, x0: number, y0: number, x1: number, y1: number): LWPolylineEntity {
  return {
    id,
    type: 'lwpolyline',
    layerId: 'walls',
    closed: true,
    vertices: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  } as LWPolylineEntity;
}

function fixture(id: string, kind: MepFixtureKind, x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'sanitary', params } as MepFixtureEntity;
}

function manifold(id: string, x: number, y: number): Entity {
  return {
    id,
    type: 'mep-manifold',
    layerId: 'plumbing',
    params: { position: { x, y, z: 0 } },
  } as unknown as Entity;
}

describe('ADR-425 — integration on a realistic apartment', () => {
  // Four rooms (mm), separate loops. Fixtures placed inside each wet room.
  const scene: Entity[] = [
    room('bath', 0, 0, 2200, 2000), //         4.4 m²  — bathtub + washbasin + WC
    room('wc', 2400, 0, 3600, 1500), //        1.8 m²  — WC + washbasin
    room('kitchen', 0, 2200, 3000, 4500), //   6.9 m²  — no fixtures (sanitary-only)
    room('living', 3800, 0, 7000, 4500), //   14.4 m²  — no fixtures
    // Bathroom fixtures
    fixture('f-bath-tub', 'bathtub', 1100, 1000),
    fixture('f-bath-wb', 'washbasin', 400, 400),
    fixture('f-bath-wc', 'wc', 400, 1500),
    // Separate WC fixtures
    fixture('f-wc-wc', 'wc', 2800, 400),
    fixture('f-wc-wb', 'washbasin', 3300, 400),
    // Source in a shaft
    manifold('m-cold', 3700, 200),
  ];

  it('recognizes spaces + terminals + source and composes a coherent model', () => {
    const registry = new RecognitionRegistry();
    registerMepRecognition(registry);
    const model = recognizeSceneFromRegistry(
      { entities: scene, storeyId: 'floor-1', sceneUnits: 'mm' },
      registry,
    );

    // ── Human-readable report ────────────────────────────────────────────────
    const lines: string[] = [];
    lines.push('');
    lines.push('═══ ADR-425 Stage 0 — recognition report (realistic apartment) ═══');
    lines.push(`spaces: ${model.spaces.length} · elements: ${model.elements.length}`);
    for (const s of model.spaces) {
      const terminals = model.elements.filter(
        (e) => e.spaceId === s.spaceId && isRecognizedTerminal(e),
      );
      const kinds = terminals
        .filter(isRecognizedTerminal)
        .map((t) => t.terminalKind)
        .join(', ');
      lines.push(
        `  • ${s.classification.padEnd(10)} (conf ${s.classificationConfidence.toFixed(2)}) ` +
          `${s.area.toFixed(1)} m²  shape=${s.shape}  terminals=[${kinds || '—'}]`,
      );
    }
    const allServices = new Set<string>();
    for (const e of model.elements) {
      if (isRecognizedTerminal(e)) e.serviceClassifications.forEach((c) => allServices.add(c));
    }
    const sources = model.elements.filter(isRecognizedSource);
    lines.push(`  sources: ${sources.map((s) => s.sourceKind).join(', ') || '—'}`);
    lines.push(`  services seen: ${[...allServices].sort().join(', ')}`);
    lines.push('═══════════════════════════════════════════════════════════════');
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    // ── Invariants ───────────────────────────────────────────────────────────
    expect(model.spaces).toHaveLength(4);
    const byClass = model.spaces.reduce<Record<string, number>>((acc, s) => {
      acc[s.classification] = (acc[s.classification] ?? 0) + 1;
      return acc;
    }, {});
    expect(byClass.bathroom).toBe(2); // bath room + WC room (WC+basin ⇒ bathroom)
    expect(byClass.unknown).toBe(2); // kitchen + living (no sanitary-only kitchen kind)
    expect(model.elements.filter(isRecognizedTerminal)).toHaveLength(5);
    expect(sources).toHaveLength(1);
    // every terminal landed inside a space
    for (const t of model.elements.filter(isRecognizedTerminal)) {
      expect(t.spaceId).toBeDefined();
    }
  });
});
