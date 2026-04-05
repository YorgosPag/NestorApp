import 'server-only';

import type { NextRequest } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';

import {
  requireAdminContext,
  audit,
  getAdminFirestore,
  SERVER_COLLECTIONS,
  type AdminContext,
} from './admin-guards';
import { getCompanyByName } from '@/services/companies.service';
import { getRequiredAdminCompanyName } from '@/config/admin-env';
import {
  listTemplatesForCompany,
  buildingExistsForTemplate,
  getExistingBuildingId,
  type BuildingTemplate,
} from '@/services/admin-building-templates.service';
import { generateOperationId } from '@/services/enterprise-id.service';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { suggestNextBuildingCode } from '@/config/entity-code-config';
import { FIELDS } from '@/config/firestore-field-constants';
import type { AuthContext } from '@/lib/auth/types';

/**
 * ENTERPRISE: Shared Building Instantiation Handler
 *
 * Single source of truth for creating buildings from templates.
 * Used by both seed and populate routes to avoid code duplication.
 *
 * This ensures:
 * - Consistent behavior across all instantiation endpoints
 * - Single point of maintenance for template-to-building logic
 * - No divergence between seed and populate implementations
 *
 * @serverOnly This module must only be used in server-side code
 * @author Enterprise Architecture Team
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result for each template processing
 */
export interface InstantiationResult {
  buildingId: string;
  templateId: string;
  templateKey: string;
  name: string;
  projectId?: string;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
}

/**
 * Handler response structure
 */
export interface HandlerResponse {
  success: boolean;
  error?: string;
  suggestion?: string;
  operationId: string;
  message?: string;
  summary?: {
    totalTemplates: number;
    created: number;
    skipped: number;
    errors: number;
    companyId: string;
    companyName: string;
  };
  results?: InstantiationResult[];
  companyId?: string;
  statusCode: number;
}

/**
 * Handler options for customization
 */
export interface HandlerOptions {
  source: string;
  operationPrefix: string;
  createdBy: string;
  includeEnterpriseFields?: boolean;
}

// ============================================================================
// HELPERS (ADR-290)
// ============================================================================

/**
 * ADR-290: Adapt AdminContext → AuthContext so admin-bulk flows can call the
 * SSoT `createEntity()` service. Admin seed/populate endpoints are gated with
 * `super_admin` at the route layer, so the globalRole mapping is safe.
 */
function buildAuthContextFromAdmin(
  adminContext: AdminContext,
  companyId: string
): AuthContext {
  return {
    uid: adminContext.uid,
    email: adminContext.email,
    companyId,
    globalRole: 'super_admin',
    mfaEnrolled: adminContext.mfaEnrolled,
    isAuthenticated: true,
  };
}

/**
 * ADR-233 §3.4 / ADR-290: Fetch existing building `code` values for a given
 * project via Admin SDK. Used to auto-generate unique codes for templates
 * that don't explicitly declare one.
 */
async function fetchBuildingCodesForProject(
  db: Firestore,
  projectId: string
): Promise<string[]> {
  const snapshot = await db
    .collection(SERVER_COLLECTIONS.BUILDINGS)
    .where(FIELDS.PROJECT_ID, '==', projectId)
    .get();

  return snapshot.docs
    .map((doc) => ((doc.data().code as string | undefined) ?? '').trim())
    .filter((code) => code.length > 0);
}

/**
 * Build the `entitySpecificFields` payload passed to `createEntity()` for a
 * given template. Common fields (companyId, linkedCompanyId, createdAt,
 * updatedAt, createdBy) are omitted — they are provided by createEntity().
 */
function buildBuildingEntityFields(
  template: BuildingTemplate,
  code: string,
  companyName: string,
  operationId: string,
  includeEnterpriseFields: boolean
): Record<string, unknown> {
  const payload = template.buildingPayload;

  const fields: Record<string, unknown> = {
    // Core template fields
    name: payload.name,
    description: payload.description,
    address: payload.address,
    city: payload.city,
    totalArea: payload.totalArea,
    builtArea: payload.builtArea,
    floors: payload.floors,
    units: payload.units,
    status: payload.status,
    progress: payload.progress,
    startDate: payload.startDate,
    completionDate: payload.completionDate,
    totalValue: payload.totalValue,
    category: payload.category,
    features: payload.features,
    // ADR-233 §3.4: locked building identifier
    code,
    // Company display name (string — distinct from companyId FK)
    company: companyName,
    // Template tracking
    sourceTemplateId: template.id,
    sourceTemplateKey: template.templateKey,
    operationId,
  };

  // projectId passed explicitly — parentId below also sets it, but keep for
  // templates that declared a projectId without requiring parent-data lookup.
  if (template.projectId) {
    fields.projectId = template.projectId;
  }

  if (includeEnterpriseFields) {
    if (payload.legalInfo) fields.legalInfo = payload.legalInfo;
    if (payload.technicalSpecs) fields.technicalSpecs = payload.technicalSpecs;
    if (payload.financialData) fields.financialData = payload.financialData;
  }

  return fields;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle building instantiation from templates
 *
 * This is the shared handler used by both seed and populate routes.
 * Provides:
 * - Authentication via requireAdminContext
 * - Company lookup from centralized config
 * - Template loading from Firestore
 * - Idempotent building creation
 * - Structured audit logging
 *
 * @param request - NextRequest object
 * @param options - Handler customization options
 * @returns HandlerResponse with success/error and results
 */
export async function handleBuildingInstantiation(
  request: NextRequest,
  options: HandlerOptions
): Promise<HandlerResponse> {
  const operationId = generateOperationId();
  const { source, operationPrefix, createdBy, includeEnterpriseFields = true } = options;

  audit(operationId, `${operationPrefix}_START`, { source });

  // GATE: Validate admin authentication
  const authResult = await requireAdminContext(request, operationId);
  if (!authResult.success) {
    audit(operationId, `${operationPrefix}_AUTH_FAILED`, {
      error: authResult.error,
    });
    return {
      success: false,
      error: authResult.error,
      operationId,
      statusCode: 403,
    };
  }

  const adminContext: AdminContext = authResult.context!;
  audit(operationId, `${operationPrefix}_AUTHENTICATED`, {
    uid: adminContext.uid,
    role: adminContext.role,
  }, adminContext);

  // Get company from centralized config
  let companyName: string;
  try {
    companyName = getRequiredAdminCompanyName();
  } catch (error) {
    audit(operationId, `${operationPrefix}_CONFIG_ERROR`, {
      error: (error as Error).message,
    }, adminContext);
    return {
      success: false,
      error: (error as Error).message,
      suggestion: 'Add ADMIN_COMPANY_NAME to .env.local',
      operationId,
      statusCode: 500,
    };
  }

  const company = await getCompanyByName(companyName);
  if (!company || !company.id) {
    audit(operationId, `${operationPrefix}_COMPANY_NOT_FOUND`, {
      companyName,
    }, adminContext);
    return {
      success: false,
      error: `Company "${companyName}" not found in database`,
      suggestion: 'Ensure company data exists before instantiating buildings',
      operationId,
      statusCode: 404,
    };
  }

  const companyId = company.id;

  audit(operationId, `${operationPrefix}_COMPANY_FOUND`, {
    companyId,
    companyName: company.companyName,
  }, adminContext);

  // Load templates from Firestore
  const templates = await listTemplatesForCompany(companyId);

  if (templates.length === 0) {
    audit(operationId, `${operationPrefix}_NO_TEMPLATES`, {
      companyId,
    }, adminContext);
    return {
      success: false,
      error: 'No active building templates found for company',
      suggestion: 'Create templates in admin_building_templates collection first',
      operationId,
      companyId,
      statusCode: 404,
    };
  }

  audit(operationId, `${operationPrefix}_TEMPLATES_LOADED`, {
    templateCount: templates.length,
    companyId,
  }, adminContext);

  // Get Admin Firestore instance
  const db = getAdminFirestore();

  // ADR-290: Build AuthContext adapter for createEntity() — super_admin-gated
  const authContext = buildAuthContextFromAdmin(adminContext, companyId);

  // ADR-233 §3.4: cache of auto-suggested codes per project (avoids collisions
  // when the same project has multiple templates in this batch).
  const projectCodesCache = new Map<string, string[]>();

  // Create buildings from templates with idempotency check
  const results: InstantiationResult[] = [];

  for (const template of templates) {
    try {
      // IDEMPOTENCY: Check if building already exists for this template
      const exists = await buildingExistsForTemplate(companyId, template.id);

      if (exists) {
        const existingId = await getExistingBuildingId(companyId, template.id);
        results.push({
          buildingId: existingId || 'unknown',
          templateId: template.id,
          templateKey: template.templateKey,
          name: template.buildingPayload.name,
          projectId: template.projectId,
          status: 'skipped',
          reason: 'Building already exists for this template',
        });

        audit(operationId, `${operationPrefix}_SKIPPED`, {
          templateId: template.id,
          existingBuildingId: existingId,
          reason: 'idempotency',
        }, adminContext);

        continue;
      }

      // ADR-290: resolve building `code` — prefer template-supplied, else
      // auto-suggest based on existing siblings in the same project.
      let code = template.buildingPayload.code?.trim() ?? '';
      if (!code) {
        const cacheKey = template.projectId ?? '__no_project__';
        let codes = projectCodesCache.get(cacheKey);
        if (!codes) {
          codes = template.projectId
            ? await fetchBuildingCodesForProject(db, template.projectId)
            : [];
          projectCodesCache.set(cacheKey, codes);
        }
        code = suggestNextBuildingCode(codes);
        // Reserve this code in the cache so subsequent templates in the same
        // project pick the next gap instead of the same value.
        codes.push(code);
      }

      // ADR-290: route through the SSoT entity creation service
      const result = await createEntity('building', {
        auth: authContext,
        parentId: template.projectId ?? null,
        entitySpecificFields: buildBuildingEntityFields(
          template,
          code,
          company.companyName,
          operationId,
          includeEnterpriseFields
        ),
        apiPath: `admin/${operationPrefix}`,
      });
      const buildingId = result.id;

      // Signal to static analysis that createdBy option (legacy hardcoded
      // string from route layer) is no longer the source of truth — actual
      // createdBy is adminContext.uid via createEntity().
      void createdBy;

      results.push({
        buildingId,
        templateId: template.id,
        templateKey: template.templateKey,
        name: template.buildingPayload.name,
        projectId: template.projectId,
        status: 'created',
      });

      audit(operationId, `${operationPrefix}_CREATED`, {
        buildingId,
        templateId: template.id,
        buildingName: template.buildingPayload.name,
        code,
      }, adminContext);
    } catch (error) {
      results.push({
        buildingId: '',
        templateId: template.id,
        templateKey: template.templateKey,
        name: template.buildingPayload.name,
        projectId: template.projectId,
        status: 'error',
        reason: (error as Error).message,
      });

      audit(operationId, `${operationPrefix}_ERROR`, {
        templateId: template.id,
        error: (error as Error).message,
      }, adminContext);
    }
  }

  const created = results.filter((r) => r.status === 'created').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const errors = results.filter((r) => r.status === 'error').length;

  audit(operationId, `${operationPrefix}_COMPLETE`, {
    totalTemplates: templates.length,
    created,
    skipped,
    errors,
    companyId,
  }, adminContext);

  return {
    success: errors === 0,
    operationId,
    message: `Processed ${templates.length} templates: ${created} created, ${skipped} skipped, ${errors} errors`,
    summary: {
      totalTemplates: templates.length,
      created,
      skipped,
      errors,
      companyId,
      companyName: company.companyName,
    },
    results,
    statusCode: 200,
  };
}
