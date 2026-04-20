/**
 * Unit tests for `dedupDualWrite` — the client-side CDC dual-write collapser.
 *
 * Phase 1 CDC writes two `entity_audit_trail` documents per change (service
 * + cdc). The UI must surface only one row per logical action. Regression
 * risk: someone tweaks the window, the key, or the source preference and
 * Γιώργος silently starts seeing duplicate rows again.
 *
 * @module services/audit/__tests__/dedup-dual-write
 * @enterprise ADR-195 — Entity Audit Trail (Phase 1 CDC PoC)
 */

import { dedupDualWrite } from '../dedup-dual-write';
import type { EntityAuditEntry } from '@/types/audit-trail';

// ---------------------------------------------------------------------------
// Fixture builder — concise, typed, deterministic
// ---------------------------------------------------------------------------

let idCounter = 0;
function makeEntry(
  overrides: Partial<EntityAuditEntry> & { offsetMs?: number } = {},
): EntityAuditEntry {
  idCounter += 1;
  const base = new Date('2026-04-20T12:00:00.000Z').getTime();
  const ts = new Date(base + (overrides.offsetMs ?? 0)).toISOString();
  const { offsetMs: _omit, ...entryOverrides } = overrides;
  return {
    id: `eaud_${idCounter}`,
    entityType: 'contact',
    entityId: 'cont_1',
    entityName: 'Test',
    action: 'created',
    changes: [],
    performedBy: 'user_1',
    performedByName: 'Test User',
    companyId: 'comp_1',
    timestamp: ts,
    ...entryOverrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dedupDualWrite', () => {
  it('returns the input unchanged when no CDC entries are present', () => {
    const entries = [
      makeEntry({ source: 'service', offsetMs: 0 }),
      makeEntry({ source: undefined, offsetMs: 1000 }),
    ];
    expect(dedupDualWrite(entries)).toEqual(entries);
  });

  it('collapses a service+cdc pair on the same entityId+action within 30s', () => {
    const service = makeEntry({
      source: 'service',
      action: 'created',
      offsetMs: 0,
    });
    const cdc = makeEntry({
      source: 'cdc',
      action: 'created',
      offsetMs: 800, // 0.8s — well within the 30s window
    });
    const result = dedupDualWrite([cdc, service]);
    expect(result.map((e) => e.id)).toEqual([cdc.id]);
  });

  it('prefers the CDC entry over the service entry (more complete diff)', () => {
    const service = makeEntry({
      source: 'service',
      changes: [{ field: 'status', oldValue: null, newValue: 'active' }],
      offsetMs: 0,
    });
    const cdc = makeEntry({
      source: 'cdc',
      changes: [
        { field: 'firstName', oldValue: null, newValue: 'Giorgio' },
        { field: 'lastName', oldValue: null, newValue: 'Pagonis' },
        { field: 'status', oldValue: null, newValue: 'active' },
      ],
      offsetMs: 500,
    });
    const [kept] = dedupDualWrite([service, cdc]);
    expect(kept.source).toBe('cdc');
    expect(kept.changes).toHaveLength(3);
  });

  it('drops legacy entries (source === undefined) as if they were service-layer', () => {
    const legacy = makeEntry({ source: undefined, offsetMs: 0 });
    const cdc = makeEntry({ source: 'cdc', offsetMs: 1000 });
    const result = dedupDualWrite([legacy, cdc]);
    expect(result.map((e) => e.id)).toEqual([cdc.id]);
  });

  it('does not collapse when the service entry is outside the 30s window', () => {
    const service = makeEntry({ source: 'service', offsetMs: 0 });
    const cdc = makeEntry({ source: 'cdc', offsetMs: 31_000 });
    const result = dedupDualWrite([service, cdc]);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.source).sort()).toEqual(['cdc', 'service']);
  });

  it('does not collapse when actions differ (e.g. service wrote soft_deleted, cdc wrote status_changed)', () => {
    // Regression guard: the very bug that motivated the CDC resolveAction
    // status-string branch. If someone reverts that, CDC would emit
    // `status_changed` while service emits `soft_deleted` — this test ensures
    // the dedup does NOT silently hide the mismatch.
    const service = makeEntry({
      source: 'service',
      action: 'soft_deleted',
      offsetMs: 0,
    });
    const cdc = makeEntry({
      source: 'cdc',
      action: 'status_changed',
      offsetMs: 500,
    });
    const result = dedupDualWrite([service, cdc]);
    expect(result).toHaveLength(2);
  });

  it('does not collapse across different entities', () => {
    const a = makeEntry({ source: 'service', entityId: 'cont_1', offsetMs: 0 });
    const b = makeEntry({ source: 'cdc', entityId: 'cont_2', offsetMs: 500 });
    const result = dedupDualWrite([a, b]);
    expect(result).toHaveLength(2);
  });

  it('handles multiple independent pairs correctly', () => {
    // Two separate actions on the same contact, each with its own dual-write.
    const serviceCreate = makeEntry({
      source: 'service',
      action: 'created',
      offsetMs: 0,
    });
    const cdcCreate = makeEntry({
      source: 'cdc',
      action: 'created',
      offsetMs: 500,
    });
    const serviceTrash = makeEntry({
      source: 'service',
      action: 'soft_deleted',
      offsetMs: 60_000,
    });
    const cdcTrash = makeEntry({
      source: 'cdc',
      action: 'soft_deleted',
      offsetMs: 60_500,
    });
    const result = dedupDualWrite([
      serviceCreate,
      cdcCreate,
      serviceTrash,
      cdcTrash,
    ]);
    expect(result.map((e) => e.id).sort()).toEqual(
      [cdcCreate.id, cdcTrash.id].sort(),
    );
  });

  it('never drops an entry missing an id (defensive: cannot match it)', () => {
    const orphan = makeEntry({ source: 'service', offsetMs: 0 });
    // Drop the id so the dedup can't identify+remove it even if the window
    // matches. The function must leave orphans alone rather than silently
    // purging them.
    delete (orphan as { id?: string }).id;
    const cdc = makeEntry({ source: 'cdc', offsetMs: 500 });
    const result = dedupDualWrite([orphan, cdc]);
    expect(result).toHaveLength(2);
  });

  it('returns entries unchanged when no service-layer counterpart exists', () => {
    const cdc = makeEntry({ source: 'cdc', offsetMs: 0 });
    expect(dedupDualWrite([cdc])).toEqual([cdc]);
  });

  it('handles an empty input array', () => {
    expect(dedupDualWrite([])).toEqual([]);
  });
});
