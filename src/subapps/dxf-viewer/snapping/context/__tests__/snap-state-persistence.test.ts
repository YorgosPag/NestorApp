/**
 * Regression tests for the migration-safe snap-state load merge (ADR-378).
 *
 * Root bug (handoff 2026-07-06): a pre-ADR-362 blob has no `dim_def_point` / `dim_line`
 * in its positive `activeTypes` list, so the old loader read them as `false` and the
 * dimension snaps never attracted. The merge must revive default-on ids that shipped
 * after the blob was written, while still honoring ids the blob explicitly disabled.
 */
import { resolvePersistedSnapState } from '../snap-state-persistence';

// Minimal, self-contained mode set that mirrors the SnapContext SSoT shape.
const MODES = ['endpoint', 'midpoint', 'grid', 'dim_def_point', 'dim_line'] as const;
type Mode = (typeof MODES)[number];

const DEFAULTS: Record<Mode, boolean> = {
  endpoint: true,
  midpoint: true,
  grid: true,
  dim_def_point: true, // default-on, ADR-362
  dim_line: true, // default-on, ADR-362
};

describe('resolvePersistedSnapState — migration-safe snap load', () => {
  it('revives default-on dim snaps missing from a legacy blob (the reported bug)', () => {
    // Legacy blob: written before dim snaps existed → no knownTypes, dim ids absent.
    const active = ['endpoint', 'midpoint', 'grid'];
    const result = resolvePersistedSnapState(MODES, DEFAULTS, active, undefined);

    expect(result.dim_def_point).toBe(true); // ← was false before the fix
    expect(result.dim_line).toBe(true);
  });

  it('keeps a legacy-blob mode that IS present enabled', () => {
    const result = resolvePersistedSnapState(MODES, DEFAULTS, ['endpoint'], undefined);
    expect(result.endpoint).toBe(true);
  });

  it('honors an explicitly-off id once knownTypes records it (post-migration blob)', () => {
    // User turned dim_line OFF; the write stamped knownTypes = all modes.
    const active = ['endpoint', 'midpoint', 'grid', 'dim_def_point'];
    const known = [...MODES];
    const result = resolvePersistedSnapState(MODES, DEFAULTS, active, known);

    expect(result.dim_line).toBe(false); // stays off — not silently revived
    expect(result.dim_def_point).toBe(true);
  });

  it('defaults a genuinely newer id absent from a post-migration knownTypes set', () => {
    // Blob knew only the first three modes; dim ids shipped afterwards.
    const active = ['endpoint', 'grid'];
    const known = ['endpoint', 'midpoint', 'grid'];
    const result = resolvePersistedSnapState(MODES, DEFAULTS, active, known);

    expect(result.midpoint).toBe(false); // known + not active → explicitly off
    expect(result.dim_def_point).toBe(true); // unknown/newer → default-on
    expect(result.dim_line).toBe(true);
  });

  it('is a pure projection over allModes (no extra / missing keys)', () => {
    const result = resolvePersistedSnapState(MODES, DEFAULTS, [], undefined);
    expect(Object.keys(result).sort()).toEqual([...MODES].sort());
  });
});
