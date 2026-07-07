/**
 * ADR-581 — Dialog model (offered groups + preview) tests.
 */

import { buildOfferedGroups, buildPreviews, MATCH_CATEGORY_ORDER } from '../match-dialog-model';
import { __clearMatchRegistryCache } from '../../../systems/match-properties/match-registry';
import {
  ROLE_GEOM_WIDTH,
  ROLE_GEOM_HEIGHT,
  ROLE_MATERIAL_PRIMARY,
} from '../../../systems/match-properties/semantic-roles';
import type { EntityType } from '../../../types/entities';
import type { SceneEntity } from '../../../core/commands/interfaces';

beforeEach(() => __clearMatchRegistryCache());

function ent(id: string, type: EntityType, params: Record<string, unknown>): SceneEntity {
  return { id, type, visible: true, params } as unknown as SceneEntity;
}

describe('buildOfferedGroups', () => {
  it('same-type (line→line): προσφέρει style ρόλους ομαδοποιημένους', () => {
    const model = buildOfferedGroups('line', ['line']);
    expect(model.isCrossType).toBe(false);
    const style = model.groups.find((g) => g.category === 'style');
    expect(style).toBeDefined();
    expect(style!.items.length).toBeGreaterThan(0);
  });

  it('cross-type (column→beam): geometry width προσφέρεται, height ΟΧΙ', () => {
    const model = buildOfferedGroups('column', ['beam']);
    expect(model.isCrossType).toBe(true);
    expect(model.offeredRoles).toContain(ROLE_GEOM_WIDTH);
    expect(model.offeredRoles).not.toContain(ROLE_GEOM_HEIGHT);
  });

  it('οι κατηγορίες βγαίνουν σε σταθερή σειρά', () => {
    const model = buildOfferedGroups('column', ['column']);
    const order = model.groups.map((g) => g.category);
    const expected = MATCH_CATEGORY_ORDER.filter((c) => order.includes(c));
    expect(order).toEqual(expected);
  });
});

describe('buildPreviews', () => {
  it('same-type: row width→width confidence 1.0 (sameType), χωρίς warning', () => {
    const source = ent('c1', 'column', { width: 300, depth: 500, material: 'concrete' });
    const targets = new Map<EntityType, SceneEntity[]>([['column', [ent('c2', 'column', { width: 100 })]]]);
    const previews = buildPreviews(source, 'column', targets, new Set([ROLE_GEOM_WIDTH]));
    const row = previews[0]?.rows.find((r) => r.role === ROLE_GEOM_WIDTH);
    expect(row?.confidence).toBe(1);
    expect(row?.reason).toBe('sameType');
    expect(previews[0]?.warningKeys ?? []).toHaveLength(0);
  });

  it('ξύλο σε RC δομικό μέλος → warning materialIncompatibleStructural', () => {
    const source = ent('b1', 'beam', { material: 'wood' });
    const targets = new Map<EntityType, SceneEntity[]>([['column', [ent('c2', 'column', { material: 'concrete' })]]]);
    const previews = buildPreviews(source, 'beam', targets, new Set([ROLE_MATERIAL_PRIMARY]));
    expect(previews[0]?.warningKeys).toContain('matchProperties.warnings.materialIncompatibleStructural');
  });
});
