/**
 * ADR-376 Phase B.2 — Opening BOQ signature-group SSoT (pure module).
 *
 * Aggregates openings by **signature** (kind + width + height + sillHeight +
 * openDirection — Mode C, ADR-376 §7 B.2) into a single BOQ row per signature
 * group. Industry convergence 6/6 (Revit Door/Window Schedule, ArchiCAD
 * Interactive Schedule, Tekla, Allplan, Bentley AECOsim, Vectorworks): all
 * aggregate by type — never per-instance.
 *
 * Diverges from wall multi-layer pattern (`boq-multi-layer-builder.ts`) because
 * openings are **atomic** (no multi-component layers). 50 ίδια παράθυρα =
 * 1 BOQ row (quantity=50), όχι 50 ξεχωριστές γραμμές.
 *
 * Pure functions — no Firestore I/O, no React imports. Bridge consumer
 * (`BimToBoqBridge`) owns the fetch + write lifecycle.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §7 B.2 §11 v7
 */

import type { BOQItem } from '@/types/boq';
import { nowISO } from '@/lib/date-local';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import type { OpeningKind, OpeningParams } from '../types/opening-types';
import type { OpeningTypeParams } from '../types/bim-family-type';
import type { AtoeMappingEntry } from '../config/bim-to-atoe-mapping';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mode C signature components (ADR-376 §7 B.2). Two openings are aggregated
 * into the same BOQ row iff all five fields match.
 */
export interface OpeningSignature {
  readonly kind: OpeningKind;
  readonly width: number;
  readonly height: number;
  readonly sillHeight: number;
  /** Hinged-kind swing direction. 'na' when undefined (windows / sliding / fixed). */
  readonly openDirection: 'inward' | 'outward' | 'na';
}

/** Subset of `OpeningDoc` consumed by the grouper. */
export interface GrouperOpeningRow {
  readonly id: string;
  readonly kind: OpeningKind;
  readonly params: OpeningParams;
  /** `createdAt.toMillis()` for stable chronological sort within a group. */
  readonly createdAtMillis: number;
}

/**
 * Raw persisted-opening row (ADR-421 SLICE C cross-floor BOQ re-feed). Unlike
 * {@link GrouperOpeningRow} it carries the Family/Type link so the effective
 * («type wins») params can be resolved BEFORE signature grouping — the only way
 * a non-active floor's stale drift-cache doc reports the new type's dimensions.
 */
export interface OpeningDocRow {
  readonly id: string;
  /** Cached (drift-tolerant) params straight from the doc — NOT yet effective. */
  readonly params: OpeningParams;
  readonly typeId?: string;
  readonly typeOverrides?: Partial<OpeningTypeParams>;
  readonly createdAtMillis: number;
}

/**
 * Effective-param resolver injected into the pure helpers below so this module
 * stays free of the family-type store (which `resolveOpeningEffective` reads).
 * Signature matches `resolveOpeningEffective(cached, link)`.
 */
export type OpeningEffectiveResolver = (
  cached: OpeningParams,
  link: { typeId?: string; typeOverrides?: Partial<OpeningTypeParams> },
) => OpeningParams;

export interface OpeningGroupBuildContext {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
  /** Group scope — per-floorplan aggregation (ADR-376 §7 B.2 v7 scope). */
  readonly floorplanId: string;
  /** ADR-395 Phase 1 (G7) — floor link → `linkedFloorId` + `scope: 'floor'`. */
  readonly floorId?: string;
}

export interface BuiltOpeningGroupRow {
  readonly id: string;
  readonly signature: OpeningSignature;
  readonly memberCount: number;
  /** Sanitized for Firestore `setDoc` (no undefined). */
  readonly payload: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// SIGNATURE COMPUTE
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mode C signature από `OpeningParams`. Idempotent — same params yield same key.
 * `openDirection` collapses to `'na'` when undefined (window / sliding-door /
 * fixed kinds), so two windows with identical dims aggregate regardless of the
 * field being absent vs explicitly null.
 */
export function computeOpeningSignature(params: OpeningParams): OpeningSignature {
  return {
    kind: params.kind,
    width: params.width,
    height: params.height,
    sillHeight: params.sillHeight,
    openDirection: params.openDirection ?? 'na',
  };
}

/** Stable string key — used as Firestore ID suffix and as Map key. */
export function signatureKey(sig: OpeningSignature): string {
  return `${sig.kind}_${sig.width}_${sig.height}_${sig.sillHeight}_${sig.openDirection}`;
}

/**
 * Deterministic Firestore ID for the signature group row. Scope = per-floorplan
 * (matches `OpeningFirestoreService` subscribe query scope, ADR-376 §7 B.2 v7).
 */
export function signatureGroupBoqId(floorplanId: string, sig: OpeningSignature): string {
  return `boq_bim_opening_sig_${floorplanId}_${signatureKey(sig)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// MARK RANGE COMPACTION
// ────────────────────────────────────────────────────────────────────────────

interface ParsedMark {
  readonly prefix: string;
  readonly seq: number;
  readonly raw: string;
}

/**
 * Parse mark `Θ.001` / `Π.101` / `Θ.Υ1.001` into prefix + integer seq. Returns
 * `null` για non-numeric tails (manual overrides like `ΧΣ`).
 *
 * Whole-string prefix preserved: `Θ.` for ground/upper floors, `Θ.Υ1.` for
 * basement -1 (per `opening-mark-service.ts`). Two marks with different
 * prefixes never collapse into the same range.
 */
function parseMark(mark: string): ParsedMark | null {
  const dotIdx = mark.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === mark.length - 1) return null;
  const seqStr = mark.slice(dotIdx + 1);
  if (!/^\d+$/.test(seqStr)) return null;
  const seq = Number.parseInt(seqStr, 10);
  if (!Number.isFinite(seq)) return null;
  const prefix = mark.slice(0, dotIdx + 1); // includes trailing '.'
  return { prefix, seq, raw: mark };
}

/**
 * Compact a list of marks into a human-readable range string (Revit Schedule
 * convention). Contiguous seqs collapse to `start..end`, gaps split into
 * multiple ranges, unparseable marks listed verbatim.
 *
 * Examples:
 *   ['Π.001', 'Π.002', 'Π.003']           → 'Π.001..Π.003'
 *   ['Π.001', 'Π.003', 'Π.005']           → 'Π.001, Π.003, Π.005'
 *   ['Π.001', 'Π.002', 'Π.005', 'Π.006']  → 'Π.001..Π.002, Π.005..Π.006'
 *   ['Π.001']                              → 'Π.001'
 *   []                                     → ''
 *   ['ΧΣ', 'Π.001']                        → 'ΧΣ, Π.001'
 */
export function compactMarkRange(marks: readonly string[]): string {
  if (marks.length === 0) return '';

  // Group parseable marks by prefix (different floors/kinds never share runs).
  const groups = new Map<string, ParsedMark[]>();
  const unparseable: string[] = [];
  for (const m of marks) {
    const parsed = parseMark(m);
    if (!parsed) {
      unparseable.push(m);
      continue;
    }
    const bucket = groups.get(parsed.prefix) ?? [];
    bucket.push(parsed);
    groups.set(parsed.prefix, bucket);
  }

  const segments: string[] = [];
  const prefixesSorted = [...groups.keys()].sort();
  for (const prefix of prefixesSorted) {
    const parsed = groups.get(prefix)!;
    parsed.sort((a, b) => a.seq - b.seq);
    let runStart = parsed[0]!;
    let runEnd = parsed[0]!;
    for (let i = 1; i < parsed.length; i += 1) {
      const cur = parsed[i]!;
      if (cur.seq === runEnd.seq + 1) {
        runEnd = cur;
        continue;
      }
      segments.push(formatRun(runStart, runEnd));
      runStart = cur;
      runEnd = cur;
    }
    segments.push(formatRun(runStart, runEnd));
  }

  // Unparseable marks appended verbatim, alphabetically sorted for stability.
  for (const m of [...unparseable].sort()) {
    segments.push(m);
  }

  return segments.join(', ');
}

function formatRun(start: ParsedMark, end: ParsedMark): string {
  if (start.raw === end.raw) return start.raw;
  return `${start.raw}..${end.raw}`;
}

// ────────────────────────────────────────────────────────────────────────────
// GROUP AGGREGATION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Bucket opening rows by signature. Each bucket is sorted chronologically
 * (createdAt ascending) so mark ranges render in placement order.
 */
export function groupBySignature(
  rows: readonly GrouperOpeningRow[],
): ReadonlyMap<string, { signature: OpeningSignature; rows: GrouperOpeningRow[] }> {
  const buckets = new Map<string, { signature: OpeningSignature; rows: GrouperOpeningRow[] }>();
  for (const row of rows) {
    const sig = computeOpeningSignature(row.params);
    const key = signatureKey(sig);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { signature: sig, rows: [] };
      buckets.set(key, bucket);
    }
    bucket.rows.push(row);
  }
  for (const bucket of buckets.values()) {
    bucket.rows.sort((a, b) => a.createdAtMillis - b.createdAtMillis);
  }
  return buckets;
}

// ────────────────────────────────────────────────────────────────────────────
// EFFECTIVE-AWARE GROUPING (ADR-421 SLICE C — cross-floor BOQ re-feed)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Bucket raw opening docs by their EFFECTIVE («type wins») signature. Members
 * carry the resolved params (so mark-range/payload + cross-type quantity are
 * correct even when a non-active floor's doc still holds the old drift-cache).
 * Pure — the type→effective resolution is injected.
 */
export function buildEffectiveSignatureMembers(
  rows: readonly OpeningDocRow[],
  resolve: OpeningEffectiveResolver,
): Map<string, { signature: OpeningSignature; members: GrouperOpeningRow[] }> {
  const buckets = new Map<string, { signature: OpeningSignature; members: GrouperOpeningRow[] }>();
  for (const row of rows) {
    const eff = resolve(row.params, { typeId: row.typeId, typeOverrides: row.typeOverrides });
    const sig = computeOpeningSignature(eff);
    const key = signatureKey(sig);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { signature: sig, members: [] };
      buckets.set(key, bucket);
    }
    bucket.members.push({ id: row.id, kind: sig.kind, params: eff, createdAtMillis: row.createdAtMillis });
  }
  for (const bucket of buckets.values()) {
    bucket.members.sort((a, b) => a.createdAtMillis - b.createdAtMillis);
  }
  return buckets;
}

/**
 * The signature groups a family-type edit can affect, for the rows of `typeId`:
 * the OLD signature (from the stale drift-cache `doc.params` — free, no prev-type
 * snapshot needed) plus the NEW signature (from the effective params resolved
 * against the already-updated live type). Deduped by {@link signatureKey}.
 * Overridden instances whose effective dims don't move collapse to one entry.
 */
export function collectAffectedSignatures(
  rows: readonly OpeningDocRow[],
  typeId: string,
  resolve: OpeningEffectiveResolver,
): OpeningSignature[] {
  const affected = new Map<string, OpeningSignature>();
  for (const row of rows) {
    if (row.typeId !== typeId) continue;
    const oldSig = computeOpeningSignature(row.params);
    affected.set(signatureKey(oldSig), oldSig);
    const newSig = computeOpeningSignature(
      resolve(row.params, { typeId, typeOverrides: row.typeOverrides }),
    );
    affected.set(signatureKey(newSig), newSig);
  }
  return [...affected.values()];
}

// ────────────────────────────────────────────────────────────────────────────
// PAYLOAD BUILDER
// ────────────────────────────────────────────────────────────────────────────

export interface BuildGroupPayloadArgs {
  readonly context: OpeningGroupBuildContext;
  readonly signature: OpeningSignature;
  readonly members: readonly GrouperOpeningRow[];
  readonly mapping: AtoeMappingEntry;
  /** Existing `createdAt` from Firestore (preservation). `null` for new rows. */
  readonly existingCreatedAt: string | null;
}

/**
 * Build the BOQ row payload για a signature group. quantity = members.length.
 * Description embeds the mark range (`Π.101..Π.150`) for cross-reference,
 * follows Revit Schedule convention.
 *
 * Title is enriched με dimensions για quick scanning στο BOQ panel:
 *   `Κούφωμα παραθύρου (BIM) — 1200×1400 (sill 900)`
 */
export function buildOpeningGroupPayload(args: BuildGroupPayloadArgs): BuiltOpeningGroupRow {
  const { context, signature, members, mapping, existingCreatedAt } = args;
  const now = nowISO();
  const id = signatureGroupBoqId(context.floorplanId, signature);

  const marks = members
    .map((m) => m.params.mark)
    .filter((m): m is string => typeof m === 'string' && m.length > 0);
  const markRange = compactMarkRange(marks);

  const titleSuffix = formatTitleSuffix(signature);
  const enrichedTitle = `${mapping.titleEL} — ${titleSuffix}`;
  const description = marks.length > 0
    ? `Marks: ${markRange}`
    : null;

  const item: BOQItem = {
    id,
    companyId: context.companyId,
    projectId: context.projectId,
    buildingId: context.buildingId,
    scope: context.floorId ? 'floor' : 'building',
    linkedFloorId: context.floorId ?? null,
    linkedUnitId: null,
    linkedUnitIds: null,
    costAllocationMethod: 'by_area',
    customAllocations: null,
    categoryCode: mapping.categoryCode,
    subCategoryCode: null,
    title: enrichedTitle,
    description,
    unit: mapping.unit,
    estimatedQuantity: members.length,
    actualQuantity: null,
    wasteFactor: 0,
    wastePolicy: 'inherited',
    materialUnitCost: 0,
    laborUnitCost: 0,
    equipmentUnitCost: 0,
    priceAuthority: 'master',
    linkedPhaseId: null,
    linkedTaskId: null,
    linkedInvoiceId: null,
    linkedContractorId: null,
    source: 'bim-auto',
    measurementMethod: 'bim',
    status: 'draft',
    qaStatus: 'pending',
    notes: null,
    createdBy: null,
    approvedBy: null,
    createdAt: existingCreatedAt ?? now,
    updatedAt: now,
    sourceType: 'bim-auto',
    sourceEntityId: null,
    sourceEntityType: 'opening',
    detached: null,
    parentBoqItemId: null,
    isGroupParent: null,
    layerIndex: null,
    materialId: null,
  };

  return {
    id,
    signature,
    memberCount: members.length,
    payload: stripUndefinedDeep(item as unknown as Record<string, unknown>),
  };
}

function formatTitleSuffix(sig: OpeningSignature): string {
  const base = `${sig.width}×${sig.height}`;
  const sillPart = sig.sillHeight > 0 ? ` (sill ${sig.sillHeight})` : '';
  const dirPart = sig.openDirection !== 'na' ? ` [${sig.openDirection}]` : '';
  return `${base}${sillPart}${dirPart}`;
}
