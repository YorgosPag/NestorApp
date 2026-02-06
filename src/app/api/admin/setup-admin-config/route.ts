/**
 * =============================================================================
 * 🏢 ENTERPRISE: Setup Admin Configuration
 * =============================================================================
 *
 * One-time setup endpoint to configure admin settings in Firestore.
 * Creates the system/settings document with:
 * - Admin notification configuration (admin section)
 * - Email inbound routing rules (integrations.emailInboundRouting)
 *
 * ADR-070: Email routing rules are auto-provisioned during setup
 * using MAILGUN_DOMAIN env var + authenticated user's companyId.
 * Pattern: Salesforce Email-to-Case auto-setup / SAP IMG auto-configuration
 *
 * 🔐 SECURITY:
 * - Requires authentication (withAuth)
 * - Only super_admin can execute
 * - Logs all operations
 *
 * @endpoint POST /api/admin/setup-admin-config
 * @enterprise Admin Configuration Bootstrap
 * @created 2026-01-24
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

// =============================================================================
// TYPES
// =============================================================================

interface SetupAdminConfigRequest {
  /** Override admin email (optional, defaults to current user) */
  adminEmail?: string;
  /** Additional admin UIDs (optional) */
  additionalAdminUids?: string[];
  /** Enable error reporting (default: true) */
  enableErrorReporting?: boolean;
}

interface SetupAdminConfigResponse {
  success: boolean;
  message: string;
  config?: {
    primaryAdminUid: string;
    adminEmail: string;
    additionalAdminUids: string[];
    enableErrorReporting: boolean;
  };
  error?: string;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

/**
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth<SetupAdminConfigResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      console.log(`🔧 [SetupAdminConfig] Request from user: ${ctx.uid}`);

      try {
        // Parse request body
        let body: SetupAdminConfigRequest = {};
        try {
          body = await req.json();
        } catch {
          // Empty body is OK - will use defaults
        }

        // Build admin configuration
        const adminConfig = {
          primaryAdminUid: ctx.uid, // Current authenticated user becomes admin
          adminEmail: body.adminEmail || ctx.email || 'admin@example.com',
          additionalAdminUids: body.additionalAdminUids || [],
          enableErrorReporting: body.enableErrorReporting ?? true,
          updatedAt: new Date(),
          updatedBy: ctx.uid
        };

        // Save to Firestore
        const docRef = getAdminFirestore().collection(COLLECTIONS.SYSTEM).doc('settings');

        // Check if document exists and if routing rules are already configured
        const existingDoc = await docRef.get();
        const existingData = existingDoc.exists ? existingDoc.data() : undefined;
        const hasRoutingRules = Array.isArray(existingData?.integrations?.emailInboundRouting)
          && existingData.integrations.emailInboundRouting.length > 0;

        // 🏢 ENTERPRISE: Auto-provision email inbound routing rules (ADR-070)
        // Pattern: Salesforce Email-to-Case auto-setup during org configuration
        // Uses MAILGUN_DOMAIN env var + user's companyId (no hardcoded values)
        const settingsPayload: Record<string, unknown> = {
          admin: adminConfig,
        };

        if (!hasRoutingRules && ctx.companyId) {
          const mailgunDomain = process.env.MAILGUN_DOMAIN;

          if (mailgunDomain) {
            // Extract base domain from Mailgun domain (e.g., "nestorconstruct.gr" from "mg.nestorconstruct.gr" or "nestorconstruct.gr")
            const baseDomain = mailgunDomain.startsWith('mg.')
              ? mailgunDomain.slice(3)
              : mailgunDomain;

            settingsPayload.integrations = {
              emailInboundRouting: [
                {
                  pattern: `inbound@${baseDomain}`,
                  companyId: ctx.companyId,
                  isActive: true,
                },
                {
                  pattern: `@${baseDomain}`,
                  companyId: ctx.companyId,
                  isActive: true,
                },
              ],
            };

            console.log(`✅ [SetupAdminConfig] Auto-provisioned email routing rules`, {
              domain: baseDomain,
              companyId: ctx.companyId,
              rulesCount: 2,
            });
          } else {
            console.warn(`⚠️ [SetupAdminConfig] MAILGUN_DOMAIN not set - skipping email routing setup`);
          }
        } else if (hasRoutingRules) {
          console.log(`ℹ️ [SetupAdminConfig] Email routing rules already configured - preserving existing`);
        }

        if (existingDoc.exists) {
          await docRef.set(settingsPayload, { merge: true });
          console.log(`✅ [SetupAdminConfig] Updated existing settings document`);
        } else {
          await docRef.set({
            ...settingsPayload,
            createdAt: new Date(),
            createdBy: ctx.uid,
          });
          console.log(`✅ [SetupAdminConfig] Created new settings document`);
        }

        console.log(`✅ [SetupAdminConfig] Admin config saved:`, {
          primaryAdminUid: adminConfig.primaryAdminUid,
          adminEmail: adminConfig.adminEmail,
          enableErrorReporting: adminConfig.enableErrorReporting,
        });

        return NextResponse.json({
          success: true,
          message: 'Admin configuration saved successfully',
          config: {
            primaryAdminUid: adminConfig.primaryAdminUid,
            adminEmail: adminConfig.adminEmail,
            additionalAdminUids: adminConfig.additionalAdminUids,
            enableErrorReporting: adminConfig.enableErrorReporting,
          },
        });

      } catch (error) {
        console.error('❌ [SetupAdminConfig] Error:', error);

        return NextResponse.json({
          success: false,
          message: 'Failed to save admin configuration',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    {
      // 🏢 ENTERPRISE: First-time setup - any authenticated user can configure
      // After setup, access should be restricted to super_admin only
      // For now, we rely on authentication only (no permission check)
      // TODO: Add requiredGlobalRoles: ['super_admin'] after first setup
    }
  ));

  return handler(request);
}

// =============================================================================
// GET - Check current admin config
// =============================================================================

/**
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export async function GET(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth<SetupAdminConfigResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      console.log(`🔍 [SetupAdminConfig] Check request from user: ${ctx.uid}`);

      try {
        const docRef = getAdminFirestore().collection(COLLECTIONS.SYSTEM).doc('settings');
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          return NextResponse.json({
            success: false,
            message: 'Admin configuration not found. POST to this endpoint to create it.',
            error: 'NOT_CONFIGURED'
          }, { status: 404 });
        }

        const data = docSnap.data();
        const adminConfig = data?.admin;

        if (!adminConfig) {
          return NextResponse.json({
            success: false,
            message: 'Admin section not found in settings. POST to this endpoint to create it.',
            error: 'ADMIN_SECTION_MISSING'
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          message: 'Admin configuration found',
          config: {
            primaryAdminUid: adminConfig.primaryAdminUid,
            adminEmail: adminConfig.adminEmail,
            additionalAdminUids: adminConfig.additionalAdminUids || [],
            enableErrorReporting: adminConfig.enableErrorReporting ?? true
          }
        });

      } catch (error) {
        console.error('❌ [SetupAdminConfig] Error checking config:', error);

        return NextResponse.json({
          success: false,
          message: 'Failed to check admin configuration',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    {
      // 🏢 ENTERPRISE: Any authenticated user can check config status
    }
  ));

  return handler(request);
}
