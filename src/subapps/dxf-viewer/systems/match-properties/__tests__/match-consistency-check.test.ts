/**
 * ADR-581 — Consistency check tests.
 */

import { checkConsistency } from '../match-consistency-check';
import type { SceneEntity } from '../../../core/commands/interfaces';

const col = (id: string): SceneEntity => ({ id, type: 'column', visible: true, params: {} });
const wall = (id: string): SceneEntity => ({ id, type: 'wall', visible: true, params: {} });

describe('checkConsistency', () => {
  it('ξύλο σε RC δομικό μέλος → warning', () => {
    const w = checkConsistency(wall('w1'), col('c1'), { material: 'wood' });
    expect(w.some((x) => x.code === 'material-incompatible-structural')).toBe(true);
  });

  it('RC υλικό → καμία incompatible warning', () => {
    const w = checkConsistency(col('c1'), col('c2'), { material: 'rc' });
    expect(w.some((x) => x.code === 'material-incompatible-structural')).toBe(false);
  });

  it('χωρίς material patch → καμία warning', () => {
    expect(checkConsistency(col('c1'), col('c2'), { width: 500 })).toHaveLength(0);
  });
});
