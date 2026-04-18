/**
 * =============================================================================
 * CONTACT SHARE RESOLVER (ADR-315)
 * =============================================================================
 *
 * Resolves `entityType: 'contact'` shares. Replaces the tokenless contact
 * share flow (`photo_shares` dispatch-only) with a proper token lifecycle.
 *
 * Policy:
 *   - canShare: same-tenant user
 *   - validateCreateInput: require `contactId` + `contactMeta.includedFields`
 *   - resolve: fetch contact, project only fields the user chose to include
 *   - safePublicProjection: never leak emails/phones/address unless explicitly
 *     included in `contactMeta.includedFields`
 *
 * @module services/sharing/resolvers/contact.resolver
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  AuthorizedUser,
  ContactShareMeta,
  CreateShareInput,
  PublicShareData,
  ShareEntityDefinition,
  ShareRecord,
  ValidationResult,
} from '@/types/sharing';

const logger = createModuleLogger('ContactShareResolver');

type IncludedField = ContactShareMeta['includedFields'][number];

export interface ContactShareResolvedData {
  shareId: string;
  token: string;
  contactId: string;
  name: string | null;
  emails: string[] | null;
  phones: string[] | null;
  address: string | null;
  company: string | null;
  note: string | null;
}

function pickIfIncluded<T>(
  value: T | null | undefined,
  field: IncludedField,
  includedFields: IncludedField[],
): T | null {
  if (!includedFields.includes(field)) return null;
  return value ?? null;
}

function asStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const maybe =
          (item as Record<string, unknown>).value ??
          (item as Record<string, unknown>).address ??
          (item as Record<string, unknown>).number;
        return typeof maybe === 'string' ? maybe : null;
      }
      return null;
    })
    .filter((v): v is string => !!v);
  return out.length ? out : null;
}

async function resolveContact(share: ShareRecord): Promise<ContactShareResolvedData> {
  const included = share.contactMeta?.includedFields ?? [];
  const ref = doc(db, COLLECTIONS.CONTACTS, share.entityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    logger.warn('Contact share points to missing contact', {
      shareId: share.id,
      contactId: share.entityId,
    });
    return {
      shareId: share.id,
      token: share.token,
      contactId: share.entityId,
      name: null,
      emails: null,
      phones: null,
      address: null,
      company: null,
      note: share.note ?? null,
    };
  }
  const data = snap.data();
  const fullName =
    (data.displayName as string | undefined) ??
    (data.name as string | undefined) ??
    ([data.firstName, data.lastName].filter(Boolean).join(' ').trim() || null);

  return {
    shareId: share.id,
    token: share.token,
    contactId: share.entityId,
    name: pickIfIncluded(fullName, 'name', included),
    emails: pickIfIncluded(asStringArray(data.emails), 'emails', included),
    phones: pickIfIncluded(asStringArray(data.phones), 'phones', included),
    address: pickIfIncluded(data.address as string | null, 'address', included),
    company: pickIfIncluded(data.company as string | null, 'company', included),
    note: share.note ?? null,
  };
}

function safePublicProjection(share: ShareRecord): PublicShareData {
  return {
    entityType: share.entityType,
    entityId: share.entityId,
    requiresPassword: share.requiresPassword,
    expiresAt: share.expiresAt,
    isActive: share.isActive,
    accessCount: share.accessCount,
    maxAccesses: share.maxAccesses,
    note: share.note ?? null,
    contactMeta: share.contactMeta ?? null,
  };
}

function validateCreateInput(input: CreateShareInput): ValidationResult {
  if (input.entityType !== 'contact') {
    return { valid: false, reason: 'Wrong resolver — expected entityType=contact' };
  }
  if (!input.entityId?.trim()) return { valid: false, reason: 'contactId required' };
  if (!input.companyId?.trim()) return { valid: false, reason: 'companyId required' };
  if (!input.createdBy?.trim()) return { valid: false, reason: 'createdBy required' };
  const included = input.contactMeta?.includedFields ?? [];
  if (!included.length) {
    return {
      valid: false,
      reason: 'contactMeta.includedFields must list at least one field',
    };
  }
  return { valid: true };
}

async function canShare(user: AuthorizedUser, entityId: string): Promise<boolean> {
  if (!user?.uid || !user?.companyId) return false;
  const ref = doc(db, COLLECTIONS.CONTACTS, entityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const contactCompanyId = snap.data().companyId as string | undefined;
  return contactCompanyId === user.companyId;
}

export const contactShareResolver: ShareEntityDefinition<ContactShareResolvedData> = {
  resolve: resolveContact,
  safePublicProjection,
  validateCreateInput,
  canShare,
  renderPublic: () => null, // Wired in Step D (public route dispatcher)
};
