/**
 * fat-line-material-catalog — a keyed, app-lifetime cache of viewport-tracking fat-line materials
 * (ADR-920 Β4.8 Β2.2 · N.18).
 *
 * A fat `LineMaterial` is not a plain singleton: `createSceneFatLineMaterial` hands back a viewport
 * SUBSCRIPTION alongside it, and that subscription has to be released together with the material on
 * teardown. The auto-breakline review grew that bookkeeping first (a `Map` + an `unsubscribes` array +
 * a dispose loop); the committed breaklines needed exactly the same three pieces. Two copies of «cache
 * by key, remember the unsubscribe, free both» is the sibling clone N.18 exists to catch — and the copy
 * that forgets the unsubscribe leaks a store listener per material for the life of the app.
 *
 * The KEY is the caller's: it names the visual role (`'halo'`, `'core:approved'`, `'surface'` …), so a
 * second request for the same role returns the same material and every mesh drawn in it repaints
 * together on resize.
 *
 * @module bim-3d/materials/fat-line-material-catalog
 * @enterprise ADR-920 — Topography breaklines · ADR-584 — Anti-Duplication
 */

import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { createSceneFatLineMaterial, type SceneFatLineMaterialParams } from '../lines/scene-fat-line';

export interface FatLineMaterialCatalog {
  /** The material for `key`, built from `params` on first request. Later `params` are ignored. */
  get(key: string, params: SceneFatLineMaterialParams): LineMaterial;
  /** Release every viewport subscription and free every material. Full teardown only. */
  dispose(): void;
}

export function createFatLineMaterialCatalog(): FatLineMaterialCatalog {
  const materials = new Map<string, LineMaterial>();
  const unsubscribes: (() => void)[] = [];
  return {
    get(key, params) {
      const cached = materials.get(key);
      if (cached) return cached;
      const built = createSceneFatLineMaterial(params);
      unsubscribes.push(built.unsubscribe);
      materials.set(key, built.material);
      return built.material;
    },
    dispose() {
      for (const unsubscribe of unsubscribes) unsubscribe();
      unsubscribes.length = 0;
      for (const material of materials.values()) material.dispose();
      materials.clear();
    },
  };
}
