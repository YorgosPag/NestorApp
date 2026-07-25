/**
 * =============================================================================
 * SHOWCASE CORE — The public payload shape (pure)
 * =============================================================================
 *
 * Kept in its own module, free of `next/server`, for two reasons:
 *
 * 1. **Testability.** The route factories import `next/server`, which throws
 *    `ReferenceError: Request is not defined` under jest's node environment.
 *    The rule that matters here is which keys reach the public, and a rule
 *    worth enforcing has to be reachable by a test.
 * 2. **Layering.** The shape of an anonymous public response is a contract, not
 *    an HTTP detail.
 *
 * ## Why this picks keys instead of spreading the snapshot
 *
 * The obvious de-duplication is `{ ...snapshot, ...media, pdfUrl, expiresAt }`
 * — all four snapshots are exactly `{ <entityKey>, company }`, so it reproduces
 * every original byte-for-byte today. It also **quietly removes a safety
 * property**: the hand-written routes listed `building:` / `company:`
 * explicitly, so a field added to `BuildingShowcaseSnapshot` tomorrow could not
 * reach an anonymous response without someone editing the route.
 *
 * Centralisation must not cost that. This module therefore **whitelists** the
 * two keys the public contract has, which is both DRY and closed: a new
 * snapshot field is invisible here until a human adds it.
 *
 * @module services/showcase-core/unified-showcase-payload
 * @enterprise ADR-698 — Public Showcase Token Surface SSoT
 */

import type { ShowcaseMediaBuckets } from './public-media';

/** Every showcase snapshot carries company branding plus one entity key. */
export interface ShowcaseSnapshotShape {
  company: unknown;
}

/** The share facts that reach the public payload. Nothing else from the share does. */
export interface UnifiedShowcasePayloadShareFacts {
  pdfUrl: string | undefined;
  expiresAt: string;
}

/**
 * A public payload: the entity, its branding, its media, and the share's
 * public facts — and nothing else the snapshot happens to carry.
 */
export type UnifiedShowcasePayload<
  TSnapshot extends ShowcaseSnapshotShape,
  TEntityKey extends keyof TSnapshot,
> = Pick<TSnapshot, TEntityKey | 'company'> &
  ShowcaseMediaBuckets &
  UnifiedShowcasePayloadShareFacts;

/**
 * Assemble the public payload from its parts, copying only the entity key and
 * `company` out of the snapshot.
 *
 * @param snapshot  Built by the surface's snapshot builder (ADR-321)
 * @param entityKey The snapshot's entity key — `'building'`, `'parking'`, …
 */
export function assembleUnifiedShowcasePayload<
  TSnapshot extends ShowcaseSnapshotShape,
  TEntityKey extends Exclude<keyof TSnapshot, 'company'>,
>(
  snapshot: TSnapshot,
  entityKey: TEntityKey,
  media: ShowcaseMediaBuckets,
  share: UnifiedShowcasePayloadShareFacts,
): UnifiedShowcasePayload<TSnapshot, TEntityKey> {
  // A computed key cannot be inferred into a `Pick<…>`, so the assembled object
  // is asserted to the declared return type. Narrow and deliberate — the two
  // copied keys are both read straight off `snapshot`, so the assertion cannot
  // claim a field that is not there.
  return {
    [entityKey]: snapshot[entityKey],
    company: snapshot.company,
    photos: media.photos,
    floorplans: media.floorplans,
    pdfUrl: share.pdfUrl,
    expiresAt: share.expiresAt,
  } as UnifiedShowcasePayload<TSnapshot, TEntityKey>;
}
