/**
 * createSceneLayer factory tests — ADR-358 Phase 9C v2.13.
 *
 * Validates:
 *   1. Auto-generation of `id` when caller omits it (factory injects `lyr_<UUID-v4>` via enterprise-id).
 *   2. Idempotency when caller provides `id` — explicit id wins, factory NEVER overwrites.
 *   3. ID format contract: `lyr_` prefix + 36-char UUID v4 body (crypto.randomUUID).
 *   4. Uniqueness across rapid calls (UUID v4 entropy).
 */

import { describe, it, expect } from '@jest/globals';
import { createSceneLayer } from '../entities';

const LYR_UUID_PATTERN = /^lyr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('createSceneLayer — id auto-generation (Phase 9C)', () => {
  it('auto-generates id when input.id is omitted', () => {
    const layer = createSceneLayer({ name: 'Walls' });
    expect(layer.id).toMatch(LYR_UUID_PATTERN);
  });

  it('preserves caller-provided id verbatim (idempotency)', () => {
    const explicit = 'lyr_01HXYZABCD1234567890ABCDEF';
    const layer = createSceneLayer({ id: explicit, name: 'Doors' });
    expect(layer.id).toBe(explicit);
  });

  it('does NOT overwrite explicit id even when other input fields trigger defaults', () => {
    const layer = createSceneLayer({
      id: 'lyr_explicit_test_id_keep_keep',
      name: 'Test',
    });
    expect(layer.id).toBe('lyr_explicit_test_id_keep_keep');
    expect(layer.colorAci).toBe(7);
    expect(layer.linetype).toBe('Continuous');
  });
});

describe('createSceneLayer — id format contract', () => {
  it('emits `lyr_` prefix + 36-char UUID v4 body when auto-generating', () => {
    const layer = createSceneLayer({ name: 'X' });
    expect(layer.id.startsWith('lyr_')).toBe(true);
    expect(layer.id.length).toBe(40);
  });

  it('id is a string (not undefined) — Phase 9C type contract', () => {
    const layer = createSceneLayer({ name: 'Y' });
    expect(typeof layer.id).toBe('string');
    expect(layer.id.length).toBeGreaterThan(0);
  });
});

describe('createSceneLayer — id uniqueness across rapid calls', () => {
  it('produces 100 distinct ids when factory auto-generates', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createSceneLayer({ name: `L${i}` }).id);
    }
    expect(ids.size).toBe(100);
  });

  it('mixing explicit + auto ids preserves explicit, generates the rest', () => {
    const explicit = createSceneLayer({ id: 'lyr_pinned_anchor_value_xxx00', name: 'A' });
    const auto1 = createSceneLayer({ name: 'B' });
    const auto2 = createSceneLayer({ name: 'C' });
    expect(explicit.id).toBe('lyr_pinned_anchor_value_xxx00');
    expect(auto1.id).not.toBe(explicit.id);
    expect(auto2.id).not.toBe(auto1.id);
  });
});
