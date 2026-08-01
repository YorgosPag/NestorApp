/**
 * =============================================================================
 * CONTACT LINK SERVICE - CRUD Operations (ADR-032)
 * =============================================================================
 *
 * SSoT for contact link operations:
 * - Create (link contact to entity)
 * - Read (get by ID, list with filters, get with links)
 * - Update (change role)
 * - Deactivate (soft-delete)
 *
 * @module services/contact-link.service
 * @enterprise ADR-032 - Linking Model (Associations)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
} from 'firebase/firestore';
import type { DocumentReference, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime';
import { contactLinkConverter } from '@/lib/firestore/converters/association.converter';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { generateContactLinkId } from '@/lib/contact-link-id';
import type {
  ContactLink,
  CreateContactLinkInput,
  ListContactLinksParams,
  LinkResult,
  ContactWithLinks,
} from '@/types/associations';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('ContactLinkService');

// =============================================================================
// CREATE
// =============================================================================

export async function linkContactToEntity(input: CreateContactLinkInput): Promise<LinkResult> {
  try {
    const { companyId, sourceWorkspaceId, sourceContactId, targetEntityType, targetEntityId, targetWorkspaceId, reason, role, createdBy, metadata } = input;

    if (!targetEntityType || !targetEntityId) {
      return { success: false, error: 'Target entity type and ID are required', errorCode: 'INVALID_TARGET' };
    }

    // 🔒 ADR-745 G7 — fail here rather than let the rules reject an unscoped write.
    // The CREATE rule requires both, so a missing value is a bug, not a soft state.
    if (!companyId) {
      return { success: false, error: 'companyId is required', errorCode: 'MISSING_TENANT' };
    }
    if (!createdBy) {
      return { success: false, error: 'createdBy is required', errorCode: 'MISSING_CREATOR' };
    }

    // Duplicate detection — direct reads, no composite indexes needed
    const linkId = buildContactLinkId(sourceContactId, targetEntityType, targetEntityId, role);
    const legacyId = `cl_${sourceContactId}_${targetEntityType}_${targetEntityId}`;

    const [canonicalDoc, legacyDoc] = await Promise.all([
      getContactLinkById(linkId),
      linkId !== legacyId ? getContactLinkById(legacyId) : Promise.resolve(null),
    ]);

    // Canonical link active → idempotent
    if (canonicalDoc?.status === 'active') {
      return { success: true, linkId, message: 'Link already exists' };
    }

    // Legacy link active with same role → idempotent
    if (legacyDoc?.status === 'active' && legacyDoc.role === role) {
      return { success: true, linkId: legacyId, message: 'Link already exists' };
    }

    // Canonical link inactive → reactivate
    if (canonicalDoc?.status === 'inactive') {
      const ref = doc(db, COLLECTIONS.CONTACT_LINKS, linkId);
      await updateDoc(ref, { status: 'active', updatedBy: createdBy, updatedAt: serverTimestamp() });
      logger.info(`Reactivated: ${linkId}`);

      RealtimeService.dispatch('CONTACT_LINK_CREATED', {
        linkId,
        link: { sourceContactId, sourceWorkspaceId, targetEntityType, targetEntityId, targetWorkspaceId },
        timestamp: Date.now(),
      });
      return { success: true, linkId, message: 'Contact link reactivated' };
    }

    // Legacy link active without role → orphan cleanup
    if (legacyDoc?.status === 'active' && !legacyDoc.role) {
      const ref = doc(db, COLLECTIONS.CONTACT_LINKS, legacyId);
      await updateDoc(ref, { status: 'inactive', updatedBy: createdBy, updatedAt: serverTimestamp() });
      logger.info(`Cleaned up orphan: ${legacyId}`);
    }

    const contactLink: ContactLink = {
      id: linkId,
      companyId,
      sourceWorkspaceId,
      sourceContactId,
      targetWorkspaceId,
      targetEntityType,
      targetEntityId,
      reason,
      role,
      status: 'active',
      createdAt: nowISO(),
      createdBy,
      metadata,
    };

    const linkRef = doc(db, COLLECTIONS.CONTACT_LINKS, linkId).withConverter(contactLinkConverter);
    await setDoc(linkRef, contactLink);

    logger.info(`Created contact link: ${linkId}`);

    RealtimeService.dispatch('CONTACT_LINK_CREATED', {
      linkId,
      link: { sourceContactId, sourceWorkspaceId, targetEntityType, targetEntityId, targetWorkspaceId },
      timestamp: Date.now(),
    });

    // Audit trail (fire-and-forget)
    if (targetEntityType && targetEntityId) {
      safeFireAndForget(fetch(API_ROUTES.AUDIT_TRAIL.RECORD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: targetEntityType,
          entityId: targetEntityId,
          entityName: null,
          action: 'linked',
          changes: [{ field: 'contact_link', oldValue: null, newValue: sourceContactId, label: `Σύνδεση (${role ?? 'γενική'})` }],
        }),
      }), 'ContactLink.auditTrail');
    }

    return { success: true, linkId, message: 'Contact linked successfully' };
  } catch (error) {
    logger.error('Failed to link contact:', error);
    return { success: false, error: getErrorMessage(error), errorCode: 'LINK_CONTACT_FAILED' };
  }
}

// =============================================================================
// READ
// =============================================================================

export async function getContactLinkById(linkId: string): Promise<ContactLink | null> {
  const linkRef = doc(db, COLLECTIONS.CONTACT_LINKS, linkId).withConverter(contactLinkConverter);
  const snapshot = await getDoc(linkRef);
  return snapshot.exists() ? snapshot.data() : null;
}

export async function listContactLinks(params: ListContactLinksParams): Promise<ContactLink[]> {
  const { companyId, sourceContactId, sourceWorkspaceId, targetWorkspaceId, targetEntityType, targetEntityId, status, limit: limitParam } = params;

  // 🔒 ADR-745 G6 — tenant scope belongs in the QUERY, not only in the rule.
  // Firestore rules are not filters: a list query that leaves `companyId`
  // unconstrained is rejected whole, because the rule reads a field the query
  // never pinned down. Leading equality field, so the composite indexes order
  // companyId → … → createdAt.
  if (!companyId) {
    throw new Error('listContactLinks: companyId is required for tenant isolation');
  }

  const optional: QueryConstraint[] = [];
  if (sourceContactId) optional.push(where('sourceContactId', '==', sourceContactId));
  if (sourceWorkspaceId) optional.push(where('sourceWorkspaceId', '==', sourceWorkspaceId));
  if (targetWorkspaceId) optional.push(where('targetWorkspaceId', '==', targetWorkspaceId));
  if (targetEntityType) optional.push(where('targetEntityType', '==', targetEntityType));
  if (targetEntityId) optional.push(where('targetEntityId', '==', targetEntityId));
  if (status) optional.push(where('status', '==', status));
  optional.push(orderBy('createdAt', 'desc'));
  if (limitParam) optional.push(firestoreLimit(limitParam));

  const q = query(
    collection(db, COLLECTIONS.CONTACT_LINKS).withConverter(contactLinkConverter),
    where('companyId', '==', companyId), // 🔒 tenant scope — always present, always first
    ...optional,
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function getContactWithLinks(contactId: string, companyId: string): Promise<ContactWithLinks | null> {
  const links = await listContactLinks({ companyId, sourceContactId: contactId, status: 'active' });
  if (links.length === 0) return null;

  const linkedTo = links.map((link) => ({
    workspaceId: link.targetWorkspaceId,
    entityType: link.targetEntityType,
    entityId: link.targetEntityId,
  }));

  return {
    contactId,
    contactName: '',
    sourceWorkspaceId: links[0].sourceWorkspaceId,
    sourceWorkspaceName: '',
    linkedTo,
  };
}

// =============================================================================
// UPDATE / DEACTIVATE
// =============================================================================

/**
 * Load a link and its ref, or the caller's not-found result.
 *
 * Both mutations below opened with the same four lines; extracted 2026-08-01 so
 * the "does it exist" answer has one shape instead of two copies (N.0.2 / N.18).
 */
async function loadLink(
  linkId: string,
): Promise<
  | { readonly found: true; readonly ref: DocumentReference; readonly data: ContactLink }
  | { readonly found: false; readonly result: LinkResult }
> {
  const ref = doc(db, COLLECTIONS.CONTACT_LINKS, linkId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return {
      found: false,
      result: { success: false, error: 'Contact link not found', errorCode: 'LINK_NOT_FOUND' },
    };
  }

  return { found: true, ref, data: snapshot.data() as ContactLink };
}

export async function unlinkContact(linkId: string, updatedBy: string): Promise<LinkResult> {
  try {
    const loaded = await loadLink(linkId);
    if (!loaded.found) return loaded.result;

    const { ref: linkRef, data: linkData } = loaded;

    await updateDoc(linkRef, { status: 'inactive', updatedBy, updatedAt: serverTimestamp() });
    logger.info(`Deactivated contact link: ${linkId}`);

    // Cleanup: deactivate sibling with opposite ID format (legacy ↔ canonical)
    if (linkData.sourceContactId && linkData.targetEntityType && linkData.targetEntityId && linkData.role) {
      const canonicalId = buildContactLinkId(
        linkData.sourceContactId, linkData.targetEntityType, linkData.targetEntityId, linkData.role
      );
      const legacyId = `cl_${linkData.sourceContactId}_${linkData.targetEntityType}_${linkData.targetEntityId}`;
      const siblingId = linkId === canonicalId ? legacyId : canonicalId;

      if (siblingId !== linkId) {
        const siblingSnap = await getDoc(doc(db, COLLECTIONS.CONTACT_LINKS, siblingId));
        if (siblingSnap.exists() && siblingSnap.data()?.status === 'active') {
          await updateDoc(doc(db, COLLECTIONS.CONTACT_LINKS, siblingId), {
            status: 'inactive', updatedBy, updatedAt: serverTimestamp(),
          });
          logger.info(`Cleaned up sibling: ${siblingId}`);
        }
      }
    }

    RealtimeService.dispatch('CONTACT_LINK_REMOVED', { linkId, timestamp: Date.now() });

    // Audit trail (fire-and-forget)
    if (linkData.targetEntityType && linkData.targetEntityId) {
      safeFireAndForget(fetch(API_ROUTES.AUDIT_TRAIL.RECORD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: linkData.targetEntityType,
          entityId: linkData.targetEntityId,
          entityName: null,
          action: 'unlinked',
          changes: [{ field: 'contact_link', oldValue: linkData.sourceContactId, newValue: null, label: `Αποσύνδεση (${linkData.role ?? 'γενική'})` }],
        }),
      }), 'ContactLink.auditTrail');
    }

    return { success: true, linkId, message: 'Contact link deactivated' };
  } catch (error) {
    logger.error('Failed to unlink contact:', error);
    return { success: false, error: getErrorMessage(error), errorCode: 'UNLINK_CONTACT_FAILED' };
  }
}

export async function updateContactLinkRole(linkId: string, role: string, updatedBy: string): Promise<LinkResult> {
  try {
    const loaded = await loadLink(linkId);
    if (!loaded.found) return loaded.result;

    await updateDoc(loaded.ref, { role, updatedBy, updatedAt: serverTimestamp() });
    logger.info(`Updated role for link ${linkId} → ${role}`);

    return { success: true, linkId, message: 'Role updated successfully' };
  } catch (error) {
    logger.error('Failed to update role:', error);
    return { success: false, error: getErrorMessage(error), errorCode: 'UPDATE_ROLE_FAILED' };
  }
}

// =============================================================================
// ID GENERATION
// =============================================================================

export function buildContactLinkId(
  contactId: string,
  targetEntityType?: string,
  targetEntityId?: string,
  role?: string
): string {
  return generateContactLinkId(contactId, targetEntityType, targetEntityId, role);
}
