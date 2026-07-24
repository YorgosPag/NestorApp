/**
 * candidate-named-identity — named-entity row + duplicate-ordinal tests (ADR-659 Phase 3).
 *
 * The selection-cycling popover used to render every imported mesh as the raw `imported-mesh`
 * type. These tests pin the Giorgio-approved naming rule (source name by default; user + source
 * name when renamed) and the C4D-grade `#n` disambiguation of genuine duplicates.
 */

import type { Entity } from '../../../types/entities';
import {
  buildNamedIdentitySemantics,
  assignDuplicateOrdinals,
  type NamedOrdinalCandidate,
} from '../candidate-named-identity';

/** Minimal imported-mesh entity — `readImportedMeshField` only reads `nodeName` / `label`. */
function makeImportedMesh(nodeName: string, label?: string): Entity {
  return { id: `im-${nodeName}`, type: 'imported-mesh', params: { kind: 'imported', nodeName, label } } as unknown as Entity;
}

function makeBlock(name: string): Entity {
  return { id: `b-${name}`, type: 'block', name } as unknown as Entity;
}

/** Builds a candidate for the ordinal pass straight from a named-identity semantics. */
function candidate(entityType: string, displayName: string, sourceName?: string): NamedOrdinalCandidate {
  return { entityType, semantics: { named: { displayName, sourceName } } };
}

describe('buildNamedIdentitySemantics', () => {
  it('returns undefined for null/undefined/unnamed entities', () => {
    expect(buildNamedIdentitySemantics(null)).toBeUndefined();
    expect(buildNamedIdentitySemantics(undefined)).toBeUndefined();
    expect(buildNamedIdentitySemantics({ id: 'w', type: 'wall' } as unknown as Entity)).toBeUndefined();
  });

  it('imported mesh WITHOUT a user label → source name only (nodeName), no secondary', () => {
    expect(buildNamedIdentitySemantics(makeImportedMesh('HBFrmEdg'))).toEqual({ displayName: 'HBFrmEdg' });
  });

  it('imported mesh WITH a distinct user label → both (user name primary, source name secondary)', () => {
    expect(buildNamedIdentitySemantics(makeImportedMesh('HPellSt', 'Πλάτη'))).toEqual({
      displayName: 'Πλάτη',
      sourceName: 'HPellSt',
    });
  });

  it('imported mesh whose label equals the nodeName → no redundant secondary', () => {
    expect(buildNamedIdentitySemantics(makeImportedMesh('Chair', 'Chair'))).toEqual({ displayName: 'Chair' });
  });

  it('paramless imported mesh (legacy) → undefined (generic fallback)', () => {
    expect(buildNamedIdentitySemantics({ id: 'x', type: 'imported-mesh' } as unknown as Entity)).toBeUndefined();
  });

  it('block reference → its block name as the display name (no source secondary)', () => {
    expect(buildNamedIdentitySemantics(makeBlock('A-DOOR'))).toEqual({ displayName: 'A-DOOR' });
  });
});

describe('assignDuplicateOrdinals', () => {
  it('leaves rows with DIFFERENT names untouched (the chair-parts case)', () => {
    const input = [candidate('imported-mesh', 'HPellSt'), candidate('imported-mesh', 'HBFrmEdg')];
    const out = assignDuplicateOrdinals(input);
    expect(out.every((c) => c.duplicateOrdinal === undefined)).toBe(true);
  });

  it('appends 1-based #n to EACH member of a genuine-duplicate group', () => {
    const input = [
      candidate('imported-mesh', 'HPellSt'),
      candidate('imported-mesh', 'HPellSt'),
      candidate('imported-mesh', 'HPellSt'),
    ];
    expect(assignDuplicateOrdinals(input).map((c) => c.duplicateOrdinal)).toEqual([1, 2, 3]);
  });

  it('a renamed row and an un-renamed row with the same source name do NOT collide', () => {
    const input = [candidate('imported-mesh', 'Πλάτη', 'HPellSt'), candidate('imported-mesh', 'HPellSt')];
    expect(assignDuplicateOrdinals(input).every((c) => c.duplicateOrdinal === undefined)).toBe(true);
  });

  it('groups independently — two distinct duplicate pairs each restart at #1', () => {
    const input = [
      candidate('imported-mesh', 'A'),
      candidate('imported-mesh', 'B'),
      candidate('imported-mesh', 'A'),
      candidate('imported-mesh', 'B'),
    ];
    expect(assignDuplicateOrdinals(input).map((c) => c.duplicateOrdinal)).toEqual([1, 1, 2, 2]);
  });

  it('never touches non-named candidates (structural / 2D rows disambiguate themselves)', () => {
    const input: NamedOrdinalCandidate[] = [{ entityType: 'wall' }, { entityType: 'wall' }];
    expect(assignDuplicateOrdinals(input).every((c) => c.duplicateOrdinal === undefined)).toBe(true);
  });

  it('returns a NEW array (immutable) and does not mutate the inputs', () => {
    const input = [candidate('imported-mesh', 'X'), candidate('imported-mesh', 'X')];
    const out = assignDuplicateOrdinals(input);
    expect(out).not.toBe(input);
    expect(input[0].duplicateOrdinal).toBeUndefined();
  });
});
