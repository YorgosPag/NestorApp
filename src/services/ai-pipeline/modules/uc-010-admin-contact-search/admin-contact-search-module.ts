/**
 * =============================================================================
 * UC-010: ADMIN CONTACT SEARCH MODULE — ADR-145
 * =============================================================================
 *
 * Super admin command: "Βρες μου τα στοιχεία του Γιάννη"
 * Searches contacts by name and returns results directly to the admin.
 *
 * Pipeline steps:
 *   Step 3 LOOKUP   → findContactByName() — fuzzy name search
 *   Step 4 PROPOSE  → Format contact results (read-only, auto-approvable)
 *   Step 6 EXECUTE  → No side effects (read-only query)
 *   Step 7 ACK      → Send results via channel dispatcher
 *
 * @module services/ai-pipeline/modules/uc-010-admin-contact-search
 * @see ADR-145 (Super Admin AI Assistant)
 */

import 'server-only';

import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { findContactByName } from '../../shared/contact-lookup';
import { sendChannelReply } from '../../shared/channel-reply-dispatcher';
import { PipelineIntentType } from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';

const logger = createModuleLogger('UC_010_ADMIN_CONTACT_SEARCH');

// ============================================================================
// TYPES
// ============================================================================

interface ContactSearchLookupData {
  searchTerm: string;
  results: ContactSearchResult[];
  companyId: string;
}

interface ContactSearchResult {
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  type: string | null;
}

// ============================================================================
// MODULE
// ============================================================================

export class AdminContactSearchModule implements IUCModule {
  readonly moduleId = 'UC-010';
  readonly displayName = 'Admin: Αναζήτηση Επαφής';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.ADMIN_CONTACT_SEARCH,
  ];
  readonly requiredRoles: readonly string[] = [];

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const searchTerm = (ctx.understanding?.entities?.contactName as string)
      ?? ctx.intake.normalized.contentText?.replace(/βρες|μου|τα|στοιχεία|του|της|τον|την/gi, '').trim()
      ?? '';

    logger.info('UC-010 LOOKUP: Searching contacts by name', {
      requestId: ctx.requestId,
      searchTerm,
      companyId: ctx.companyId,
    });

    let results: ContactSearchResult[] = [];
    if (searchTerm.length > 0) {
      try {
        results = await findContactByName(searchTerm, ctx.companyId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('UC-010 LOOKUP: Contact search failed', {
          requestId: ctx.requestId,
          error: msg,
        });
      }
    }

    logger.info('UC-010 LOOKUP: Complete', {
      requestId: ctx.requestId,
      searchTerm,
      resultsFound: results.length,
    });

    const lookupData: ContactSearchLookupData = {
      searchTerm,
      results,
      companyId: ctx.companyId,
    };

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as ContactSearchLookupData | undefined;
    const results = lookup?.results ?? [];
    const searchTerm = lookup?.searchTerm ?? '';

    const summary = results.length > 0
      ? `Βρέθηκαν ${results.length} επαφές για "${searchTerm}"`
      : `Δεν βρέθηκαν επαφές για "${searchTerm}"`;

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_contact_search_reply',
          params: {
            searchTerm,
            results,
            resultCount: results.length,
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
    logger.info('UC-010 EXECUTE: Sending contact search results', {
      requestId: ctx.requestId,
    });

    try {
      const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
      const action = actions.find(a => a.type === 'admin_contact_search_reply');

      if (!action) {
        return { success: false, sideEffects: [], error: 'No admin_contact_search_reply action found' };
      }

      const params = action.params;
      const results = (params.results as ContactSearchResult[]) ?? [];
      const searchTerm = (params.searchTerm as string) ?? '';

      // Format reply text
      let replyText: string;
      if (results.length === 0) {
        replyText = `Δεν βρέθηκαν επαφές για "${searchTerm}".`;
      } else {
        const lines = results.map((r, i) => {
          const parts = [`${i + 1}. ${r.name}`];
          if (r.email) parts.push(`   Email: ${r.email}`);
          if (r.phone) parts.push(`   Τηλ: ${r.phone}`);
          if (r.company) parts.push(`   Εταιρεία: ${r.company}`);
          return parts.join('\n');
        });
        replyText = `Βρέθηκαν ${results.length} αποτελέσματα για "${searchTerm}":\n\n${lines.join('\n\n')}`;
      }

      const telegramChatId = (params.telegramChatId as string)
        ?? (ctx.intake.rawPayload.chatId as string)
        ?? (ctx.intake.normalized.sender.telegramId)
        ?? undefined;

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
        telegramChatId: telegramChatId ?? undefined,
        subject: `Αποτελέσματα αναζήτησης: ${searchTerm}`,
        textBody: replyText,
        requestId: ctx.requestId,
      });

      return {
        success: true,
        sideEffects: replyResult.success
          ? [`reply_sent:${replyResult.messageId ?? 'unknown'}`]
          : [`reply_failed:${replyResult.error ?? 'unknown'}`],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('UC-010 EXECUTE: Failed', { requestId: ctx.requestId, error: errorMessage });
      return { success: false, sideEffects: [], error: errorMessage };
    }
  }

  // ── Step 7: ACKNOWLEDGE ──

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    const replySent = ctx.executionResult?.sideEffects?.some(
      (se: string) => se.startsWith('reply_sent:')
    ) ?? false;

    return { sent: replySent, channel: ctx.intake.channel };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
