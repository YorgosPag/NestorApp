import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

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
  type BuildingPayload,
} from '@/services/admin-building-templates.service';
import { generateBuildingId, generateOperationId } from '@/services/enterprise-id.service';
import type { Building } from '@/types/building/contracts';

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

/**
 * Strongly-typed building data for Firestore
 * projectId is optional - only set if template has it (no hardcoded defaults)
 */
interface BuildingDocument extends Omit<Building, 'id' | 'projectId'> {
  projectId?: string;
  sourceTemplateId: string;
  sourceTemplateKey: string;
  createdBy: string;
  operationId: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
  // Enterprise fields from template (if present)
  legalInfo?: BuildingPayload['legalInfo'];
  technicalSpecs?: BuildingPayload['technicalSpecs'];
  financialData?: BuildingPayload['financialData'];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create building document from template
 * Pure orchestration - all enterprise data comes from template, NOT generated
 */
function createBuildingDocument(
  template: BuildingTemplate,
  companyId: string,
  companyName: string,
  operationId: string,
  createdBy: string,
  includeEnterpriseFields: boolean
): BuildingDocument {
  const payload: BuildingPayload = template.buildingPayload;

  const doc: BuildingDocument = {
    // Core fields from template payload
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

    // Company association
    companyId,
    company: companyName,

    // Template tracking
    sourceTemplateId: template.id,
    sourceTemplateKey: template.templateKey,

    // Metadata
    createdBy,
    operationId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Conditional field: only add projectId if template has it (no hardcoded defaults)
  if (template.projectId) {
    doc.projectId = template.projectId;
  }

  // Enterprise fields from template (stored in DB, not generated)
  if (includeEnterpriseFields) {
    if (payload.legalInfo) {
      doc.legalInfo = payload.legalInfo;
    }
    if (payload.technicalSpecs) {
      doc.technicalSpecs = payload.technicalSpecs;
    }
    if (payload.financialData) {
      doc.financialData = payload.financialData;
    }
  }

  return doc;
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
  const buildingsCollection = db.collection(SERVER_COLLECTIONS.BUILDINGS);

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

      // Generate building ID using enterprise ID service
      const buildingId = generateBuildingId();

      // Create building document (pure orchestration)
      const buildingData = createBuildingDocument(
        template,
        companyId,
        company.companyName,
        operationId,
        createdBy,
        includeEnterpriseFields
      );

      // Write to Firestore using Admin SDK
      await buildingsCollection.doc(buildingId).set(buildingData);

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
