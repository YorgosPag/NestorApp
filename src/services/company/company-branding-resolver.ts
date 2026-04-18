/**
 * =============================================================================
 * 🏢 COMPANY BRANDING RESOLVER — hierarchical SSoT (ADR-312 Phase 3.7)
 * =============================================================================
 *
 * Resolves the company branding block (name + phone + email + website) that
 * the public showcase surfaces display, by walking the domain hierarchy:
 *
 *   Property  (projectId)
 *     └── Project  (linkedCompanyId)
 *           └── Contact  type=company  ← PRIMARY branding source
 *
 * Fallback — when the hierarchy is incomplete (no `projectId`, project missing,
 * or no `linkedCompanyId`) — the tenant document `companies/{companyId}` is
 * used. When even that is absent, the identifier-based `Company #<idPrefix>`
 * fallback from `company-name-resolver` kicks in.
 *
 * Rationale: the `companies` collection is the tenant-settings doc (plan,
 * timezone, feature flags) and may contain placeholder values carried over
 * from bootstrap; the real company profile (legal name, VAT, contact
 * channels) lives in the `contacts` collection linked through the project.
 * Showcase branding MUST read from the linked contact, not the tenant.
 *
 * @module services/company/company-branding-resolver
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveCompanyDisplayName } from './company-name-resolver';

export type BrandingSource = 'contact' | 'tenant' | 'fallback';

export interface ShowcaseCompanyBranding {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  /** Which layer of the hierarchy produced this branding (for observability). */
  source: BrandingSource;
}

export interface ResolveBrandingParams {
  adminDb: Firestore;
  /** The resolved property document data. Used to discover `projectId`. */
  propertyData: Record<string, unknown>;
  /** Tenant id (used as last-resort fallback). */
  companyId: string;
}

interface PrimaryCarrier {
  isPrimary?: boolean;
}

function pickValue<T extends PrimaryCarrier & Record<string, unknown>>(
  arr: unknown,
  field: keyof T,
): string | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const entries = arr as T[];
  const primary = entries.find((e) => e?.isPrimary === true);
  const pick = (primary ?? entries[0]) as T | undefined;
  const raw = pick?.[field];
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return undefined;
}

function extractContactBranding(
  contact: Record<string, unknown>,
  contactId: string,
): ShowcaseCompanyBranding {
  return {
    name: resolveCompanyDisplayName({
      id: contactId,
      companyName: contact.companyName as string | undefined,
      tradeName: contact.tradeName as string | undefined,
      legalName: contact.legalName as string | undefined,
      displayName: contact.displayName as string | undefined,
    }),
    email: pickValue<{ isPrimary?: boolean; email?: string } & Record<string, unknown>>(
      contact.emails,
      'email',
    ),
    phone: pickValue<{ isPrimary?: boolean; number?: string } & Record<string, unknown>>(
      contact.phones,
      'number',
    ),
    website: pickValue<{ url?: string } & Record<string, unknown>>(
      contact.websites,
      'url',
    ),
    source: 'contact',
  };
}

function extractTenantBranding(
  tenant: Record<string, unknown>,
  tenantId: string,
): ShowcaseCompanyBranding {
  return {
    name: resolveCompanyDisplayName({
      id: tenantId,
      name: tenant.name as string | undefined,
      companyName: tenant.companyName as string | undefined,
      tradeName: tenant.tradeName as string | undefined,
      legalName: tenant.legalName as string | undefined,
      displayName: tenant.displayName as string | undefined,
    }),
    phone: typeof tenant.phone === 'string' && tenant.phone.trim() ? tenant.phone.trim() : undefined,
    email: typeof tenant.email === 'string' && tenant.email.trim() ? tenant.email.trim() : undefined,
    website:
      typeof tenant.website === 'string' && tenant.website.trim() ? tenant.website.trim() : undefined,
    source: 'tenant',
  };
}

/**
 * Resolve showcase company branding via domain hierarchy with graceful
 * fallback. Never throws — worst case returns an identifier-based label.
 */
export async function resolveShowcaseCompanyBranding(
  params: ResolveBrandingParams,
): Promise<ShowcaseCompanyBranding> {
  const { adminDb, propertyData, companyId } = params;

  // ── Primary path: Property → Project → Contact ───────────────────────────
  const projectId = propertyData.projectId as string | undefined;
  if (projectId) {
    const projectSnap = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
    if (projectSnap.exists) {
      const project = projectSnap.data() ?? {};
      const linkedContactId = (project as Record<string, unknown>).linkedCompanyId as
        | string
        | undefined;
      if (linkedContactId) {
        const contactSnap = await adminDb
          .collection(COLLECTIONS.CONTACTS)
          .doc(linkedContactId)
          .get();
        if (contactSnap.exists) {
          return extractContactBranding(contactSnap.data() ?? {}, linkedContactId);
        }
      }
    }
  }

  // ── Fallback path: tenant companies/{companyId} ──────────────────────────
  const tenantSnap = await adminDb.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
  if (tenantSnap.exists) {
    return extractTenantBranding(tenantSnap.data() ?? {}, companyId);
  }

  // ── Last-resort fallback ─────────────────────────────────────────────────
  return {
    name: resolveCompanyDisplayName({ id: companyId }),
    source: 'fallback',
  };
}
