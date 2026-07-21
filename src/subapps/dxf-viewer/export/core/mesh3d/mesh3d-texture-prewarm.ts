/**
 * ADR-679 Φ5.1b — headless texture prewarm για το 3Δ export.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ: το `buildMesh3dScene` τρέχει SYNC· τα THREE υλικά αποκτούν `.map` ΜΟΝΟ όταν
 * το texture είναι ΗΔΗ cached (`MaterialCatalog3D.resolveTexturedMaterial` / `resolveUserMaterial`
 * = sync + cache-gated). Ο ζωντανός viewport το λύνει με resync-on-bump (React effect,
 * `use-bim3d-vg-resync`) — που ΔΕΝ υπάρχει headless. Χωρίς prewarm, μια «κρύα» υφή εξάγεται flat.
 *
 * Η ΛΥΣΗ (double-build, gated — ΧΩΡΙΣ mutation του shared render-settings store, N.7.2):
 *   1. build#1 → ως side-effect πυροδοτεί όλα τα `preloadTextureSet` / `preloadUserMaterialTextures`
 *      που χρειάζεται η σκηνή (η πραγματική resolution logic = μηδέν διπλότυπη «ποια υφή θέλει
 *      αυτό το υλικό» — build#1 ΕΙΝΑΙ το discovery pass).
 *   2. await στα ΔΥΟ cache drains (built-in slugs + user `bmat_*`).
 *   3. αν κάτι φόρτωσε → build#2 (τώρα cache-hit) → υλικά με `.map`. Αν ΤΙΠΟΤΑ δεν ήταν in-flight
 *      (realistic OFF, ή ήδη cached, ή μηδέν υφές) → build#1 είναι τελικό → **μηδέν σπατάλη** 2ου build.
 *
 * ΓΙΑΤΙ ΟΧΙ force-realistic: σέβεται το live `realisticMaterials` toggle. Αν είναι OFF, το
 * `resolveTexturedMaterial` επιστρέφει flat ΧΩΡΙΣ να πυροδοτεί preload → drains = 0 → single build.
 * Ένας explicit «Εξαγωγή υφών» διακόπτης (decoupled από το viewport shading, όπως οι μεγάλοι DCC)
 * είναι καθαρό follow-up με δικό του UI+i18n — όχι store-mutation hack εδώ.
 *
 * Ασφάλεια double-build (ground-truth ADR-679 §3): οι γεωμετρίες χτίζονται fresh ανά build· τα
 * disposals (`stripExportDecorations` / `bakeInstancedMeshesForExport`) αγγίζουν ΜΟΝΟ το throwaway
 * δέντρο του κάθε build — κανένα shared singleton (υλικά/textures) δεν αλλοιώνεται.
 *
 * @see ./build-mesh3d-scene — ο pure/sync builder (καλείται 1–2 φορές)
 * @see ../../../bim-3d/materials/bim-texture-cache — `awaitInFlightTextureSets`
 * @see ../../../bim-3d/materials/user-material-registry — `awaitInFlightUserMaterialTextures`
 */

import { buildMesh3dScene, type Mesh3dBuildResult } from './build-mesh3d-scene';
import { awaitInFlightTextureSets } from '../../../bim-3d/materials/bim-texture-cache';
import { awaitInFlightUserMaterialTextures } from '../../../bim-3d/materials/user-material-registry';
import type { ResolvedExportFloor } from '../export-floor-scope';
import type { ExportDeps } from '../../types';

/**
 * Χτίζει την export-σκηνή με προ-φορτωμένες υφές (βλ. module doc). Ασφαλές να καλείται όταν το
 * realistic είναι OFF ή δεν υπάρχουν υφές — τότε εκφυλίζεται σε ΕΝΑ build (κανένα κόστος).
 */
export async function buildTexturedMesh3dScene(
  floors: readonly ResolvedExportFloor[],
  deps: ExportDeps,
): Promise<Mesh3dBuildResult> {
  const first = buildMesh3dScene(floors, deps); // side-effect: fires any cold preloads
  const [slugCount, userCount] = await Promise.all([
    awaitInFlightTextureSets(),
    awaitInFlightUserMaterialTextures(),
  ]);
  // Τίποτα δεν φόρτωνε ⇒ build#1 είναι ήδη ό,τι πιο textured γίνεται (all-cached ή no-textures).
  if (slugCount + userCount === 0) return first;
  return buildMesh3dScene(floors, deps); // rebuild — τώρα cache-hit → `.map` attached
}
