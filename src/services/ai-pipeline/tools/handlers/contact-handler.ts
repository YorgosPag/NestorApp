/**
 * =============================================================================
 * CONTACT HANDLER — Create & Append Contact Info
 * =============================================================================
 *
 * Tools:
 * - create_contact: Enterprise-grade contact creation with duplicate detection
 * - append_contact_info: Append phone/email/social to own contact (APPEND-ONLY)
 *
 * @module services/ai-pipeline/tools/handlers/contact-handler
 * @see ADR-171 (Autonomous AI Agent)
 * @see SPEC-257E (Append-Only Contact Updates)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { CONTACT_FIELD_TYPES, CONTACT_TYPES } from '../agentic-tool-definitions';
import type { ContactFieldType, ContactTypeEnum } from '../agentic-tool-definitions';
import type { PhoneInfo, EmailInfo, SocialMediaInfo } from '@/types/contacts/contracts';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  AI_ERRORS,
  auditWrite,
  buildAttribution,
  logger,
} from '../executor-shared';

// ============================================================================
// LABEL MAPS (SSoT for Greek↔English label resolution)
// ============================================================================

const PHONE_LABEL_MAP: Record<string, PhoneInfo['type']> = {
  'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
  'σπίτι': 'home', 'home': 'home',
  'κινητό': 'mobile', 'mobile': 'mobile',
  'fax': 'fax', 'φαξ': 'fax',
};

const EMAIL_LABEL_MAP: Record<string, EmailInfo['type']> = {
  'προσωπικό': 'personal', 'personal': 'personal', 'προσωπικά': 'personal',
  'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
};

const SOCIAL_PLATFORM_MAP: Record<string, SocialMediaInfo['platform']> = {
  'facebook': 'facebook', 'fb': 'facebook',
  'twitter': 'twitter', 'x': 'twitter',
  'linkedin': 'linkedin',
  'instagram': 'instagram', 'insta': 'instagram',
  'youtube': 'youtube',
  'github': 'github',
};

// ============================================================================
// HANDLER
// ============================================================================

export class ContactHandler implements ToolHandler {
  readonly toolNames = ['create_contact', 'append_contact_info'] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'create_contact':
        return this.executeCreateContact(args, ctx);
      case 'append_contact_info':
        return this.executeAppendContactInfo(args, ctx);
      default:
        return { success: false, error: `Unknown contact tool: ${toolName}` };
    }
  }

  // --------------------------------------------------------------------------
  // create_contact
  // --------------------------------------------------------------------------

  private async executeCreateContact(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Contact creation is restricted to admin only' };
    }

    const contactType = String(args.contactType ?? '').trim();
    const firstName = String(args.firstName ?? '').trim();
    const lastName = String(args.lastName ?? '').trim();
    const companyName = args.companyName ? String(args.companyName).trim() : null;
    const email = args.email ? String(args.email).trim().toLowerCase() : null;
    let phone = args.phone ? String(args.phone).trim() : null;
    const skipDuplicateCheck = args.skipDuplicateCheck === true;

    if (!CONTACT_TYPES.includes(contactType as ContactTypeEnum)) {
      return { success: false, error: `contactType must be one of: ${CONTACT_TYPES.join(', ')}` };
    }

    if (contactType === 'individual' && (!firstName || !lastName)) {
      return { success: false, error: 'firstName and lastName are required for individual contacts' };
    }

    if (contactType === 'company' && !companyName) {
      return { success: false, error: 'companyName is required for company contacts' };
    }

    // Validate phone & email format (SSoT validators)
    if (phone) {
      const { isValidPhone, cleanPhoneNumber } = await import('@/lib/validation/phone-validation');
      if (!isValidPhone(phone)) {
        return {
          success: false,
          error: `Μη έγκυρο τηλέφωνο: "${phone}". Αποδεκτά: ελληνικό κινητό (69XXXXXXXX — 10 ψηφία), σταθερό (2XXXXXXXXX — 10 ψηφία) ή διεθνές (+XXXXXXXXXXX). Ζήτα από τον χρήστη να δώσει ξανά τον αριθμό.`,
        };
      }
      phone = cleanPhoneNumber(phone);
    }
    if (email) {
      const { isValidEmail } = await import('@/lib/validation/email-validation');
      if (!isValidEmail(email)) {
        return {
          success: false,
          error: `Μη έγκυρο email: "${email}". Ζήτα από τον χρήστη να δώσει ξανά τη σωστή διεύθυνση.`,
        };
      }
    }

    // Delegate to createContactServerSide (SSoT)
    try {
      const { createContactServerSide } = await import(
        '@/services/ai-pipeline/shared/contact-lookup'
      );

      const result = await createContactServerSide({
        firstName,
        lastName,
        email,
        phone,
        type: contactType as 'individual' | 'company',
        companyId: ctx.companyId,
        companyName: companyName ?? undefined,
        createdBy: buildAttribution(ctx),
        skipDuplicateCheck,
      });

      await auditWrite(ctx, COLLECTIONS.CONTACTS, result.contactId, 'create', {
        displayName: result.displayName,
        type: contactType,
      });

      logger.info('Contact created via dedicated tool', {
        contactId: result.contactId,
        displayName: result.displayName,
        type: contactType,
      });

      return {
        success: true,
        data: {
          contactId: result.contactId,
          displayName: result.displayName,
          type: contactType,
        },
        count: 1,
      };
    } catch (err) {
      const errorMsg = getErrorMessage(err);

      if (errorMsg.includes('DUPLICATE_CONTACT')) {
        const jsonSeparator = errorMsg.indexOf('|||');
        let duplicateMatches: Array<Record<string, unknown>> = [];
        if (jsonSeparator !== -1) {
          try {
            duplicateMatches = JSON.parse(errorMsg.slice(jsonSeparator + 3)) as Array<Record<string, unknown>>;
          } catch {
            // Fallback: no structured data
          }
        }

        logger.info('Duplicate contact detected — returning to AI for user decision', {
          firstName, lastName, phone, email, matchCount: duplicateMatches.length,
        });

        return {
          success: false,
          data: {
            duplicateDetected: true,
            matches: duplicateMatches,
            requestedContact: { firstName, lastName, email, phone, contactType },
            suggestedActions: [
              'Περίγραψε τα ταυτόσημα αποτελέσματα στον χρήστη. ΜΗΝ δώσεις αριθμημένες επιλογές — τα κουμπιά θα σταλούν αυτόματα μέσω Telegram inline keyboard.',
            ],
          },
          error: duplicateMatches.length > 0
            ? `Βρέθηκαν ${duplicateMatches.length} πιθανές ταυτόσημες επαφές. Ζήτα οδηγίες από τον χρήστη πριν προχωρήσεις.`
            : errorMsg,
        };
      }

      logger.error('Failed to create contact', { error: errorMsg });
      return { success: false, error: `Αποτυχία δημιουργίας επαφής: ${errorMsg}` };
    }
  }

  // --------------------------------------------------------------------------
  // append_contact_info
  // --------------------------------------------------------------------------

  private async executeAppendContactInfo(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const contact = ctx.contactMeta;
    if (!contact?.contactId) {
      return { success: false, error: AI_ERRORS.UNRECOGNIZED_USER };
    }

    const fieldType = String(args.fieldType ?? '');
    const value = String(args.value ?? '').trim();
    const label = String(args.label ?? '').trim().toLowerCase();

    if (!CONTACT_FIELD_TYPES.includes(fieldType as ContactFieldType)) {
      return { success: false, error: `fieldType must be one of: ${CONTACT_FIELD_TYPES.join(', ')}` };
    }
    if (!value) {
      return { success: false, error: 'value is required' };
    }

    // Validate value format (SSoT validators)
    if (fieldType === 'phone') {
      const { isValidPhone } = await import('@/lib/validation/phone-validation');
      if (!isValidPhone(value)) {
        return { success: false, error: `Μη έγκυρο τηλέφωνο: "${value}". Αποδεκτά: ελληνικό (69XXXXXXXX, 2XXXXXXXXX) ή διεθνές (+XXXXXXXXXXX).` };
      }
    } else if (fieldType === 'email') {
      const { isValidEmail } = await import('@/lib/validation/email-validation');
      if (!isValidEmail(value)) {
        return { success: false, error: `Μη έγκυρο email: "${value}".` };
      }
    }

    const db = getAdminFirestore();
    const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(contact.contactId).get();
    if (!contactDoc.exists) {
      return { success: false, error: 'Η επαφή δεν βρέθηκε.' };
    }
    const contactData = contactDoc.data() as Record<string, unknown>;

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      lastModifiedBy: buildAttribution(ctx),
    };

    if (fieldType === 'phone') {
      const { cleanPhoneNumber } = await import('@/lib/validation/phone-validation');
      const cleanedPhone = cleanPhoneNumber(value);
      const currentPhones = (contactData.phones ?? []) as Array<{ number: string }>;
      if (currentPhones.some(p => cleanPhoneNumber(p.number) === cleanedPhone)) {
        return { success: false, error: `Το τηλέφωνο ${value} υπάρχει ήδη.` };
      }
      const phoneType = PHONE_LABEL_MAP[label] ?? 'mobile';
      const newEntry = {
        number: cleanedPhone,
        type: phoneType,
        isPrimary: false,
        ...(label && !PHONE_LABEL_MAP[label] ? { label } : {}),
      };
      updatePayload.phones = [...currentPhones, newEntry];
    } else if (fieldType === 'email') {
      const normalizedEmail = value.toLowerCase().trim();
      const currentEmails = (contactData.emails ?? []) as Array<{ email: string }>;
      if (currentEmails.some(e => e.email.toLowerCase() === normalizedEmail)) {
        return { success: false, error: `Το email ${value} υπάρχει ήδη.` };
      }
      const emailType = EMAIL_LABEL_MAP[label] ?? 'personal';
      const newEntry = {
        email: normalizedEmail,
        type: emailType,
        isPrimary: false,
        ...(label && !EMAIL_LABEL_MAP[label] ? { label } : {}),
      };
      updatePayload.emails = [...currentEmails, newEntry];
    } else {
      // social
      const currentSocial = (contactData.socialMedia ?? []) as Array<{ username: string; url?: string }>;
      if (currentSocial.some(s => s.username === value || s.url === value)) {
        return { success: false, error: `Το social media ${value} υπάρχει ήδη.` };
      }
      const platform = SOCIAL_PLATFORM_MAP[label] ?? 'other';
      const { isValidUrl } = await import('@/lib/validation/email-validation');
      const newEntry = {
        platform,
        username: value,
        ...(isValidUrl(value) ? { url: value } : {}),
        ...(label && !SOCIAL_PLATFORM_MAP[label] ? { label } : {}),
      };
      updatePayload.socialMedia = [...currentSocial, newEntry];
    }

    await db.collection(COLLECTIONS.CONTACTS).doc(contact.contactId).update(updatePayload);

    await auditWrite(ctx, COLLECTIONS.CONTACTS, contact.contactId, 'append', updatePayload);

    const { emitEntitySyncSignal } = await import(
      '@/services/ai-pipeline/shared/contact-lookup'
    );
    emitEntitySyncSignal('contacts', 'UPDATED', contact.contactId, ctx.companyId);

    logger.info('Contact info appended', {
      contactId: contact.contactId,
      fieldType,
      requestId: ctx.requestId,
    });

    return {
      success: true,
      data: { contactId: contact.contactId, fieldType, value, added: true },
      count: 1,
    };
  }
}
