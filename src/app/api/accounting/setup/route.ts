/**
 * =============================================================================
 * GET + PUT /api/accounting/setup — Company Setup
 * =============================================================================
 *
 * GET:  Fetch company profile setup
 * PUT:  Save/update company profile setup
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/setup
 * @enterprise ADR-ACC-000 §2 Company Data, M-001 Company Setup
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { createAuditedRepository } from '@/subapps/accounting/services/audited-repository-wrapper';
import type { CompanySetupInput } from '@/subapps/accounting/types';
import type { Partner, Member, Shareholder } from '@/subapps/accounting/types/entity';
import {
  validateCompanyEntityArrays,
  deriveShareholderEfkaModes,
} from '@/subapps/accounting/services/validation/entity-arrays-validator';

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

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to fetch company setup',
  handler: async ({ auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const profile = await repository.getCompanySetup();

    return ok(profile);
  },
});

// =============================================================================
// PUT — Save/Update Company Setup
// =============================================================================

export const PUT = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to save company setup',
  handler: async ({ req, auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const body = (await req.json()) as Partial<CompanySetupInput>;

    // Validate required fields
    const validationError = validateSetupInput(body);
    if (validationError) {
      badRequest(validationError);
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
      mobile: (body as Record<string, unknown>).mobile as string | null ?? null,
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
        badRequest('AE minimum share capital is €25,000 (Law 4548/2018)');
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

    // ADR-440: the live write path is the SSoT for partners/members/shareholders.
    // Re-derive ΑΕ EFKA mode server-side (never trust the client for derived fields)
    // and validate the entity arrays (money-affecting: dividend/profit sums = 100%).
    if (data.entityType === 'ae') {
      data = { ...data, shareholders: deriveShareholderEfkaModes(data.shareholders) };
    }
    const entityArraysError = validateCompanyEntityArrays(data);
    if (entityArraysError) {
      badRequest(entityArraysError);
    }

    // ADR-440: wrap with the audited repository so ownership/dividend changes
    // emit a COMPANY_PROFILE_UPDATED audit entry (material data).
    const auditedRepository = createAuditedRepository(repository, auth.uid, auth.companyId);
    await auditedRepository.saveCompanySetup(data);

    return ok();
  },
});
