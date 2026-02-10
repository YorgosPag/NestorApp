/**
 * =============================================================================
 * FIX COMPANIES - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Fixes company names (renames TechCorp → Pagonis)
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Data fix operation
 *
 * This endpoint updates company names:
 * - Renames TechCorp Α.Ε. to configured company name
 * - Uses batch updates for consistency
 *
 * @method POST - Execute company name fix
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *
 * @technology Client-side Firestore with batch updates
 * @classification Data fix operation
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FixCompaniesRoute');

/** Result of company fix operation */
interface CompanyFixResult {
  id: string;
  name: string;
  action: 'none' | 'updated' | 'deleted';
}

/**
 * POST - Execute Company Name Fix (withAuth protected)
 * Renames TechCorp to configured company name.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleFixCompaniesExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for POST (fix companies).
 */
async function handleFixCompaniesExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('[POST /api/fix-companies] BLOCKED: Non-super_admin attempted company name fix', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  logger.info('Starting company fix process...');

  try {
    // Get all contacts with type 'company'
    const companiesQuery = query(
      collection(db, COLLECTIONS.CONTACTS),
      where('type', '==', 'company')
    );

    const snapshot = await getDocs(companiesQuery);
    logger.info('Found companies', { count: snapshot.size });

    const batch = writeBatch(db);
    let changesCount = 0;
    const results: CompanyFixResult[] = [];

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      logger.info('Company found', { index: index + 1, id: doc.id, name: data.companyName });

      results.push({
        id: doc.id,
        name: data.companyName,
        action: 'none'
      });

      // 🏢 ENTERPRISE: Dynamic company detection (NO HARDCODED IDs)
      // Detect main company by checking if it's 'TechCorp Α.Ε.' which needs to be renamed
      if (data.companyName === 'TechCorp Α.Ε.') {
        // This is the main company - rename it to Pagonis
        const newCompanyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company';
        logger.info('Updating main company', { id: doc.id, newCompanyName });
        batch.update(doc.ref, {
          companyName: newCompanyName,
          industry: 'Κατασκευές & Ανάπτυξη Ακινήτων',
          updatedAt: new Date()
        });
        results[results.length - 1].action = 'updated';
        changesCount++;
      }
    });

    if (changesCount > 0) {
      logger.info('Committing changes', { changesCount });
      await batch.commit();
      logger.info('Company fix completed successfully!');
    } else {
      logger.info('No changes needed');
    }

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'fix_company_names',
      {
        operation: 'fix-companies',
        totalCompanies: snapshot.size,
        companiesUpdated: changesCount,
        updatedCompanies: results.filter(r => r.action === 'updated').map(r => ({
          id: r.id,
          oldName: 'TechCorp Α.Ε.',
          newName: r.name,
        })),
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Company name fix by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.error('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json({
      success: true,
      message: 'Company fix completed successfully',
      changesCount,
      results,
      executionTimeMs: duration,
    });

  } catch (error: unknown) {
    logger.error('Error fixing companies', { error });
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fix companies',
        executionTimeMs: duration,
      },
      { status: 500 }
    );
  }
}