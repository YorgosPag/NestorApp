/**
 * SSoT — user-uploaded hatch image URL store (ADR-643 Φ4).
 *
 * 2D-only, THREE-free bridge: maps a `bim_materials` doc id (`bmat_*`, the
 * `HatchImageFill.assetId` of a user-uploaded image) → its resolved appearance
 * image URL (`thumbnailUrl`). Fed always-on by `UserMaterialRegistryHost` — the
 * SAME Firestore subscription that feeds the 3D `user-material-registry` — and,
 * on a fresh upload, directly by `uploadHatchImageMaterial`, so the tile renders
 * immediately in-session without waiting for the next library snapshot.
 *
 * Read (sync) by `material-image-resolver` BEFORE the builtin catalog — one
 * resolver, one extension point (ADR-643 §4 Φ4). A monotonic `version` lets the
 * live render cache lazily retry `error` entries once a URL becomes known (a
 * reopened doc renders a hatch before the library hydrates), leak-free — no
 * per-cache subscription.
 *
 * Big-player SSoT (Revit/Cinema 4D/Figma): ONE shared material library,
 * referenced by id from BOTH the 2D image-fill and the 3D render appearance.
 *
 * @see ./material-image-resolver.ts — reads this store first (assetId → src)
 * @see ./hatch-image-cache.ts — lazy error-retry gated on `version`
 * @see ../../../app/UserMaterialRegistryHost.tsx — the always-on feeder
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md §4 Φ4
 */

import type { BimMaterial } from '../../../bim/types/bim-material-types';
import { createExternalStore } from '../../../stores/createExternalStore';

/** materialId (`bmat_*`) → resolved appearance image URL (`thumbnailUrl`). */
const urls = new Map<string, string>();
/** SSoT pub/sub + monotonic version signal (createExternalStore WAVE 3 — the `urls`
 *  Map stays the mutation accelerator, this store IS the version number). */
const versionSignal = createExternalStore<number>(0);

function emit(): void {
  versionSignal.set(versionSignal.get() + 1);
}

/** True when `next` differs from the current contents (avoids no-op version bumps). */
function differs(next: ReadonlyMap<string, string>): boolean {
  if (urls.size !== next.size) return true;
  for (const [id, url] of next) {
    if (urls.get(id) !== url) return true;
  }
  return false;
}

/**
 * Replace the store from the latest library snapshot — image-bearing docs only
 * (a `thumbnailUrl` IS the user's uploaded fill image). No-op (no version bump)
 * when nothing changed.
 */
export function setUserMaterialImages(materials: readonly BimMaterial[]): void {
  const next = new Map<string, string>();
  for (const m of materials) {
    if (m.thumbnailUrl) next.set(m.id, m.thumbnailUrl);
  }
  if (!differs(next)) return;
  urls.clear();
  for (const [id, url] of next) urls.set(id, url);
  emit();
}

/** Register a single freshly-uploaded asset for immediate in-session render. */
export function registerUserMaterialImage(assetId: string, url: string): void {
  if (urls.get(assetId) === url) return;
  urls.set(assetId, url);
  emit();
}

/**
 * Resolved image URL for an asset id, or `null` when unknown (→ the resolver
 * falls back to the builtin catalog, then the raw assetId).
 */
export function getUserMaterialImageUrl(assetId: string): string | null {
  return urls.get(assetId) ?? null;
}

/** Monotonic version — bumps on every content change (render-cache retry gate). */
export function getUserMaterialImageVersion(): number {
  return versionSignal.get();
}

/** Subscribe to content changes; returns an unsubscribe. */
export function subscribeUserMaterialImages(listener: () => void): () => void {
  return versionSignal.subscribe(listener);
}

/** Test-only — reset the store between specs. */
export function __resetUserMaterialImageStoreForTests(): void {
  urls.clear();
  versionSignal.reset(0);
}
