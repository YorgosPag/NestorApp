/**
 * ADR-650 M10 (Εύρημα #2) — durable projectId resolution across sibling levels.
 */

import { resolveActiveProjectId } from '../level-floor-resolution';
import type { Level } from '../config';

// Minimal Level factory — only the fields the resolver reads.
const lvl = (over: Partial<Level>): Level => ({ id: 'lvl', name: 'L', ...over }) as Level;

describe('resolveActiveProjectId', () => {
  it('returns null for empty / nullish input', () => {
    expect(resolveActiveProjectId([])).toBeNull();
    expect(resolveActiveProjectId(null)).toBeNull();
    expect(resolveActiveProjectId(undefined)).toBeNull();
  });

  it('finds a sibling projectId even when the foundation level has none', () => {
    const levels = [
      lvl({ id: 'lvl_foundation', name: 'Θεμελίωση' }), // no projectId (wizard-less)
      lvl({ id: 'lvl_ground', name: 'Ισόγειο', projectId: 'proj_5a495bad' }),
    ];
    expect(resolveActiveProjectId(levels)).toBe('proj_5a495bad');
  });

  it('returns the first level projectId when present', () => {
    const levels = [
      lvl({ id: 'lvl_a', projectId: 'proj_a' }),
      lvl({ id: 'lvl_b', projectId: 'proj_b' }),
    ];
    expect(resolveActiveProjectId(levels)).toBe('proj_a');
  });

  it('returns null when no level carries a projectId', () => {
    expect(resolveActiveProjectId([lvl({ id: 'lvl_a' }), lvl({ id: 'lvl_b' })])).toBeNull();
  });
});
