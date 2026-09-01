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
 * @see lib/api/admin-operation-route — ο ΕΝΑΣ ορισμός του «άμεση διοικητική επέμβαση»
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { LEGACY_TENANT_COMPANY_ID } from '@/config/tenant';
import { ensureCompanyDocument, getCompanyDocument, repairCompanyDocument } from '@/services/company-document.service';
import { logSystemOperation, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  adminDirectOperationRead,
  adminDirectOperationWrite,
} from '@/lib/api/admin-operation-route';
import {
  republishListingsForCompany,
  type CompanyRepublishReport,
} from '@/services/listings/rebuild-public-listings.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('BootstrapCompanyRoute');

// =============================================================================
// GET — Check company document status
// =============================================================================

export const GET = adminDirectOperationRead(
  async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    try {
      const companyId = LEGACY_TENANT_COMPANY_ID;
      const existing = await getCompanyDocument(companyId);

      // Check if phantom subcollections exist
      const db = getAdminFirestore();
      const auditLogsSnap = await db
        .collection(COLLECTIONS.COMPANIES)
        .doc(companyId)
        .collection(SUBCOLLECTIONS.COMPANY_AUDIT_LOGS)
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
        error: getErrorMessage(error),
      });
      return NextResponse.json(
        { success: false, error: 'Failed to check company status' },
        { status: 500 }
      );
    }
  }
);

// =============================================================================
// POST — Materialize phantom → real document
// =============================================================================

export const POST = adminDirectOperationWrite(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
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

      // Step 2: Read any explicit contact override (optional — the legal
      // identity SSoT is the per-tenant company profile, read inside
      // ensureCompanyDocument; ADR-439).
      const db = getAdminFirestore();
      const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(companyId).get();

      let companyName = 'ΠΑΓΩΝΗΣ';
      let contactData: { name: string; contactId: string } | undefined;
      if (contactDoc.exists) {
        const cd = contactDoc.data();
        const resolvedContactName = cd?.companyName ?? cd?.name;
        if (resolvedContactName) {
          companyName = resolvedContactName;
          contactData = { name: resolvedContactName, contactId: contactDoc.id };
        }
      } else {
        logger.warn('[BootstrapCompany] Contact document not found, deriving name from company profile', { companyId });
      }

      // Step 3: Materialize — name derived from company profile (or contact override)
      const document = await ensureCompanyDocument(companyId, contactData, ctx.uid);

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
          error: getErrorMessage(err),
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
        error: getErrorMessage(error),
        duration,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Bootstrap failed: ${getErrorMessage(error)}`,
          executionTimeMs: duration,
        },
        { status: 500 }
      );
    }
  }
);

// =============================================================================
// PATCH — Repair existing company document (fix name + contactId)
// =============================================================================

export const PATCH = adminDirectOperationWrite(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    try {
      const body = await req.json().catch(() => ({})) as { companyId?: string };
      const targetCompanyId = body.companyId ?? LEGACY_TENANT_COMPANY_ID;

      const result = await repairCompanyDocument(targetCompanyId, ctx.uid);

      if (!result.wasRepaired) {
        return NextResponse.json(
          { success: false, error: 'No admin user found for this company', companyId: targetCompanyId },
          { status: 404 }
        );
      }

      // ── ADR-841 §7 (Α1) — Η ΜΕΤΟΝΟΜΑΣΙΑ ΚΑΤΕΧΕΙ ΤΗ ΣΥΝΕΠΕΙΑ ΤΗΣ ────────────────
      //
      // 🔴 **Αυτή είναι η ΜΟΝΗ ζωντανή διαδρομή που αλλάζει `companies/{id}.name`**
      //    (μετρημένο 2026-09-01: το `api/companies` είναι μόνο `GET`). Η επωνυμία
      //    είναι **αντιγραμμένη** σε κάθε δημόσια αγγελία του οργανισμού· μέχρι σήμερα
      //    **κανείς** δεν ανανέωνε τα αντίγραφα, άρα η αγορά έδειχνε το **παλιό** όνομα
      //    για πάντα.
      //
      // 🔑 **Εδώ και όχι σε Cloud Function trigger**: ένα trigger θα ήταν **δεύτερη
      //    μηχανή** που γράφει στο `public_listings` (ADR-749). Το σημείο που **ξέρει
      //    ότι το όνομα άλλαξε** είναι αυτό — και το `wasRepaired` το λέει ρητά.
      //
      // ⚠️ **Τυλιγμένο**: η μετονομασία **έγινε** και δεν ακυρώνεται από αποτυχία
      //    παραγώγου· αλλά ο άνθρωπος **μαθαίνει** αν οι αγγελίες έμειναν πίσω, αντί
      //    να το ανακαλύψει από την οθόνη.
      let republished: CompanyRepublishReport | null = null;
      try {
        republished = await republishListingsForCompany(getAdminFirestore(), targetCompanyId);
      } catch (error) {
        logger.error('[BootstrapCompany] Η ΜΕΤΟΝΟΜΑΣΙΑ ΕΓΙΝΕ — οι αγγελίες ΕΜΕΙΝΑΝ ΜΠΑΓΙΑΤΙΚΕΣ', {
          companyId: targetCompanyId,
          error: getErrorMessage(error),
        });
      }

      logger.info('[BootstrapCompany] PATCH repair completed', {
        companyId: targetCompanyId,
        name: result.name,
        republished,
      });

      return NextResponse.json({
        success: true,
        message: 'Company document repaired.',
        companyId: targetCompanyId,
        name: result.name,
        republished,
      });
    } catch (error) {
      logger.error('[BootstrapCompany] PATCH failed', { error: getErrorMessage(error) });
      return NextResponse.json(
        { success: false, error: getErrorMessage(error) },
        { status: 500 }
      );
    }
  }
);
