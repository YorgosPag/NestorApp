/**
 * =============================================================================
 * SHOWCASE CORE — Snapshot field primitives (ADR-700)
 * =============================================================================
 *
 * The raw-value pickers, the floor formatter and the related-name loader that
 * every showcase snapshot builder needs. Before ADR-700 each surface carried
 * its own private copy: `pickString`/`pickNumber` existed verbatim in four
 * files (building / parking / project / storage), `formatFloor` in two, and
 * the "read a foreign key, fetch that doc, pick its name" loader in three.
 *
 * ## 🔴 Two picker contracts — this is a decision, not an oversight
 *
 * `pickShowcaseString` returns **`null`**; `pickShowcaseStringOrUndefined`
 * returns **`undefined`**. They are NOT interchangeable at the wire:
 * `JSON.stringify` **emits** `null` and **drops** `undefined`, so swapping one
 * for the other silently changes every showcase payload that carries the
 * field.
 *
 *   - null variant      → building / parking / project / storage snapshots,
 *                         whose `*ShowcaseInfo` types declare `T | null`.
 *   - undefined variant → the property showcase, whose section builders
 *                         (`snapshot-field-builders.ts`) declare `T | undefined`
 *                         and rely on absent keys being omitted from the JSON.
 *
 * Both live here so the divergence is visible in one place instead of being
 * rediscovered as a same-name/different-contract trap. `__tests__/
 * snapshot-field-primitives.test.ts` pins both contracts.
 *
 * @module services/showcase-core/snapshot-field-primitives
 * @see adrs/ADR-700-showcase-snapshot-primitives.md
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';

// =============================================================================
// Raw value pickers
// =============================================================================

/**
 * Trimmed non-empty string, else `null`.
 *
 * Use on surfaces whose `*ShowcaseInfo` type declares `string | null`. For the
 * property showcase use {@link pickShowcaseStringOrUndefined} instead.
 */
export function pickShowcaseString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

/** Finite number, else `null`. See {@link pickShowcaseString} on the contract. */
export function pickShowcaseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

/**
 * Trimmed non-empty string, else `undefined` — the property-showcase contract,
 * where an absent value must vanish from the serialised payload rather than
 * appear as an explicit `null`.
 */
export function pickShowcaseStringOrUndefined(value: unknown): string | undefined {
  return pickShowcaseString(value) ?? undefined;
}

/** Finite number, else `undefined`. Property-showcase contract. */
export function pickShowcaseNumberOrUndefined(value: unknown): number | undefined {
  return pickShowcaseNumber(value) ?? undefined;
}

// =============================================================================
// Floor label
// =============================================================================

const FLOOR_ORDINAL_SUFFIX_EN: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };

function formatBasementLabel(num: number, locale: EnumLocale): string {
  if (num === -1) return locale === 'el' ? 'Υπόγειο' : 'Basement';
  const depth = Math.abs(num);
  // NOTE (ADR-700 §8): the EN branch reads "3nd Basement" for depths past 2 —
  // a wrong ordinal inherited verbatim from the parking/storage originals.
  // Preserved so this refactor stays output-identical; see ADR-700 for the
  // pending decision to correct it.
  return locale === 'el' ? `${depth}ο Υπόγειο` : `${depth}nd Basement`;
}

/**
 * Human floor label for a raw Firestore `floor` field.
 *
 * Numeric strings become locale-aware labels (`0` → Ισόγειο / Ground Floor,
 * negatives → basements, positives → ordinals). Anything non-numeric is passed
 * through trimmed, so free-text floors ("Δώμα", "Mezzanine") survive intact.
 * Returns `null` for empty input.
 */
export function formatShowcaseFloorLabel(
  raw: unknown,
  locale: EnumLocale,
): string | null {
  const text = pickShowcaseString(raw);
  if (text === null) return null;

  const num = parseInt(text, 10);
  if (Number.isNaN(num) || String(num) !== text) return text;

  if (num < 0) return formatBasementLabel(num, locale);
  if (num === 0) return locale === 'el' ? 'Ισόγειο' : 'Ground Floor';
  if (locale === 'el') return `${num}ος Όροφος`;
  return `${num}${FLOOR_ORDINAL_SUFFIX_EN[num] ?? 'th'} Floor`;
}

// =============================================================================
// Shared buildInfo field groups
// =============================================================================

/**
 * The identity quartet every non-parking showcase `buildInfo` opens with:
 * `{ id, code, name, description }`. `name` falls back to the entity id so a
 * card is never nameless. Spread first in the literal to keep wire key order.
 *
 * Parking is deliberately NOT a caller — its identity leads with `number`
 * instead of `name`, so it keeps its own literal (see ADR-700 §9).
 */
export function buildShowcaseIdentityFields(
  entityId: string,
  raw: Record<string, unknown>,
): { id: string; code: string | null; name: string; description: string | null } {
  return {
    id: entityId,
    code: pickShowcaseString(raw.code),
    name: pickShowcaseString(raw.name) ?? entityId,
    description: pickShowcaseString(raw.description),
  };
}

/**
 * The `{ area, price, floor }` metric trio shared by the parking and storage
 * cards. `buildingName` stays inline at each caller because its relation shape
 * is surface-specific.
 */
export function buildShowcaseMetricFields(
  raw: Record<string, unknown>,
  locale: EnumLocale,
): { area: number | null; price: number | null; floor: string | null } {
  return {
    area: pickShowcaseNumber(raw.area),
    price: pickShowcaseNumber(raw.price),
    floor: formatShowcaseFloorLabel(raw.floor, locale),
  };
}

// =============================================================================
// Related-name loader — data, not a hand-written async closure
// =============================================================================

export interface ShowcaseRelationLoaderConfig<TKey extends string> {
  /** Field on the entity doc holding the related doc id (e.g. `buildingId`). */
  foreignKeyField: string;
  /** Collection the related doc lives in, from `COLLECTIONS.*`. */
  collection: string;
  /** Key the resolved name is published under (e.g. `buildingName`). */
  resultKey: TKey;
  /**
   * Name fields tried in order on the related doc; the first non-empty wins.
   * Buildings publish `name`; projects fall back `name` → `title`.
   */
  nameFields: readonly string[];
}

/**
 * Build a `loadRelations` implementation that resolves exactly one related
 * document's display name.
 *
 * Missing foreign key, missing document and blank name all collapse to
 * `{ [resultKey]: null }` — a broken relation degrades the label, it never
 * fails the snapshot.
 */
export function createShowcaseRelationLoader<TKey extends string>(
  config: ShowcaseRelationLoaderConfig<TKey>,
): (
  adminDb: Firestore,
  entityId: string,
  raw: Record<string, unknown>,
) => Promise<Record<TKey, string | null>> {
  const empty = (): Record<TKey, string | null> =>
    ({ [config.resultKey]: null }) as Record<TKey, string | null>;

  return async (adminDb, _entityId, raw) => {
    const relatedId = pickShowcaseString(raw[config.foreignKeyField]);
    if (relatedId === null) return empty();

    const snap = await adminDb.collection(config.collection).doc(relatedId).get();
    if (!snap.exists) return empty();

    const relatedRaw = snap.data() ?? {};
    for (const field of config.nameFields) {
      const name = pickShowcaseString(relatedRaw[field]);
      if (name !== null) {
        return { [config.resultKey]: name } as Record<TKey, string | null>;
      }
    }
    return empty();
  };
}
