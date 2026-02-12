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
import type { Partner, Member, Shareholder } from '@/subapps/accounting/types/entity';

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

        // Common fields (Firestore compliance: nullable)
        const entityType = (body as Record<string, unknown>).entityType as string ?? 'sole_proprietor';
        const commonFields = {
          businessName: body.businessName!.trim(),
          profession: body.profession!.trim(),
          vatNumber: body.vatNumber!.trim(),
          taxOffice: body.taxOffice!.trim(),
          address: body.address!.trim(),
          city: body.city!.trim(),
          postalCode: body.postalCode!.trim(),
          phone: body.phone?.trim() ?? null,
          email: body.email?.trim() ?? null,
          website: (body as Record<string, unknown>).website as string | null ?? null,
          mainKad: body.mainKad!,
          secondaryKads: body.secondaryKads ?? [],
          bookCategory: body.bookCategory ?? 'simplified',
          vatRegime: body.vatRegime ?? 'normal',
          fiscalYearEnd: body.fiscalYearEnd ?? 12,
          currency: 'EUR' as const,
          invoiceSeries: body.invoiceSeries ?? [],
        };

        // Build discriminated union based on entityType
        let data: CompanySetupInput;

        if (entityType === 'ae') {
          const shareCapital = ((body as Record<string, unknown>).shareCapital as number) ?? 0;
          if (shareCapital < 25000) {
            return NextResponse.json(
              { success: false, error: 'AE minimum share capital is €25,000 (Ν.4548/2018)' },
              { status: 400 }
            );
          }
          data = {
            ...commonFields,
            entityType: 'ae' as const,
            bookCategory: 'double_entry', // Γ' Βιβλία ΥΠΟΧΡΕΩΤΙΚΑ
            gemiNumber: ((body as Record<string, unknown>).gemiNumber as string) ?? '',
            shareholders: ((body as Record<string, unknown>).shareholders as Shareholder[]) ?? [],
            shareCapital,
          };
        } else if (entityType === 'epe') {
          data = {
            ...commonFields,
            entityType: 'epe' as const,
            bookCategory: 'double_entry', // Γ' Βιβλία ΥΠΟΧΡΕΩΤΙΚΑ
            gemiNumber: ((body as Record<string, unknown>).gemiNumber as string) ?? '',
            members: ((body as Record<string, unknown>).members as Member[]) ?? [],
            shareCapital: ((body as Record<string, unknown>).shareCapital as number) ?? 0,
          };
        } else if (entityType === 'oe') {
          data = {
            ...commonFields,
            entityType: 'oe' as const,
            gemiNumber: ((body as Record<string, unknown>).gemiNumber as string | null) ?? null,
            partners: ((body as Record<string, unknown>).partners as Partner[]) ?? [],
          };
        } else {
          data = {
            ...commonFields,
            entityType: 'sole_proprietor' as const,
            efkaCategory: ((body as Record<string, unknown>).efkaCategory as 1 | 2 | 3 | 4 | 5 | 6) ?? 1,
          };
        }

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
