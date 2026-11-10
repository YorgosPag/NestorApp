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
import { toStoredUom } from '@/lib/uom/uom-registry';
import { GREEK_VAT_RATE_PERCENTS, isGreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import { isVatExemptionCode } from '@/subapps/accounting/services/config/vat-exemption-reasons';
import { hasVatExemptionContradiction } from '@/subapps/accounting/services/mydata/mydata-codes';

// =============================================================================
// VALIDATION
// =============================================================================


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
  if (typeof preset.vatRate !== 'number' || !isGreekVatRatePercent(preset.vatRate)) {
    return `presets[${index}].vatRate must be one of ${GREEK_VAT_RATE_PERCENTS.join(', ')}`;
  }
  if (!preset.mydataCode || typeof preset.mydataCode !== 'string') {
    return `presets[${index}].mydataCode is required`;
  }
  return validatePresetVatExemption(preset, index);
}

/**
 * Αιτία εξαίρεσης της υπηρεσίας (ADR-ACC-003 §22.3): κωδικός του καταλόγου §8.3, και **μόνο** σε συντελεστή που τη
 * δέχεται — ο ίδιος κανόνας αντίφασης με τις γραμμές τιμολογίου (`hasVatExemptionContradiction`).
 */
function validatePresetVatExemption(preset: Partial<ServicePreset>, index: number): string | null {
  const code = preset.vatExemptionCategory;
  if (code == null) return null;
  if (!isVatExemptionCode(code)) {
    return `presets[${index}].vatExemptionCategory is not an AADE §8.3 code`;
  }
  if (typeof preset.vatRate === 'number' && hasVatExemptionContradiction({ vatRate: preset.vatRate, vatExemptionCategory: code })) {
    return `presets[${index}].vatExemptionCategory is allowed only on a 0% (AADE VAT category 7) preset`;
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
      unit: toStoredUom(p.unit),
      unitPrice: p.unitPrice!,
      vatRate: p.vatRate!,
      mydataCode: p.mydataCode!,
      vatExemptionCategory: p.vatExemptionCategory ?? null,
      isActive: p.isActive !== false,
      sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : i,
    }));

    await repository.saveServicePresets(presets);

    return ok();
  },
});
