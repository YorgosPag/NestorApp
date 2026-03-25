/**
 * =============================================================================
 * MESSAGING HANDLER — Email, Telegram & Social Messaging
 * =============================================================================
 *
 * Tools:
 * - send_email_to_contact: Find contact by name and send branded email
 * - send_telegram_message: Send Telegram message to chatId
 * - send_messenger_message: Send Messenger message to contact
 * - send_instagram_message: Send Instagram message to contact
 *
 * @module services/ai-pipeline/tools/handlers/messaging-handler
 * @see ADR-171 (Autonomous AI Agent)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { greekToLatin } from '../../shared/greek-nlp';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  logger,
} from '../executor-shared';

// ============================================================================
// HANDLER
// ============================================================================

export class MessagingHandler implements ToolHandler {
  readonly toolNames = [
    'send_email_to_contact',
    'send_telegram_message',
    'send_messenger_message',
    'send_instagram_message',
  ] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'send_email_to_contact':
        return this.executeSendEmail(args, ctx);
      case 'send_telegram_message':
        return this.executeSendTelegram(args, ctx);
      case 'send_messenger_message':
        return this.executeSendSocialMessage(args, ctx, 'messenger');
      case 'send_instagram_message':
        return this.executeSendSocialMessage(args, ctx, 'instagram');
      default:
        return { success: false, error: `Unknown messaging tool: ${toolName}` };
    }
  }

  // --------------------------------------------------------------------------
  // Shared: Fuzzy Greek↔Latin contact search
  // --------------------------------------------------------------------------

  private buildSearchTerms(contactName: string): string[] {
    const searchWords = contactName.toLowerCase().split(/\s+/).filter(Boolean);
    const latinWords = searchWords.map(w => greekToLatin(w)).filter(Boolean);
    const stems = [...searchWords, ...latinWords]
      .filter(w => w.length >= 3)
      .map(w => w.substring(0, Math.min(w.length, 4)));
    return [...new Set([...searchWords, ...latinWords, ...stems])];
  }

  private matchesContact(
    doc: FirebaseFirestore.QueryDocumentSnapshot,
    allSearchTerms: string[]
  ): boolean {
    const data = doc.data();
    const nameFields = [data.displayName, data.firstName, data.lastName, data.name, data.tradeName]
      .filter(Boolean).map(v => String(v).toLowerCase());
    const searchableText = nameFields.join(' ');
    const latinText = nameFields.map(n => greekToLatin(n)).filter(Boolean).join(' ');
    const fullText = `${searchableText} ${latinText}`;
    return allSearchTerms.some(term => fullText.includes(term));
  }

  // --------------------------------------------------------------------------
  // send_email_to_contact
  // --------------------------------------------------------------------------

  private async executeSendEmail(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Email sending is restricted to admin only' };
    }

    const contactName = String(args.contactName ?? '');
    const subject = String(args.subject ?? 'Μήνυμα');
    const body = String(args.body ?? '');

    if (!contactName) {
      return { success: false, error: 'contactName is required' };
    }

    const allSearchTerms = this.buildSearchTerms(contactName);

    const db = getAdminFirestore();
    const contactsSnap = await db
      .collection(COLLECTIONS.CONTACTS)
      .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
      .limit(50)
      .get();

    const matchingContacts = contactsSnap.docs.filter(doc => this.matchesContact(doc, allSearchTerms));

    if (matchingContacts.length === 0) {
      return { success: false, error: `Contact "${contactName}" not found` };
    }

    const contact = matchingContacts[0];
    const contactData = contact.data();
    const emailsArray = Array.isArray(contactData.emails)
      ? contactData.emails as Array<{ email?: string; isPrimary?: boolean }>
      : [];
    const primaryEmail = emailsArray.find(e => e.isPrimary)?.email ?? emailsArray[0]?.email;
    const email = String(primaryEmail ?? contactData.email ?? '');

    if (!email) {
      return {
        success: false,
        error: `Contact "${contactData.displayName ?? contactName}" has no email address`,
      };
    }

    const { wrapInBrandedTemplate, escapeHtml } = await import(
      '@/services/email-templates'
    );

    const recipientName = String(contactData.displayName ?? contactData.firstName ?? contactName);
    const contentHtml = `
      <p style="margin: 0 0 16px;">Αγαπητέ/ή ${escapeHtml(recipientName)},</p>
      <p style="margin: 0 0 16px;">${escapeHtml(body)}</p>
      <p style="margin: 24px 0 0; color: #6B7280;">Με εκτίμηση,<br/>Pagonis Energo</p>
    `;

    const htmlBody = wrapInBrandedTemplate({ contentHtml });

    // Download attachments from Firebase Storage (if provided)
    const attachmentPaths = Array.isArray(args.attachmentPaths) ? args.attachmentPaths as string[] : [];
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    if (attachmentPaths.length > 0) {
      const { getStorage } = await import('firebase-admin/storage');
      const bucket = getStorage().bucket();

      for (const storagePath of attachmentPaths.slice(0, 5)) {
        try {
          const file = bucket.file(storagePath);
          const [buffer] = await file.download();
          const [metadata] = await file.getMetadata();
          const filename = storagePath.split('/').pop() ?? 'attachment';
          attachments.push({
            filename,
            content: buffer,
            contentType: String(metadata.contentType ?? 'application/octet-stream'),
          });
        } catch {
          logger.warn('Failed to download attachment', { path: storagePath });
        }
      }
    }

    const { sendChannelReply } = await import(
      '@/services/ai-pipeline/shared/channel-reply-dispatcher'
    );

    const result = await sendChannelReply({
      channel: 'email',
      recipientEmail: email,
      subject,
      textBody: body,
      htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined,
      requestId: ctx.requestId,
    });

    return {
      success: result.success,
      data: {
        recipientName: contactData.displayName ?? contactName,
        recipientEmail: email,
        messageId: result.messageId ?? null,
      },
      error: result.error,
    };
  }

  // --------------------------------------------------------------------------
  // send_telegram_message
  // --------------------------------------------------------------------------

  private async executeSendTelegram(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Telegram sending is restricted to admin only' };
    }

    const chatId = String(args.chatId ?? ctx.telegramChatId ?? '');
    const text = String(args.text ?? '');

    if (!chatId || !text) {
      return { success: false, error: 'chatId and text are required' };
    }

    const { sendChannelReply } = await import(
      '@/services/ai-pipeline/shared/channel-reply-dispatcher'
    );

    const result = await sendChannelReply({
      channel: 'telegram',
      telegramChatId: chatId,
      textBody: text,
      requestId: ctx.requestId,
    });

    return {
      success: result.success,
      data: { chatId, sent: result.success },
      error: result.error,
    };
  }

  // --------------------------------------------------------------------------
  // send_messenger_message / send_instagram_message
  // --------------------------------------------------------------------------

  private async executeSendSocialMessage(
    args: Record<string, unknown>,
    ctx: AgenticContext,
    channel: 'messenger' | 'instagram',
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Social messaging is restricted to admin only' };
    }

    const contactName = String(args.contactName ?? '');
    const text = String(args.text ?? '');

    if (!contactName || !text) {
      return { success: false, error: 'contactName and text are required' };
    }

    const allSearchTerms = this.buildSearchTerms(contactName);

    const db = getAdminFirestore();
    const contactsSnap = await db
      .collection(COLLECTIONS.CONTACTS)
      .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
      .limit(50)
      .get();

    const matchingContacts = contactsSnap.docs.filter(doc => this.matchesContact(doc, allSearchTerms));

    if (matchingContacts.length === 0) {
      return { success: false, error: `Contact "${contactName}" not found` };
    }

    const contactId = matchingContacts[0].id;
    const contactData = matchingContacts[0].data();
    const contactDisplayName = String(contactData.displayName ?? contactData.firstName ?? contactName);

    const platform = channel === 'messenger' ? 'messenger' : 'instagram';
    const identitiesSnap = await db
      .collection(COLLECTIONS.EXTERNAL_IDENTITIES)
      .where('contactId', '==', contactId)
      .where('platform', '==', platform)
      .limit(1)
      .get();

    if (identitiesSnap.empty) {
      return {
        success: false,
        error: `Ο ${contactDisplayName} δεν έχει ${channel === 'messenger' ? 'Messenger' : 'Instagram'} identity. Πρέπει να έχει στείλει πρώτα μήνυμα στη σελίδα σου.`,
      };
    }

    const identity = identitiesSnap.docs[0].data();
    const recipientId = String(identity.platformUserId ?? identity.psid ?? identity.igsid ?? '');

    if (!recipientId) {
      return { success: false, error: `No ${platform} user ID found for ${contactDisplayName}` };
    }

    const { sendChannelReply } = await import(
      '@/services/ai-pipeline/shared/channel-reply-dispatcher'
    );

    const result = await sendChannelReply({
      channel,
      ...(channel === 'messenger' ? { messengerPsid: recipientId } : { instagramIgsid: recipientId }),
      textBody: text,
      requestId: ctx.requestId,
    });

    return {
      success: result.success,
      data: {
        recipientName: contactDisplayName,
        platform: channel,
        recipientId,
        messageId: result.messageId ?? null,
      },
      error: result.error,
    };
  }
}
