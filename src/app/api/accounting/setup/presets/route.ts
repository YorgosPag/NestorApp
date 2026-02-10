/**
 * =============================================================================
 * GET + PUT /api/accounting/setup/presets — Service Presets
 * =============================================================================
 *
 * GET:  Fetch all active service presets
 * PUT:  Save entire presets array
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/setup/presets
 * @enterprise ADR-ACC-011 Service Presets
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
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

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const presets = await repository.getServicePresets();

        return NextResponse.json({ success: true, data: presets });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch service presets';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// PUT — Save Service Presets
// =============================================================================

async function handlePut(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as unknown;

        const validationError = validatePresetsArray(body);
        if (validationError) {
          return NextResponse.json(
            { success: false, error: validationError },
            { status: 400 }
          );
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

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save service presets';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const PUT = withStandardRateLimit(handlePut);
