/**
 * =============================================================================
 * BOOTSTRAP COMPANY — Materialize Phantom → Real Document
 * =============================================================================
 *
 * @purpose Creates a real company document from a phantom one
 * @since 2026-03-13
 * @protection withAuth + super_admin + audit logging
 * @classification System-level operation
 *
 * A phantom document exists in Firestore only because subcollections
 * (audit_logs, RBAC) were written under its path. This endpoint
 * reads the company data from the contacts collection and writes
 * a proper document with fields to the companies collection.
 *
 * @method GET  - Check if company document exists + show status
 * @method POST - Materialize the phantom document
 *
 * @see ADR-210 Phase 3: Company Document Materialization
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { LEGACY_TENANT_COMPANY_ID } from '@/config/tenant';
import { ensureCompanyDocument, getCompanyDocument } from '@/services/company-document.service';
import { withAuth, logSystemOperation, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BootstrapCompanyRoute');

// =============================================================================
// GET — Check company document status
// =============================================================================

export const GET = withAuth(
  async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    if (ctx.globalRole !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: super_admin required', code: 'SUPER_ADMIN_REQUIRED' },
        { status: 403 }
      );
    }

    try {
      const companyId = LEGACY_TENANT_COMPANY_ID;
      const existing = await getCompanyDocument(companyId);

      // Check if phantom subcollections exist
      const db = getAdminFirestore();
      const auditLogsSnap = await db
        .collection(COLLECTIONS.COMPANIES)
        .doc(companyId)
        .collection('audit_logs')
        .limit(1)
        .get();

      return NextResponse.json({
        companyId,
        documentExists: !!existing,
        document: existing,
        hasAuditSubcollection: !auditLogsSnap.empty,
        auditLogCount: auditLogsSnap.size,
        status: existing ? 'REAL_DOCUMENT' : 'PHANTOM',
        message: existing
          ? 'Company document is materialized with proper fields.'
          : 'Company document is phantom — only subcollections exist. Use POST to materialize.',
      });
    } catch (error) {
      logger.error('[BootstrapCompany] GET failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { success: false, error: 'Failed to check company status' },
        { status: 500 }
      );
    }
  },
  { permissions: 'admin:direct:operations' }
);

// =============================================================================
// POST — Materialize phantom → real document
// =============================================================================

export const POST = withSensitiveRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      if (ctx.globalRole !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: super_admin required', code: 'SUPER_ADMIN_REQUIRED' },
          { status: 403 }
        );
      }

      const startTime = Date.now();

      try {
        const companyId = LEGACY_TENANT_COMPANY_ID;

        // Step 1: Check if already materialized
        const existing = await getCompanyDocument(companyId);
        if (existing) {
          return NextResponse.json({
            success: true,
            message: 'Company document already exists — no action needed.',
            document: existing,
            action: 'ALREADY_EXISTS',
          });
        }

        // Step 2: Read company data from contacts collection
        const db = getAdminFirestore();
        const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(companyId).get();

        let companyName = 'ΠΑΓΩΝΗΣ';
        if (contactDoc.exists) {
          const contactData = contactDoc.data();
          companyName = contactData?.companyName ?? contactData?.name ?? companyName;
        } else {
          logger.warn('[BootstrapCompany] Contact document not found, using default name', { companyId });
        }

        // Step 3: Materialize
        const document = await ensureCompanyDocument(
          companyId,
          { name: companyName, contactId: companyId },
          ctx.uid
        );

        const duration = Date.now() - startTime;

        // Step 4: Audit log
        const metadata = extractRequestMetadata(req);
        await logSystemOperation(
          ctx,
          'bootstrap_company_document',
          {
            companyId,
            companyName,
            action: 'materialize_phantom',
            contactExists: contactDoc.exists,
            executionTimeMs: duration,
          },
          `Company document materialized by ${ctx.email}`
        ).catch((err: unknown) => {
          logger.error('[BootstrapCompany] Audit log failed (non-blocking)', {
            error: err instanceof Error ? err.message : String(err),
            metadata,
          });
        });

        logger.info('[BootstrapCompany] Successfully materialized company document', {
          companyId,
          companyName,
          duration,
        });

        return NextResponse.json({
          success: true,
          message: `Company document materialized successfully.`,
          document,
          action: 'CREATED',
          executionTimeMs: duration,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('[BootstrapCompany] POST failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });
        return NextResponse.json(
          {
            success: false,
            error: `Bootstrap failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            executionTimeMs: duration,
          },
          { status: 500 }
        );
      }
    },
    { permissions: 'admin:direct:operations' }
  )
);
