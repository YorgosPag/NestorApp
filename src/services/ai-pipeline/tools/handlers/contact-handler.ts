/** CONTACT HANDLER — Create, append & update contact info + ESCO data */
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { toGreekTitleCase } from '@/utils/greek-text';
import { CONTACT_FIELD_TYPES, CONTACT_TYPES, CONTACT_UPDATABLE_FIELDS } from '../agentic-tool-definitions';
import type { ContactFieldType, ContactTypeEnum, ContactUpdatableField } from '../agentic-tool-definitions';
import type { PhoneInfo, EmailInfo, SocialMediaInfo, AddressInfo, WebsiteInfo } from '@/types/contacts/contracts';
import { ADDRESS_LABEL_MAP, parseGreekAddress } from './address-parser';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  AI_ERRORS,
  auditWrite,
  buildAttribution,
  logger,
} from '../executor-shared';

// LABEL MAPS (SSoT for Greek↔English label resolution)
const PHONE_LABEL_MAP: Record<string, PhoneInfo['type']> = {
  'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
  'σπίτι': 'home', 'home': 'home',
  'κινητό': 'mobile', 'mobile': 'mobile',
  'σταθερό': 'home', 'landline': 'home',
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

const WEBSITE_TYPE_MAP: Record<string, WebsiteInfo['type']> = {
  'personal': 'personal', 'προσωπικό': 'personal', 'προσωπική': 'personal',
  'company': 'company', 'εταιρικό': 'company', 'εταιρεία': 'company', 'portfolio': 'portfolio', 'blog': 'blog',
};

// HANDLER

export class ContactHandler implements ToolHandler {
  readonly toolNames = [
    'create_contact', 'append_contact_info', 'update_contact_field', 'set_contact_esco',
  ] as const;

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
      case 'update_contact_field':
        return this.executeUpdateContactField(args, ctx);
      case 'set_contact_esco':
        return this.executeSetContactEsco(args, ctx);
      default:
        return { success: false, error: `Unknown contact tool: ${toolName}` };
    }
  }

  private async executeCreateContact(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Contact creation is restricted to admin only' };
    }

    const contactType = String(args.contactType ?? '').trim();
    const tc = contactType !== 'company'; // Title Case for individuals
    const firstName = tc ? toGreekTitleCase(String(args.firstName ?? '').trim()) : String(args.firstName ?? '').trim();
    const lastName = tc ? toGreekTitleCase(String(args.lastName ?? '').trim()) : String(args.lastName ?? '').trim();
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

    if (phone) {
      const { isValidPhone, cleanPhoneNumber } = await import('@/lib/validation/phone-validation');
      if (!isValidPhone(phone)) {
        return { success: false, error: `Μη έγκυρο τηλέφωνο: "${phone}". Αποδεκτά: 69XXXXXXXX, 2XXXXXXXXX, +XXXXXXXXXXX.` };
      }
      phone = cleanPhoneNumber(phone);
    }
    if (email) {
      const { isValidEmail } = await import('@/lib/validation/email-validation');
      if (!isValidEmail(email)) {
        return { success: false, error: `Μη έγκυρο email: "${email}".` };
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

      await auditWrite(ctx, COLLECTIONS.CONTACTS, result.contactId, 'create', { displayName: result.displayName, type: contactType });
      // FIND-K: Index for Global Search (non-fatal)
      try {
        const { indexContactForSearch } = await import('@/lib/search/search-indexer');
        await indexContactForSearch(result.contactId, { displayName: result.displayName, firstName, lastName, email, companyName, status: 'active' }, ctx.companyId);
      } catch { /* non-fatal */ }
      logger.info('Contact created', { contactId: result.contactId, displayName: result.displayName, type: contactType });

      return { success: true, data: { contactId: result.contactId, displayName: result.displayName, type: contactType }, count: 1 };
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

  private async executeAppendContactInfo(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    // Admin path: accept contactId from args (admin can append to ANY contact)
    // Customer path: use contactMeta (customer can only append to their OWN contact)
    const contactId = ctx.isAdmin
      ? String(args.contactId ?? '').trim()
      : ctx.contactMeta?.contactId ?? '';

    if (!contactId) {
      return {
        success: false,
        error: ctx.isAdmin
          ? 'contactId is required for admin append.'
          : AI_ERRORS.UNRECOGNIZED_USER,
      };
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
    const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
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
      // Phone type: label → map, else detect by Greek prefix (2xx = landline, 69x = mobile)
      const phoneType = PHONE_LABEL_MAP[label]
        ?? (cleanedPhone.startsWith('2') ? 'home' : 'mobile');
      const newEntry = {
        number: cleanedPhone,
        type: phoneType,
        isPrimary: false,
        ...(label && !PHONE_LABEL_MAP[label] ? { label } : {}),
      };
      updatePayload.phones = [...currentPhones, newEntry];
    } else if (fieldType === 'address') {
      const parsed = parseGreekAddress(value);
      const addressType = ADDRESS_LABEL_MAP[label] ?? 'home';
      const currentAddresses = (contactData.addresses ?? []) as AddressInfo[];
      const newAddress: AddressInfo = {
        ...parsed,
        type: addressType,
        isPrimary: currentAddresses.length === 0,
        country: parsed.country || 'GR',
      };
      updatePayload.addresses = [...currentAddresses, newAddress];
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
    } else if (fieldType === 'website') {
      // FIND-I: Write to dedicated websites[] array (WebsiteInfo shape)
      const { isValidUrl } = await import('@/lib/validation/email-validation');
      const normalizedUrl = value.startsWith('http') ? value : `https://${value}`;
      if (!isValidUrl(normalizedUrl)) {
        return { success: false, error: `Μη έγκυρο URL: ${value}` };
      }
      const currentWebsites = (contactData.websites ?? []) as Array<{ url: string }>;
      if (currentWebsites.some(w => w.url === normalizedUrl)) {
        return { success: false, error: `Το website ${value} υπάρχει ήδη.` };
      }
      const websiteType = WEBSITE_TYPE_MAP[label] ?? 'personal';
      const newEntry = {
        url: normalizedUrl,
        type: websiteType,
        ...(label && !WEBSITE_TYPE_MAP[label] ? { label } : {}),
      };
      updatePayload.websites = [...currentWebsites, newEntry];
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

    await db.collection(COLLECTIONS.CONTACTS).doc(contactId).update(updatePayload);

    await auditWrite(ctx, COLLECTIONS.CONTACTS, contactId, 'append', updatePayload);

    const { emitEntitySyncSignal } = await import(
      '@/services/ai-pipeline/shared/contact-lookup'
    );
    emitEntitySyncSignal('contacts', 'UPDATED', contactId, ctx.companyId);

    logger.info('Contact info appended', {
      contactId,
      fieldType,
      requestId: ctx.requestId,
    });

    return {
      success: true,
      data: { contactId, fieldType, value, added: true },
      count: 1,
    };
  }

  private async executeUpdateContactField(
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

    // ESCO-protected fields — MUST go through set_contact_esco (server-side enforcement)
    const ESCO_PROTECTED = ['profession', 'escoUri', 'escoLabel', 'iscoCode', 'escoSkills'];
    if (ESCO_PROTECTED.includes(field)) {
      return {
        success: false,
        error: `Το πεδίο "${field}" προστατεύεται — χρησιμοποίησε set_contact_esco αντί update_contact_field.`,
      };
    }

    // Verify the contact exists
    const db = getAdminFirestore();
    const docSnap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
    if (!docSnap.exists) {
      return { success: false, error: `Η επαφή ${contactId} δεν βρέθηκε.` };
    }

    const { updateContactField, emitEntitySyncSignal } = await import(
      '@/services/ai-pipeline/shared/contact-lookup'
    );
    await updateContactField(contactId, field, value, buildAttribution(ctx));
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

  private async executeSetContactEsco(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const { executeSetContactEsco } = await import('./esco-write-handler');
    return executeSetContactEsco(args, ctx);
  }
}
