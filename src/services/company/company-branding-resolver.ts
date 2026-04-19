/**
 * =============================================================================
 * 🏢 COMPANY BRANDING RESOLVER — hierarchical SSoT (ADR-312 Phase 3.7 / 9)
 * =============================================================================
 *
 * Resolves the company branding block the public showcase surfaces display,
 * by walking the domain hierarchy:
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
 * Phase 9 widens the block to expose every non-primary phone/email/website
 * plus the full `addresses[]` and `socialMedia[]` arrays, so the showcase top
 * container (web + PDF + HTML email) can render the complete company identity.
 *
 * @module services/company/company-branding-resolver
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveCompanyDisplayName } from './company-name-resolver';

export type BrandingSource = 'contact' | 'tenant' | 'fallback';

export type ShowcaseSocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'twitter'
  | 'youtube'
  | 'github'
  | 'other';

export interface ShowcaseContactPhone {
  value: string;
  label?: string;
}

export interface ShowcaseContactEmail {
  value: string;
  label?: string;
}

export interface ShowcaseContactWebsite {
  url: string;
  label?: string;
}

export interface ShowcaseContactSocial {
  platform: ShowcaseSocialPlatform;
  url: string;
  username?: string;
  label?: string;
}

export interface ShowcaseCompanyBranding {
  name: string;
  /** Primary phone — preserved for the legacy footer contact line. */
  phone?: string;
  /** Primary email — preserved for the legacy footer contact line. */
  email?: string;
  /** Primary website — preserved for the legacy footer contact line. */
  website?: string;
  /**
   * Absolute URL of the company logo (ADR-312 Phase 8). When undefined the
   * showcase surfaces fall back to the bundled `/images/pagonis-energo-logo.png`
   * asset. Read from `contacts.logoURL` (primary) or `companies.logoURL`
   * (tenant fallback). Empty strings are normalised to undefined.
   */
  logoUrl?: string;
  /** Every non-empty phone on the contact, primary first (ADR-312 Phase 9). */
  phones?: ShowcaseContactPhone[];
  /** Every non-empty email on the contact, primary first (ADR-312 Phase 9). */
  emails?: ShowcaseContactEmail[];
  /** Pre-formatted address lines, primary first (ADR-312 Phase 9). */
  addresses?: string[];
  /** Every non-empty website on the contact (ADR-312 Phase 9). */
  websites?: ShowcaseContactWebsite[];
  /** Social network handles normalised to absolute URLs (ADR-312 Phase 9). */
  socialMedia?: ShowcaseContactSocial[];
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

function pickNonEmptyString(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sortPrimaryFirst<T extends PrimaryCarrier>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ap = a?.isPrimary === true ? 0 : 1;
    const bp = b?.isPrimary === true ? 0 : 1;
    return ap - bp;
  });
}

function pickAllPhones(arr: unknown): ShowcaseContactPhone[] | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const entries = arr as Array<PrimaryCarrier & { number?: string; label?: string; countryCode?: string }>;
  const mapped = sortPrimaryFirst(entries)
    .map<ShowcaseContactPhone | undefined>((e) => {
      const value = pickNonEmptyString(e.number);
      if (!value) return undefined;
      const cc = pickNonEmptyString(e.countryCode);
      const full = cc && !value.startsWith('+') ? `${cc} ${value}` : value;
      const label = pickNonEmptyString(e.label);
      return label ? { value: full, label } : { value: full };
    })
    .filter((v): v is ShowcaseContactPhone => v !== undefined);
  return mapped.length > 0 ? mapped : undefined;
}

function pickAllEmails(arr: unknown): ShowcaseContactEmail[] | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const entries = arr as Array<PrimaryCarrier & { email?: string; label?: string }>;
  const mapped = sortPrimaryFirst(entries)
    .map<ShowcaseContactEmail | undefined>((e) => {
      const value = pickNonEmptyString(e.email);
      if (!value) return undefined;
      const label = pickNonEmptyString(e.label);
      return label ? { value, label } : { value };
    })
    .filter((v): v is ShowcaseContactEmail => v !== undefined);
  return mapped.length > 0 ? mapped : undefined;
}

function pickAllWebsites(arr: unknown): ShowcaseContactWebsite[] | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const entries = arr as Array<PrimaryCarrier & { url?: string; label?: string }>;
  const mapped = sortPrimaryFirst(entries)
    .map<ShowcaseContactWebsite | undefined>((e) => {
      const url = pickNonEmptyString(e.url);
      if (!url) return undefined;
      const label = pickNonEmptyString(e.label);
      return label ? { url, label } : { url };
    })
    .filter((v): v is ShowcaseContactWebsite => v !== undefined);
  return mapped.length > 0 ? mapped : undefined;
}

interface RawAddress {
  street?: string;
  number?: string;
  city?: string;
  postalCode?: string;
  region?: string;
  country?: string;
  isPrimary?: boolean;
}

function formatContactAddressLine(addr: RawAddress): string | undefined {
  const parts: string[] = [];
  const streetParts = [addr.street, addr.number].map(pickNonEmptyString).filter(Boolean) as string[];
  if (streetParts.length > 0) parts.push(streetParts.join(' '));
  const locality = [addr.postalCode, addr.city].map(pickNonEmptyString).filter(Boolean) as string[];
  if (locality.length > 0) parts.push(locality.join(' '));
  const region = pickNonEmptyString(addr.region);
  if (region) parts.push(region);
  const country = pickNonEmptyString(addr.country);
  if (country && country.toUpperCase() !== 'GR' && country !== 'Ελλάδα' && country !== 'Greece') {
    parts.push(country);
  }
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function pickAllAddresses(arr: unknown): string[] | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const entries = arr as Array<RawAddress & PrimaryCarrier>;
  const mapped = sortPrimaryFirst(entries)
    .map((e) => formatContactAddressLine(e))
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  return mapped.length > 0 ? mapped : undefined;
}

const SOCIAL_PLATFORMS: readonly ShowcaseSocialPlatform[] = [
  'facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'github', 'other',
];

const SOCIAL_BASE_URL: Record<Exclude<ShowcaseSocialPlatform, 'other'>, string> = {
  facebook: 'https://facebook.com/',
  instagram: 'https://instagram.com/',
  linkedin: 'https://linkedin.com/in/',
  twitter: 'https://twitter.com/',
  youtube: 'https://youtube.com/@',
  github: 'https://github.com/',
};

function normalisePlatform(raw: unknown): ShowcaseSocialPlatform {
  const v = pickNonEmptyString(raw)?.toLowerCase();
  if (v && (SOCIAL_PLATFORMS as readonly string[]).includes(v)) {
    return v as ShowcaseSocialPlatform;
  }
  return 'other';
}

function pickAllSocials(arr: unknown): ShowcaseContactSocial[] | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const entries = arr as Array<{
    platform?: unknown;
    username?: unknown;
    url?: unknown;
    label?: unknown;
  }>;
  const mapped = entries
    .map<ShowcaseContactSocial | undefined>((e) => {
      const platform = normalisePlatform(e.platform);
      const explicitUrl = pickNonEmptyString(e.url);
      const username = pickNonEmptyString(e.username);
      let finalUrl = explicitUrl;
      if (!finalUrl && username && platform !== 'other') {
        finalUrl = SOCIAL_BASE_URL[platform] + username.replace(/^@/, '');
      }
      if (!finalUrl) return undefined;
      const label = pickNonEmptyString(e.label);
      const base: ShowcaseContactSocial = { platform, url: finalUrl };
      if (username) base.username = username.replace(/^@/, '');
      if (label) base.label = label;
      return base;
    })
    .filter((v): v is ShowcaseContactSocial => v !== undefined);
  return mapped.length > 0 ? mapped : undefined;
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
    logoUrl: pickNonEmptyString(contact.logoURL),
    phones: pickAllPhones(contact.phones),
    emails: pickAllEmails(contact.emails),
    addresses: pickAllAddresses(contact.addresses),
    websites: pickAllWebsites(contact.websites),
    socialMedia: pickAllSocials(contact.socialMedia),
    source: 'contact',
  };
}

function extractTenantBranding(
  tenant: Record<string, unknown>,
  tenantId: string,
): ShowcaseCompanyBranding {
  const legacyPhone = pickNonEmptyString(tenant.phone);
  const legacyEmail = pickNonEmptyString(tenant.email);
  const legacyWebsite = pickNonEmptyString(tenant.website);
  return {
    name: resolveCompanyDisplayName({
      id: tenantId,
      name: tenant.name as string | undefined,
      companyName: tenant.companyName as string | undefined,
      tradeName: tenant.tradeName as string | undefined,
      legalName: tenant.legalName as string | undefined,
      displayName: tenant.displayName as string | undefined,
    }),
    phone: legacyPhone,
    email: legacyEmail,
    website: legacyWebsite,
    logoUrl: pickNonEmptyString(tenant.logoURL) ?? pickNonEmptyString(tenant.logoUrl),
    phones:
      pickAllPhones(tenant.phones)
      ?? (legacyPhone ? [{ value: legacyPhone }] : undefined),
    emails:
      pickAllEmails(tenant.emails)
      ?? (legacyEmail ? [{ value: legacyEmail }] : undefined),
    addresses: pickAllAddresses(tenant.addresses),
    websites:
      pickAllWebsites(tenant.websites)
      ?? (legacyWebsite ? [{ url: legacyWebsite }] : undefined),
    socialMedia: pickAllSocials(tenant.socialMedia),
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
