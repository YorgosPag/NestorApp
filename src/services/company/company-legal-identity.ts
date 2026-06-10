/**
 * =============================================================================
 * 🏢 COMPANY LEGAL IDENTITY READER — per-tenant SSoT (ADR-439)
 * =============================================================================
 *
 * Server-only reader for a tenant's **legal identity** (επωνυμία / διακριτικός
 * τίτλος). The canonical source is the per-tenant company profile document at
 * `accounting_settings/{companyId}` — the legal-identity Single Source of Truth
 * (ADR-439). The accounting subsystem already owns this profile (ΑΦΜ, ΔΟΥ, ΚΑΔ,
 * entity type, share capital); identity derivation reads from it rather than
 * falling back to a user's `displayName`.
 *
 * This reader feeds {@link resolveCompanyDisplayName}: the resolved business
 * name becomes the derived cache stored in `companies/{id}.name`.
 *
 * Reads the per-tenant doc only (ADR-439 Phase 2b). The legacy global singleton
 * (`accounting_settings/company_profile`) was migrated into the per-tenant path
 * by `POST /api/admin/migrate-accounting-profile` and is no longer consulted.
 *
 * @module services/company/company-legal-identity
 * @see ADR-439 Tenant Identity SSoT & Provisioning
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CompanyLegalIdentity');

/**
 * The legal-identity fields used to derive a company's display name.
 * Both are optional — a tenant may have only a registered business name.
 */
export interface CompanyLegalIdentity {
  /** Registered legal name (Επωνυμία) — company profile `businessName`. */
  businessName?: string;
  /** Trade / commercial name (διακριτικός τίτλος), if recorded. */
  tradeName?: string;
}

function readStringField(
  data: FirebaseFirestore.DocumentData,
  field: string,
): string | undefined {
  const value = data[field];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Read the legal identity (business / trade name) for a tenant.
 *
 * Source: per-tenant profile `accounting_settings/{companyId}` — the
 * legal-identity SSoT (ADR-439).
 *
 * @returns The identity, or `null` when no business/trade name is available.
 */
export async function readCompanyLegalIdentity(
  companyId: string,
): Promise<CompanyLegalIdentity | null> {
  try {
    const db = getAdminFirestore();
    const settings = db.collection(COLLECTIONS.ACCOUNTING_SETTINGS);

    // Per-tenant legal-identity SSoT.
    const snap = await settings.doc(companyId).get();

    if (!snap.exists) return null;
    const data = snap.data();
    if (!data) return null;

    const businessName = readStringField(data, 'businessName');
    const tradeName = readStringField(data, 'tradeName');
    if (!businessName && !tradeName) return null;

    return { businessName, tradeName };
  } catch (error) {
    logger.warn('[CompanyLegalIdentity] read failed — falling back to non-profile name', {
      companyId,
      error: getErrorMessage(error),
    });
    return null;
  }
}
