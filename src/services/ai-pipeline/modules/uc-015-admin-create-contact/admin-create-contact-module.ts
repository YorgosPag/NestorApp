/**
 * =============================================================================
 * UC-015: ADMIN CREATE CONTACT MODULE — ADR-145
 * =============================================================================
 *
 * Super admin command: "Δημιούργησε επαφή Νέστορας Παγώνης, nestoras@gmail.com"
 * Parses name, checks duplicate by email, creates contact in Firestore.
 *
 * @module services/ai-pipeline/modules/uc-015-admin-create-contact
 * @see ADR-145 (Super Admin AI Assistant)
 */

import 'server-only';

import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  findContactByEmail,
  createContactServerSide,
  getContactMissingFields,
  type ContactMatch,
  type CreateContactParams,
} from '../../shared/contact-lookup';
import { sendChannelReply } from '../../shared/channel-reply-dispatcher';
import { setAdminSession, buildAdminIdentifier } from '../../shared/admin-session';
import { PipelineIntentType } from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';

const logger = createModuleLogger('UC_015_ADMIN_CREATE_CONTACT');

// ============================================================================
// TYPES
// ============================================================================

interface CreateContactLookupData {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  contactType: 'individual' | 'company';
  companyId: string;
  duplicateContact: ContactMatch | null;
}

// ============================================================================
// MODULE
// ============================================================================

export class AdminCreateContactModule implements IUCModule {
  readonly moduleId = 'UC-015';
  readonly displayName = 'Admin: Δημιουργία Επαφής';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.ADMIN_CREATE_CONTACT,
  ];
  readonly requiredRoles: readonly string[] = [];

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    // NOTE: OpenAI structured output schema (extractedEntities) only supports
    // companyId/projectId/buildingId/unitId/contactId with additionalProperties: false.
    // Admin-specific entities (contactName, email, phone) are NOT available via
    // ctx.understanding.entities. We parse them from the raw message text instead.
    const rawMessage = ctx.intake.normalized.contentText ?? '';

    // Extract email from message (regex)
    const email = extractEmail(rawMessage);

    // Extract phone from message (regex)
    const phone = extractPhone(rawMessage);

    // Extract name: strip command keywords, email, phone → remaining text is the name
    const { firstName, lastName } = extractNameFromMessage(rawMessage, email, phone);

    // Extract contact type (default: individual)
    const lowerMsg = rawMessage.toLowerCase();
    const contactType: 'individual' | 'company' =
      lowerMsg.includes('εταιρεία') || lowerMsg.includes('εταιρία') || lowerMsg.includes('company')
        ? 'company'
        : 'individual';

    logger.info('UC-015 LOOKUP: Parsed contact data from raw message', {
      requestId: ctx.requestId,
      firstName,
      lastName,
      email,
      phone,
      contactType,
      rawMessage,
    });

    // Duplicate check by email
    let duplicateContact: ContactMatch | null = null;
    if (email) {
      try {
        duplicateContact = await findContactByEmail(email, ctx.companyId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('UC-015 LOOKUP: Duplicate check failed', {
          requestId: ctx.requestId,
          error: msg,
        });
      }
    }

    const lookupData: CreateContactLookupData = {
      firstName,
      lastName,
      email,
      phone,
      contactType,
      companyId: ctx.companyId,
      duplicateContact,
    };

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as CreateContactLookupData | undefined;
    const duplicate = lookup?.duplicateContact;

    const displayName = `${lookup?.firstName ?? ''} ${lookup?.lastName ?? ''}`.trim() || 'Χωρίς όνομα';
    const emailLabel = lookup?.email ? ` (${lookup.email})` : '';

    const summary = duplicate
      ? `Υπάρχει ήδη επαφή "${duplicate.name}" με email ${lookup?.email ?? ''} (ID: ${duplicate.contactId})`
      : `Δημιουργία επαφής: ${displayName}${emailLabel}`;

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_create_contact_action',
          params: {
            firstName: lookup?.firstName ?? null,
            lastName: lookup?.lastName ?? null,
            email: lookup?.email ?? null,
            phone: lookup?.phone ?? null,
            contactType: lookup?.contactType ?? 'individual',
            companyId: lookup?.companyId ?? ctx.companyId,
            duplicateContactId: duplicate?.contactId ?? null,
            duplicateContactName: duplicate?.name ?? null,
            channel: ctx.intake.channel,
            telegramChatId: (ctx.intake.rawPayload.chatId as string) ?? null,
          },
        },
      ],
      requiredApprovals: [],
      autoApprovable: true,
      summary,
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // ── Step 6: EXECUTE ──

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    try {
      const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
      const action = actions.find(a => a.type === 'admin_create_contact_action');

      if (!action) {
        return { success: false, sideEffects: [], error: 'No admin_create_contact_action found' };
      }

      const params = action.params;
      const duplicateContactId = params.duplicateContactId as string | null;
      const duplicateContactName = params.duplicateContactName as string | null;
      const firstName = (params.firstName as string) ?? '';
      const lastName = (params.lastName as string) ?? '';
      const email = params.email as string | null;
      const phone = params.phone as string | null;
      const contactType = (params.contactType as string) ?? 'individual';

      const telegramChatId = (params.telegramChatId as string)
        ?? (ctx.intake.rawPayload.chatId as string)
        ?? ctx.intake.normalized.sender.telegramId
        ?? undefined;

      // ── Case 1: Duplicate found ──
      if (duplicateContactId) {
        const dupMsg = `Υπάρχει ήδη επαφή "${duplicateContactName ?? ''}" με email ${email ?? ''} (ID: ${duplicateContactId}). Δεν δημιουργήθηκε νέα επαφή.`;

        await sendChannelReply({
          channel: ctx.intake.channel,
          recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
          telegramChatId: telegramChatId ?? undefined,
          subject: 'Διπλότυπη επαφή',
          textBody: dupMsg,
          requestId: ctx.requestId,
        });

        return {
          success: true,
          sideEffects: [`contact_exists:${duplicateContactId}`],
        };
      }

      // ── Case 2: Create new contact ──
      const adminName = ctx.adminCommandMeta?.adminIdentity.displayName ?? 'Admin';

      const createParams: CreateContactParams = {
        firstName,
        lastName,
        email,
        phone,
        type: contactType === 'company' ? 'company' : 'individual',
        companyId: ctx.companyId,
        createdBy: adminName,
      };

      const result = await createContactServerSide(createParams);

      const sideEffects: string[] = [`contact_created:${result.contactId}`];

      logger.info('UC-015 EXECUTE: Contact created', {
        requestId: ctx.requestId,
        contactId: result.contactId,
        displayName: result.displayName,
      });

      // ── Smart Confirmation: Show missing fields + suggested commands ──
      const missingFields = await getContactMissingFields(
        result.contactId,
        contactType === 'company' ? 'company' : 'individual'
      );

      const confirmLines: string[] = [
        `✅ Η επαφή δημιουργήθηκε: ${result.displayName}${email ? ` (${email})` : ''} — ID: ${result.contactId}`,
      ];

      if (missingFields.length > 0) {
        confirmLines.push('');
        confirmLines.push('📋 Ελλιπή στοιχεία:');
        for (const field of missingFields) {
          confirmLines.push(`  • ${field}`);
        }
        confirmLines.push('');
        confirmLines.push('Μπορείτε να συμπληρώσετε:');
        // Show contextual examples based on missing fields
        const firstName = createParams.firstName || result.displayName.split(' ')[0];
        if (missingFields.includes('Τηλέφωνο')) {
          confirmLines.push(`  "Πρόσθεσε τηλέφωνο 69... στον ${firstName}"`);
        }
        if (missingFields.includes('ΑΦΜ')) {
          confirmLines.push(`  "Βάλε ΑΦΜ 123456789 στον ${firstName}"`);
        }
        if (missingFields.includes('Επάγγελμα')) {
          confirmLines.push(`  "Επάγγελμα ${firstName}: Μηχανικός"`);
        }
        if (missingFields.includes('Διεύθυνση')) {
          confirmLines.push(`  "Διεύθυνση ${firstName}: Ερμού 10, Αθήνα"`);
        }
      }

      const confirmText = confirmLines.join('\n');

      const confirmResult = await sendChannelReply({
        channel: ctx.intake.channel,
        recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
        telegramChatId: telegramChatId ?? undefined,
        subject: 'Νέα επαφή δημιουργήθηκε',
        textBody: confirmText,
        requestId: ctx.requestId,
      });

      if (confirmResult.success) {
        sideEffects.push(`confirm_sent:${confirmResult.messageId ?? 'unknown'}`);
      }

      // ── Write admin session for conversational context ──
      const adminIdentifier = buildAdminIdentifier(
        ctx.intake.channel,
        ctx.intake.normalized.sender
      );
      await setAdminSession(adminIdentifier, {
        type: 'create_contact',
        contactId: result.contactId,
        contactName: result.displayName,
        timestamp: new Date().toISOString(),
      });

      return { success: true, sideEffects };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('UC-015 EXECUTE: Failed', { requestId: ctx.requestId, error: errorMessage });

      // If it's a duplicate error from createContactServerSide, notify admin
      if (errorMessage.startsWith('DUPLICATE_CONTACT:')) {
        const telegramChatId = (ctx.intake.rawPayload.chatId as string)
          ?? ctx.intake.normalized.sender.telegramId
          ?? undefined;

        await sendChannelReply({
          channel: ctx.intake.channel,
          recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
          telegramChatId: telegramChatId ?? undefined,
          subject: 'Διπλότυπη επαφή',
          textBody: errorMessage.replace('DUPLICATE_CONTACT: ', ''),
          requestId: ctx.requestId,
        });

        return { success: true, sideEffects: ['contact_duplicate_detected'] };
      }

      return { success: false, sideEffects: [], error: errorMessage };
    }
  }

  // ── Step 7: ACKNOWLEDGE ──

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    const confirmSent = ctx.executionResult?.sideEffects?.some(
      (se: string) => se.startsWith('confirm_sent:') || se.startsWith('contact_created:')
    ) ?? false;
    return { sent: confirmSent, channel: ctx.intake.channel };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// ============================================================================
// HELPERS: Raw Message Parsing
// ============================================================================

/** Email regex — matches standard email addresses */
const EMAIL_REGEX = /[\w.+-]+@[\w.-]+\.\w{2,}/;

/** Greek phone regex — matches 69XXXXXXXX, +3069XXXXXXXX, 210XXXXXXX etc. */
const PHONE_REGEX = /(?:\+30)?(?:\s?)(?:69\d{8}|2\d{9})/;

/** Command keywords to strip when extracting the contact name */
const COMMAND_KEYWORDS = [
  'δημιούργησε επαφή',
  'δημιουργησε επαφη',
  'πρόσθεσε επαφή',
  'προσθεσε επαφη',
  'νέα επαφή',
  'νεα επαφη',
  'κάνε νέα επαφή',
  'κανε νεα επαφη',
  'φτιάξε επαφή',
  'φτιαξε επαφη',
  'create contact',
  'add contact',
  'new contact',
];

/**
 * Extract email address from raw message text.
 * @example extractEmail("Νέστορας nestoras@gmail.com") → "nestoras@gmail.com"
 */
function extractEmail(message: string): string | null {
  const match = message.match(EMAIL_REGEX);
  return match ? match[0].toLowerCase().trim() : null;
}

/**
 * Extract phone number from raw message text.
 * @example extractPhone("Νέστορας 6971234567") → "6971234567"
 */
function extractPhone(message: string): string | null {
  const match = message.match(PHONE_REGEX);
  return match ? match[0].replace(/\s/g, '').trim() : null;
}

/**
 * Extract contact name from raw message by stripping command keywords, email, and phone.
 *
 * @example
 * extractNameFromMessage("Δημιούργησε επαφή Νέστορας Παγώνης, nestoras@gmail.com", "nestoras@gmail.com", null)
 * → { firstName: "Νέστορας", lastName: "Παγώνης" }
 */
function extractNameFromMessage(
  message: string,
  email: string | null,
  phone: string | null
): { firstName: string; lastName: string } {
  let cleaned = message;

  // Strip command keywords (case-insensitive)
  for (const keyword of COMMAND_KEYWORDS) {
    const regex = new RegExp(keyword, 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // Strip email
  if (email) {
    cleaned = cleaned.replace(email, '');
  }

  // Strip phone
  if (phone) {
    cleaned = cleaned.replace(phone, '');
  }

  // Strip punctuation (commas, colons, dashes) and extra whitespace
  cleaned = cleaned
    .replace(/[,;:\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Parse remaining text as name
  return parseName(cleaned);
}

/**
 * Parse a full name string into firstName and lastName.
 * Handles Greek and Latin names. Last token = lastName, rest = firstName.
 *
 * @example parseName("Νέστορας Παγώνης") → { firstName: "Νέστορας", lastName: "Παγώνης" }
 * @example parseName("Γιώργος") → { firstName: "Γιώργος", lastName: "" }
 */
function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  // Last token is lastName, rest is firstName
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');

  return { firstName, lastName };
}
