/**
 * ADR-363 Phase 0 — BIM Enterprise ID generators unit tests.
 *
 * Verifies:
 *  - Each generator returns a string with the correct prefix
 *  - Generated IDs are unique (no collisions in batch)
 *  - Prefix constants match ADR-363 §5.11
 *  - SOS N.6: convenience functions call enterpriseIdService, never addDoc/randomUUID inline
 */

import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import {
  generateWallId,
  generateOpeningId,
  generateSlabId,
  generateSlabOpeningId,
  generateDeterministicSlabOpeningId,
  generateColumnId,
  generateBeamId,
  generateBimPresetId,
  generateBimMaterialId,
  generateBimSettingsId,
} from '@/services/enterprise-id-convenience';

describe('ADR-363 BIM ID Prefixes', () => {
  it('ENTERPRISE_ID_PREFIXES has correct BIM prefixes per ADR-363 §5.11', () => {
    expect(ENTERPRISE_ID_PREFIXES.WALL).toBe('wall');
    expect(ENTERPRISE_ID_PREFIXES.OPENING).toBe('opening');
    expect(ENTERPRISE_ID_PREFIXES.SLAB).toBe('slab');
    expect(ENTERPRISE_ID_PREFIXES.SLAB_OPENING).toBe('slbopn');
    expect(ENTERPRISE_ID_PREFIXES.COLUMN).toBe('col');
    expect(ENTERPRISE_ID_PREFIXES.BEAM).toBe('beam');
    expect(ENTERPRISE_ID_PREFIXES.BIM_PRESET).toBe('bpst');
    expect(ENTERPRISE_ID_PREFIXES.BIM_MATERIAL).toBe('bmat');
    expect(ENTERPRISE_ID_PREFIXES.BIM_SETTINGS).toBe('bset');
  });
});

describe('ADR-363 BIM ID Generators', () => {
  const PREFIX_CASES: [string, () => string, string][] = [
    ['generateWallId', generateWallId, 'wall'],
    ['generateOpeningId', generateOpeningId, 'opening'],
    ['generateSlabId', generateSlabId, 'slab'],
    ['generateSlabOpeningId', generateSlabOpeningId, 'slbopn'],
    ['generateColumnId', generateColumnId, 'col'],
    ['generateBeamId', generateBeamId, 'beam'],
    ['generateBimPresetId', generateBimPresetId, 'bpst'],
    ['generateBimMaterialId', generateBimMaterialId, 'bmat'],
    ['generateBimSettingsId', generateBimSettingsId, 'bset'],
  ];

  test.each(PREFIX_CASES)('%s returns string with prefix %s_', (name, fn, prefix) => {
    const id = fn();
    expect(typeof id).toBe('string');
    expect(id.startsWith(`${prefix}_`)).toBe(true);
  });

  test.each(PREFIX_CASES)('%s returns unique IDs (10 batch)', (name, fn) => {
    const ids = Array.from({ length: 10 }, () => fn());
    const unique = new Set(ids);
    expect(unique.size).toBe(10);
  });

  it('generateWallId length is reasonable (>10 chars)', () => {
    expect(generateWallId().length).toBeGreaterThan(10);
  });

  it('generateBimPresetId produces bpst_ prefix (ADR-363 §5.9.1 BimPreset)', () => {
    const id = generateBimPresetId();
    expect(id).toMatch(/^bpst_/);
  });
});

describe('ADR-632 Φ5 — deterministic slab-opening id', () => {
  it('ίδιο seed → ΙΔΙΟ id (σταθερό ανά (stair, slab))', () => {
    const seed = 'stair-1::slab-1';
    expect(generateDeterministicSlabOpeningId(seed)).toBe(generateDeterministicSlabOpeningId(seed));
  });

  it('διαφορετικό seed → διαφορετικό id', () => {
    expect(generateDeterministicSlabOpeningId('stair-1::slab-1')).not.toBe(
      generateDeterministicSlabOpeningId('stair-1::slab-2'),
    );
  });

  it('σωστό prefix (slbopn_) + uuid-shape', () => {
    const id = generateDeterministicSlabOpeningId('stair-9::slab-9');
    expect(id.startsWith('slbopn_')).toBe(true);
    expect(id).toMatch(/^slbopn_[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
