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
 * 🔑 ADR-841 §7 Α23 — το προφίλ είναι η **μία** αλήθεια της νομικής ταυτότητας (ADR-439):
 * - ο **αριθμός ΓΕΜΗ** ελέγχεται εδώ ως προς τη μορφή (και στην ατομική, όπου μπορεί να λείπει)·
 * - η **αλλαγή επωνυμίας** κατέχει τη συνέπειά της (`companies.name` + δημόσιες αγγελίες).
 *
 * 🔑 ADR-841 §7 Α23 Φ3.2 Γ3 — **μάσκα πεδίων** (Google AIP-134 · Figma · Stripe): ο πελάτης στέλνει
 * όλη τη φόρμα **και** `fields` = ό,τι άλλαξε ο άνθρωπος. Γράφονται **μόνο** αυτά, σε **μία**
 * συναλλαγή μαζί με το ίχνος. Χωρίς `fields` ⇒ πλήρης αντικατάσταση (παλιός πελάτης) · άγνωστο
 * πεδίο ⇒ 400 (AIP-161). Οι συνέπειες κρίνονται από το «πριν/μετά» **της συναλλαγής** — ποτέ από
 * τη φόρμα, ποτέ από δεύτερη ανάγνωση.
 *
 * ⚖️ ADR-841 §7 Α23.12 — **διατήρηση του αντιγράφου ΓΕΜΗ**: αλλαγή ή σβήσιμο του αριθμού ⇒ το αντίγραφο του
 * παλιού αριθμού σβήνεται **στην ίδια** συναλλαγή με το προφίλ, με ίχνος (`registryRetentionCompanion`).
 *
 * @module api/accounting/setup
 * @enterprise ADR-ACC-000 §2 Company Data, M-001 Company Setup
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { after } from 'next/server';

import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import {
  propagateCompanyRename,
  reconcileShowcaseLegalIdentity,
} from '@/services/company/company-rename.service';
import { registryRetentionCompanion } from '@/services/company-registry/company-registry-retention.service';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { createAuditedRepository } from '@/subapps/accounting/services/audited-repository-wrapper';
import {
  changedProfileFields,
  parseProfileFieldMask,
} from '@/subapps/accounting/services/setup/company-profile-field-mask';
import type { CompanySetupInput } from '@/subapps/accounting/types';
import type { CompanyProfileField } from '@/subapps/accounting/types/company';
import type { CompanySetupSaveResult } from '@/subapps/accounting/types/interfaces';
import type { Partner, Member, Shareholder } from '@/subapps/accounting/types/entity';
import {
  validateCompanyEntityArrays,
  deriveShareholderEfkaModes,
} from '@/subapps/accounting/services/validation/entity-arrays-validator';

const logger = createModuleLogger('api/accounting/setup');

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/** Ελέγχει αν το ΑΦΜ είναι 9 ψηφία */
function isValidVatNumber(vat: string): boolean {
  return /^\d{9}$/.test(vat);
}

/**
 * Ο αριθμός ΓΕΜΗ όπως τον έγραψε ο άνθρωπος, ή `null` αν λείπει.
 *
 * ⚠️ Κενό ⇒ `null` και **όχι** `''`: ο ελεύθερος επαγγελματίας **δεν έχει** ΓΕΜΗ, και ένα κενό
 * κείμενο θα διαβαζόταν «δηλωμένος αριθμός» από κάθε καταναλωτή που ελέγχει `!== null`.
 */
function optionalGemiNumber(body: Partial<CompanySetupInput>): string | null {
  const value = (body as { gemiNumber?: unknown }).gemiNumber;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
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
  const gemiNumber = optionalGemiNumber(data);
  if (gemiNumber !== null && canonicalGemiNumber(gemiNumber) === null) {
    return 'gemiNumber must be a GEMI number (digits only, up to 12)';
  }
  return null;
}

/**
 * ADR-841 §7 Α23 — η επωνυμία και η νομική ταυτότητα του προφίλ **αντιγράφονται** (`companies.name`,
 * νομική ταυτότητα βιτρίνας, δημόσιες αγγελίες).
 *
 * 🔴 Ως τις 2026-09-14 αυτή η αποθήκευση άλλαζε την επωνυμία **χωρίς** να ενημερώνει κανένα
 * αντίγραφο. Με `after()`: η αλήθεια γράφτηκε, και ο άνθρωπος δεν περιμένει N αγγελίες για να δει
 * «Αποθηκεύτηκε». Αποτυχία ⇒ γραμμή `error`, και η επόμενη πράξη το διορθώνει.
 */
function scheduleConsequence(companyId: string, failure: string, task: () => Promise<unknown>): void {
  after(async () => {
    try {
      await task();
    } catch (error) {
      logger.error(failure, { companyId, error: getErrorMessage(error) });
    }
  });
}

/**
 * Τα πεδία του προφίλ που τροφοδοτούν τη **νομική ταυτότητα της βιτρίνας** πέρα από την επωνυμία —
 * αριθμός ΓΕΜΗ, μορφή, καταστατική έδρα (`lib/agency/showcase-legal-identity`).
 */
const LEGAL_IDENTITY_FIELDS: readonly CompanyProfileField[] = ['entityType', 'gemiNumber', 'address', 'city', 'postalCode'];

/**
 * 🔑 Η μετονομασία **περιέχει** την ανανέωση της βιτρίνας· χωριστά μόνο όταν άλλαξε άλλη είσοδος.
 *
 * 🔴 Κρίνεται από ό,τι **έγραψε η συναλλαγή** (Γ3): μια μπαγιάτικη φόρμα με παλιά επωνυμία που η μάσκα
 * **δεν** έγραψε δεν ξαναγράφει N αγγελίες — και μια ταυτόχρονη υιοθέτηση δεν «χάνεται» σε δεύτερη ανάγνωση.
 */
function scheduleProfileConsequences(companyId: string, uid: string, saved: CompanySetupSaveResult): void {
  const changed = changedProfileFields(saved.before, saved.after);
  if (changed.includes('businessName')) {
    scheduleConsequence(companyId, 'Η επωνυμία άλλαξε — τα αντίγραφά της δεν ενημερώθηκαν', () =>
      propagateCompanyRename(getAdminFirestore(), companyId, uid),
    );
  } else if (changed.some((field) => LEGAL_IDENTITY_FIELDS.includes(field))) {
    scheduleConsequence(companyId, 'Η νομική ταυτότητα της βιτρίνας δεν ανανεώθηκε', () =>
      reconcileShowcaseLegalIdentity(getAdminFirestore(), companyId),
    );
  }
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
    const body = (await req.json()) as Partial<CompanySetupInput> & { fields?: unknown };

    // Validate required fields
    const validationError = validateSetupInput(body);
    if (validationError) {
      badRequest(validationError);
    }

    // ADR-841 §7 Α23 Φ3.2 Γ3: άγνωστο πεδίο στη μάσκα ⇒ 400, ποτέ γραφή αυθαίρετου κλειδιού (AIP-161).
    const mask = parseProfileFieldMask(body.fields);
    if (mask.kind === 'invalid') {
      badRequest('fields contains unknown profile fields', { rejected: mask.rejected });
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
        gemiNumber: optionalGemiNumber(body) ?? '',
        shareholders: ((body as Record<string, unknown>).shareholders as Shareholder[]) ?? [],
        shareCapital,
      };
    } else if (entityType === 'epe') {
      data = {
        ...commonFields,
        entityType: 'epe' as const,
        bookCategory: 'double_entry', // Γ' Βιβλία ΥΠΟΧΡΕΩΤΙΚΑ
        gemiNumber: optionalGemiNumber(body) ?? '',
        members: ((body as Record<string, unknown>).members as Member[]) ?? [],
        shareCapital: ((body as Record<string, unknown>).shareCapital as number) ?? 0,
      };
    } else if (entityType === 'oe') {
      data = {
        ...commonFields,
        entityType: 'oe' as const,
        gemiNumber: optionalGemiNumber(body),
        partners: ((body as Record<string, unknown>).partners as Partner[]) ?? [],
      };
    } else {
      data = {
        ...commonFields,
        entityType: 'sole_proprietor' as const,
        efkaCategory: ((body as Record<string, unknown>).efkaCategory as 1 | 2 | 3 | 4 | 5 | 6) ?? 1,
        gemiNumber: optionalGemiNumber(body),
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

    // ADR-440 · Γ3: audited repository ⇒ μία συναλλαγή — μάσκα πεδίων + ίχνος (ιδιοκτησία, επωνυμία).
    const auditedRepository = createAuditedRepository(repository, auth.uid, auth.companyId);
    const saved = await auditedRepository.saveCompanySetup(data, {
      fields: mask.kind === 'fields' ? mask.fields : undefined,
      // ADR-841 §7 Α23.12: αντίγραφο ΓΕΜΗ άλλου αριθμού σβήνεται ΣΤΗΝ ΙΔΙΑ συναλλαγή, με ίχνος.
      companion: registryRetentionCompanion(getAdminFirestore(), auth.companyId, auth.uid),
    });

    scheduleProfileConsequences(auth.companyId, auth.uid, saved);

    return ok();
  },
});
