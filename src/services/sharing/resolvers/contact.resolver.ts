/**
 * =============================================================================
 * CONTACT SHARE RESOLVER (ADR-315, primitives per ADR-699)
 * =============================================================================
 *
 * Resolves `entityType: 'contact'` shares. The shared policy (projection, base
 * validation, tenant ownership, entity read) comes from
 * `sharing/resolver-core`; what stays here is the field-level consent rule that
 * makes contact shares different from every other surface:
 *
 *   **nothing is published unless the sharer listed it in `includedFields`.**
 *
 * Emails, phones, address and company are personal data. `pickIfIncluded` is
 * the enforcement point — it is deliberately applied per field rather than by
 * filtering the object afterwards, so a new field added to this shape is
 * omitted by default instead of leaking until someone remembers to filter it.
 *
 * @module services/sharing/resolvers/contact.resolver
 * @see adrs/ADR-699-share-resolver-declarations.md
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import {
  createTenantOwnershipGuard,
  loadSharedEntityDoc,
} from '@/services/sharing/resolver-core/share-entity-access';
import {
  buildSafePublicProjection,
  validateShareBaseInput,
} from '@/services/sharing/resolver-core/share-resolver-primitives';
import type {
  ContactShareMeta,
  CreateShareInput,
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

/** Display name, in the order the contacts UI itself resolves it. */
function readFullName(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  return (
    (data.displayName as string | undefined) ??
    (data.name as string | undefined) ??
    ([data.firstName, data.lastName].filter(Boolean).join(' ').trim() || null)
  );
}

async function resolveContact(share: ShareRecord): Promise<ContactShareResolvedData> {
  const included = share.contactMeta?.includedFields ?? [];
  const data = await loadSharedEntityDoc({
    collection: COLLECTIONS.CONTACTS,
    share,
    logger,
    missingMessage: 'Contact share points to missing contact',
  });

  return {
    shareId: share.id,
    token: share.token,
    contactId: share.entityId,
    name: pickIfIncluded(readFullName(data), 'name', included),
    emails: pickIfIncluded(asStringArray(data?.emails), 'emails', included),
    phones: pickIfIncluded(asStringArray(data?.phones), 'phones', included),
    address: pickIfIncluded(data?.address as string | null, 'address', included),
    company: pickIfIncluded(data?.company as string | null, 'company', included),
    note: share.note ?? null,
  };
}

function validateCreateInput(input: CreateShareInput): ValidationResult {
  const base = validateShareBaseInput(input, {
    entityType: ENTITY_TYPES.CONTACT,
    entityIdLabel: 'contactId',
  });
  if (!base.valid) return base;

  if (!(input.contactMeta?.includedFields ?? []).length) {
    return {
      valid: false,
      reason: 'contactMeta.includedFields must list at least one field',
    };
  }
  return { valid: true };
}

export const contactShareResolver: ShareEntityDefinition<ContactShareResolvedData> = {
  resolve: resolveContact,
  safePublicProjection: share => buildSafePublicProjection(share, 'contactMeta'),
  validateCreateInput,
  canShare: createTenantOwnershipGuard(COLLECTIONS.CONTACTS),
  renderPublic: () => null, // Wired in Step D (public route dispatcher)
};
