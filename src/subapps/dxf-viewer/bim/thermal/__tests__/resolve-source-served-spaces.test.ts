/**
 * Tests για το resolve-source-served-spaces.ts (ADR-422).
 * jest globals — ΟΧΙ vitest import.
 *
 * Χρησιμοποιεί minimal typed object literals που ικανοποιούν ΜΟΝΟ τα πεδία
 * που διαβάζουν οι tested functions — χωρίς `any` / `as any`.
 */

import {
  resolveSourceServedSpaces,
  sumServedHeatLoadW,
} from '../resolve-source-served-spaces';
import type { MepRadiatorEntity } from '../../types/mep-radiator-types';
import type { MepUnderfloorEntity } from '../../types/mep-underfloor-types';
import type { MepBoilerEntity } from '../../types/mep-boiler-types';
import type { MepSystemEntity } from '../../types/mep-system-types';
import type { ThermalSpaceEntity } from '../../types/thermal-space-types';
import type { Entity } from '../../../types/entities';
import type { SpaceHeatLoadDeriveResult } from '../heat-load/derive-space-heat-loads';

// ─── Helpers για minimal fixture creation ─────────────────────────────────────

/** Minimal BimValidation (fields used by type system — δεν διαβάζονται από τη fn). */
const STUB_VALIDATION = {
  hasCodeViolations: false,
  violationKeys: [] as readonly string[],
  lastValidatedAt: null,
} as const;

/** Minimal boiler (source entity — διαβάζεται μόνο το `id` και `type`). */
function makeBoiler(id: string): MepBoilerEntity {
  return {
    id,
    type: 'mep-boiler',
    ifcGuid: '0123456789abcdefABCDEF',
    ifcType: 'IfcBoiler',
    layerId: 'lyr_test',
    kind: 'wall-boiler',
    params: {
      kind: 'wall-boiler',
      shape: 'rectangular',
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      width: 450,
      length: 350,
      bodyHeightMm: 700,
      mountingElevationMm: 1200,
      connectorDiameterMm: 22,
      connectors: [],
    },
    geometry: {
      footprint: { vertices: [] },
      bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      area: 0,
      height: 700,
    },
    validation: STUB_VALIDATION,
  };
}

/**
 * Minimal radiator terminal.
 * position = σημείο που θα δοκιμαστεί με pointInPolygon.
 */
function makeRadiator(id: string, posX: number, posY: number): MepRadiatorEntity {
  return {
    id,
    type: 'mep-radiator',
    ifcGuid: '0123456789abcdefABCDEF',
    ifcType: 'IfcSpaceHeater',
    layerId: 'lyr_test',
    kind: 'panel-radiator',
    params: {
      kind: 'panel-radiator',
      shape: 'rectangular',
      position: { x: posX, y: posY, z: 0 },
      rotation: 0,
      width: 1000,
      length: 100,
      bodyHeightMm: 600,
      mountingElevationMm: 450,
      connectorDiameterMm: 15,
      connectors: [],
    },
    geometry: {
      footprint: { vertices: [] },
      bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      area: 0,
      height: 600,
    },
    validation: STUB_VALIDATION,
  };
}

/**
 * Minimal underfloor terminal.
 * footprint = τετράγωνο [0..w] × [0..h] — centroid = (w/2, h/2).
 */
function makeUnderfloor(
  id: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
): MepUnderfloorEntity {
  return {
    id,
    type: 'mep-underfloor',
    ifcGuid: '0123456789abcdefABCDEF',
    ifcType: 'IfcSpaceHeater',
    layerId: 'lyr_test',
    kind: 'hydronic-loop',
    params: {
      kind: 'hydronic-loop',
      footprint: {
        vertices: [
          { x: x0,     y: y0,     z: 0 },
          { x: x0 + w, y: y0,     z: 0 },
          { x: x0 + w, y: y0 + h, z: 0 },
          { x: x0,     y: y0 + h, z: 0 },
        ],
      },
      pipeSpacingMm: 150,
      edgeClearanceMm: 100,
      patternType: 'boustrophedon',
      screedOffsetMm: 50,
      connectorDiameterMm: 16,
      connectors: [],
    },
    geometry: {
      bbox: { min: { x: x0, y: y0 }, max: { x: x0 + w, y: y0 + h } },
      areaM2: (w * h) / 1e6,
      totalLengthM: 0,
      loopPath: [],
      supplyConnectorLocal: { x: x0, y: y0 },
      returnConnectorLocal: { x: x0, y: y0 },
    },
    validation: STUB_VALIDATION,
  };
}

/**
 * Minimal thermal space.
 * footprint = τετράγωνο [x0..x0+w] × [y0..y0+h].
 */
function makeSpace(
  id: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
): ThermalSpaceEntity {
  return {
    id,
    type: 'thermal-space',
    ifcGuid: '0123456789abcdefABCDEF',
    ifcType: 'IfcSpace',
    layerId: 'lyr_test',
    kind: 'generic',
    params: {
      footprint: {
        vertices: [
          { x: x0,     y: y0,     z: 0 },
          { x: x0 + w, y: y0,     z: 0 },
          { x: x0 + w, y: y0 + h, z: 0 },
          { x: x0,     y: y0 + h, z: 0 },
        ],
      },
      useType: 'generic',
      ceilingHeightMm: 3000,
    },
    geometry: {
      bbox: { min: { x: x0, y: y0 }, max: { x: x0 + w, y: y0 + h } },
      area: (w * h) / 1e6,
      perimeter: 2 * (w + h) / 1e3,
      volume: (w * h) / 1e6 * 3,
    },
    validation: STUB_VALIDATION,
  };
}

/** Minimal MepSystemEntity με source → boiler, member → radiator. */
function makeSystem(
  id: string,
  sourceEntityId: string,
  memberEntityIds: string[],
): MepSystemEntity {
  return {
    id,
    params: {
      systemType: 'pipe-network',
      name: 'Δοκιμαστικό δίκτυο',
      systemClassification: 'hydronic-supply',
      sourceEntityId,
      sourceConnectorId: 'conn_src',
      members: memberEntityIds.map((eid, i) => ({
        entityId: eid,
        connectorId: `conn_${i}`,
      })),
    },
  };
}

/** Minimal SpaceHeatLoadDeriveResult. */
function makeHeatLoads(
  entries: ReadonlyArray<{ spaceId: string; totalW: number }>,
  totalW: number,
): SpaceHeatLoadDeriveResult {
  const results = new Map(
    entries.map(({ spaceId, totalW: w }) => [
      spaceId,
      {
        spaceId,
        deltaTC: 30,
        transmissionW: w * 0.8,
        ventilationW: w * 0.2,
        infiltrationW: 0,
        designedVentilationW: w * 0.2,
        thermalBridgeW: 0,
        reheatW: 0,
        totalW: w,
        specificLoadWperM2: w / 20,
        boundaries: [],
      },
    ]),
  );
  return { results, minWperM2: 0, maxWperM2: 0, totalW };
}

// ─── resolveSourceServedSpaces — βασική περίπτωση (radiator) ─────────────────

describe('resolveSourceServedSpaces — radiator inside space', () => {
  it('επιστρέφει τον χώρο που περιέχει το καλοριφέρ', () => {
    // Χώρος: [0,0]→[5000,5000] mm
    // Καλοριφέρ: position (2500, 2500) — εντός χώρου
    const boiler = makeBoiler('boiler_1');
    const radiator = makeRadiator('rad_1', 2500, 2500);
    const space = makeSpace('space_1', 0, 0, 5000, 5000);
    const system = makeSystem('sys_1', 'boiler_1', ['rad_1']);

    const result = resolveSourceServedSpaces(
      boiler as unknown as Entity,
      [system],
      [radiator as unknown as Entity],
      [space],
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('space_1');
  });

  it('dedupe: δύο καλοριφέρ στον ίδιο χώρο → επιστρέφει 1 φορά τον χώρο', () => {
    const boiler = makeBoiler('boiler_1');
    const rad1 = makeRadiator('rad_1', 1000, 1000);
    const rad2 = makeRadiator('rad_2', 2000, 2000);
    const space = makeSpace('space_1', 0, 0, 5000, 5000);
    const system = makeSystem('sys_1', 'boiler_1', ['rad_1', 'rad_2']);

    const result = resolveSourceServedSpaces(
      boiler as unknown as Entity,
      [system],
      [rad1, rad2] as unknown as Entity[],
      [space],
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('space_1');
  });

  it('δύο καλοριφέρ σε διαφορετικούς χώρους → επιστρέφει 2 χώρους', () => {
    const boiler = makeBoiler('boiler_1');
    const rad1 = makeRadiator('rad_1', 500, 500);       // εντός space_1
    const rad2 = makeRadiator('rad_2', 6000, 6000);    // εντός space_2
    const space1 = makeSpace('space_1', 0, 0, 4000, 4000);
    const space2 = makeSpace('space_2', 5000, 5000, 4000, 4000);
    const system = makeSystem('sys_1', 'boiler_1', ['rad_1', 'rad_2']);

    const result = resolveSourceServedSpaces(
      boiler as unknown as Entity,
      [system],
      [rad1, rad2] as unknown as Entity[],
      [space1, space2],
    );

    expect(result).toHaveLength(2);
    const ids = result.map((s) => s.id).sort();
    expect(ids).toEqual(['space_1', 'space_2']);
  });
});

// ─── resolveSourceServedSpaces — underfloor (centroid) ───────────────────────

describe('resolveSourceServedSpaces — underfloor centroid', () => {
  it('χρησιμοποιεί centroid footprint ενδοδαπέδιου για το point-in-polygon test', () => {
    // Χώρος: [0,0]→[6000,6000]
    // Ενδοδαπέδιο: [500,500]→[3500,3500] — centroid = (2000,2000) ∈ χώρο
    const boiler = makeBoiler('boiler_1');
    const underfloor = makeUnderfloor('uf_1', 500, 500, 3000, 3000);
    const space = makeSpace('space_1', 0, 0, 6000, 6000);
    const system = makeSystem('sys_1', 'boiler_1', ['uf_1']);

    const result = resolveSourceServedSpaces(
      boiler as unknown as Entity,
      [system],
      [underfloor as unknown as Entity],
      [space],
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('space_1');
  });
});

// ─── resolveSourceServedSpaces — περίπτωση χωρίς δίκτυα ─────────────────────

describe('resolveSourceServedSpaces — no systems / no members', () => {
  it('επιστρέφει κενό πίνακα αν δεν υπάρχουν δίκτυα', () => {
    const boiler = makeBoiler('boiler_1');
    const space = makeSpace('space_1', 0, 0, 5000, 5000);

    const result = resolveSourceServedSpaces(
      boiler as unknown as Entity,
      [],          // κανένα σύστημα
      [],
      [space],
    );

    expect(result).toHaveLength(0);
  });

  it('επιστρέφει κενό πίνακα αν το δίκτυο δεν έχει members', () => {
    const boiler = makeBoiler('boiler_1');
    const space = makeSpace('space_1', 0, 0, 5000, 5000);
    const emptySystem = makeSystem('sys_1', 'boiler_1', []);

    const result = resolveSourceServedSpaces(
      boiler as unknown as Entity,
      [emptySystem],
      [],
      [space],
    );

    expect(result).toHaveLength(0);
  });

  it('αγνοεί terminal που βρίσκεται εκτός κάθε χώρου', () => {
    // Καλοριφέρ στο (99000, 99000) — εκτός όλων των χώρων
    const boiler = makeBoiler('boiler_1');
    const rad = makeRadiator('rad_1', 99_000, 99_000);
    const space = makeSpace('space_1', 0, 0, 5000, 5000);
    const system = makeSystem('sys_1', 'boiler_1', ['rad_1']);

    const result = resolveSourceServedSpaces(
      boiler as unknown as Entity,
      [system],
      [rad as unknown as Entity],
      [space],
    );

    expect(result).toHaveLength(0);
  });
});

// ─── sumServedHeatLoadW ───────────────────────────────────────────────────────

describe('sumServedHeatLoadW', () => {
  it('αθροίζει σωστά τα φορτία των δοσμένων χώρων', () => {
    const space1 = makeSpace('s1', 0, 0, 3000, 3000);
    const space2 = makeSpace('s2', 4000, 0, 3000, 3000);
    const heatLoads = makeHeatLoads(
      [{ spaceId: 's1', totalW: 3500 }, { spaceId: 's2', totalW: 2200 }],
      5700,
    );

    const total = sumServedHeatLoadW([space1, space2], heatLoads);
    expect(total).toBeCloseTo(5700, 1);
  });

  it('επιστρέφει 0 για κενό πίνακα χώρων (caller εφαρμόζει fallback)', () => {
    const heatLoads = makeHeatLoads([{ spaceId: 's1', totalW: 4000 }], 4000);
    expect(sumServedHeatLoadW([], heatLoads)).toBe(0);
  });

  it('χώρος χωρίς αποτέλεσμα στο Map μετράει ως 0 (defensive)', () => {
    const space = makeSpace('s_unknown', 0, 0, 3000, 3000);
    // Map κενή — δεν έχει 's_unknown'
    const heatLoads = makeHeatLoads([], 0);
    expect(sumServedHeatLoadW([space], heatLoads)).toBe(0);
  });

  it('αθροίζει μόνο τους δοσμένους χώρους — όχι ολόκληρο το totalW', () => {
    const space1 = makeSpace('s1', 0, 0, 3000, 3000);
    // heatLoads έχει s1 (1000 W) + s2 (9000 W)· δίνουμε μόνο space1
    const heatLoads = makeHeatLoads(
      [{ spaceId: 's1', totalW: 1000 }, { spaceId: 's2', totalW: 9000 }],
      10_000,
    );

    const partial = sumServedHeatLoadW([space1], heatLoads);
    expect(partial).toBeCloseTo(1000, 1);
    expect(partial).not.toBe(10_000);
  });
});
