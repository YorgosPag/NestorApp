/**
 * ADR-408 Φ14 — connectable sanitary fixtures (WC/washbasin/shower/bathtub/bidet).
 *
 * Verifies the SSoT wiring that turns the five sanitary terminals into connectable
 * `mep-fixture` kinds: IFC/category resolvers, the drain connector, kind-aware
 * default params (footprint + drain outlet), the shared 2D drawers, the tool-id
 * mapping, and Zod round-trip.
 */

import {
  resolveFixtureBimCategory,
  resolveFixtureIfcType,
  type MepFixtureParams,
} from '../../types/mep-fixture-types';
import {
  SANITARY_KINDS,
  SANITARY_SPEC,
  SANITARY_DRAWERS,
  isSanitaryKind,
  sanitaryFixtureToolId,
  sanitaryFixtureToolKind,
} from '../../sanitary/sanitary-symbol-spec';
import {
  buildSanitaryDrainConnector,
  SANITARY_DRAIN_CONNECTOR_ID,
} from '../../types/mep-connector-types';
import { buildDefaultMepFixtureParams } from '../../../hooks/drawing/mep-fixture-completion';
import { MepFixtureKindSchema, MepFixtureParamsSchema } from '../../types/mep-fixture.schemas';
import type { Point3D } from '../../types/bim-base';

describe('ADR-408 Φ14 — sanitary fixture kinds', () => {
  describe('kind set + guards', () => {
    it('exposes exactly the five sanitary terminals', () => {
      expect([...SANITARY_KINDS]).toEqual(['wc', 'washbasin', 'shower', 'bathtub', 'bidet']);
    });

    it('isSanitaryKind only matches the five (not floor-drain / light-fixture)', () => {
      for (const k of SANITARY_KINDS) expect(isSanitaryKind(k)).toBe(true);
      expect(isSanitaryKind('floor-drain')).toBe(false);
      expect(isSanitaryKind('light-fixture')).toBe(false);
    });
  });

  describe('IFC + V/G category resolvers', () => {
    it('every sanitary terminal is an IfcSanitaryTerminal', () => {
      for (const k of SANITARY_KINDS) expect(resolveFixtureIfcType(k)).toBe('IfcSanitaryTerminal');
      // regression: the other kinds keep their classes
      expect(resolveFixtureIfcType('floor-drain')).toBe('IfcSanitaryTerminal');
      expect(resolveFixtureIfcType('light-fixture')).toBe('IfcLightFixture');
    });

    it("sanitary terminals map to the 'sanitary' V/G category (not 'drain-pipe')", () => {
      for (const k of SANITARY_KINDS) {
        expect(resolveFixtureBimCategory({ kind: k } as MepFixtureParams)).toBe('sanitary');
      }
      // regression: floor-drain stays on the drainage category, light on its own
      expect(resolveFixtureBimCategory({ kind: 'floor-drain' } as MepFixtureParams)).toBe('drain-pipe');
      expect(resolveFixtureBimCategory({ kind: 'light-fixture' } as MepFixtureParams)).toBe('light-fixture');
    });
  });

  describe('buildSanitaryDrainConnector', () => {
    it('is a single gravity outlet on the pipe domain, fixed to sanitary-drainage', () => {
      const c = buildSanitaryDrainConnector({ x: 0, y: 0, z: 0 }, 100);
      expect(c.connectorId).toBe(SANITARY_DRAIN_CONNECTOR_ID);
      expect(c.domain).toBe('pipe');
      expect(c.flow).toBe('out');
      expect(c.pipe?.systemClassification).toBe('sanitary-drainage');
      expect(c.pipe?.diameterMm).toBe(100);
    });
  });

  describe('buildDefaultMepFixtureParams — sanitary kinds', () => {
    for (const kind of SANITARY_KINDS) {
      it(`'${kind}' uses the SANITARY_SPEC footprint + drain + water-supply connectors, floor-standing`, () => {
        const params = buildDefaultMepFixtureParams({ x: 5, y: 7 }, { kind });
        const spec = SANITARY_SPEC[kind];
        expect(params.kind).toBe(kind);
        expect(params.shape).toBe('rectangular');
        expect(params.width).toBe(spec.widthMm);
        expect(params.length).toBe(spec.depthMm);
        expect(params.mountingElevationMm).toBe(0); // floor-standing (FFL)
        expect(params.position).toEqual({ x: 5, y: 7, z: 0 });
        const connectors = params.connectors ?? [];
        // gravity drain outlet (always), sized by the spec's DN
        const drain = connectors.find((c) => c.pipe?.systemClassification === 'sanitary-drainage');
        expect(drain?.flow).toBe('out');
        expect(drain?.pipe?.diameterMm).toBe(spec.drainDiameterMm);
        // cold-water supply inlet (always)
        const cold = connectors.find((c) => c.pipe?.systemClassification === 'domestic-cold-water');
        expect(cold?.flow).toBe('in');
        // hot-water supply inlet iff the kind mixes hot water (a WC is cold-only)
        const hot = connectors.find((c) => c.pipe?.systemClassification === 'domestic-hot-water');
        expect(hot !== undefined).toBe(spec.supply.hot);
        // total = drain + cold + (hot ? 1 : 0)
        expect(connectors).toHaveLength(2 + (spec.supply.hot ? 1 : 0));
      });
    }

    it('overrides still win over the spec defaults', () => {
      const params = buildDefaultMepFixtureParams({ x: 0, y: 0 }, { kind: 'wc', width: 999, rotation: 90 });
      expect(params.width).toBe(999);
      expect(params.rotation).toBe(90);
    });
  });

  describe('SANITARY_DRAWERS (shared 2D vectors)', () => {
    // A unit-square footprint in the (c0,c1,c2,c3) front-left-CCW convention.
    const FOOTPRINT: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];

    it('every kind has a drawer that emits at least one non-empty stroke', () => {
      for (const k of SANITARY_KINDS) {
        const strokes = SANITARY_DRAWERS[k](FOOTPRINT);
        expect(strokes.length).toBeGreaterThan(0);
        expect(strokes.every((s) => s.length >= 2)).toBe(true);
      }
    });
  });

  describe('tool-id ↔ kind mapping (one tool per kind)', () => {
    it('round-trips every sanitary kind through mep-${kind}', () => {
      for (const k of SANITARY_KINDS) {
        const toolId = sanitaryFixtureToolId(k);
        expect(toolId).toBe(`mep-${k}`);
        expect(sanitaryFixtureToolKind(toolId)).toBe(k);
      }
    });

    it('returns null for non-sanitary tools (no collisions)', () => {
      for (const id of ['mep-pipe', 'mep-fixture', 'mep-floor-drain', 'mep-duct', 'wall']) {
        expect(sanitaryFixtureToolKind(id)).toBeNull();
      }
    });
  });

  describe('Zod schema round-trip', () => {
    it('accepts every sanitary kind literal', () => {
      for (const k of SANITARY_KINDS) expect(MepFixtureKindSchema.parse(k)).toBe(k);
    });

    it('parses a full sanitary params object (WC) without dropping it', () => {
      const params = buildDefaultMepFixtureParams({ x: 1, y: 2 }, { kind: 'wc' });
      const parsed = MepFixtureParamsSchema.parse(params);
      expect(parsed.kind).toBe('wc');
      expect(parsed.connectors?.[0]?.pipe?.systemClassification).toBe('sanitary-drainage');
    });
  });
});
