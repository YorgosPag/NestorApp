/**
 * BIM / content-library storage paths — single-purpose builders (SSoT).
 *
 * Εξήχθησαν από το `storage-path.ts` (N.7.1 — 500 γρ./αρχείο, 2026-07-13): εκεί μένει η
 * canonical entity/domain/category ιεραρχία (`buildStoragePath` + validation + parse), εδώ
 * τα «μονοσκοπα» paths που ΔΕΝ ανήκουν σε αυτήν: BIM animation renders, HDRI περιβάλλοντα,
 * material thumbnails/textures και η γεωμετρία της βιβλιοθήκης block (ADR-652).
 *
 * Re-exported από το `storage-path.ts` → οι υπάρχοντες importers δεν αλλάζουν.
 */

/**
 * Builds the storage path for a BIM animation MP4/WebM render output.
 *
 * Path scheme: `companies/{companyId}/bim_animations/{animationId}/renders/{jobId}.{ext}`
 *
 * Used by ADR-366 §C.1.c render queue processor. This is a single-purpose path
 * (not part of the canonical entity/domain/category hierarchy) so it lives here
 * as the centralized SSoT instead of in `buildStoragePath()`.
 *
 * @param params Render path components
 * @returns Storage path string ready for `makeStorageRef()`
 */
export function buildBimAnimationRenderPath(params: {
  companyId: string;
  animationId: string;
  jobId: string;
  ext: 'mp4' | 'webm';
}): string {
  return `companies/${params.companyId}/bim_animations/${params.animationId}/renders/${params.jobId}.${params.ext}`;
}

/**
 * Builds the storage path for a custom BIM HDRI environment asset.
 *
 * Path scheme: `companies/{companyId}/bim_environments/{envId}.{ext}`
 *
 * Used by ADR-366 Group B custom HDRI upload. Single-purpose path
 * (Storage-only, no Firestore metadata) — lives here alongside the
 * animation render path SSoT.
 */
export function buildBimEnvironmentHdriPath(params: {
  companyId: string;
  envId: string;
  ext: 'hdr' | 'exr';
}): string {
  return `companies/${params.companyId}/bim_environments/${params.envId}.${params.ext}`;
}

/** Allowed image extensions for a BIM material appearance thumbnail. */
export type BimMaterialThumbnailExt = 'png' | 'jpg' | 'jpeg' | 'webp';

/**
 * Builds the storage path for a user-uploaded BIM material appearance thumbnail
 * (ADR-413 §2D Phase 2 — Revit «Appearance asset → image»).
 *
 * Path scheme: `companies/{companyId}/bim-material-thumbnails/{materialId}.{ext}`
 *
 * Single-purpose, company-scoped path (tenant isolation, mirrors the HDRI
 * environment path). Keyed by `materialId` — the ONE central appearance asset
 * per material (not per BIM-type that consumes it). The download URL is then
 * persisted on the `bim_materials/{materialId}` doc as `thumbnailUrl`.
 */
export function buildBimMaterialThumbnailPath(params: {
  companyId: string;
  materialId: string;
  ext: BimMaterialThumbnailExt;
}): string {
  return `companies/${params.companyId}/bim-material-thumbnails/${params.materialId}.${params.ext}`;
}

/**
 * Storage path της **σφραγίδας/υπογραφής μηχανικού** (ADR-651 Φάση Ε — Απόφαση #6α).
 *
 * Path scheme: `companies/{companyId}/engineer-stamps/{userId}.{ext}`
 *
 * Company-scoped (tenant isolation — mirror του material-thumbnail path) αλλά **keyed by
 * `userId`**: η σφραγίδα ανήκει στον ΜΗΧΑΝΙΚΟ (το Α.Μ. ΤΕΕ είναι προσωπικό), όχι στο έργο
 * και όχι στο σχέδιο — ανεβαίνει ΜΙΑ φορά και εμφανίζεται σε ΟΛΕΣ τις πινακίδες (πρακτική
 * ArchiCAD Project Info / Revit shared params). Το download URL γράφεται στο
 * `users/{userId}.stampImageUrl` και ταξιδεύει στην πινακίδα μέσα από το **υπάρχον**
 * `buildPlaceholderScope()` — κανένα δεύτερο data path.
 */
export function buildEngineerStampPath(params: {
  companyId: string;
  userId: string;
  ext: BimMaterialThumbnailExt;
}): string {
  return `companies/${params.companyId}/engineer-stamps/${params.userId}.${params.ext}`;
}

/** PBR texture map channel of a user-uploaded BIM material appearance asset. */
export type BimMaterialTextureMapName = 'albedo' | 'normal' | 'roughness' | 'ao';

/**
 * Builds the storage path for a user-uploaded BIM material PBR texture map
 * (ADR-413 §2D Phase 3 — Revit «Appearance asset → Image» per-map slot that
 * RENDERS in the 3D viewport, not just a 2D thumbnail).
 *
 * Path scheme:
 *   `companies/{companyId}/bim-material-textures/{materialId}/{map}.{ext}`
 *
 * Company-scoped (tenant isolation, mirrors the Phase-2 thumbnail path) but
 * keyed by `materialId` + sub-keyed by `map` (albedo/normal/roughness/ao) so the
 * four channels of ONE material live together. The download URLs are persisted on
 * the `bim_materials/{materialId}` doc under `pbrTextures.<map>Url`.
 */
export function buildBimMaterialTextureMapPath(params: {
  companyId: string;
  materialId: string;
  map: BimMaterialTextureMapName;
  ext: BimMaterialThumbnailExt;
}): string {
  return `companies/${params.companyId}/bim-material-textures/${params.materialId}/${params.map}.${params.ext}`;
}

/**
 * Builds the storage path for a Block Library geometry blob (ADR-652 M2/M3 —
 * το «αρχείο» ενός block, όπως το .rfa του Revit / το .gsm του ArchiCAD).
 *
 * ΔΥΟ σχήματα, ένα ανά ΙΔΙΟΚΤΗΤΗ του περιεχομένου:
 *  - `companies/{companyId}/block-library/{blockId}.json` — περιεχόμενο ΕΝΟΣ πελάτη
 *    (ό,τι σώζει ο χρήστης από δικό του DXF)· tenant-isolated, mirror του BIM material
 *    thumbnail path.
 *  - `system/block-library/{blockId}.json` — **έτοιμη/partner βιβλιοθήκη** (`scope:'system'`,
 *    M3): ΔΕΝ ανήκει σε καμία εταιρεία, την διαβάζουν ΟΛΟΙ οι πελάτες. Γράφεται μόνο από
 *    το seed (Admin SDK) — `storage.rules`: read = authenticated, write = super-admin.
 *
 * `companyId: null` ⇒ system content. Keyed by `blockId` (enterprise id `blklib_*`), ώστε το
 * κατέβασμα να μη χρειάζεται parse του `geometryUrl` (ντετερμινιστικό path).
 */
export function buildBlockLibraryGeometryPath(params: {
  companyId: string | null;
  blockId: string;
}): string {
  return params.companyId
    ? `companies/${params.companyId}/block-library/${params.blockId}.json`
    : `system/block-library/${params.blockId}.json`;
}