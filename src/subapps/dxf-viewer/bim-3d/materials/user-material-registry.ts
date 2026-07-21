/**
 * userMaterialRegistry — reactive bridge between the `bim_materials` Firestore
 * docs and the SYNCHRONOUS 3D material catalog (ADR-413 §2D Phase 3).
 *
 * THE GAP THIS CLOSES: `MaterialCatalog3D` is pure (zero Firestore access) and
 * `resolveMaterialKey('bmat_…')` collapses every library material to concrete. So
 * a wall DNA layer painted with a `bmat_*` material rendered as plain concrete in
 * 3D. This registry is fed (always-on) by `UserMaterialRegistryHost` via
 * `MaterialLibraryService.subscribeMaterials`, and the catalog reads it for
 * `bmat_*` ids — so a library material renders with ITS OWN flat colour (by
 * category) and, when the user uploads them, ITS OWN PBR textures.
 *
 * Mirrors `bim-texture-cache.ts` but keyed by `materialId` (dynamic, per-doc URLs)
 * instead of a fixed slug. On a full per-material texture-set load it bumps the
 * shared `textureAssetVersion` so `BimViewport3D` re-runs `resyncBimScene`
 * (REUSE — same resync path as the slug library).
 *
 * TEARDOWN (Revit-grade, zero GPU leak): when a material's texture URLs change or
 * the material is deleted, its loaded GPU textures are disposed and a version
 * bump tells the catalog to drop its cached `MeshStandardMaterial`.
 *
 * @see ./MaterialCatalog3D.ts — the consumer (`resolveUserMaterial`)
 * @see ../../app/UserMaterialRegistryHost.tsx — the always-on feeder
 * @see ./pbr-texture-config.ts — shared texture configuration (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures-parametric-bim.md
 */

import * as THREE from 'three';
import type { BimMaterial, PbrMaterialTextures } from '../../bim/types/bim-material-types';
import {
  getCategoryMaterialDef,
  type PbrMaterialDef,
} from '../../bim/materials/material-catalog-defs';
import { configurePbrTexture } from './pbr-texture-config';
import type { LoadedTextureSet } from './bim-texture-cache';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { registerMaterialColorProvider } from '../../bim/materials/material-color-registry';
import { trueColorToHex } from '../../utils/dxf-true-color';

/** Resolved 3D appearance of a library material: flat fallback + optional textures. */
export interface UserMaterialAppearance {
  /** Flat PBR def derived from the material's category (3D fallback). */
  readonly def: PbrMaterialDef;
  /** User-uploaded PBR texture URLs, or null when none uploaded. */
  readonly textures: PbrMaterialTextures | null;
}

interface RegistryEntry extends UserMaterialAppearance {
  /** category + texture-URL fingerprint — drives change detection. */
  readonly signature: string;
}

type LoadState = 'loading' | 'error';

const entries = new Map<string, RegistryEntry>();
/** materialId → loaded per-material texture set (shared singleton; never cloned). */
const sets = new Map<string, LoadedTextureSet>();
/** materialId → in-flight / error marker (so we never double-load or hammer). */
const status = new Map<string, LoadState>();
/** materialId → in-flight load promise (settles on success/error) — headless prewarm drain (ADR-679 Φ5.1b). */
const inFlight = new Map<string, Promise<void>>();
/** materialId → monotonic version, bumped on every appearance / set change. */
const versions = new Map<string, number>();

const loader = new THREE.TextureLoader();

// ── Signatures ────────────────────────────────────────────────────────────────

function texturesSignature(t: PbrMaterialTextures | null): string {
  if (!t) return '∅';
  return [t.albedoUrl, t.normalUrl, t.roughnessUrl, t.aoUrl, t.tileSizeM].join('|');
}

function fullSignature(material: BimMaterial): string {
  return `${material.category}::${texturesSignature(material.pbrTextures)}`;
}

function bumpVersion(id: string): void {
  versions.set(id, (versions.get(id) ?? 0) + 1);
}

/** Current change-version for a material (0 if unknown). Catalog cache key. */
export function getUserMaterialSetVersion(id: string): number {
  return versions.get(id) ?? 0;
}

// ── Teardown ──────────────────────────────────────────────────────────────────

/** Dispose a material's loaded GPU textures + clear its load state. */
function disposeSet(id: string): void {
  const set = sets.get(id);
  if (set) {
    set.map.dispose();
    set.normalMap?.dispose();
    set.roughnessMap?.dispose();
    set.aoMap?.dispose();
    sets.delete(id);
  }
  status.delete(id);
}

// ── Feed (called by the always-on host on every materials change) ───────────────

/**
 * Replace the registry contents with the latest `bim_materials` snapshot. Diffs
 * by signature: only changed materials bump their version (and dispose stale
 * textures); removed materials are torn down. Bumps the shared resync once when
 * anything changed.
 */
export function setUserMaterials(materials: readonly BimMaterial[]): void {
  const nextIds = new Set<string>();
  let changed = false;

  for (const m of materials) {
    nextIds.add(m.id);
    const sig = fullSignature(m);
    const prev = entries.get(m.id);
    if (prev && prev.signature === sig) continue; // unchanged → skip

    // If the texture URLs changed, dispose the stale loaded set so it reloads.
    if (prev && texturesSignature(prev.textures) !== texturesSignature(m.pbrTextures)) {
      disposeSet(m.id);
    }
    entries.set(m.id, {
      def: getCategoryMaterialDef(m.category),
      textures: m.pbrTextures,
      signature: sig,
    });
    bumpVersion(m.id);
    changed = true;
  }

  for (const id of [...entries.keys()]) {
    if (nextIds.has(id)) continue;
    entries.delete(id);
    disposeSet(id);
    bumpVersion(id); // tell the catalog to drop its cached material for this id
    changed = true;
  }

  if (changed) useBim3DEntitiesStore.getState().bumpTextureAssetVersion();
}

// ── Reads (catalog, synchronous) ────────────────────────────────────────────────

/** The resolved appearance for a library material id, or null if unknown. */
export function getUserMaterialAppearance(id: string): UserMaterialAppearance | null {
  return entries.get(id) ?? null;
}

// ADR-679 Φ2a — ένα `bmat_*` library υλικό τροφοδοτεί με το flat χρώμα του (ανά κατηγορία)
// τον ενοποιημένο per-face color resolver (ADR-539), ώστε μια όψη βαμμένη με library υλικό
// να δείχνει ΤΟ χρώμα του σε 3D+2D (όχι γκρι). Οι υφές του = Φ2b. Εγγραφή μία φορά στο
// module-load (πάντα-ζωντανό μέσω `UserMaterialRegistryHost`)· `null` για ξένα ids.
registerMaterialColorProvider((id) => {
  const appearance = getUserMaterialAppearance(id);
  return appearance ? trueColorToHex(appearance.def.color) : null;
});

/** Synchronous read of a loaded per-material texture set, or null on a miss. */
export function getUserMaterialTextureSet(id: string): LoadedTextureSet | null {
  return sets.get(id) ?? null;
}

// ── Async load (fire-and-forget) ────────────────────────────────────────────────

async function loadMap(
  url: string | null,
  tileSizeM: number,
  isAlbedo: boolean,
): Promise<THREE.Texture | null> {
  if (!url) return null;
  const tex = await loader.loadAsync(url);
  configurePbrTexture(tex, tileSizeM, isAlbedo);
  return tex;
}

/** Dispose a freshly-loaded (but now stale) set of textures. */
function disposeLoaded(maps: readonly (THREE.Texture | null)[]): void {
  for (const m of maps) m?.dispose();
}

/**
 * Kick off (or no-op) an async load of a material's texture set. Resolves
 * silently; the set becomes available via `getUserMaterialTextureSet` and a
 * version bump + resync swaps the flat material for the textured one. Stale loads
 * (material changed mid-flight) are discarded so they never clobber fresh data.
 */
export function preloadUserMaterialTextures(id: string): void {
  if (sets.has(id) || status.has(id)) return;
  const entry = entries.get(id);
  if (!entry || !entry.textures || !entry.textures.albedoUrl) return;
  status.set(id, 'loading');

  const t = entry.textures;
  const startVersion = getUserMaterialSetVersion(id);
  const p = (async (): Promise<void> => {
    const [albedo, normal, roughness, ao] = await Promise.all([
      loadMap(t.albedoUrl, t.tileSizeM, true),
      loadMap(t.normalUrl, t.tileSizeM, false),
      loadMap(t.roughnessUrl, t.tileSizeM, false),
      loadMap(t.aoUrl, t.tileSizeM, false),
    ]);
    // Material changed (or was removed) while loading → discard, allow re-load.
    if (getUserMaterialSetVersion(id) !== startVersion) {
      disposeLoaded([albedo, normal, roughness, ao]);
      status.delete(id);
      return;
    }
    // Albedo is mandatory — without it there is no textured material.
    if (!albedo) {
      status.set(id, 'error');
      return;
    }
    sets.set(id, {
      map: albedo,
      normalMap: normal ?? undefined,
      roughnessMap: roughness ?? undefined,
      aoMap: ao ?? undefined,
    });
    status.delete(id);
    bumpVersion(id);
    useBim3DEntitiesStore.getState().bumpTextureAssetVersion();
  })().catch(() => {
    status.set(id, 'error');
  }).finally(() => {
    inFlight.delete(id);
  });
  inFlight.set(id, p);
}

/**
 * ADR-679 Φ5.1b — headless prewarm drain (user-material twin of
 * `awaitInFlightTextureSets`). Resolves once every CURRENTLY in-flight per-material
 * texture load has settled, returning how many were awaited. Zero ⇒ nothing was
 * loading → caller can skip its rebuild. Never rejects.
 */
export function awaitInFlightUserMaterialTextures(): Promise<number> {
  const pending = [...inFlight.values()];
  return Promise.all(pending).then(() => pending.length);
}

/** Test-only — reset the registry between specs. */
export function __resetUserMaterialRegistryForTests(): void {
  for (const id of [...sets.keys()]) disposeSet(id);
  entries.clear();
  status.clear();
  versions.clear();
  inFlight.clear();
}
