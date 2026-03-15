/**
 * POST /api/notifications/professional-assigned
 *
 * Στέλνει branded email σε νομικό επαγγελματία μετά από ανάθεση ρόλου σε ακίνητο.
 * Fire-and-forget: καλείται από ProfessionalsCard μετά το success.
 *
 * @module api/notifications/professional-assigned
 * @rateLimit STANDARD (60 req/min)
 *
 * 🔒 SECURITY:
 * - Authenticated users only (withAuth)
 * - Admin SDK for Firestore reads
 * - Mailgun for email delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { buildProfessionalAssignmentEmail, buildProfessionalRemovalEmail } from '@/services/email-templates/professional-assignment';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('api/notifications/professional-assigned');

// ============================================================================
// TYPES
// ============================================================================

interface AssignmentNotificationRequest {
  contactId: string;
  role: string;
  unitId: string;
  /** 'assignment' (default) or 'removal' */
  type?: 'assignment' | 'removal';
}

interface AssignmentNotificationResponse {
  success: boolean;
  emailSent: boolean;
  error?: string;
}

/** Role labels — Greek translations for email subject & body */
const ROLE_LABELS: Record<string, string> = {
  seller_lawyer: 'Δικηγόρος Πωλητή',
  buyer_lawyer: 'Δικηγόρος Αγοραστή',
  notary: 'Συμβολαιογράφος',
};

// ============================================================================
// VALIDATION
// ============================================================================

function validateRequest(body: unknown): body is AssignmentNotificationRequest {
  if (!body || typeof body !== 'object') return false;
  const req = body as Partial<AssignmentNotificationRequest>;
  return !!(req.contactId && req.role && req.unitId);
}

// ============================================================================
// HIERARCHY RESOLVER
// ============================================================================

interface UnitHierarchy {
  unitName: string;
  unitCode: string | null;
  unitFloor: number | null;
  buildingName: string | null;
  projectName: string | null;
  projectAddress: string | null;
  companyName: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyAddress: string | null;
  companyWebsite: string | null;
}

/**
 * Resolve unit → building → project → company hierarchy via Admin SDK.
 * Same pattern as sales-accounting-bridge.ts resolveHierarchy().
 */
async function resolveUnitHierarchy(unitId: string): Promise<UnitHierarchy | null> {
  const db = getAdminFirestore();

  // 1. Unit
  const unitSnap = await db.collection(COLLECTIONS.UNITS).doc(unitId).get();
  if (!unitSnap.exists) return null;
  const unitData = unitSnap.data() as Record<string, unknown>;

  const result: UnitHierarchy = {
    unitName: (unitData.name as string) ?? unitId,
    unitCode: (unitData.code as string) ?? null,
    unitFloor: (unitData.floor as number) ?? null,
    buildingName: null,
    projectName: null,
    projectAddress: null,
    companyName: null,
    companyPhone: null,
    companyEmail: null,
    companyAddress: null,
    companyWebsite: null,
  };

  // 2. Building
  const buildingId = unitData.buildingId as string | undefined;
  if (buildingId) {
    const buildingSnap = await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
    if (buildingSnap.exists) {
      const buildingData = buildingSnap.data() as Record<string, unknown>;
      result.buildingName = (buildingData.name as string) ?? null;

      // 3. Project
      const projectId = buildingData.projectId as string | undefined;
      if (projectId) {
        const projectSnap = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
        if (projectSnap.exists) {
          const projectData = projectSnap.data() as Record<string, unknown>;
          result.projectName = (projectData.name as string) ?? null;
          const addr = (projectData.address as string) ?? '';
          const city = (projectData.city as string) ?? '';
          result.projectAddress = [addr, city].filter(Boolean).join(', ') || null;

          // 4. Company contact — ADR-232: linkedCompanyId is the contact doc ID
          //    project.companyId = tenant ID (comp_xxx), NOT a contact document
          //    project.linkedCompanyId = actual contact ID (cont_xxx) in contacts collection
          const linkedCompanyId = projectData.linkedCompanyId as string | undefined;
          if (linkedCompanyId) {
            const companySnap = await db.collection(COLLECTIONS.CONTACTS).doc(linkedCompanyId).get();
            if (companySnap.exists) {
              const companyData = companySnap.data() as Record<string, unknown>;
              result.companyName = (companyData.companyName as string)
                ?? (companyData.displayName as string)
                ?? null;
              result.companyPhone = extractPrimaryPhone(companyData);
              result.companyEmail = extractPrimaryEmail(companyData);
              result.companyAddress = extractPrimaryAddress(companyData);
              result.companyWebsite = extractPrimaryWebsite(companyData);
            }
          } else {
            // Fallback: use denormalized company name from project
            result.companyName = (projectData.linkedCompanyName as string)
              ?? (projectData.company as string)
              ?? null;
          }
        }
      }
    }
  }

  return result;
}

// ============================================================================
// PRIMARY EMAIL RESOLVER
// ============================================================================

/**
 * Extract primary email from contact document.
 * Checks: contact.email → contact.emails[].isPrimary → contact.emails[0].
 */
function extractPrimaryEmail(contactData: Record<string, unknown>): string | null {
  // Direct email field
  const directEmail = contactData.email as string | undefined;
  if (directEmail) return directEmail;

  // emails array
  const emails = contactData.emails as Array<{ email?: string; isPrimary?: boolean }> | undefined;
  if (!emails || emails.length === 0) return null;

  const primary = emails.find(e => e.isPrimary && e.email);
  if (primary?.email) return primary.email;

  return emails[0]?.email ?? null;
}

/** Extract primary phone from phones[] array */
function extractPrimaryPhone(contactData: Record<string, unknown>): string | null {
  const phones = contactData.phones as Array<{ number?: string; isPrimary?: boolean }> | undefined;
  if (!phones || phones.length === 0) return null;

  const primary = phones.find(p => p.isPrimary && p.number);
  return primary?.number ?? phones[0]?.number ?? null;
}

/** Extract formatted primary address from addresses[] array */
function extractPrimaryAddress(contactData: Record<string, unknown>): string | null {
  const addresses = contactData.addresses as Array<{
    street?: string; number?: string; city?: string;
    postalCode?: string; isPrimary?: boolean;
  }> | undefined;
  if (!addresses || addresses.length === 0) return null;

  const addr = addresses.find(a => a.isPrimary) ?? addresses[0];
  const parts = [
    [addr.street, addr.number].filter(Boolean).join(' '),
    addr.postalCode,
    addr.city,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

/** Extract primary website from websites[] array */
function extractPrimaryWebsite(contactData: Record<string, unknown>): string | null {
  const websites = contactData.websites as Array<{ url?: string }> | undefined;
  if (!websites || websites.length === 0) return null;
  return websites[0]?.url ?? null;
}

// ============================================================================
// HANDLER
// ============================================================================

async function handleAssignmentNotification(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<AssignmentNotificationResponse>> {
  try {
    const body: unknown = await request.json();

    if (!validateRequest(body)) {
      return NextResponse.json(
        { success: false, emailSent: false, error: 'Invalid request: contactId, role, unitId required' },
        { status: 400 }
      );
    }

    const { contactId, role, unitId, type = 'assignment' } = body;
    const isRemoval = type === 'removal';

    logger.info('Professional notification', { contactId, role, unitId, type, userId: ctx.uid });

    // 1. Fetch contact — get primary email
    const db = getAdminFirestore();
    const contactSnap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
    if (!contactSnap.exists) {
      logger.warn('Contact not found', { contactId });
      return NextResponse.json({ success: true, emailSent: false });
    }

    const contactData = contactSnap.data() as Record<string, unknown>;
    const email = extractPrimaryEmail(contactData);

    if (!email) {
      logger.info('Contact has no email — skipping notification', { contactId });
      return NextResponse.json({ success: true, emailSent: false });
    }

    // 2. Resolve display name
    const displayName = (contactData.displayName as string)
      ?? ([contactData.firstName, contactData.lastName].filter(Boolean).join(' ')
      || 'Κύριε/Κυρία');

    // 3. Resolve unit hierarchy
    const hierarchy = await resolveUnitHierarchy(unitId);
    if (!hierarchy) {
      logger.warn('Unit not found — skipping notification', { unitId });
      return NextResponse.json({ success: true, emailSent: false });
    }

    // 4. Build email (assignment or removal)
    const roleName = ROLE_LABELS[role] ?? role;
    const templateData = {
      professionalName: displayName,
      roleName,
      unitName: hierarchy.unitName,
      unitCode: hierarchy.unitCode,
      unitFloor: hierarchy.unitFloor,
      buildingName: hierarchy.buildingName,
      projectName: hierarchy.projectName,
      projectAddress: hierarchy.projectAddress,
      companyName: hierarchy.companyName,
      companyPhone: hierarchy.companyPhone ?? undefined,
      companyEmail: hierarchy.companyEmail ?? undefined,
      companyAddress: hierarchy.companyAddress ?? undefined,
      companyWebsite: hierarchy.companyWebsite ?? undefined,
    };

    const { subject, html, text } = isRemoval
      ? buildProfessionalRemovalEmail(templateData)
      : buildProfessionalAssignmentEmail(templateData);

    // 5. Send via Mailgun
    const result = await sendReplyViaMailgun({
      to: email,
      subject,
      textBody: text,
      htmlBody: html,
    });

    if (!result.success) {
      logger.error('Failed to send professional assignment email', {
        contactId, email, error: result.error,
      });
      return NextResponse.json({ success: true, emailSent: false });
    }

    logger.info('Professional assignment email sent', {
      contactId, email, role, unitId, messageId: result.messageId,
    });

    return NextResponse.json({ success: true, emailSent: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Professional assignment notification failed', { error: msg });
    return NextResponse.json(
      { success: false, emailSent: false, error: msg },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXPORT
// ============================================================================

const basePOST = async (request: NextRequest) => {
  const handler = withAuth<AssignmentNotificationResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleAssignmentNotification(req, ctx);
    }
  );
  return handler(request);
};

export const POST = withStandardRateLimit(basePOST);
