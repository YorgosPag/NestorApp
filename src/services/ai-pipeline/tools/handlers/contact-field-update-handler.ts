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

/** Fields that only apply to individual contacts — NEVER to companies (FIND-R) */
const INDIVIDUAL_ONLY_FIELDS = [
  'gender', 'fatherName', 'motherName', 'amka',
  'birthDate', 'birthCountry',
  'documentType', 'documentNumber', 'documentIssuer', 'documentIssueDate', 'documentExpiryDate',
];

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

  // FIND-Z: Block 4-digit year values in registrationNumber (ΓΕΜΗ ≠ founded year)
  if (field === 'registrationNumber' && /^(19|20)\d{2}$/.test(value.trim())) {
    return {
      success: false,
      error: 'Ο αριθμός ΓΕΜΗ δεν μπορεί να είναι 4-ψήφιο έτος. Μήπως εννοείς "έτος ίδρυσης"; Αυτό το πεδίο δεν υποστηρίζεται — μπορείς να το βάλεις στις σημειώσεις.',
    };
  }

  // FIND-U: Block auto-setting taxOffice when vatNumber was updated in the same request.
  // AI tends to "guess" a DOY when given an AFM — this is wrong. DOY must be explicit user request.
  if (field === 'taxOffice') {
    const updatedFields = ctx._updatedContactFields?.get(contactId);
    if (updatedFields?.has('vatNumber')) {
      return {
        success: false,
        error: 'Δεν μπορείς να αλλάξεις τη ΔΟΥ αυτόματα μαζί με τον ΑΦΜ. Η ΔΟΥ ενημερώνεται ΜΟΝΟ αν ο χρήστης τη ζητήσει ρητά.',
      };
    }
  }

  const db = getAdminFirestore();
  const docSnap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
  if (!docSnap.exists) {
    return { success: false, error: `Η επαφή ${contactId} δεν βρέθηκε.` };
  }

  const existingData = docSnap.data() as Record<string, unknown>;

  // FIND-R: Block individual-only fields on company contacts
  if (existingData.type === 'company' && INDIVIDUAL_ONLY_FIELDS.includes(field)) {
    return {
      success: false,
      error: `Το πεδίο "${field}" αφορά μόνο φυσικά πρόσωπα, όχι εταιρείες.`,
    };
  }

  const { updateContactField, emitEntitySyncSignal } = await import(
    '@/services/ai-pipeline/shared/contact-lookup'
  );
  await updateContactField(contactId, field, value, buildAttribution(ctx));

  // Auto-sync displayName when name fields change
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

  // FIND-U: Track updated fields per contact for cross-field guardrails
  if (!ctx._updatedContactFields) {
    ctx._updatedContactFields = new Map();
  }
  if (!ctx._updatedContactFields.has(contactId)) {
    ctx._updatedContactFields.set(contactId, new Set());
  }
  ctx._updatedContactFields.get(contactId)!.add(field);

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
