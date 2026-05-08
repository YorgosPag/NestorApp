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
