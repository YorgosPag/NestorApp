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
import {
  COMPANY_ENTITY_TYPES,
  LEGACY_DEFAULT_ENTITY_TYPE,
  type EntityType,
} from '@/subapps/accounting/types/entity';
import type { CompanyRegistryDeclaration } from '@/types/company-registry';
import type { CompanySeatDeclaration } from '@/types/showcase-legal-identity';

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
 * What reading the per-tenant profile learned — **three** states, never two.
 *
 * 🔴 `unavailable` ≠ `absent` (N.12): a failed read that looked like "no profile"
 * would invite the human to type again what the system already holds.
 */
type ProfileDocumentRead =
  | { readonly kind: 'present'; readonly data: FirebaseFirestore.DocumentData }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unavailable' };

/** The ONE read of `accounting_settings/{companyId}` for this module's consumers. */
async function readProfileDocument(companyId: string): Promise<ProfileDocumentRead> {
  try {
    const snap = await getAdminFirestore().collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(companyId).get();
    const data = snap.exists ? snap.data() : undefined;
    return data ? { kind: 'present', data } : { kind: 'absent' };
  } catch (error) {
    logger.warn('[CompanyLegalIdentity] profile read failed', { companyId, error: getErrorMessage(error) });
    return { kind: 'unavailable' };
  }
}

/**
 * Read the legal identity (business / trade name) for a tenant.
 *
 * Source: per-tenant profile `accounting_settings/{companyId}` — the
 * legal-identity SSoT (ADR-439).
 *
 * @returns The identity, or `null` when no business/trade name is available
 *   (including a failed read — the caller falls back to a non-profile name).
 */
export async function readCompanyLegalIdentity(
  companyId: string,
): Promise<CompanyLegalIdentity | null> {
  const read = await readProfileDocument(companyId);
  if (read.kind !== 'present') return null;

  const businessName = readStringField(read.data, 'businessName');
  const tradeName = readStringField(read.data, 'tradeName');
  if (!businessName && !tradeName) return null;

  return { businessName, tradeName };
}

// ============================================================================
// CONTACT DECLARATION — ADR-841 §7 Α21.19 (import into the professional card)
// ============================================================================

/**
 * **Where the organisation says it can be reached** — and NOTHING else from the profile.
 *
 * 🔑 Minimisation by type (same doctrine as `company-public-name.reader`): the profile
 * also carries ΑΦΜ, shareholders, ΚΑΔ and invoice series. What this shape does not
 * name cannot leak through a `{ ...declaration }` in a response.
 *
 * ⚠️ `address` is **free text** ("Σαμοθράκης 16") — structure is read by the caller
 * through `utils/address/address-parse`, never guessed here.
 */
export interface CompanyContactDeclaration {
  readonly address: string | null;
  readonly city: string | null;
  readonly postalCode: string | null;
  readonly phone: string | null;
  readonly mobile: string | null;
  readonly email: string | null;
  readonly website: string | null;
}

export type CompanyContactDeclarationRead =
  | { readonly kind: 'present'; readonly declaration: CompanyContactDeclaration }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unavailable' };

/**
 * Read the tenant's declared contact details from the legal-identity SSoT (ADR-439).
 *
 * A profile with **no** contact field at all reads as `absent`: there is nothing to import.
 */
export async function readCompanyContactDeclaration(companyId: string): Promise<CompanyContactDeclarationRead> {
  const read = await readProfileDocument(companyId);
  if (read.kind !== 'present') return read;

  const field = (name: keyof CompanyContactDeclaration) => readStringField(read.data, name) ?? null;
  const declaration: CompanyContactDeclaration = {
    address: field('address'),
    city: field('city'),
    postalCode: field('postalCode'),
    phone: field('phone'),
    mobile: field('mobile'),
    email: field('email'),
    website: field('website'),
  };
  if (Object.values(declaration).every((value) => value === null)) return { kind: 'absent' };
  return { kind: 'present', declaration };
}

// ============================================================================
// REGISTRY DECLARATION — ADR-841 §7 Α23 (the declaration checked against ΓΕΜΗ)
// ============================================================================

/**
 * 🔑 The ΓΕΜΗ number lives **once**, in the profile (the legal-identity SSoT, ADR-439). The
 * showcase and the brokerage declaration **read** it — they never ask again (pattern: Stripe
 * `company.registration_number`). The shape lives in `types/company-registry.ts` so screens see it.
 */
export type { CompanyRegistryDeclaration };

export type CompanyRegistryDeclarationRead =
  | { readonly kind: 'present'; readonly declaration: CompanyRegistryDeclaration }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unavailable' };

function entityTypeOf(value: unknown): EntityType | null {
  if (value === undefined || value === null || value === '') return LEGACY_DEFAULT_ENTITY_TYPE;
  return COMPANY_ENTITY_TYPES.find((type) => type === value) ?? null;
}

/**
 * Read the declaration that is judged against the registry.
 *
 * 🔴 Three states: a failed read must NOT look like "no ΓΕΜΗ number" — that would drop a
 * verification badge or refuse a brokerage declaration for an organisation that has one.
 */
export async function readCompanyRegistryDeclaration(
  companyId: string,
): Promise<CompanyRegistryDeclarationRead> {
  const read = await readProfileDocument(companyId);
  if (read.kind !== 'present') return read;
  return { kind: 'present', declaration: registryDeclarationOf(read.data) };
}

// ============================================================================
// PURE PARSERS — ADR-841 §7 Α23 (the profile read INSIDE a transaction)
// ============================================================================

/**
 * The registry declaration from an **already-read** profile document.
 *
 * 🔑 Exported so the showcase publication can `transaction.get` the profile and judge it inside the
 * same transaction: a concurrent rename then **retries** the publication instead of letting it write a
 * stale legal identity. One parser for both paths — never a second reading of the same fields.
 */
export function registryDeclarationOf(data: FirebaseFirestore.DocumentData): CompanyRegistryDeclaration {
  return {
    entityType: entityTypeOf(data.entityType),
    businessName: readStringField(data, 'businessName') ?? null,
    gemiNumber: readStringField(data, 'gemiNumber') ?? null,
  };
}

/** The **statutory seat** from an already-read profile document — address, city, postal code, nothing else. */
export function seatDeclarationOf(data: FirebaseFirestore.DocumentData): CompanySeatDeclaration {
  return {
    address: readStringField(data, 'address') ?? null,
    city: readStringField(data, 'city') ?? null,
    postalCode: readStringField(data, 'postalCode') ?? null,
  };
}
