/**
 * ADR-376 Phase A — Opening Mark allocator.
 *
 * Assigns auto-incrementing instance Mark to a newly placed opening, scoped
 * to `(projectId, floorplanId, floor.number, kind)`. Format:
 *
 *   Standard floors (`number ≥ 0`):
 *     `<kindPrefix>.<number*100 + seq>`         zero-padded 3 digits
 *     e.g. ground (0) → `Θ.001..Θ.099`, 1st (1) → `Θ.101..Θ.199`
 *
 *   Basement floors (`number < 0`):
 *     `<kindPrefix>.<basementPrefix><|number|>.<seq>`   zero-padded 3 digits
 *     e.g. basement -1 → `Θ.Υ1.001..Θ.Υ1.099` (el) / `D.B1.001..` (en)
 *
 * Prefixes are i18n-resolved at call site (`opening.tag.prefix.<kind>` +
 * `opening.tag.basementPrefix`) and passed in by the caller — this keeps the
 * service free of React/i18n imports and easy to unit-test.
 *
 * Race condition (ADR §4.8): two concurrent placements can collide on the same
 * `nextSeq` and produce duplicate Marks within one (floor, kind). This is
 * documented as a *warning* (validator), not a hard error — manual override
 * via the ribbon resolves it. Atomicity via Firestore transaction is reserved
 * for Phase B if collisions are seen in production.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §4.5
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { OpeningKind } from '../types/opening-types';

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────────────

export interface AllocateMarkArgs {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** `FloorDocument.number` — signed int. -N = basement, 0 = ground, +N = upper. */
  readonly floorNumber: number;
  readonly kind: OpeningKind;
  /** i18n-resolved per-kind prefix. el: `Θ/Σ/ΔΘ/Π/ΣΥ`. en: `D/SD/FD/W/FX`. */
  readonly kindPrefix: string;
  /** i18n-resolved basement prefix. el: `Υ`. en: `B`. */
  readonly basementPrefix: string;
}

export interface OpeningMarkService {
  allocateMark(args: AllocateMarkArgs): Promise<string>;
}

// ────────────────────────────────────────────────────────────────────────────
// FORMATTING (pure, exported for tests)
// ────────────────────────────────────────────────────────────────────────────

/** Padding width για το αύξον τμήμα του Mark. */
const SEQ_PAD = 3;

/**
 * Compose the floor segment that lives μεταξύ kindPrefix and seq.
 *   `0` → `''`           (ground, no floor segment — `Θ.001`)
 *   `1` → `''`           (handled via seq base; `Θ.101`)
 *   `-1` → `Υ1.`         (basement, e.g. `Θ.Υ1.001`)
 */
function floorSegment(floorNumber: number, basementPrefix: string): string {
  if (floorNumber >= 0) return '';
  return `${basementPrefix}${Math.abs(floorNumber)}.`;
}

/** Final mark string given the inputs and an already-resolved sequence. */
export function formatMark(args: {
  kindPrefix: string;
  floorNumber: number;
  basementPrefix: string;
  seq: number;
}): string {
  const segment = floorSegment(args.floorNumber, args.basementPrefix);
  const seqStr = String(args.seq).padStart(SEQ_PAD, '0');
  if (args.floorNumber >= 0) {
    const base = args.floorNumber * 100;
    return `${args.kindPrefix}.${String(base + args.seq).padStart(SEQ_PAD, '0')}`;
  }
  return `${args.kindPrefix}.${segment}${seqStr}`;
}

/**
 * Parse an existing Mark and return its raw sequence number, OR `null` αν
 * δεν ταιριάζει με το (kindPrefix, floorNumber, basementPrefix) tuple.
 */
export function parseMarkSeq(
  mark: string,
  args: { kindPrefix: string; floorNumber: number; basementPrefix: string },
): number | null {
  if (!mark.startsWith(`${args.kindPrefix}.`)) return null;
  const tail = mark.slice(args.kindPrefix.length + 1);

  if (args.floorNumber < 0) {
    const segment = `${args.basementPrefix}${Math.abs(args.floorNumber)}.`;
    if (!tail.startsWith(segment)) return null;
    const seqStr = tail.slice(segment.length);
    const n = Number.parseInt(seqStr, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Standard floor — tail is the raw number `floorNumber*100 + seq` zero-padded.
  // Per ADR-376 §4.1 the floor-prefix hundreds convention caps seq at 99 per
  // (floor, kind) — `Θ.001..Θ.099` ground, `Θ.101..Θ.199` first, etc. A mark
  // whose decoded seq falls outside [1, 99] belongs to a different floor and
  // MUST be ignored, otherwise the allocator pulls cross-floor max+1.
  if (tail.includes('.')) return null; // exclude basement-style tails
  const n = Number.parseInt(tail, 10);
  if (!Number.isFinite(n)) return null;
  const base = args.floorNumber * 100;
  const seq = n - base;
  return seq >= 1 && seq <= 99 ? seq : null;
}

// ────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ────────────────────────────────────────────────────────────────────────────

interface OpeningMarkDoc {
  readonly params?: { readonly mark?: unknown; readonly kind?: unknown };
}

class FirestoreOpeningMarkService implements OpeningMarkService {
  async allocateMark(args: AllocateMarkArgs): Promise<string> {
    const existingMarks = await this.fetchExistingMarks(args);
    let maxSeq = 0;
    for (const m of existingMarks) {
      const seq = parseMarkSeq(m, args);
      if (seq !== null && seq > maxSeq) maxSeq = seq;
    }
    const nextSeq = maxSeq + 1;
    return formatMark({ ...args, seq: nextSeq });
  }

  private async fetchExistingMarks(args: AllocateMarkArgs): Promise<string[]> {
    const q = query(
      collection(db, COLLECTIONS.FLOORPLAN_OPENINGS),
      where('companyId', '==', args.companyId),
      where('projectId', '==', args.projectId),
      where('floorplanId', '==', args.floorplanId),
      where('kind', '==', args.kind),
    );
    const snap = await getDocs(q);
    const marks: string[] = [];
    snap.forEach((d) => {
      const doc = d.data() as OpeningMarkDoc;
      const m = doc.params?.mark;
      if (typeof m === 'string' && m.length > 0) marks.push(m);
    });
    return marks;
  }
}

let singleton: OpeningMarkService | null = null;

export function getOpeningMarkService(): OpeningMarkService {
  if (!singleton) singleton = new FirestoreOpeningMarkService();
  return singleton;
}

/** Test-only override hook. */
export function __setOpeningMarkServiceForTests(svc: OpeningMarkService | null): void {
  singleton = svc;
}
