/** CONTACT HANDLER — Create, append & update contact info + ESCO data */
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { toGreekTitleCase } from '@/utils/greek-text';
import { CONTACT_FIELD_TYPES, CONTACT_TYPES } from '../agentic-tool-definitions';
import type { ContactFieldType, ContactTypeEnum } from '../agentic-tool-definitions';
import type { SocialMediaInfo, AddressInfo } from '@/types/contacts/contracts';
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

// ============================================================================
// ENTITY-AWARE TYPE MAPS — Different types per contact entity (individual/company/service)
// SSoT: CommunicationConfigs.ts defines UI types; these maps resolve AI label→type
// ============================================================================

type ContactEntity = 'individual' | 'company' | 'service';

// ── PHONE TYPE MAPS ──
const PHONE_INDIVIDUAL_MAP: Record<string, string> = {
  'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
  'σπίτι': 'home', 'home': 'home',
  'κινητό': 'mobile', 'mobile': 'mobile',
  'σταθερό': 'home', 'landline': 'home',
  'fax': 'fax', 'φαξ': 'fax',
};
const PHONE_COMPANY_MAP: Record<string, string> = {
  'κύριο': 'main', 'main': 'main', 'κεντρικό': 'main', 'εργασία': 'main', 'work': 'main',
  'τμήμα': 'department', 'department': 'department',
  'γραμματεία': 'secretariat', 'secretariat': 'secretariat',
  'πωλήσεις': 'sales', 'sales': 'sales',
  'υποστήριξη': 'support', 'support': 'support',
  'fax': 'fax', 'φαξ': 'fax',
};
const PHONE_SERVICE_MAP: Record<string, string> = {
  'κύριο': 'main', 'main': 'main', 'κεντρικό': 'main', 'εργασία': 'main', 'work': 'main',
  'τμήμα': 'department', 'department': 'department',
  'γραμματεία': 'secretariat', 'secretariat': 'secretariat',
  'helpdesk': 'helpdesk', 'κέντρο': 'helpdesk',
  'fax': 'fax', 'φαξ': 'fax',
};

// ── EMAIL TYPE MAPS ──
const EMAIL_INDIVIDUAL_MAP: Record<string, string> = {
  'προσωπικό': 'personal', 'personal': 'personal', 'προσωπικά': 'personal',
  'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
};
const EMAIL_COMPANY_MAP: Record<string, string> = {
  'γενικό': 'general', 'general': 'general', 'εργασία': 'general', 'work': 'general',
  'τμήμα': 'department', 'department': 'department',
  'πωλήσεις': 'sales', 'sales': 'sales',
  'υποστήριξη': 'support', 'support': 'support',
  'πληροφορίες': 'info', 'info': 'info',
};
const EMAIL_SERVICE_MAP: Record<string, string> = {
  'γενικό': 'general', 'general': 'general', 'εργασία': 'general', 'work': 'general',
  'τμήμα': 'department', 'department': 'department',
  'γραμματεία': 'secretariat', 'secretariat': 'secretariat',
  'πληροφορίες': 'info', 'info': 'info',
};

// ── WEBSITE TYPE MAPS ──
const WEBSITE_INDIVIDUAL_MAP: Record<string, string> = {
  'personal': 'personal', 'προσωπικό': 'personal', 'προσωπική': 'personal',
  'company': 'company', 'εταιρικό': 'company', 'εταιρεία': 'company',
  'portfolio': 'portfolio', 'blog': 'blog',
};
const WEBSITE_COMPANY_MAP: Record<string, string> = {
  'εταιρική': 'corporate', 'corporate': 'corporate', 'εταιρικό': 'corporate',
  'company': 'corporate', 'personal': 'corporate',
  'eshop': 'eshop', 'e-shop': 'eshop', 'κατάστημα': 'eshop',
  'blog': 'blog', 'ιστολόγιο': 'blog',
};
const WEBSITE_SERVICE_MAP: Record<string, string> = {
  'επίσημη': 'official', 'official': 'official', 'personal': 'official', 'company': 'official',
  'eservices': 'eServices', 'ηλεκτρονικές': 'eServices',
  'portal': 'portal', 'πύλη': 'portal',
};

// ── SOCIAL MEDIA PLATFORM MAP (same for all entity types) ──
const SOCIAL_PLATFORM_MAP: Record<string, SocialMediaInfo['platform']> = {
  'facebook': 'facebook', 'fb': 'facebook',
  'twitter': 'twitter', 'x': 'twitter',
  'linkedin': 'linkedin',
  'instagram': 'instagram', 'insta': 'instagram',
  'youtube': 'youtube',
  'github': 'github',
  'tiktok': 'other',
  'whatsapp': 'other',
  'telegram': 'other',
};

// ── ENTITY-AWARE DEFAULTS ──
const PHONE_DEFAULTS: Record<ContactEntity, string> = {
  individual: 'mobile', company: 'main', service: 'main',
};
const EMAIL_DEFAULTS: Record<ContactEntity, string> = {
  individual: 'personal', company: 'general', service: 'general',
};
const WEBSITE_DEFAULTS: Record<ContactEntity, string> = {
  individual: 'personal', company: 'corporate', service: 'official',
};

// ── RESOLVER FUNCTIONS ──

function resolvePhoneType(label: string, entity: ContactEntity, phoneNumber: string): string {
  const map = entity === 'company' ? PHONE_COMPANY_MAP
    : entity === 'service' ? PHONE_SERVICE_MAP
    : PHONE_INDIVIDUAL_MAP;
  if (map[label]) return map[label];
  // Individual: auto-detect by Greek prefix (2xx = home/landline, 69x = mobile)
  if (entity === 'individual') {
    return phoneNumber.startsWith('2') ? 'home' : 'mobile';
  }
  return PHONE_DEFAULTS[entity];
}

function resolveEmailType(label: string, entity: ContactEntity): string {
  const map = entity === 'company' ? EMAIL_COMPANY_MAP
    : entity === 'service' ? EMAIL_SERVICE_MAP
    : EMAIL_INDIVIDUAL_MAP;
  return map[label] ?? EMAIL_DEFAULTS[entity];
}

function resolveWebsiteType(label: string, entity: ContactEntity): string {
  const map = entity === 'company' ? WEBSITE_COMPANY_MAP
    : entity === 'service' ? WEBSITE_SERVICE_MAP
    : WEBSITE_INDIVIDUAL_MAP;
  return map[label] ?? WEBSITE_DEFAULTS[entity];
}

/** Determine entity type from Firestore contact data */
function getContactEntity(contactData: Record<string, unknown>): ContactEntity {
  const t = String(contactData.type ?? 'individual');
  if (t === 'company') return 'company';
  if (t === 'service') return 'service';
  return 'individual';
}

/** Check if a label was resolved via an entity-aware map (to decide if label should be stored) */
function resolvedInMap(label: string, entity: ContactEntity, commType: 'phone' | 'email' | 'website'): boolean {
  const maps: Record<string, Record<ContactEntity, Record<string, string>>> = {
    phone: { individual: PHONE_INDIVIDUAL_MAP, company: PHONE_COMPANY_MAP, service: PHONE_SERVICE_MAP },
    email: { individual: EMAIL_INDIVIDUAL_MAP, company: EMAIL_COMPANY_MAP, service: EMAIL_SERVICE_MAP },
    website: { individual: WEBSITE_INDIVIDUAL_MAP, company: WEBSITE_COMPANY_MAP, service: WEBSITE_SERVICE_MAP },
  };
  return !!maps[commType][entity][label];
}

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

      // ADR-264: Auto-enrich from invoice entities (code-level guarantee — not prompt-dependent)
      try {
        const { autoEnrichFromInvoice } = await import('@/services/ai-pipeline/invoice-auto-enrichment');
        await autoEnrichFromInvoice(
          result.contactId,
          result.displayName,
          contactType,
          !!phone,
          !!email,
          ctx
        );
      } catch { /* non-fatal — contact is created, enrichment is best-effort */ }

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
    const entity = getContactEntity(contactData);

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
      const phoneType = resolvePhoneType(label, entity, cleanedPhone);
      const newEntry = {
        number: cleanedPhone,
        type: phoneType,
        isPrimary: false,
        ...(label && !resolvedInMap(label, entity, 'phone') ? { label } : {}),
      };
      updatePayload.phones = [...currentPhones, newEntry];
    } else if (fieldType === 'address') {
      const parsed = parseGreekAddress(value);
      const addressType = ADDRESS_LABEL_MAP[label] ?? (entity === 'individual' ? 'home' : 'work');
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
      const emailType = resolveEmailType(label, entity);
      const newEntry = {
        email: normalizedEmail,
        type: emailType,
        isPrimary: false,
        ...(label && !resolvedInMap(label, entity, 'email') ? { label } : {}),
      };
      updatePayload.emails = [...currentEmails, newEntry];
    } else if (fieldType === 'website') {
      const { isValidUrl } = await import('@/lib/validation/email-validation');
      const normalizedUrl = value.startsWith('http') ? value : `https://${value}`;
      if (!isValidUrl(normalizedUrl)) {
        return { success: false, error: `Μη έγκυρο URL: ${value}` };
      }
      const currentWebsites = (contactData.websites ?? []) as Array<{ url: string }>;
      if (currentWebsites.some(w => w.url === normalizedUrl)) {
        return { success: false, error: `Το website ${value} υπάρχει ήδη.` };
      }
      const websiteType = resolveWebsiteType(label, entity);
      const newEntry = {
        url: normalizedUrl,
        type: websiteType,
        ...(label && !resolvedInMap(label, entity, 'website') ? { label } : {}),
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
    const { executeUpdateContactField } = await import('./contact-field-update-handler');
    return executeUpdateContactField(args, ctx);
  }

  private async executeSetContactEsco(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const { executeSetContactEsco } = await import('./esco-write-handler');
    return executeSetContactEsco(args, ctx);
  }
}
