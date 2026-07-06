/**
 * 📐 DXF DIMENSION STYLES API — ENTERPRISE HANDLERS (ADR-362 Phase F4)
 *
 * Per-company custom DIMSTYLE persistence + the per-company "default" dim style
 * pointer. Mirrors `dxf-levels.handlers.ts` (createEntity for create; Admin SDK
 * + withVersionCheck + ownership for update/delete). Adds a `set-default` action
 * that transfers the single `isDefault:true` pointer atomically (idempotent batch:
 * exactly one default doc — or ZERO when the target is the Nestor code default).
 *
 * @see ADR-362 §Group F Phase F4
 * @see ADR-286 — DXF Level Creation Centralization (pattern parent)
 * @see ADR-238 — Entity Creation Centralization
 *
 * 🔒 SECURITY: tenant isolation via `companyId == ctx.companyId` (super_admin
 * bypass on read). All writes ownership-checked before mutation.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { generateDimStyleId } from '@/services/enterprise-id.service';
import { DEFAULT_ACTIVE_DIM_STYLE_ID } from '@/subapps/dxf-viewer/systems/dimensions/dim-style-templates';
import {
  CreateDimStyleSchema,
  UpdateDimStyleSchema,
  SetDefaultDimStyleSchema,
} from './dxf-dimension-styles.schemas';
import type {
  DxfDimStyleCreateResponse,
  DxfDimStyleDeleteResponse,
  DxfDimStyleDocument,
  DxfDimStylesListResponse,
  DxfDimStyleUpdateResponse,
} from './dxf-dimension-styles.types';

const logger = createModuleLogger('DxfDimensionStylesRoute');

// ── List ─────────────────────────────────────────────────────────────────────

export async function handleListDxfDimStyles(
  _request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfDimStylesListResponse>> {
  try {
    const isSuperAdmin = ctx.globalRole === 'super_admin';
    const db = getAdminFirestore();

    // Single-field filter only (companyId) → no composite index required (CHECK 3.15).
    // `.limit()` yields a Query base so the conditional `.where()` narrowing type-checks.
    let query = db.collection(COLLECTIONS.DXF_DIMENSION_STYLES).limit(500);
    if (!isSuperAdmin) {
      query = query.where('companyId', '==', ctx.companyId);
    }

    const snapshot = await query.get();
    const styles = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as DxfDimStyleDocument));

    logger.info('[DxfDimStyles/List] Found styles', {
      count: styles.length,
      companyId: ctx.companyId,
    });

    return NextResponse.json({
      success: true,
      styles,
      stats: { totalStyles: styles.length },
      message: `Found ${styles.length} DXF dimension styles`,
    });
  } catch (error) {
    logger.error('[DxfDimStyles/List] Error', { error: getErrorMessage(error), userId: ctx.uid });
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch DXF dimension styles',
      details: getErrorMessage(error),
    }, { status: 500 });
  }
}

// ── Create (custom style) ──────────────────────────────────────────────────────

export async function handleCreateDxfDimStyle(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ApiSuccessResponse<DxfDimStyleCreateResponse>>> {
  try {
    const parsed = safeParseBody(CreateDimStyleSchema, await request.json());
    if (parsed.error) {
      throw new ApiError(400, 'Validation failed');
    }
    const body = parsed.data;

    const isBuiltInRef = body.isBuiltInRef ?? false;
    const entitySpecificFields: Record<string, unknown> = {
      name: body.name,
      // The pointer is only ever moved via the set-default action → new custom
      // styles are created NON-default to preserve the single-default invariant.
      isDefault: false,
      isBuiltInRef,
      style: body.style ?? null,
      // Thin built-in-ref docs carry the built-in slug as a stored `id` field so
      // the subscribe layer ({ id: doc.id, ...data }) resolves it to the registry.
      // Custom styles NEVER store `id` in the payload → the DB docId IS the id
      // (see `explicitId` below: docId == the client-minted id → hydrate matches).
      ...(isBuiltInRef && body.id ? { id: body.id } : {}),
    };

    const result = await createEntity('dimStyle', {
      auth: ctx,
      parentId: null,
      entitySpecificFields,
      // Custom style → the client (DIMSTYLE registry) is the identity authority:
      // persist under the SAME `dimstyle_*` id it minted for its optimistic
      // in-memory entry, so a reload hydrates the exact id every drawn dimension
      // references (no duplicate, no orphaned styleId). Built-in-ref docs keep a
      // fresh docId (their stored `id` field is the built-in slug).
      explicitId: !isBuiltInRef ? body.id : undefined,
      apiPath: '/api/dxf-dimension-styles (POST)',
    });

    logger.info('[DxfDimStyles/Create] Created style', {
      styleId: result.id,
      companyId: ctx.companyId,
      userId: ctx.uid,
    });

    return apiSuccess<DxfDimStyleCreateResponse>(
      { styleId: result.id },
      `DXF dimension style "${body.name}" created successfully`
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[DxfDimStyles/Create] Error', { error: getErrorMessage(error), userId: ctx.uid });
    throw new ApiError(500, getErrorMessage(error, 'Failed to create DXF dimension style'));
  }
}

// ── PATCH dispatch (update vs set-default) ─────────────────────────────────────

export async function handlePatchDxfDimStyle(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfDimStyleUpdateResponse>> {
  const raw = await request.json();
  if (raw && typeof raw === 'object' && (raw as { action?: unknown }).action === 'set-default') {
    return handleSetDefaultDxfDimStyle(raw, ctx);
  }
  return handleUpdateDxfDimStyle(raw, ctx);
}

// ── Update (custom style fields) ───────────────────────────────────────────────

async function handleUpdateDxfDimStyle(
  raw: unknown,
  ctx: AuthContext
): Promise<NextResponse<DxfDimStyleUpdateResponse>> {
  try {
    const parsed = safeParseBody(UpdateDimStyleSchema, raw);
    if (parsed.error) {
      return parsed.error as NextResponse<DxfDimStyleUpdateResponse>;
    }
    const { _v: expectedVersion, styleId, ...body } = parsed.data;

    const db = getAdminFirestore();
    const styleRef = db.collection(COLLECTIONS.DXF_DIMENSION_STYLES).doc(styleId);
    const styleDoc = await styleRef.get();

    if (!styleDoc.exists) {
      return NextResponse.json({ success: false, error: 'DXF dimension style not found' }, { status: 404 });
    }

    const styleData = styleDoc.data();
    if (styleData?.companyId !== ctx.companyId && ctx.globalRole !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    // `style` is a full replacement of the ~60-field DimStyle payload (custom only).
    if (body.style !== undefined) updates.style = body.style;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const versionResult = await withVersionCheck({
      db,
      collection: COLLECTIONS.DXF_DIMENSION_STYLES,
      docId: styleId,
      expectedVersion,
      updates,
      userId: ctx.uid,
    });

    logger.info('[DxfDimStyles/Update] Style updated', { styleId, _v: versionResult.newVersion });

    return NextResponse.json({
      success: true,
      message: `DXF dimension style "${styleId}" updated`,
      _v: versionResult.newVersion,
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json(error.body, { status: error.statusCode });
    }
    logger.error('[DxfDimStyles/Update] Error', { error: getErrorMessage(error, 'Unknown') });
    return NextResponse.json({
      success: false,
      error: 'Failed to update DXF dimension style',
      details: getErrorMessage(error, 'Unknown'),
    }, { status: 500 });
  }
}

// ── Set default (transfer the single isDefault pointer) ────────────────────────

async function handleSetDefaultDxfDimStyle(
  raw: unknown,
  ctx: AuthContext
): Promise<NextResponse<DxfDimStyleUpdateResponse>> {
  try {
    const parsed = safeParseBody(SetDefaultDimStyleSchema, raw);
    if (parsed.error) {
      return parsed.error as NextResponse<DxfDimStyleUpdateResponse>;
    }
    const { styleId, isBuiltInRef, name } = parsed.data;

    const companyId = ctx.companyId;
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Missing tenant context' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const col = db.collection(COLLECTIONS.DXF_DIMENSION_STYLES);

    // Single-field filter → no composite index needed (CHECK 3.15).
    const snapshot = await col.where('companyId', '==', companyId).get();
    const batch = db.batch();
    let targetFound = false;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const isTarget = isBuiltInRef
        ? data.isBuiltInRef === true && data.id === styleId
        : doc.id === styleId;

      if (isTarget) {
        targetFound = true;
        if (data.isDefault !== true) {
          batch.update(doc.ref, { isDefault: true, updatedAt: FieldValue.serverTimestamp(), _lastModifiedBy: ctx.uid });
        }
      } else if (data.isBuiltInRef === true) {
        // Dormant built-in pointer — remove so at most ONE thin ref doc survives.
        batch.delete(doc.ref);
      } else if (data.isDefault === true) {
        // A custom style losing default: keep the style, clear its flag.
        batch.update(doc.ref, { isDefault: false, updatedAt: FieldValue.serverTimestamp(), _lastModifiedBy: ctx.uid });
      }
    }

    // Nestor is the code default → ZERO isDefault docs means "Nestor default".
    const isNestorDefault = isBuiltInRef && styleId === DEFAULT_ACTIVE_DIM_STYLE_ID;

    if (!targetFound) {
      if (isBuiltInRef && !isNestorDefault) {
        // Pin a non-Nestor built-in as default via a thin reference doc.
        const docId = generateDimStyleId();
        batch.set(col.doc(docId), {
          id: styleId,
          name: name ?? styleId,
          isBuiltInRef: true,
          isDefault: true,
          style: null,
          companyId,
          linkedCompanyId: null,
          createdBy: ctx.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          _lastModifiedBy: ctx.uid,
          _v: 1,
        });
      } else if (!isBuiltInRef) {
        return NextResponse.json({ success: false, error: 'DXF dimension style not found' }, { status: 404 });
      }
      // Nestor built-in default with no doc → nothing to write (code default wins).
    }

    await batch.commit();
    logger.info('[DxfDimStyles/SetDefault] Default set', { styleId, isBuiltInRef: !!isBuiltInRef, companyId });

    return NextResponse.json({ success: true, message: `DXF dimension style "${styleId}" set as default` });
  } catch (error) {
    logger.error('[DxfDimStyles/SetDefault] Error', { error: getErrorMessage(error, 'Unknown') });
    return NextResponse.json({
      success: false,
      error: 'Failed to set default DXF dimension style',
      details: getErrorMessage(error, 'Unknown'),
    }, { status: 500 });
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function handleDeleteDxfDimStyle(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfDimStyleDeleteResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const styleId = searchParams.get('styleId');

    if (!styleId) {
      return NextResponse.json({ success: false, error: 'Style ID is required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const styleRef = db.collection(COLLECTIONS.DXF_DIMENSION_STYLES).doc(styleId);
    const styleDoc = await styleRef.get();

    if (!styleDoc.exists) {
      return NextResponse.json({ success: false, error: 'DXF dimension style not found' }, { status: 404 });
    }

    const styleData = styleDoc.data();
    if (styleData?.companyId !== ctx.companyId && ctx.globalRole !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    await styleRef.delete();
    logger.info('[DxfDimStyles/Delete] Style deleted', { styleId, userId: ctx.uid });

    return NextResponse.json({ success: true, message: `DXF dimension style "${styleId}" deleted` });
  } catch (error) {
    logger.error('[DxfDimStyles/Delete] Error', { error: getErrorMessage(error, 'Unknown') });
    return NextResponse.json({
      success: false,
      error: 'Failed to delete DXF dimension style',
      details: getErrorMessage(error, 'Unknown'),
    }, { status: 500 });
  }
}
