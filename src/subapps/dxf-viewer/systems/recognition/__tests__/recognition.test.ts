/**
 * ADR-423 / ADR-424 — Stage 0 Recognition: unit tests.
 *
 * Covers the agnostic kernel (space detection / binding / classification / engine)
 * + the MEP sanitary pilot (terminal recognizer, source recognizer, classifier)
 * + the SSoT registry wiring. Determinism is asserted (same scene ⇒ same ids).
 */

import type { Entity, LWPolylineEntity } from '../../../types/entities';
import type { MepFixtureEntity, MepFixtureKind } from '../../../bim/types/mep-fixture-types';
import { buildDefaultMepFixtureParams } from '../../../hooks/drawing/mep-fixture-completion';
import { detectSpaces } from '../space-detection';
import { bindElementsToSpaces } from '../space-binding';
import { recognizeScene, recognizeSceneFromRegistry } from '../recognition-engine';
import { RecognitionRegistry } from '../recognition-registry';
import { composeClassifiers } from '../space-classification';
import {
  sanitaryTerminalRecognizer,
  sanitarySpaceClassifier,
} from '../recognizers/sanitary-terminal-recognizer';
import { mepSourceRecognizer } from '../recognizers/mep-source-recognizer';
import {
  registerMepRecognition,
  MEP_RECOGNITION_ID,
} from '../recognizers/mep-recognition';
import {
  isRecognizedTerminal,
  isRecognizedSource,
  type RecognizedTerminal,
} from '../recognizers/mep-recognized-types';
import type { RecognitionInput } from '../recognition-types';

// ─── Fixtures (scene builders) ────────────────────────────────────────────────

/** A wall-bounded room as a closed rectangle (lwpolyline), scene units = mm. */
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

/** A connectable sanitary fixture at (x, y) — full params incl. pipe connectors. */
function fixture(id: string, kind: MepFixtureKind, x: number, y: number): MepFixtureEntity {
  const params = buildDefaultMepFixtureParams({ x, y }, { kind });
  return { id, type: 'mep-fixture', layerId: 'sanitary', params } as MepFixtureEntity;
}

/** A bare manifold source at (x, y) — only the fields the recognizer reads. */
function manifold(id: string, x: number, y: number): Entity {
  return {
    id,
    type: 'mep-manifold',
    layerId: 'plumbing',
    params: { position: { x, y, z: 0 } },
  } as unknown as Entity;
}

const ROOM_4x3: Entity = room('r1', 0, 0, 4000, 3000); // 4m × 3m → 12 m²

function input(entities: readonly Entity[], storeyId = 'floor-1'): RecognitionInput {
  return { entities, storeyId, sceneUnits: 'mm' };
}

// ─── Space detection ──────────────────────────────────────────────────────────

describe('Stage 0 — space detection (ADR-419 reuse)', () => {
  it('promotes a closed wall loop to one space with correct m² area', () => {
    const spaces = detectSpaces([ROOM_4x3], 'floor-1', 'mm');
    expect(spaces).toHaveLength(1);
    expect(spaces[0].area).toBeCloseTo(12, 3);
    expect(spaces[0].shape).toBe('rectangle');
    expect(spaces[0].classification).toBe('unknown');
    expect(spaces[0].centroid.x).toBeCloseTo(2000, 1);
    expect(spaces[0].centroid.y).toBeCloseTo(1500, 1);
  });

  it('detects two separate rooms as two spaces', () => {
    const spaces = detectSpaces(
      [room('a', 0, 0, 2000, 2000), room('b', 5000, 0, 7000, 3000)],
      'floor-1',
      'mm',
    );
    expect(spaces).toHaveLength(2);
    const areas = spaces.map((s) => s.area).sort((p, q) => p - q);
    expect(areas[0]).toBeCloseTo(4, 3);
    expect(areas[1]).toBeCloseTo(6, 3);
  });

  it('produces deterministic, stable space ids (same scene ⇒ same id)', () => {
    const a = detectSpaces([ROOM_4x3], 'floor-1', 'mm')[0].spaceId;
    const b = detectSpaces([ROOM_4x3], 'floor-1', 'mm')[0].spaceId;
    expect(a).toBe(b);
    expect(a).toContain('space:floor-1:');
  });
});

// ─── Sanitary terminal recognizer ─────────────────────────────────────────────

describe('Stage 0 — sanitary terminal recognizer (pilot, Tier 1)', () => {
  const ctx = {
    entities: [fixture('wc1', 'wc', 1000, 1000), fixture('wb1', 'washbasin', 2000, 1000)],
    storeyId: 'floor-1',
    sceneUnits: 'mm' as const,
    spaces: [],
  };

  it('recognizes each sanitary fixture as a Tier-1 terminal (confidence 1)', () => {
    const terminals = sanitaryTerminalRecognizer.recognize(ctx);
    expect(terminals).toHaveLength(2);
    for (const t of terminals) {
      expect(t.category).toBe('mep-terminal');
      expect(t.tier).toBe('bim-entity');
      expect(t.confidence).toBe(1);
    }
  });

  it('derives service classifications from the embedded pipe connectors', () => {
    const byKind = new Map<string, RecognizedTerminal>(
      sanitaryTerminalRecognizer.recognize(ctx).map((t) => [t.terminalKind, t]),
    );
    // WC = cold supply + drain (no hot)
    expect(new Set(byKind.get('wc')!.serviceClassifications)).toEqual(
      new Set(['domestic-cold-water', 'sanitary-drainage']),
    );
    // Washbasin = cold + hot + drain
    expect(new Set(byKind.get('washbasin')!.serviceClassifications)).toEqual(
      new Set(['domestic-cold-water', 'domestic-hot-water', 'sanitary-drainage']),
    );
  });

  it('ignores non-sanitary entities (walls)', () => {
    const terminals = sanitaryTerminalRecognizer.recognize({ ...ctx, entities: [ROOM_4x3] });
    expect(terminals).toHaveLength(0);
  });
});

// ─── Source recognizer ────────────────────────────────────────────────────────

describe('Stage 0 — MEP source recognizer', () => {
  const baseCtx = { storeyId: 'floor-1', sceneUnits: 'mm' as const, spaces: [] };

  it('recognizes a manifold as a source', () => {
    const sources = mepSourceRecognizer.recognize({
      ...baseCtx,
      entities: [manifold('m1', 500, 500)],
    });
    expect(sources).toHaveLength(1);
    expect(sources[0].sourceKind).toBe('manifold');
    expect(sources[0].position).toEqual({ x: 500, y: 500 });
  });

  it('returns nothing for a fixtures-only scene', () => {
    const sources = mepSourceRecognizer.recognize({
      ...baseCtx,
      entities: [fixture('wc1', 'wc', 1000, 1000)],
    });
    expect(sources).toHaveLength(0);
  });
});

// ─── Space binding ────────────────────────────────────────────────────────────

describe('Stage 0 — space binding (smallest containing space)', () => {
  it('binds contained fixtures both ways; leaves outside ones unbound', () => {
    const spaces = detectSpaces([ROOM_4x3], 'floor-1', 'mm');
    const inside = sanitaryTerminalRecognizer.recognize({
      entities: [fixture('wc1', 'wc', 1000, 1000)],
      storeyId: 'floor-1',
      sceneUnits: 'mm',
      spaces,
    });
    const outside = sanitaryTerminalRecognizer.recognize({
      entities: [fixture('wc2', 'wc', 9000, 9000)],
      storeyId: 'floor-1',
      sceneUnits: 'mm',
      spaces,
    });
    const bound = bindElementsToSpaces(spaces, [...inside, ...outside]);
    expect(bound.spaces[0].containedElementIds).toEqual(['term:wc1']);
    expect(bound.elements.find((e) => e.elementId === 'term:wc1')!.spaceId).toBe(
      spaces[0].spaceId,
    );
    expect(bound.elements.find((e) => e.elementId === 'term:wc2')!.spaceId).toBeUndefined();
  });
});

// ─── Space classification ─────────────────────────────────────────────────────

describe('Stage 0 — sanitary space classifier', () => {
  function classifyRoomWith(kinds: readonly MepFixtureKind[]): string {
    const entities: Entity[] = [
      ROOM_4x3,
      ...kinds.map((k, i) => fixture(`f${i}`, k, 1000 + i * 200, 1000)),
    ];
    const model = recognizeScene(input(entities), {
      recognizers: [sanitaryTerminalRecognizer],
      classifier: sanitarySpaceClassifier,
    });
    return model.spaces[0].classification;
  }

  it('bath or shower ⇒ bathroom', () => {
    expect(classifyRoomWith(['bathtub', 'washbasin'])).toBe('bathroom');
    expect(classifyRoomWith(['shower'])).toBe('bathroom');
  });

  it('WC alone ⇒ wc', () => {
    expect(classifyRoomWith(['wc'])).toBe('wc');
  });

  it('WC + washbasin (no bath) ⇒ bathroom', () => {
    expect(classifyRoomWith(['wc', 'washbasin'])).toBe('bathroom');
  });

  it('empty room ⇒ unknown', () => {
    expect(classifyRoomWith([])).toBe('unknown');
  });
});

// ─── Engine + registry ────────────────────────────────────────────────────────

describe('Stage 0 — engine + SSoT registry', () => {
  it('recognizeScene wires detection → recognition → binding → classification', () => {
    const entities: Entity[] = [
      ROOM_4x3,
      fixture('wc1', 'wc', 1000, 1000),
      fixture('wb1', 'washbasin', 2000, 1000),
    ];
    const model = recognizeScene(input(entities), {
      recognizers: [sanitaryTerminalRecognizer],
      classifier: sanitarySpaceClassifier,
    });
    expect(model.spaces).toHaveLength(1);
    expect(model.spaces[0].classification).toBe('bathroom');
    expect(model.spaces[0].containedElementIds).toHaveLength(2);
    expect(model.elements.filter(isRecognizedTerminal)).toHaveLength(2);
  });

  it('registry assembles recognizers + classifiers; unregister/clear work', () => {
    const registry = new RecognitionRegistry();
    expect(registry.has(MEP_RECOGNITION_ID)).toBe(false);
    registerMepRecognition(registry);
    expect(registry.has(MEP_RECOGNITION_ID)).toBe(true);
    expect(registry.recognizers()).toHaveLength(2); // sanitary terminal + source
    expect(registry.classifiers()).toHaveLength(1);

    const model = recognizeSceneFromRegistry(
      input([ROOM_4x3, fixture('wc1', 'wc', 1000, 1000), manifold('m1', 500, 500)]),
      registry,
    );
    expect(model.spaces[0].classification).toBe('wc');
    expect(model.elements.filter(isRecognizedTerminal)).toHaveLength(1);
    expect(model.elements.filter(isRecognizedSource)).toHaveLength(1);

    expect(registry.unregister(MEP_RECOGNITION_ID)).toBe(true);
    expect(registry.recognizers()).toHaveLength(0);
    registry.clear();
    expect(registry.has(MEP_RECOGNITION_ID)).toBe(false);
  });

  it('composeClassifiers picks the highest-confidence verdict', () => {
    const composed = composeClassifiers([sanitarySpaceClassifier]);
    const model = recognizeScene(
      input([ROOM_4x3, fixture('b1', 'bathtub', 1000, 1000)]),
      { recognizers: [sanitaryTerminalRecognizer], classifier: composed },
    );
    expect(model.spaces[0].classification).toBe('bathroom');
    expect(model.spaces[0].classificationConfidence).toBeCloseTo(0.9, 5);
  });
});
