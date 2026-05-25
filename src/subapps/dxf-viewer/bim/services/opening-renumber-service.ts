/**
 * ADR-376 Phase B.1 — Opening Renumber service.
 *
 * Manual "Renumber Openings" command — fills gaps left by deletions and
 * realigns the (floor, kind) Mark sequence με creation order.
 *
 * Inspired by **IMAGINiT Door Mark Update** (Revit add-in, industry de-facto)
 * + ArchiCAD Element ID Manager + Tekla locked-mark pattern. 5/5 industry
 * convergence (CLAUDE.md feedback_industry_standard_default): preserve manual
 * overrides by default. Modal exposes opt-in toggle for full wipe.
 *
 * Design:
 *   - **Pure compute**: `computeRenumberUpdates()` takes raw opening rows +
 *     args, returns `{ updates, skipped }`. No Firestore writes inside.
 *   - **Fetch wrapper**: `renumberOpenings()` performs the Firestore query +
 *     calls compute. Still no writes — caller (ICommand) owns batch write.
 *   - Reuse `formatMark()` + `parseMarkSeq()` από `opening-mark-service.ts`
 *     ως format SSoT. No duplication.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §4.9 §7 Phase B.1
 */

import { collection, getDocs, query, where, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { OpeningKind, OpeningParams } from '../types/opening-types';
import { formatMark } from './opening-mark-service';

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ────────────────────────────────────────────────────────────────────────────

/** Subset of `OpeningDoc` consumed by the renumber compute. */
export interface RenumberOpeningRow {
  readonly id: string;
  readonly kind: OpeningKind;
  readonly floorId?: string;
  readonly params: OpeningParams;
  /** `createdAt.toMillis()` for stable chronological sort. */
  readonly createdAtMillis: number;
}

export type RenumberScope =
  | { readonly kind: 'current-floor'; readonly floorId: string; readonly floorNumber: number }
  | { readonly kind: 'all-floors' };

export interface RenumberComputeArgs {
  readonly scope: RenumberScope;
  readonly includeManual: boolean;
  /** When set, restricts renumber to listed opening kinds. Undefined = all kinds. */
  readonly kindFilter?: ReadonlyArray<OpeningKind>;
  /** i18n-resolved per-kind prefix. */
  readonly kindPrefixes: Readonly<Record<OpeningKind, string>>;
  /** i18n-resolved basement prefix. */
  readonly basementPrefix: string;
  /**
   * Pre-fetched `FloorDocument.number` map για openings στο 'all-floors' scope.
   * Service avoids N+1 floor reads by accepting this map from the caller.
   */
  readonly floorNumberByFloorId: ReadonlyMap<string, number>;
}

export interface RenumberUpdate {
  readonly openingId: string;
  readonly oldMark: string | undefined;
  readonly newMark: string;
  readonly kind: OpeningKind;
  readonly floorNumber: number;
}

export type RenumberSkipReason = 'no-floor' | 'manual-preserved' | 'kind-filtered' | 'out-of-scope';

export interface RenumberSkippedRow {
  readonly openingId: string;
  readonly reason: RenumberSkipReason;
}

export interface RenumberResult {
  readonly updates: ReadonlyArray<RenumberUpdate>;
  readonly skipped: ReadonlyArray<RenumberSkippedRow>;
}

export interface RenumberFetchArgs {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
}

// ────────────────────────────────────────────────────────────────────────────
// PURE COMPUTE (exported for tests)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Group rows by `(floorNumber, kind)`, sort by `createdAt`, assign sequential
 * marks via `formatMark()`. Preserves manual overrides unless `includeManual`.
 *
 * Pure — no I/O, no Firestore access. Caller fetches rows + floor numbers.
 */
export function computeRenumberUpdates(
  rows: ReadonlyArray<RenumberOpeningRow>,
  args: RenumberComputeArgs,
): RenumberResult {
  const updates: RenumberUpdate[] = [];
  const skipped: RenumberSkippedRow[] = [];
  const kindAllowed: ReadonlySet<OpeningKind> | null = args.kindFilter && args.kindFilter.length > 0
    ? new Set(args.kindFilter)
    : null;

  // Bucket eligible rows by (floorNumber, kind); record skips inline.
  const buckets = new Map<string, RenumberOpeningRow[]>();
  const bucketFloorNumbers = new Map<string, number>();
  const bucketKinds = new Map<string, OpeningKind>();

  for (const row of rows) {
    if (kindAllowed && !kindAllowed.has(row.kind)) {
      skipped.push({ openingId: row.id, reason: 'kind-filtered' });
      continue;
    }

    let floorNumber: number;
    if (args.scope.kind === 'current-floor') {
      if (row.floorId !== args.scope.floorId) {
        skipped.push({ openingId: row.id, reason: 'out-of-scope' });
        continue;
      }
      floorNumber = args.scope.floorNumber;
    } else {
      if (!row.floorId) {
        skipped.push({ openingId: row.id, reason: 'no-floor' });
        continue;
      }
      const lookup = args.floorNumberByFloorId.get(row.floorId);
      if (typeof lookup !== 'number') {
        skipped.push({ openingId: row.id, reason: 'no-floor' });
        continue;
      }
      floorNumber = lookup;
    }

    if (!args.includeManual && row.params.markIsManual === true) {
      skipped.push({ openingId: row.id, reason: 'manual-preserved' });
      continue;
    }

    const bucketKey = `${floorNumber}::${row.kind}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = [];
      buckets.set(bucketKey, bucket);
      bucketFloorNumbers.set(bucketKey, floorNumber);
      bucketKinds.set(bucketKey, row.kind);
    }
    bucket.push(row);
  }

  for (const [bucketKey, bucketRows] of buckets) {
    const floorNumber = bucketFloorNumbers.get(bucketKey)!;
    const kind = bucketKinds.get(bucketKey)!;
    const kindPrefix = args.kindPrefixes[kind];
    bucketRows.sort((a, b) => a.createdAtMillis - b.createdAtMillis);
    let seq = 1;
    for (const row of bucketRows) {
      const newMark = formatMark({
        kindPrefix,
        floorNumber,
        basementPrefix: args.basementPrefix,
        seq,
      });
      updates.push({
        openingId: row.id,
        oldMark: row.params.mark,
        newMark,
        kind,
        floorNumber,
      });
      seq += 1;
    }
  }

  return { updates, skipped };
}

// ────────────────────────────────────────────────────────────────────────────
// FETCH + COMPUTE WRAPPER
// ────────────────────────────────────────────────────────────────────────────

interface OpeningRawDoc {
  readonly id?: string;
  readonly kind?: OpeningKind;
  readonly floorId?: string;
  readonly params?: OpeningParams;
  readonly createdAt?: Timestamp | { toMillis?: () => number };
}

function toMillis(value: OpeningRawDoc['createdAt']): number {
  if (!value) return 0;
  if (typeof value === 'object' && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    try { return (value as Timestamp).toMillis(); } catch { return 0; }
  }
  return 0;
}

/**
 * Firestore-backed renumber computation. Fetches openings rows for the given
 * (company, project, floorplan), then runs pure compute. Returns the result
 * without writing — caller wraps updates σε `RenumberOpeningsCommand`.
 */
export async function renumberOpenings(
  fetchArgs: RenumberFetchArgs,
  computeArgs: RenumberComputeArgs,
): Promise<RenumberResult> {
  const rows = await fetchOpeningRows(fetchArgs);
  return computeRenumberUpdates(rows, computeArgs);
}

async function fetchOpeningRows(args: RenumberFetchArgs): Promise<RenumberOpeningRow[]> {
  const q = query(
    collection(db, COLLECTIONS.FLOORPLAN_OPENINGS),
    where('companyId', '==', args.companyId),
    where('projectId', '==', args.projectId),
    where('floorplanId', '==', args.floorplanId),
  );
  const snap = await getDocs(q);
  const rows: RenumberOpeningRow[] = [];
  snap.forEach((d) => {
    const data = d.data() as OpeningRawDoc;
    if (!data.kind || !data.params) return;
    rows.push({
      id: d.id,
      kind: data.kind,
      floorId: data.floorId,
      params: data.params,
      createdAtMillis: toMillis(data.createdAt),
    });
  });
  return rows;
}
