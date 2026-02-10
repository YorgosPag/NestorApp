/**
 * =============================================================================
 * UC-012: ADMIN SEND EMAIL MODULE — ADR-145
 * =============================================================================
 *
 * Super admin command: "Στείλε email στον Κώστα ότι μετακινείται το ραντεβού"
 * Finds contact by name, composes email, sends via Mailgun.
 *
 * @module services/ai-pipeline/modules/uc-012-admin-send-email
 * @see ADR-145 (Super Admin AI Assistant)
 */

import 'server-only';

import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { findContactByName, type ContactNameSearchResult } from '../../shared/contact-lookup';
import { sendChannelReply } from '../../shared/channel-reply-dispatcher';
import { sendReplyViaMailgun } from '../../shared/mailgun-sender';
import { PipelineIntentType } from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';

const logger = createModuleLogger('UC_012_ADMIN_SEND_EMAIL');

// ============================================================================
// TYPES
// ============================================================================

interface SendEmailLookupData {
  recipientName: string;
  emailContent: string;
  targetContact: ContactNameSearchResult | null;
  companyId: string;
  /** Explicit email from command (e.g. "στείλε στο georgios@example.com") overrides contact email */
  overrideRecipientEmail: string | null;
}

// ============================================================================
// CONTACT CARD PATTERN — Compound command detection
// ============================================================================

/**
 * Detects "στοιχεία του/της X" pattern in email content.
 * Returns the name of the contact whose details are requested, or null.
 *
 * Matches:
 *   "τα στοιχεία του Γιάννη"
 *   "στοιχεία της Σοφίας"
 *   "πληροφορίες για τον Κώστα"
 *   "τα δεδομένα επαφής Νίκου"
 *
 * NOTE: Capture limited to 1-2 words to avoid greedy matching past conjunctions.
 */
const CONTACT_CARD_PATTERN = /(?:στοιχεί|επαφ|πληροφορ|δεδομέν)(?:α|ές|ων|ής)?\s+(?:του|της|τον|την|για τον|για την|επαφής)\s+([\p{L}]+(?:\s[\p{L}]+)?)/iu;

/**
 * Detects compound "find contact + send" commands.
 *
 * Matches:
 *   "Βρες την επαφή της σοφίας και στείλε την..."
 *   "Βρείτε τα στοιχεία του Κώστα και στείλε τα..."
 *   "Βρες την επαφή σοφίας και στείλε..."
 */
const COMPOUND_FIND_SEND_PATTERN = /βρ(?:ες|είτε)\s+(?:την?\s+)?(?:επαφ[ήέ]|στοιχεί[αά])\s+(?:του|της|τον|την)?\s*([\p{L}]+(?:\s[\p{L}]+)?)\s+και\s+στείλ/iu;

/** Extract an explicit email address from raw text */
const EXPLICIT_EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.\w{2,}/i;

/**
 * Format a contact's details as a readable card (plain text).
 */
function formatContactCard(contact: ContactNameSearchResult): string {
  const lines: string[] = [`Στοιχεία επαφής: ${contact.name}`];

  if (contact.email) lines.push(`Email: ${contact.email}`);
  if (contact.phone) lines.push(`Τηλέφωνο: ${contact.phone}`);
  if (contact.company) lines.push(`Εταιρεία: ${contact.company}`);
  if (contact.type) lines.push(`Τύπος: ${contact.type}`);

  return lines.join('\n');
}

// ============================================================================
// MODULE
// ============================================================================

export class AdminSendEmailModule implements IUCModule {
  readonly moduleId = 'UC-012';
  readonly displayName = 'Admin: Αποστολή Email';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.ADMIN_SEND_EMAIL,
  ];
  readonly requiredRoles: readonly string[] = [];

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    let recipientName = (ctx.understanding?.entities?.recipientName as string) ?? '';
    let emailContent = (ctx.understanding?.entities?.emailContent as string)
      ?? ctx.intake.normalized.contentText ?? '';

    const rawMessage = ctx.intake.normalized.contentText ?? '';

    // Fallback: if AI didn't extract entities (schema mismatch), parse from raw message
    if (!recipientName && rawMessage) {
      recipientName = extractRecipientFromMessage(rawMessage);
    }
    if (!emailContent && rawMessage) {
      emailContent = extractEmailContentFromMessage(rawMessage);
    }
    // Last resort: use raw message as email content
    if (!emailContent) {
      emailContent = rawMessage;
    }

    const entitySource = (ctx.understanding?.entities?.recipientName) ? 'ai' : 'fallback';

    logger.info('UC-012 LOOKUP: Finding recipient contact', {
      requestId: ctx.requestId,
      recipientName,
      entitySource,
    });

    let targetContact: ContactNameSearchResult | null = null;
    if (recipientName.length > 0) {
      try {
        const results = await findContactByName(recipientName, ctx.companyId, 1);
        targetContact = results.length > 0 ? results[0] : null;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('UC-012 LOOKUP: Contact search failed', {
          requestId: ctx.requestId,
          error: msg,
        });
      }
    }

    // ── Extract explicit email from command (e.g. "στο georgios@example.com") ──
    let overrideRecipientEmail: string | null = null;
    const explicitEmailMatch = rawMessage.match(EXPLICIT_EMAIL_PATTERN);
    if (explicitEmailMatch) {
      overrideRecipientEmail = explicitEmailMatch[0];
      logger.info('UC-012 LOOKUP: Explicit recipient email found in command', {
        requestId: ctx.requestId,
        overrideRecipientEmail,
      });
    }

    // ── Contact card: AI extracts includeContactCardOf via tool calling ──
    const includeCardOfEntity = (ctx.understanding?.entities?.includeContactCardOf as string) ?? null;

    if (includeCardOfEntity) {
      // AI-extracted entity — no regex needed
      try {
        const cardResults = await findContactByName(includeCardOfEntity, ctx.companyId, 1);
        if (cardResults.length > 0) {
          emailContent = formatContactCard(cardResults[0]);
          logger.info('UC-012 LOOKUP: Contact card via AI entity', {
            requestId: ctx.requestId,
            includeCardOf: includeCardOfEntity,
            resolvedName: cardResults[0].name,
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('UC-012 LOOKUP: Contact card AI entity lookup failed', {
          requestId: ctx.requestId,
          includeCardOf: includeCardOfEntity,
          error: msg,
        });
      }
    } else {
      // ── Fallback: regex-based compound command detection ──
      const compoundMatch = rawMessage.match(COMPOUND_FIND_SEND_PATTERN);
      if (compoundMatch?.[1]) {
        const compoundContactName = compoundMatch[1].trim();
        try {
          const compoundResults = await findContactByName(compoundContactName, ctx.companyId, 1);
          if (compoundResults.length > 0) {
            emailContent = formatContactCard(compoundResults[0]);
            if (!targetContact) {
              targetContact = compoundResults[0];
            }
            logger.info('UC-012 LOOKUP: Compound find+send — contact card resolved (regex fallback)', {
              requestId: ctx.requestId,
              compoundContactName,
              resolvedName: compoundResults[0].name,
            });
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.warn('UC-012 LOOKUP: Compound find+send lookup failed', {
            requestId: ctx.requestId,
            compoundContactName,
            error: msg,
          });
        }
      } else {
        // ── Fallback: "στοιχεία του/της X" pattern ──
        const cardMatch = emailContent.match(CONTACT_CARD_PATTERN);
        if (cardMatch?.[1]) {
          const cardContactName = cardMatch[1].trim();
          try {
            const cardResults = await findContactByName(cardContactName, ctx.companyId, 1);
            if (cardResults.length > 0) {
              emailContent = formatContactCard(cardResults[0]);
              logger.info('UC-012 LOOKUP: Contact card pattern resolved (regex fallback)', {
                requestId: ctx.requestId,
                cardContactName,
                resolvedName: cardResults[0].name,
              });
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.warn('UC-012 LOOKUP: Contact card lookup failed', {
              requestId: ctx.requestId,
              cardContactName,
              error: msg,
            });
          }
        }
      }
    }

    const lookupData: SendEmailLookupData = {
      recipientName,
      emailContent,
      targetContact,
      companyId: ctx.companyId,
      overrideRecipientEmail,
    };

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as SendEmailLookupData | undefined;
    const contact = lookup?.targetContact;

    // Explicit email from command overrides contact's email
    const resolvedEmail = lookup?.overrideRecipientEmail ?? contact?.email ?? null;
    const resolvedName = lookup?.recipientName || contact?.name || '';

    const summary = resolvedEmail
      ? `Αποστολή email στον ${resolvedName} (${resolvedEmail})`
      : `Δεν βρέθηκε email για "${resolvedName}"`;

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_send_email_action',
          params: {
            recipientName: resolvedName || null,
            recipientEmail: resolvedEmail,
            recipientContactId: contact?.contactId ?? null,
            emailContent: lookup?.emailContent ?? null,
            contactFound: contact !== null,
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
      const action = actions.find(a => a.type === 'admin_send_email_action');

      if (!action) {
        return { success: false, sideEffects: [], error: 'No admin_send_email_action found' };
      }

      const params = action.params;
      const recipientEmail = params.recipientEmail as string | null;
      const recipientName = (params.recipientName as string) ?? '';
      const emailContent = (params.emailContent as string) ?? '';

      // If no email found, notify admin
      if (!recipientEmail) {
        const noEmailMsg = `Δεν βρέθηκε email για "${recipientName}". Ελέγξτε τα στοιχεία της επαφής.`;

        const telegramChatId = (params.telegramChatId as string)
          ?? (ctx.intake.rawPayload.chatId as string)
          ?? (ctx.intake.normalized.sender.telegramId)
          ?? undefined;

        await sendChannelReply({
          channel: ctx.intake.channel,
          recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
          telegramChatId: telegramChatId ?? undefined,
          inAppCommandId: (ctx.intake.rawPayload?.commandId as string) ?? undefined,
          subject: `Αποτυχία αποστολής email`,
          textBody: noEmailMsg,
          requestId: ctx.requestId,
        });

        return {
          success: true,
          sideEffects: ['no_recipient_email'],
        };
      }

      // Send the actual email via Mailgun
      const adminName = ctx.adminCommandMeta?.adminIdentity.displayName ?? 'Admin';
      const mailResult = await sendReplyViaMailgun({
        to: recipientEmail,
        subject: `Μήνυμα από ${adminName}`,
        textBody: emailContent,
      });

      const sideEffects: string[] = [];

      if (mailResult.success) {
        sideEffects.push(`email_sent:${mailResult.messageId ?? recipientEmail}`);
        logger.info('UC-012 EXECUTE: Email sent', {
          requestId: ctx.requestId,
          to: recipientEmail,
        });
      } else {
        sideEffects.push(`email_failed:${mailResult.error ?? 'unknown'}`);
        logger.warn('UC-012 EXECUTE: Email send failed', {
          requestId: ctx.requestId,
          error: mailResult.error,
        });
      }

      // Confirm to admin via their channel
      const confirmText = mailResult.success
        ? `Email στάλθηκε στον ${recipientName} (${recipientEmail}).`
        : `Αποτυχία αποστολής email στον ${recipientName}: ${mailResult.error ?? 'unknown error'}`;

      const telegramChatId = (params.telegramChatId as string)
        ?? (ctx.intake.rawPayload.chatId as string)
        ?? (ctx.intake.normalized.sender.telegramId)
        ?? undefined;

      const confirmResult = await sendChannelReply({
        channel: ctx.intake.channel,
        recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
        telegramChatId: telegramChatId ?? undefined,
        inAppCommandId: (ctx.intake.rawPayload?.commandId as string) ?? undefined,
        subject: 'Επιβεβαίωση αποστολής',
        textBody: confirmText,
        requestId: ctx.requestId,
      });

      if (confirmResult.success) {
        sideEffects.push(`confirm_sent:${confirmResult.messageId ?? 'unknown'}`);
      }

      return { success: true, sideEffects };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('UC-012 EXECUTE: Failed', { requestId: ctx.requestId, error: errorMessage });
      return { success: false, sideEffects: [], error: errorMessage };
    }
  }

  // ── Step 7: ACKNOWLEDGE ──

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    const confirmSent = ctx.executionResult?.sideEffects?.some(
      (se: string) => se.startsWith('confirm_sent:') || se.startsWith('reply_sent:')
    ) ?? false;
    return { sent: confirmSent, channel: ctx.intake.channel };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// ============================================================================
// FALLBACK PARSING — Extract entities from raw message when AI fails
// ============================================================================

/** Greek/English command keywords that indicate "send email to" */
const SEND_EMAIL_KEYWORDS = [
  'στείλε email στον', 'στείλε email στη', 'στείλε email στο',
  'στείλε μήνυμα στον', 'στείλε μήνυμα στη', 'στείλε μήνυμα στο',
  'στείλε mail στον', 'στείλε mail στη', 'στείλε mail στο',
  'send email to', 'send mail to', 'send message to',
  'στείλε στον', 'στείλε στη', 'στείλε στο',
] as const;

/** Content separators — text after these is the email body */
const CONTENT_SEPARATORS = ['ότι', 'πως', 'oti', 'that', 'λέγοντας', 'με περιεχόμενο'] as const;

/**
 * Extract recipient name from raw admin message
 * Pattern: "Στείλε email στον **Κώστα** ότι..."
 */
function extractRecipientFromMessage(message: string): string {
  const lowerMsg = message.toLowerCase();

  // Strategy 1: Strip known command keywords and find name between preposition and separator
  for (const keyword of SEND_EMAIL_KEYWORDS) {
    const idx = lowerMsg.indexOf(keyword);
    if (idx === -1) continue;

    const afterKeyword = message.substring(idx + keyword.length).trim();

    // Find where content starts (separator word)
    for (const sep of CONTENT_SEPARATORS) {
      const sepIdx = afterKeyword.toLowerCase().indexOf(` ${sep} `);
      if (sepIdx !== -1) {
        return afterKeyword.substring(0, sepIdx).trim();
      }
    }

    // No separator found — check for colon
    const colonIdx = afterKeyword.indexOf(':');
    if (colonIdx !== -1 && colonIdx < 50) {
      return afterKeyword.substring(0, colonIdx).trim();
    }

    // Take first word(s) before a long text (up to 3 words)
    const words = afterKeyword.split(/\s+/);
    if (words.length >= 1) {
      return words.slice(0, Math.min(words.length, 3)).join(' ').trim();
    }
  }

  // Strategy 2: Regex — find text after preposition στον/στη/στο
  const prepMatch = message.match(/(?:στον|στη|στο)\s+([\p{L}\s]{2,30}?)(?:\s+(?:ότι|πως|λέγοντας|:)|$)/u);
  if (prepMatch?.[1]) {
    return prepMatch[1].trim();
  }

  return '';
}

/**
 * Extract email content from raw admin message
 * Pattern: "...ότι **μετακινείται το ραντεβού**"
 */
function extractEmailContentFromMessage(message: string): string {
  // Strategy 1: Content after separator word (ότι, πως, etc.)
  for (const sep of CONTENT_SEPARATORS) {
    const regex = new RegExp(`\\s${sep}\\s(.+)`, 'i');
    const match = message.match(regex);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  // Strategy 2: Content after colon
  const colonIdx = message.indexOf(':');
  if (colonIdx !== -1 && colonIdx < message.length - 1) {
    const afterColon = message.substring(colonIdx + 1).trim();
    if (afterColon.length > 0) {
      return afterColon;
    }
  }

  // Fallback: return empty (caller uses rawMessage)
  return '';
}
