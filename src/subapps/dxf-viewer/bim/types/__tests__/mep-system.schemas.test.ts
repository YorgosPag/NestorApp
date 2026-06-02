/**
 * ADR-408 Φ2 — MepSystem schema validation tests.
 */

import { MepSystemParamsSchema, MepSystemEntitySchema } from '../mep-system.schemas';
import { buildDefaultCircuitParams } from '../mep-system-types';

describe('MepSystemParamsSchema', () => {
  it('accepts a well-formed electrical circuit', () => {
    const params = buildDefaultCircuitParams('Circuit L1-01', 'pnl1', 'src', [
      { entityId: 'fx1', connectorId: 'c1' },
    ]);
    expect(MepSystemParamsSchema.safeParse(params).success).toBe(true);
  });

  it('rejects an empty name', () => {
    const params = buildDefaultCircuitParams('', 'pnl1', 'src');
    expect(MepSystemParamsSchema.safeParse(params).success).toBe(false);
  });

  it('rejects an unknown system type', () => {
    const bad = { ...buildDefaultCircuitParams('C', 'pnl1', 'src'), systemType: 'pipe-system' };
    expect(MepSystemParamsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a member missing connectorId', () => {
    const bad = {
      ...buildDefaultCircuitParams('C', 'pnl1', 'src'),
      members: [{ entityId: 'fx1' }],
    };
    expect(MepSystemParamsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects unknown extra keys (strict)', () => {
    const bad = { ...buildDefaultCircuitParams('C', 'pnl1', 'src'), bogus: 1 };
    expect(MepSystemParamsSchema.safeParse(bad).success).toBe(false);
  });
});

describe('MepSystemEntitySchema', () => {
  it('round-trips an entity with tenant/timestamp passthrough', () => {
    const entity = {
      id: 'mepsys_x',
      params: buildDefaultCircuitParams('C', 'pnl1', 'src'),
      companyId: 'co1',
      projectId: 'pr1',
      floorplanId: 'fp1',
    };
    const parsed = MepSystemEntitySchema.safeParse(entity);
    expect(parsed.success).toBe(true);
  });
});
