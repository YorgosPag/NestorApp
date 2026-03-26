/**
 * CONTACT FIELD UPDATE — Extracted from contact-handler.ts (SRP / N.7.1)
 *
 * Updates a scalar field on an existing contact. Admin only.
 * Auto-syncs displayName when firstName or lastName changes.
 *
 * @module services/ai-pipeline/tools/handlers/contact-field-update-handler
 * @see SPEC-257E (Contact Management)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CONTACT_UPDATABLE_FIELDS } from '../agentic-tool-definitions';
import type { ContactUpdatableField } from '../agentic-tool-definitions';
import {
  type AgenticContext,
  type ToolResult,
  auditWrite,
  buildAttribution,
  logger,
} from '../executor-shared';

const ESCO_PROTECTED = ['profession', 'escoUri', 'escoLabel', 'iscoCode', 'escoSkills'];

export async function executeUpdateContactField(
  args: Record<string, unknown>,
  ctx: AgenticContext
): Promise<ToolResult> {
  if (!ctx.isAdmin) {
    return { success: false, error: 'update_contact_field is admin-only.' };
  }

  const contactId = String(args.contactId ?? '').trim();
  const field = String(args.field ?? '');
  const value = String(args.value ?? '');

  if (!contactId) {
    return { success: false, error: 'contactId is required.' };
  }
  if (!CONTACT_UPDATABLE_FIELDS.includes(field as ContactUpdatableField)) {
    return { success: false, error: `field must be one of: ${CONTACT_UPDATABLE_FIELDS.join(', ')}` };
  }

  if (ESCO_PROTECTED.includes(field)) {
    return {
      success: false,
      error: `Το πεδίο "${field}" προστατεύεται — χρησιμοποίησε set_contact_esco αντί update_contact_field.`,
    };
  }

  const db = getAdminFirestore();
  const docSnap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
  if (!docSnap.exists) {
    return { success: false, error: `Η επαφή ${contactId} δεν βρέθηκε.` };
  }

  const { updateContactField, emitEntitySyncSignal } = await import(
    '@/services/ai-pipeline/shared/contact-lookup'
  );
  await updateContactField(contactId, field, value, buildAttribution(ctx));

  // Auto-sync displayName when name fields change
  const existingData = docSnap.data() as Record<string, unknown>;
  if (field === 'firstName' || field === 'lastName') {
    const newFirst = field === 'firstName' ? value : String(existingData.firstName ?? '');
    const newLast = field === 'lastName' ? value : String(existingData.lastName ?? '');
    const newDisplayName = `${newFirst} ${newLast}`.trim();
    await updateContactField(contactId, 'displayName', newDisplayName, buildAttribution(ctx));
  } else if (field === 'companyName' && existingData.type === 'company') {
    await updateContactField(contactId, 'displayName', value, buildAttribution(ctx));
  }

  await auditWrite(ctx, COLLECTIONS.CONTACTS, contactId, 'update', { [field]: value });
  emitEntitySyncSignal('contacts', 'UPDATED', contactId, ctx.companyId);

  logger.info('Contact field updated via tool', {
    contactId,
    field,
    requestId: ctx.requestId,
  });

  return {
    success: true,
    data: { contactId, field, value, updated: true },
    count: 1,
  };
}
