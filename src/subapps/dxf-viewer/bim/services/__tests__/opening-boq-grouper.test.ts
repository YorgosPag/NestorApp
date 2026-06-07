/**
 * ADR-376 Phase B.2 — opening-boq-grouper unit tests.
 *
 * Verifies pure signature compute + group aggregation + mark range compaction +
 * payload building. No Firestore I/O — bridge integration covered separately.
 */

import {
  buildEffectiveSignatureMembers,
  buildOpeningGroupPayload,
  collectAffectedSignatures,
  compactMarkRange,
  computeOpeningSignature,
  groupBySignature,
  signatureGroupBoqId,
  signatureKey,
  type GrouperOpeningRow,
  type OpeningDocRow,
  type OpeningEffectiveResolver,
  type OpeningGroupBuildContext,
} from '../opening-boq-grouper';
import type { OpeningKind, OpeningParams } from '../../types/opening-types';
import type { OpeningTypeParams } from '../../types/bim-family-type';
import type { AtoeMappingEntry } from '../../config/bim-to-atoe-mapping';

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

function params(args: Partial<OpeningParams> & { kind: OpeningKind }): OpeningParams {
  return {
    kind: args.kind,
    wallId: args.wallId ?? 'w1',
    offsetFromStart: args.offsetFromStart ?? 0,
    width: args.width ?? 1200,
    height: args.height ?? 1400,
    sillHeight: args.sillHeight ?? 900,
    openDirection: args.openDirection,
    handing: args.handing,
    frameWidth: args.frameWidth,
    mark: args.mark,
    markIsManual: args.markIsManual,
  } as OpeningParams;
}

function row(args: {
  id: string;
  kind: OpeningKind;
  width?: number;
  height?: number;
  sillHeight?: number;
  openDirection?: 'inward' | 'outward';
  mark?: string;
  createdAt?: number;
}): GrouperOpeningRow {
  return {
    id: args.id,
    kind: args.kind,
    params: params({
      kind: args.kind,
      width: args.width,
      height: args.height,
      sillHeight: args.sillHeight,
      openDirection: args.openDirection,
      mark: args.mark,
    }),
    createdAtMillis: args.createdAt ?? 0,
  };
}

const CONTEXT: OpeningGroupBuildContext = {
  companyId: 'co_test',
  projectId: 'proj_test',
  buildingId: 'b_test',
  floorplanId: 'fp_test',
};

const WINDOW_MAPPING: AtoeMappingEntry = {
  categoryCode: 'OIK-5.02',
  unit: 'pcs',
  titleEL: 'Κούφωμα παραθύρου (BIM)',
};

const DOOR_MAPPING: AtoeMappingEntry = {
  categoryCode: 'OIK-5.01',
  unit: 'pcs',
  titleEL: 'Κούφωμα πόρτας (BIM)',
};

// ────────────────────────────────────────────────────────────────────────────
// Signature compute
// ────────────────────────────────────────────────────────────────────────────

describe('computeOpeningSignature', () => {
  it('stable — same params → same signature', () => {
    const p = params({ kind: 'window', width: 1200, height: 1400, sillHeight: 900 });
    const a = computeOpeningSignature(p);
    const b = computeOpeningSignature(p);
    expect(a).toEqual(b);
    expect(signatureKey(a)).toBe('window_1200_1400_900_na');
  });

  it('openDirection variants produce different signatures', () => {
    const inward = computeOpeningSignature(params({ kind: 'door', width: 900, height: 2100, sillHeight: 0, openDirection: 'inward' }));
    const outward = computeOpeningSignature(params({ kind: 'door', width: 900, height: 2100, sillHeight: 0, openDirection: 'outward' }));
    const na = computeOpeningSignature(params({ kind: 'door', width: 900, height: 2100, sillHeight: 0 }));
    expect(signatureKey(inward)).toBe('door_900_2100_0_inward');
    expect(signatureKey(outward)).toBe('door_900_2100_0_outward');
    expect(signatureKey(na)).toBe('door_900_2100_0_na');
    expect(new Set([signatureKey(inward), signatureKey(outward), signatureKey(na)]).size).toBe(3);
  });

  it('kind isolation — door vs window with same dims = different signatures', () => {
    const door = computeOpeningSignature(params({ kind: 'door', width: 900, height: 2100, sillHeight: 0 }));
    const win = computeOpeningSignature(params({ kind: 'window', width: 900, height: 2100, sillHeight: 0 }));
    expect(signatureKey(door)).not.toBe(signatureKey(win));
  });

  it('all 5 kinds produce distinct signature keys with same dims', () => {
    const kinds: OpeningKind[] = ['door', 'window', 'sliding-door', 'french-door', 'fixed'];
    const keys = kinds.map((k) =>
      signatureKey(computeOpeningSignature(params({ kind: k, width: 1000, height: 2000, sillHeight: 0 }))),
    );
    expect(new Set(keys).size).toBe(5);
  });

  it('non-signature fields (handing, frameWidth, mark) do NOT change signature', () => {
    const a = computeOpeningSignature(params({ kind: 'door', width: 900, height: 2100, sillHeight: 0, handing: 'left', frameWidth: 50, mark: 'Θ.001' }));
    const b = computeOpeningSignature(params({ kind: 'door', width: 900, height: 2100, sillHeight: 0, handing: 'right', frameWidth: 80, mark: 'Θ.002' }));
    expect(signatureKey(a)).toBe(signatureKey(b));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Group ID
// ────────────────────────────────────────────────────────────────────────────

describe('signatureGroupBoqId', () => {
  it('deterministic — same inputs → same ID', () => {
    const sig = computeOpeningSignature(params({ kind: 'window', width: 1200, height: 1400, sillHeight: 900 }));
    expect(signatureGroupBoqId('fp_a', sig)).toBe('boq_bim_opening_sig_fp_a_window_1200_1400_900_na');
    expect(signatureGroupBoqId('fp_a', sig)).toBe(signatureGroupBoqId('fp_a', sig));
  });

  it('different floorplans produce different IDs', () => {
    const sig = computeOpeningSignature(params({ kind: 'door', width: 900, height: 2100, sillHeight: 0 }));
    expect(signatureGroupBoqId('fp_a', sig)).not.toBe(signatureGroupBoqId('fp_b', sig));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Mark range compaction
// ────────────────────────────────────────────────────────────────────────────

describe('compactMarkRange', () => {
  it('empty list → empty string', () => {
    expect(compactMarkRange([])).toBe('');
  });

  it('singleton → mark verbatim', () => {
    expect(compactMarkRange(['Π.001'])).toBe('Π.001');
  });

  it('contiguous → range', () => {
    expect(compactMarkRange(['Π.001', 'Π.002', 'Π.003'])).toBe('Π.001..Π.003');
  });

  it('contiguous unsorted input → range (sort applied)', () => {
    expect(compactMarkRange(['Π.003', 'Π.001', 'Π.002'])).toBe('Π.001..Π.003');
  });

  it('gaps → comma-separated list', () => {
    expect(compactMarkRange(['Π.001', 'Π.003', 'Π.005'])).toBe('Π.001, Π.003, Π.005');
  });

  it('mixed contiguous + gaps → multiple ranges', () => {
    expect(compactMarkRange(['Π.001', 'Π.002', 'Π.005', 'Π.006'])).toBe('Π.001..Π.002, Π.005..Π.006');
  });

  it('unparseable marks (manual override) listed verbatim after parseable runs', () => {
    expect(compactMarkRange(['ΧΣ', 'Π.001', 'Π.002'])).toBe('Π.001..Π.002, ΧΣ');
  });

  it('different prefixes never collapse — basement Θ.Υ1.001 vs ground Θ.001', () => {
    expect(compactMarkRange(['Θ.001', 'Θ.Υ1.001', 'Θ.Υ1.002'])).toBe('Θ.001, Θ.Υ1.001..Θ.Υ1.002');
  });

  it('100-member contiguous range collapses cleanly', () => {
    const marks = Array.from({ length: 100 }, (_, i) => `Π.${String(101 + i).padStart(3, '0')}`);
    expect(compactMarkRange(marks)).toBe('Π.101..Π.200');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Group aggregation
// ────────────────────────────────────────────────────────────────────────────

describe('groupBySignature', () => {
  it('empty rows → empty map', () => {
    const result = groupBySignature([]);
    expect(result.size).toBe(0);
  });

  it('50 identical windows → 1 group of 50', () => {
    const rows: GrouperOpeningRow[] = Array.from({ length: 50 }, (_, i) =>
      row({ id: `w${i}`, kind: 'window', width: 1200, height: 1400, sillHeight: 900, mark: `Π.${String(101 + i).padStart(3, '0')}`, createdAt: i }),
    );
    const result = groupBySignature(rows);
    expect(result.size).toBe(1);
    const bucket = result.get('window_1200_1400_900_na')!;
    expect(bucket.rows).toHaveLength(50);
  });

  it('mixed signatures → separate buckets', () => {
    const rows = [
      row({ id: 'w1', kind: 'window', width: 1200, height: 1400, sillHeight: 900, mark: 'Π.001' }),
      row({ id: 'w2', kind: 'window', width: 1500, height: 1400, sillHeight: 900, mark: 'Π.002' }),
      row({ id: 'd1', kind: 'door', width: 900, height: 2100, sillHeight: 0, openDirection: 'inward', mark: 'Θ.001' }),
    ];
    const result = groupBySignature(rows);
    expect(result.size).toBe(3);
  });

  it('within-bucket sort by createdAt ascending', () => {
    const rows = [
      row({ id: 'w_late', kind: 'window', mark: 'Π.003', createdAt: 300 }),
      row({ id: 'w_early', kind: 'window', mark: 'Π.001', createdAt: 100 }),
      row({ id: 'w_mid', kind: 'window', mark: 'Π.002', createdAt: 200 }),
    ];
    const result = groupBySignature(rows);
    const bucket = result.get('window_1200_1400_900_na')!;
    expect(bucket.rows.map((r) => r.id)).toEqual(['w_early', 'w_mid', 'w_late']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Payload building
// ────────────────────────────────────────────────────────────────────────────

describe('buildOpeningGroupPayload', () => {
  function buildContiguousWindows(count: number): GrouperOpeningRow[] {
    return Array.from({ length: count }, (_, i) =>
      row({ id: `w${i}`, kind: 'window', mark: `Π.${String(101 + i).padStart(3, '0')}`, createdAt: i }),
    );
  }

  it('quantity equals member count', () => {
    const members = buildContiguousWindows(50);
    const sig = computeOpeningSignature(members[0]!.params);
    const built = buildOpeningGroupPayload({
      context: CONTEXT,
      signature: sig,
      members,
      mapping: WINDOW_MAPPING,
      existingCreatedAt: null,
    });
    expect(built.payload.estimatedQuantity).toBe(50);
    expect(built.memberCount).toBe(50);
  });

  it('description embeds compacted mark range', () => {
    const members = buildContiguousWindows(50);
    const sig = computeOpeningSignature(members[0]!.params);
    const built = buildOpeningGroupPayload({
      context: CONTEXT,
      signature: sig,
      members,
      mapping: WINDOW_MAPPING,
      existingCreatedAt: null,
    });
    expect(built.payload.description).toBe('Marks: Π.101..Π.150');
  });

  it('title enriched with dimensions (sill suffix when > 0)', () => {
    const members = buildContiguousWindows(1);
    const sig = computeOpeningSignature(members[0]!.params);
    const built = buildOpeningGroupPayload({
      context: CONTEXT,
      signature: sig,
      members,
      mapping: WINDOW_MAPPING,
      existingCreatedAt: null,
    });
    expect(built.payload.title).toBe('Κούφωμα παραθύρου (BIM) — 1200×1400 (sill 900)');
  });

  it('title omits sill suffix when sillHeight=0', () => {
    const doorRow = row({ id: 'd1', kind: 'door', width: 900, height: 2100, sillHeight: 0, openDirection: 'inward', mark: 'Θ.001' });
    const sig = computeOpeningSignature(doorRow.params);
    const built = buildOpeningGroupPayload({
      context: CONTEXT,
      signature: sig,
      members: [doorRow],
      mapping: DOOR_MAPPING,
      existingCreatedAt: null,
    });
    expect(built.payload.title).toBe('Κούφωμα πόρτας (BIM) — 900×2100 [inward]');
  });

  it('deterministic ID — id from floorplanId + signature key', () => {
    const members = buildContiguousWindows(1);
    const sig = computeOpeningSignature(members[0]!.params);
    const built = buildOpeningGroupPayload({
      context: CONTEXT,
      signature: sig,
      members,
      mapping: WINDOW_MAPPING,
      existingCreatedAt: null,
    });
    expect(built.id).toBe('boq_bim_opening_sig_fp_test_window_1200_1400_900_na');
  });

  it('createdAt preserved when existing row present', () => {
    const members = buildContiguousWindows(1);
    const sig = computeOpeningSignature(members[0]!.params);
    const existing = '2024-01-01T00:00:00.000Z';
    const built = buildOpeningGroupPayload({
      context: CONTEXT,
      signature: sig,
      members,
      mapping: WINDOW_MAPPING,
      existingCreatedAt: existing,
    });
    expect(built.payload.createdAt).toBe(existing);
  });

  it('idempotent — same inputs → same payload (excluding updatedAt)', () => {
    const members = buildContiguousWindows(5);
    const sig = computeOpeningSignature(members[0]!.params);
    const a = buildOpeningGroupPayload({ context: CONTEXT, signature: sig, members, mapping: WINDOW_MAPPING, existingCreatedAt: '2024-01-01T00:00:00.000Z' });
    const b = buildOpeningGroupPayload({ context: CONTEXT, signature: sig, members, mapping: WINDOW_MAPPING, existingCreatedAt: '2024-01-01T00:00:00.000Z' });
    const stripUpdated = (p: Record<string, unknown>) => {
      const { updatedAt: _u, ...rest } = p;
      return rest;
    };
    expect(stripUpdated(a.payload)).toEqual(stripUpdated(b.payload));
  });

  it('source markers — sourceType=bim-auto, sourceEntityType=opening, sourceEntityId=null', () => {
    const members = buildContiguousWindows(1);
    const sig = computeOpeningSignature(members[0]!.params);
    const built = buildOpeningGroupPayload({
      context: CONTEXT,
      signature: sig,
      members,
      mapping: WINDOW_MAPPING,
      existingCreatedAt: null,
    });
    expect(built.payload.sourceType).toBe('bim-auto');
    expect(built.payload.sourceEntityType).toBe('opening');
    // After stripUndefinedDeep, null entries persist (Firestore stores null).
    expect('sourceEntityId' in built.payload ? built.payload.sourceEntityId : undefined).toBeNull();
  });

  it('ADR-395 G7: floorId in context → linkedFloorId + scope="floor"', () => {
    const members = buildContiguousWindows(3);
    const sig = computeOpeningSignature(members[0]!.params);
    const built = buildOpeningGroupPayload({
      context: { ...CONTEXT, floorId: 'floor-A' },
      signature: sig,
      members,
      mapping: WINDOW_MAPPING,
      existingCreatedAt: null,
    });
    expect(built.payload.linkedFloorId).toBe('floor-A');
    expect(built.payload.scope).toBe('floor');
  });

  it('ADR-395 G7: no floorId → linkedFloorId null + scope="building" (back-compat)', () => {
    const members = buildContiguousWindows(3);
    const sig = computeOpeningSignature(members[0]!.params);
    const built = buildOpeningGroupPayload({
      context: CONTEXT,
      signature: sig,
      members,
      mapping: WINDOW_MAPPING,
      existingCreatedAt: null,
    });
    expect(built.payload.linkedFloorId).toBeNull();
    expect(built.payload.scope).toBe('building');
  });

  it('members without mark → description null', () => {
    const noMark = row({ id: 'unmark1', kind: 'window' });
    const sig = computeOpeningSignature(noMark.params);
    const built = buildOpeningGroupPayload({
      context: CONTEXT,
      signature: sig,
      members: [noMark],
      mapping: WINDOW_MAPPING,
      existingCreatedAt: null,
    });
    expect('description' in built.payload ? built.payload.description : undefined).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Effective-aware grouping (ADR-421 SLICE C — cross-floor BOQ re-feed)
// ────────────────────────────────────────────────────────────────────────────

function docRow(args: {
  id: string;
  kind: OpeningKind;
  width?: number;
  height?: number;
  sillHeight?: number;
  openDirection?: 'inward' | 'outward';
  mark?: string;
  typeId?: string;
  typeOverrides?: Partial<OpeningTypeParams>;
  createdAt?: number;
}): OpeningDocRow {
  return {
    id: args.id,
    params: params({
      kind: args.kind,
      width: args.width,
      height: args.height,
      sillHeight: args.sillHeight,
      openDirection: args.openDirection,
      mark: args.mark,
    }),
    typeId: args.typeId,
    typeOverrides: args.typeOverrides,
    createdAtMillis: args.createdAt ?? 0,
  };
}

/**
 * Fake «type wins» resolver mirroring `resolveEffectiveParams` against a catalog
 * snapshot — keeps these tests pure (no family-type store). Untyped/unknown-type
 * → cached unchanged (legacy fast-path). Order: cached → typeParams → overrides.
 */
function makeResolver(catalog: Record<string, Partial<OpeningTypeParams>>): OpeningEffectiveResolver {
  return (cached, link) => {
    if (!link.typeId) return cached;
    const typeParams = catalog[link.typeId];
    if (!typeParams) return cached;
    return { ...cached, ...typeParams, ...(link.typeOverrides ?? {}) } as OpeningParams;
  };
}

describe('buildEffectiveSignatureMembers (ADR-421 SLICE C)', () => {
  it('groups by EFFECTIVE («type wins») signature, not the stale doc params', () => {
    // Stale door doc (drift-cache says door/900) linked to a window/1200 type.
    const rows = [docRow({ id: 'o1', kind: 'door', width: 900, height: 2100, sillHeight: 0, typeId: 'T-win' })];
    const resolve = makeResolver({ 'T-win': { kind: 'window', width: 1200, height: 1400, sillHeight: 900 } });
    const map = buildEffectiveSignatureMembers(rows, resolve);
    expect([...map.keys()]).toEqual(['window_1200_1400_900_na']);
    const bucket = map.get('window_1200_1400_900_na')!;
    expect(bucket.members.map((m) => m.id)).toEqual(['o1']);
    expect(bucket.members[0]!.params.width).toBe(1200);
    expect(bucket.members[0]!.kind).toBe('window');
  });

  it('cross-type sharing — an untyped opening and a typed one resolve to the same group', () => {
    const rows = [
      docRow({ id: 'untyped', kind: 'window', width: 1200, height: 1400, sillHeight: 900 }),
      docRow({ id: 'typed', kind: 'door', width: 800, height: 2000, sillHeight: 0, typeId: 'T-win' }),
    ];
    const resolve = makeResolver({ 'T-win': { kind: 'window', width: 1200, height: 1400, sillHeight: 900 } });
    const map = buildEffectiveSignatureMembers(rows, resolve);
    expect(map.size).toBe(1);
    expect(map.get('window_1200_1400_900_na')!.members.map((m) => m.id).sort()).toEqual(['typed', 'untyped']);
  });

  it('per-instance override wins over the type', () => {
    const rows = [docRow({ id: 'o1', kind: 'window', width: 1000, height: 1400, sillHeight: 900, typeId: 'T', typeOverrides: { width: 1100 } })];
    const resolve = makeResolver({ T: { kind: 'window', width: 1000, height: 1400, sillHeight: 900 } });
    const map = buildEffectiveSignatureMembers(rows, resolve);
    expect([...map.keys()]).toEqual(['window_1100_1400_900_na']);
  });

  it('members sorted by createdAt ascending', () => {
    const rows = [
      docRow({ id: 'late', kind: 'window', createdAt: 300 }),
      docRow({ id: 'early', kind: 'window', createdAt: 100 }),
      docRow({ id: 'mid', kind: 'window', createdAt: 200 }),
    ];
    const map = buildEffectiveSignatureMembers(rows, makeResolver({}));
    expect(map.get('window_1200_1400_900_na')!.members.map((m) => m.id)).toEqual(['early', 'mid', 'late']);
  });
});

describe('collectAffectedSignatures (ADR-421 SLICE C)', () => {
  it('dimension edit — union of OLD (stale) and NEW (effective) signatures', () => {
    // doc still holds the old 900 dims; the live type now says 1000.
    const rows = [docRow({ id: 'o1', kind: 'door', width: 900, height: 2100, sillHeight: 0, typeId: 'T' })];
    const resolve = makeResolver({ T: { kind: 'door', width: 1000, height: 2100, sillHeight: 0 } });
    const affected = collectAffectedSignatures(rows, 'T', resolve).map(signatureKey).sort();
    expect(affected).toEqual(['door_1000_2100_0_na', 'door_900_2100_0_na']);
  });

  it('kind edit (door→window) — both the old door sig and the new window sig are affected', () => {
    const rows = [docRow({ id: 'o1', kind: 'door', width: 900, height: 2100, sillHeight: 0, typeId: 'T' })];
    const resolve = makeResolver({ T: { kind: 'window', width: 900, height: 2100, sillHeight: 0 } });
    const affected = collectAffectedSignatures(rows, 'T', resolve).map(signatureKey).sort();
    expect(affected).toEqual(['door_900_2100_0_na', 'window_900_2100_0_na']);
  });

  it('ignores openings NOT linked to the edited type', () => {
    const rows = [
      docRow({ id: 'mine', kind: 'door', width: 900, height: 2100, sillHeight: 0, typeId: 'T' }),
      docRow({ id: 'other', kind: 'window', width: 1500, height: 1400, sillHeight: 900, typeId: 'OTHER' }),
      docRow({ id: 'untyped', kind: 'window', width: 600, height: 600, sillHeight: 1200 }),
    ];
    const resolve = makeResolver({ T: { kind: 'door', width: 1000, height: 2100, sillHeight: 0 } });
    const affected = collectAffectedSignatures(rows, 'T', resolve).map(signatureKey).sort();
    expect(affected).toEqual(['door_1000_2100_0_na', 'door_900_2100_0_na']);
  });

  it('overridden instance whose effective dims do not move → single collapsed signature', () => {
    // doc.params already cache the override (1100); type 900→1000 leaves it at 1100.
    const rows = [docRow({ id: 'o1', kind: 'door', width: 1100, height: 2100, sillHeight: 0, typeId: 'T', typeOverrides: { width: 1100 } })];
    const resolve = makeResolver({ T: { kind: 'door', width: 1000, height: 2100, sillHeight: 0 } });
    const affected = collectAffectedSignatures(rows, 'T', resolve).map(signatureKey);
    expect(affected).toEqual(['door_1100_2100_0_na']);
  });

  it('no openings of the type → no affected signatures', () => {
    const rows = [docRow({ id: 'other', kind: 'window', typeId: 'OTHER' })];
    expect(collectAffectedSignatures(rows, 'T', makeResolver({}))).toEqual([]);
  });
});
