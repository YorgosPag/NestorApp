/**
 * =============================================================================
 * GET + PUT /api/accounting/setup — Company Setup
 * =============================================================================
 *
 * GET:  Fetch company profile setup
 * PUT:  Save/update company profile setup
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/setup
 * @enterprise ADR-ACC-000 §2 Company Data, M-001 Company Setup
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { CompanySetupInput } from '@/subapps/accounting/types';

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/** Ελέγχει αν το ΑΦΜ είναι 9 ψηφία */
function isValidVatNumber(vat: string): boolean {
  return /^\d{9}$/.test(vat);
}

/** Ελέγχει αν η αίτηση σύνταξης έχει τα απαραίτητα πεδία */
function validateSetupInput(data: Partial<CompanySetupInput>): string | null {
  if (!data.businessName?.trim()) return 'businessName is required';
  if (!data.vatNumber?.trim()) return 'vatNumber is required';
  if (!isValidVatNumber(data.vatNumber.trim())) return 'vatNumber must be exactly 9 digits';
  if (!data.taxOffice?.trim()) return 'taxOffice is required';
  if (!data.address?.trim()) return 'address is required';
  if (!data.city?.trim()) return 'city is required';
  if (!data.postalCode?.trim()) return 'postalCode is required';
  if (!data.profession?.trim()) return 'profession is required';
  if (!data.mainKad?.code?.trim()) return 'mainKad.code is required';
  if (!data.mainKad?.description?.trim()) return 'mainKad.description is required';
  return null;
}

// =============================================================================
// GET — Fetch Company Setup
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const profile = await repository.getCompanySetup();

        return NextResponse.json({ success: true, data: profile });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch company setup';
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
// PUT — Save/Update Company Setup
// =============================================================================

async function handlePut(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as Partial<CompanySetupInput>;

        // Validate required fields
        const validationError = validateSetupInput(body);
        if (validationError) {
          return NextResponse.json(
            { success: false, error: validationError },
            { status: 400 }
          );
        }

        // Ensure nullability for optional fields (Firestore compliance)
        const data: CompanySetupInput = {
          businessName: body.businessName!.trim(),
          profession: body.profession!.trim(),
          vatNumber: body.vatNumber!.trim(),
          taxOffice: body.taxOffice!.trim(),
          address: body.address!.trim(),
          city: body.city!.trim(),
          postalCode: body.postalCode!.trim(),
          phone: body.phone?.trim() ?? null,
          email: body.email?.trim() ?? null,
          website: body.website?.trim() ?? null,
          mainKad: body.mainKad!,
          secondaryKads: body.secondaryKads ?? [],
          bookCategory: body.bookCategory ?? 'simplified',
          vatRegime: body.vatRegime ?? 'normal',
          fiscalYearEnd: body.fiscalYearEnd ?? 12,
          currency: 'EUR',
          efkaCategory: body.efkaCategory ?? 1,
          invoiceSeries: body.invoiceSeries ?? [],
        };

        await repository.saveCompanySetup(data);

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save company setup';
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
