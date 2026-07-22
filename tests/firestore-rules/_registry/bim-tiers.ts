/**
 * ADR-657 — BIM Authoring vs Presentation RBAC — TIER SSoT
 * =============================================================================
 *
 * The single source of truth for which BIM/floorplan collection sits in which
 * RBAC tier. Consumed by:
 *   - `scripts/check-firestore-rules-test-coverage.js` (CHECK 3.16, tier
 *     conformance validator) — proves every block's `allow read` calls the
 *     helper its tier mandates, and that no write leg still grants on ownership.
 *   - `coverage-manifest.ts` / `coverage-matrices-dxf.ts` — picks the matrix.
 *
 * ## The two tiers
 *
 * Big-player BIM tools (Revit / Autodesk Construction Cloud, ArchiCAD, and
 * Figma for the same reason) separate *authoring data* — the model, editable by
 * the design team — from *published views* — what the client is shown. Tenancy
 * is an isolation boundary, not an authorization one. Role is the authorization.
 *
 *   AUTHORING     read + write require `isInternalUserOfCompany()`.
 *                 Reachable only inside /dxf/viewer (AdminGuard). `external_user`
 *                 is denied outright — zero client blast radius.
 *
 *   PRESENTATION  read stays tenant-wide (any role, incl. `external_user`);
 *                 write requires `isInternalUserOfCompany()`.
 *                 These are read client-side on /properties and the
 *                 Buildings/Projects floorplan tabs (ADR-370) via
 *                 `useFloorplanBimEntities` / `useFloorOverlays` /
 *                 `useBackgroundScale`. `external_user` is the DEFAULT role of
 *                 every self-registration, so denying read here breaks
 *                 production today.
 *
 * ## Phase 2 (deferred — ADR-657 §Deferred)
 *
 * Move those three client hooks behind a server route (Admin SDK +
 * PropertyGrant entitlement, SPEC-257F), then move every PRESENTATION entry
 * into AUTHORING. That flip is the whole reason the tiers are data and not
 * hardcoded booleans.
 *
 * ## Invariant enforced by CHECK 3.16
 *
 * Every `match /floorplan_*` and `match /*floorplans` block in firestore.rules
 * MUST appear in exactly one of these lists. A new BIM collection therefore
 * cannot be added without consciously picking a tier.
 */

/** Scope keys every BIM entity document must carry on create. */
export type BimRequiredKeys = readonly string[];

export interface BimTierEntry {
  /** Firestore collection id, exactly as it appears in `match /<collection>/`. */
  readonly collection: string;
  /**
   * The `hasAll([...])` list in the collection's `allow create` rule.
   * Six distinct variants exist across the 29 entity collections — this is the
   * ONLY per-collection knob in the shared `canCreateBimEntity()` helper.
   * `null` for the 5 legacy containers, which have no `createdBy`/scope-key
   * contract (they predate it) and use `canCreateLegacyFloorplan()` instead.
   */
  readonly requiredKeys: BimRequiredKeys | null;
}

// ---------------------------------------------------------------------------
// AUTHORING — 22 collections. Editor-only. `external_user` fully denied.
// ---------------------------------------------------------------------------

export const BIM_AUTHORING_COLLECTIONS: readonly BimTierEntry[] = [
  // --- Structure / envelope not shown on the customer floorplan tab ---
  { collection: 'floorplan_roofs', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_foundations', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_railings', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },

  // --- Drafting aids / survey ---
  { collection: 'floorplan_grid_guides', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'guides'] },
  { collection: 'floorplan_topo_surfaces', requiredKeys: ['companyId', 'projectId', 'floorplanId'] },

  // --- MEP ---
  { collection: 'floorplan_mep_fixtures', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_mep_manifolds', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_mep_radiators', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_mep_boilers', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_mep_water_heaters', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_mep_underfloors', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_mep_segments', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_mep_fittings', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_mep_systems', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'params'] },
  { collection: 'floorplan_electrical_panels', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },

  // --- Finishes / annotation / analysis ---
  { collection: 'floorplan_furniture', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  // ADR-683 Φ3β — εισαγόμενο ψημένο πλέγμα από glTF συνεργάτη (ίδιο συμβόλαιο με το furniture).
  { collection: 'floorplan_imported_meshes', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  // ADR-684 — παραμετρικό γεωμετρικό στερεό (procedural· ίδιο συμβόλαιο με το imported-mesh).
  { collection: 'floorplan_generic_solids', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_symbols', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'category', 'kind', 'params'] },
  { collection: 'floorplan_floor_finishes', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'params'] },
  { collection: 'floorplan_wall_coverings', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'params'] },
  { collection: 'floorplan_hatches', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'data'] },
  { collection: 'floorplan_thermal_spaces', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'params'] },
  { collection: 'floorplan_space_separators', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'params'] },
] as const;

// ---------------------------------------------------------------------------
// PRESENTATION — 14 blocks. Read tenant-wide; write internal-only.
// ---------------------------------------------------------------------------

export const BIM_PRESENTATION_COLLECTIONS: readonly BimTierEntry[] = [
  // --- The 7 BIM entity collections read by useFloorplanBimEntities (ADR-370) ---
  { collection: 'floorplan_walls', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_slabs', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_beams', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_columns', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_openings', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_slab_openings', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },
  { collection: 'floorplan_stairs', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'] },

  // --- Raster backdrop + vector overlays (ADR-340). Already role-gated on
  //     write before ADR-657; restated here in the shared vocabulary. Their
  //     payload validators (_overlayWriteValid, naturalBounds/scale) are
  //     bespoke and stay verbatim — we share role gates, not field guards.
  { collection: 'floorplan_backgrounds', requiredKeys: null },
  { collection: 'floorplan_overlays', requiredKeys: null },

  // --- Legacy containers. No createdBy/scope-key contract (they predate it);
  //     they use canCreateLegacyFloorplan() / canWriteLegacyFloorplan().
  { collection: 'floorplans', requiredKeys: null },
  { collection: 'project_floorplans', requiredKeys: null },
  { collection: 'building_floorplans', requiredKeys: null },
  { collection: 'floor_floorplans', requiredKeys: null },
  { collection: 'unit_floorplans', requiredKeys: null },
] as const;

// ---------------------------------------------------------------------------
// Derived lookups
// ---------------------------------------------------------------------------

export type BimTier = 'authoring' | 'presentation';

/** Collections whose `allow read` must call `canReadBimAuthoring()`. */
export const BIM_AUTHORING_NAMES: readonly string[] =
  BIM_AUTHORING_COLLECTIONS.map((e) => e.collection);

/** Collections whose `allow read` must call `canReadBimPresentation()`. */
export const BIM_PRESENTATION_NAMES: readonly string[] =
  BIM_PRESENTATION_COLLECTIONS.map((e) => e.collection);

/** The 5 legacy containers — they use the legacy helper trio, not canCreateBimEntity(). */
export const LEGACY_FLOORPLAN_CONTAINERS: readonly string[] = [
  'floorplans',
  'project_floorplans',
  'building_floorplans',
  'floor_floorplans',
  'unit_floorplans',
] as const;

/** @returns the tier a collection belongs to, or `null` if it is untiered (a CHECK 3.16 violation). */
export function getBimTier(collection: string): BimTier | null {
  if (BIM_AUTHORING_NAMES.includes(collection)) return 'authoring';
  if (BIM_PRESENTATION_NAMES.includes(collection)) return 'presentation';
  return null;
}

/** @returns the `hasAll([...])` scope keys for a BIM entity collection, or `null` for legacy containers. */
export function getBimRequiredKeys(collection: string): BimRequiredKeys | null {
  const entry =
    BIM_AUTHORING_COLLECTIONS.find((e) => e.collection === collection) ??
    BIM_PRESENTATION_COLLECTIONS.find((e) => e.collection === collection);
  return entry?.requiredKeys ?? null;
}
