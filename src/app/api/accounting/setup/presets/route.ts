/**
 * =============================================================================
 * GET + PUT /api/accounting/setup/presets — Service Presets
 * =============================================================================
 *
 * GET:  Fetch all active service presets
 * PUT:  Save entire presets array
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/setup/presets
 * @enterprise ADR-ACC-011 Service Presets
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { ServicePreset } from '@/subapps/accounting/types';

// =============================================================================
// VALIDATION
// =============================================================================

const VALID_VAT_RATES = [0, 6, 13, 24];

function validatePreset(preset: Partial<ServicePreset>, index: number): string | null {
  if (!preset.presetId || typeof preset.presetId !== 'string') {
    return `presets[${index}].presetId is required`;
  }
  if (!preset.description || typeof preset.description !== 'string' || !preset.description.trim()) {
    return `presets[${index}].description is required`;
  }
  if (!preset.unit || typeof preset.unit !== 'string' || !preset.unit.trim()) {
    return `presets[${index}].unit is required`;
  }
  if (typeof preset.unitPrice !== 'number' || preset.unitPrice < 0) {
    return `presets[${index}].unitPrice must be >= 0`;
  }
  if (typeof preset.vatRate !== 'number' || !VALID_VAT_RATES.includes(preset.vatRate)) {
    return `presets[${index}].vatRate must be one of ${VALID_VAT_RATES.join(', ')}`;
  }
  if (!preset.mydataCode || typeof preset.mydataCode !== 'string') {
    return `presets[${index}].mydataCode is required`;
  }
  return null;
}

function validatePresetsArray(data: unknown): string | null {
  if (!Array.isArray(data)) {
    return 'Request body must be an array of presets';
  }
  if (data.length > 100) {
    return 'Maximum 100 presets allowed';
  }
  for (let i = 0; i < data.length; i++) {
    const error = validatePreset(data[i] as Partial<ServicePreset>, i);
    if (error) return error;
  }
  return null;
}

// =============================================================================
// GET — Fetch Service Presets
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to fetch service presets',
  handler: async ({ auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const presets = await repository.getServicePresets();

    return ok(presets);
  },
});

// =============================================================================
// PUT — Save Service Presets
// =============================================================================

export const PUT = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to save service presets',
  handler: async ({ req, auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const body = (await req.json()) as unknown;

    const validationError = validatePresetsArray(body);
    if (validationError) {
      badRequest(validationError);
    }

    const presets = (body as Array<Partial<ServicePreset>>).map((p, i) => ({
      presetId: p.presetId!,
      description: p.description!.trim(),
      unit: p.unit!.trim(),
      unitPrice: p.unitPrice!,
      vatRate: p.vatRate!,
      mydataCode: p.mydataCode!,
      isActive: p.isActive !== false,
      sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : i,
    }));

    await repository.saveServicePresets(presets);

    return ok();
  },
});
