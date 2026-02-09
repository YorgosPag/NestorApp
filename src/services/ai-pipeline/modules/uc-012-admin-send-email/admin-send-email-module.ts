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
import { PipelineChannel, PipelineIntentType } from '@/types/ai-pipeline';
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
    const recipientName = (ctx.understanding?.entities?.recipientName as string) ?? '';
    const emailContent = (ctx.understanding?.entities?.emailContent as string)
      ?? ctx.intake.normalized.contentText ?? '';

    logger.info('UC-012 LOOKUP: Finding recipient contact', {
      requestId: ctx.requestId,
      recipientName,
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

    const lookupData: SendEmailLookupData = {
      recipientName,
      emailContent,
      targetContact,
      companyId: ctx.companyId,
    };

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as SendEmailLookupData | undefined;
    const contact = lookup?.targetContact;

    const summary = contact?.email
      ? `Αποστολή email στον ${contact.name} (${contact.email})`
      : `Δεν βρέθηκε email για "${lookup?.recipientName ?? ''}"`;

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_send_email_action',
          params: {
            recipientName: lookup?.recipientName ?? null,
            recipientEmail: contact?.email ?? null,
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
