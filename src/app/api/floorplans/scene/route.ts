/**
 * =============================================================================
 * Floorplan Scene API Route
 * =============================================================================
 *
 * Serves processed DXF scene data. Public access allowed when the scene's
 * project has at least one property listed for sale/rent. Otherwise requires
 * floorplans:floorplans:process permission.
 *
 * @module api/floorplans/scene
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { buildRequestContext } from '@/lib/auth/auth-context';
import { hasPermission, createPermissionCache } from '@/lib/auth/permissions';
import { isAuthenticated } from '@/lib/auth/types';
import { createModuleLogger } from '@/lib/telemetry';
import {
  fetchFileRecord,
  isFilePublic,
  downloadSceneFile,
  buildSceneResponse,
  getErrorMessage,
} from './scene-fetcher';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('FloorplanSceneRoute');

// ============================================================================
// GET handler — optional auth + public property check
// ============================================================================

const getHandler = withStandardRateLimit(async (request: NextRequest): Promise<NextResponse> => {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json({ success: false, error: 'fileId is required' }, { status: 400 });
  }

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!storageBucket) {
    return NextResponse.json({ success: false, error: 'Storage not configured' }, { status: 500 });
  }

  try {
    // 1. Fetch file record (no auth needed)
    const file = await fetchFileRecord(fileId);
    if (!file) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    // 2. Try optional auth
    const ctx = await buildRequestContext(request);

    // 3. Decide access
    if (!isAuthenticated(ctx)) {
      // Anonymous — allowed only if project has public properties
      const pub = await isFilePublic(file);
      if (!pub) {
        logger.warn('Anonymous access denied — no public properties in project', { fileId });
        return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
      }
      logger.info('Anonymous public access granted', { fileId });
    } else {
      // Authenticated — tenant check first
      if (file.companyId && file.companyId !== ctx.companyId && ctx.globalRole !== 'super_admin') {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }

      // Permission check — bypass for public projects
      const cache = createPermissionCache();
      const allowed = await hasPermission(ctx, 'floorplans:floorplans:process', {}, cache);
      if (!allowed) {
        const pub = await isFilePublic(file);
        if (!pub) {
          logger.warn('Permission denied', { email: ctx.email, fileId });
          return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
        }
        logger.info('Auth user with public project access granted', { email: ctx.email, fileId });
      }
    }

    // 4. Download scene
    const result = await downloadSceneFile(file, fileId, storageBucket);
    if (!result) {
      return NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 });
    }

    return buildSceneResponse(result.buffer, result.etag, fileId, request.headers.get('If-None-Match'));
  } catch (error) {
    logger.error('Unexpected error', { error: getErrorMessage(error) });
    return NextResponse.json({ success: false, error: 'Failed to fetch scene' }, { status: 500 });
  }
});

export const GET = getHandler;
