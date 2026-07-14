/**
 * Firestore Rules Test Harness — DXF / CAD / Floorplan / File Seeders
 *
 * Arrange-phase seeders for the DXF/CAD/floorplan and file-management
 * collections covered in ADR-298 Phase C.2+C.3 (2026-04-14). Extracted into
 * a dedicated module per the Google SRP 500-line limit.
 *
 * Patterns:
 *   - DXF/floorplan (crmDirectMatrix): companyId + createdBy=same_tenant_user.uid
 *     so the `createdBy==uid` update/delete leg is exercised.
 *   - unit_floorplans / document_templates / file_folders (fileTenantFullMatrix):
 *     same structure — super_admin can also create.
 *   - cad_files: companyId + createdBy + fileName (minimal required field).
 *   - file_audit_log: companyId required, no createdBy (immutable).
 *   - file_shares: companyId + createdBy=same_tenant_user.uid (delete leg).
 *   - photo_shares: companyId + createdBy + contactId.
 *   - file_comments: companyId + authorId=same_tenant_user.uid (delete leg).
 *   - file_approvals: companyId + status workflow fields.
 *   - document_templates: companyId + template content.
 *   - file_folders: companyId + folder name.
 *
 * @module tests/firestore-rules/_harness/seed-helpers-dxf
 * @since 2026-04-14 (ADR-298 Phase C.2+C.3)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { SeedOptions } from './seed-helpers';

// ---------------------------------------------------------------------------
// DXF / floorplan seeders (crmDirectMatrix pattern)
// ---------------------------------------------------------------------------

export async function seedProjectFloorplan(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('project_floorplans').doc(docId).set({
      name: `Project Floorplan ${docId}`,
      projectId: `project-${docId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedBuildingFloorplan(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('building_floorplans').doc(docId).set({
      name: `Building Floorplan ${docId}`,
      buildingId: `building-${docId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedFloorFloorplan(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('floor_floorplans').doc(docId).set({
      name: `Floor Floorplan ${docId}`,
      floorId: `floor-${docId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedUnitFloorplan(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('unit_floorplans').doc(docId).set({
      name: `Unit Floorplan ${docId}`,
      unitId: `unit-${docId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedFloorplan(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('floorplans').doc(docId).set({
      name: `Floorplan ${docId}`,
      type: 'floor',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// DXF overlay / layer seeders (crmDirectMatrix pattern)
// ---------------------------------------------------------------------------

export async function seedDxfOverlayLevel(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('dxf_overlay_levels').doc(docId).set({
      name: `Overlay Level ${docId}`,
      level: 0,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedLayer(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('layers').doc(docId).set({
      name: `Layer ${docId}`,
      type: 'visualization',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedLayerGroup(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('layer_groups').doc(docId).set({
      name: `Layer Group ${docId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedAdminBuildingTemplate(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('admin_building_templates').doc(docId).set({
      name: `Building Template ${docId}`,
      type: 'residential',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// CAD files seeder (cadFilesMatrix — permissive write)
// ---------------------------------------------------------------------------

export async function seedCadFile(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('cad_files').doc(docId).set({
      fileName: `scene-${docId}.dxf`,
      fileSize: 1024,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// File management seeders (Phase C.3)
// ---------------------------------------------------------------------------

/**
 * file_audit_log — immutable, no createdBy update/delete path.
 * Read gate is belongsToCompany (no super_admin bypass).
 */
export async function seedFileAuditLog(
  env: RulesTestEnvironment,
  docId: string,
  opts?: Pick<SeedOptions, 'companyId' | 'overrides'>,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('file_audit_log').doc(docId).set({
      action: 'upload',
      fileId: `file-${docId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      performedBy: PERSONA_CLAIMS.same_tenant_user.uid,
      timestamp: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * file_shares — public read, creator-only delete.
 * Seed: createdBy = same_tenant_user.uid so same_tenant_user can delete.
 */
export async function seedFileShare(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('file_shares').doc(docId).set({
      shareToken: `token-${docId}`,
      fileId: `file-${docId}`,
      downloadCount: 0,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * photo_shares — super-admin-only delete, immutable update.
 */
export async function seedPhotoShare(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('photo_shares').doc(docId).set({
      photoUrl: `https://example.com/photo-${docId}.jpg`,
      contactId: `contact-${docId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * file_comments — author delete (authorId = same_tenant_user.uid).
 * Update: any same-tenant member (as long as authorId not changed).
 */
export async function seedFileComment(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    const authorId = opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid;
    await ctx.firestore().collection('file_comments').doc(docId).set({
      content: `Comment ${docId}`,
      fileId: `file-${docId}`,
      authorId,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * file_approvals — immutable delete (approval workflow records).
 */
export async function seedFileApproval(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('file_approvals').doc(docId).set({
      fileId: `file-${docId}`,
      status: 'pending',
      approvers: [],
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * document_templates — full CRUD tenant (fileTenantFullMatrix).
 */
export async function seedDocumentTemplate(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('document_templates').doc(docId).set({
      name: `Template ${docId}`,
      content: 'Hello {{name}}',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * file_folders — full CRUD tenant (fileTenantFullMatrix).
 */
export async function seedFileFolder(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('file_folders').doc(docId).set({
      name: `Folder ${docId}`,
      parentId: null,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * floorplan_backgrounds — ADR-340 Phase 7 (Q9 RBAC).
 * Tenant-scoped role_dual: read for any same-tenant user; write/delete for
 * super_admin / company_admin / internal_user.
 */
export async function seedFloorplanBackground(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('floorplan_backgrounds').doc(docId).set({
      id: docId,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      floorId: 'floor-test',
      fileId: 'file-test',
      providerId: 'pdf-page',
      providerMetadata: { pdfPageNumber: 1, imageDecoderUsed: 'native' },
      naturalBounds: { width: 1000, height: 800 },
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      calibration: null,
      opacity: 1,
      visible: true,
      locked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      updatedBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      ...opts?.overrides,
    });
  });
}

/**
 * company_fonts — ADR-344 Phase 6 (DXF Text Engine font management).
 * Tenant read, admin write. createdBy = same_tenant_admin (only admins upload).
 */
export async function seedCompanyFont(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('company_fonts').doc(docId).set({
      id: docId,
      name: `Font ${docId}`,
      fileName: `${docId}.ttf`,
      fileSize: 102400,
      mimeType: 'font/ttf',
      storageUrl: `gs://bucket/company_fonts/${docId}.ttf`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_admin.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * text_templates — ADR-344 Phase 7.B (DXF Text Engine).
 * Tenant read, admin write. createdBy = same_tenant_admin (only admins create).
 */
export async function seedTextTemplate(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('text_templates').doc(docId).set({
      id: docId,
      name: `Text Template ${docId}`,
      category: 'label',
      content: 'Hello {{name}}',
      placeholders: [{ key: 'name', label: 'Name', type: 'text' }],
      isDefault: false,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_admin.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * text_custom_dictionary — ADR-344 Phase 8 (DXF Text Engine spell-check).
 * Per-company custom dictionary entries (single-word vocabulary). Same
 * tenant_admin_write shape as text_templates / company_fonts: tenant read,
 * admin write. createdBy = same_tenant_admin (only admins create direct via
 * Firestore SDK; clients normally go through the API).
 */
export async function seedCustomDictionaryEntry(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('text_custom_dictionary').doc(docId).set({
      id: docId,
      term: `οπτοπλινθοδομή-${docId}`,
      language: 'el',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_admin.uid,
      createdByName: 'Admin User',
      updatedBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_admin.uid,
      updatedByName: 'Admin User',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * floorplan_overlays — ADR-340 Phase 9 (multi-kind discriminated union).
 * Same-shape RBAC as floorplan_backgrounds; geometry+role schema.
 */
export async function seedFloorplanOverlay(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('floorplan_overlays').doc(docId).set({
      id: docId,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      backgroundId: 'rbg-test',
      floorId: 'floor-test',
      geometry: {
        type: 'polygon',
        vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      },
      role: 'auxiliary',
      createdBy: 'seed-user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Block library seeder (ADR-652 — bespoke blockLibraryMatrix)
// ---------------------------------------------------------------------------

/**
 * Seed one `block_library` metadata document (geometry itself lives as a blob
 * in Storage — the doc only carries metadata + provenance/license).
 *
 * Defaults produce the **private** case the matrix targets: `scope: 'user'`,
 * owned by `same_tenant_user`. The suite's hardening block re-uses the same
 * seeder with `overrides` to build the `company` and `system` variants — one
 * seeder, three fixtures (no per-scope twin).
 */
export async function seedBlockLibraryItem(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('block_library').doc(docId).set({
      id: docId,
      name: `Block ${docId}`,
      scope: 'user',
      category: 'furniture',
      builtin: false,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      projectId: null,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      boundsMm: { minX: 0, minY: 0, maxX: 600, maxY: 600 },
      geometryUrl: `https://storage.example/block-library/${docId}.json`,
      provenance: { source: 'user_import' },
      license: { type: 'unknown', redistributable: false },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// ADR-657 — shared BIM entity seeder (one factory, all 29 entity collections)
// ---------------------------------------------------------------------------

/**
 * Seed ONE BIM/floorplan entity document into `collection` (ADR-657).
 *
 * A single factory rather than 29 near-identical per-collection seeders
 * (rule N.18): the seed context bypasses rules (Admin SDK), so the *content*
 * of the document is irrelevant to what the rules decide — only the identity/
 * scope fields the rule reads matter (`companyId`, `projectId`, `floorplanId`,
 * `createdBy`, `createdAt`). Those are the immutables `bimImmutablesUnchanged()`
 * pins and the fields `canReadBim*`/`isBimWriter` gate on.
 *
 * `createdBy` defaults to `same_tenant_user` and `companyId` to the same-tenant
 * bucket so the owner/tenant rows are observable and distinct from the
 * cross-tenant / external / anonymous rows. Per-collection scope payloads
 * (e.g. `guides` for grid_guides, `data` for hatches, `category` for symbols,
 * `surfaces` for topo) are supplied through `opts.overrides` — they change no
 * rule leg, since create validates key *presence*, not a specific field.
 */
export async function seedBimEntity(
  env: RulesTestEnvironment,
  collection: string,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection(collection).doc(docId).set({
      id: docId,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      projectId: 'proj-test',
      floorplanId: 'floorplan-test',
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed one `floorplan_topo_surfaces` document — the per-floor topographic
 * survey definition (ADR-650). Delegates to `seedBimEntity()` and only adds the
 * inline survey payload. Topo is AUTHORING tier (ADR-657): `external_user` is
 * denied all ops; the `same_tenant_user` default `createdBy` keeps the doc a
 * well-formed, tenant-owned fixture.
 *
 * The survey payload is seeded **inline** (`surfaces`); the Storage-offload
 * variant (`pointsStoragePath`) is only a field swap and changes no rule leg.
 */
export async function seedFloorplanTopoSurface(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await seedBimEntity(env, 'floorplan_topo_surfaces', docId, {
    ...opts,
    overrides: {
      surfaces: [
        {
          id: 'surf-1',
          points: [
            { x: 0, y: 0, z: 12.5 },
            { x: 10, y: 0, z: 13.0 },
            { x: 10, y: 10, z: 13.4 },
          ],
        },
      ],
      contourInterval: 0.5,
      ...opts?.overrides,
    },
  });
}
