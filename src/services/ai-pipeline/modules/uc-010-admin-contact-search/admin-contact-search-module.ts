/**
 * =============================================================================
 * UC-010: ADMIN CONTACT SEARCH MODULE — ADR-145
 * =============================================================================
 *
 * Super admin commands:
 *   "Βρες μου τα στοιχεία του Γιάννη" → search by name
 *   "Ποιες είναι οι επαφές φυσικών προσώπων;" → list all individuals
 *   "Δείξε μου τις εταιρείες" → list all companies
 *
 * Pipeline steps:
 *   Step 3 LOOKUP   → findContactByName() OR listContacts()
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
import { findContactByName, listContacts } from '../../shared/contact-lookup';
import type { ContactTypeFilter } from '../../shared/contact-lookup';
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
  mode: 'search' | 'list';
  searchTerm: string;
  typeFilter: ContactTypeFilter;
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

  // ── Helpers ──

  /**
   * Detect contact type filter from message keywords.
   */
  private detectTypeFilter(text: string): ContactTypeFilter {
    const lower = text.toLowerCase();
    const individualKw = ['φυσικ', 'πρόσωπ', 'individual', 'ατομ', 'ιδιώτ'];
    const companyKw = ['εταιρ', 'company', 'επιχείρ'];

    if (individualKw.some(kw => lower.includes(kw))) return 'individual';
    if (companyKw.some(kw => lower.includes(kw))) return 'company';
    return 'all';
  }

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const contactName = (ctx.understanding?.entities?.contactName as string) ?? '';
    const contactType = (ctx.understanding?.entities?.contactType as string) ?? '';
    const messageText = ctx.intake.normalized.contentText ?? '';

    // Determine mode: if a specific name is given → search; otherwise → list
    const hasSpecificName = contactName.length > 1
      && !['', 'all', 'όλες', 'όλους', 'όλα'].includes(contactName.toLowerCase().trim());

    const mode: 'search' | 'list' = hasSpecificName ? 'search' : 'list';

    // Determine type filter from AI entity or keyword detection
    let typeFilter: ContactTypeFilter = 'all';
    if (contactType === 'individual') typeFilter = 'individual';
    else if (contactType === 'company') typeFilter = 'company';
    else typeFilter = this.detectTypeFilter(messageText);

    logger.info('UC-010 LOOKUP: Contact lookup', {
      requestId: ctx.requestId,
      mode,
      contactName: hasSpecificName ? contactName : '(list all)',
      typeFilter,
      companyId: ctx.companyId,
    });

    let results: ContactSearchResult[] = [];
    try {
      if (mode === 'search') {
        results = await findContactByName(contactName, ctx.companyId);
      } else {
        results = await listContacts(ctx.companyId, typeFilter, 20);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('UC-010 LOOKUP: Contact lookup failed', {
        requestId: ctx.requestId,
        error: msg,
      });
    }

    logger.info('UC-010 LOOKUP: Complete', {
      requestId: ctx.requestId,
      mode,
      resultsFound: results.length,
    });

    const lookupData: ContactSearchLookupData = {
      mode,
      searchTerm: hasSpecificName ? contactName : '',
      typeFilter,
      results,
      companyId: ctx.companyId,
    };

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as ContactSearchLookupData | undefined;
    const results = lookup?.results ?? [];
    const mode = lookup?.mode ?? 'search';
    const searchTerm = lookup?.searchTerm ?? '';
    const typeFilter = lookup?.typeFilter ?? 'all';

    const typeLabel = typeFilter === 'individual' ? 'φυσικά πρόσωπα'
      : typeFilter === 'company' ? 'εταιρείες' : 'επαφές';

    const summary = mode === 'list'
      ? `Λίστα: ${results.length} ${typeLabel}`
      : results.length > 0
        ? `Βρέθηκαν ${results.length} επαφές για "${searchTerm}"`
        : `Δεν βρέθηκαν επαφές για "${searchTerm}"`;

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_contact_search_reply',
          params: {
            mode,
            searchTerm,
            typeFilter,
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
      const mode = (params.mode as string) ?? 'search';
      const typeFilter = (params.typeFilter as string) ?? 'all';

      const typeLabel = typeFilter === 'individual' ? 'φυσικά πρόσωπα'
        : typeFilter === 'company' ? 'εταιρείες' : 'επαφές';

      // Format reply text
      let replyText: string;
      if (results.length === 0) {
        replyText = mode === 'list'
          ? `Δεν βρέθηκαν ${typeLabel}.`
          : `Δεν βρέθηκαν επαφές για "${searchTerm}".`;
      } else {
        const lines = results.map((r, i) => {
          const parts = [`${i + 1}. ${r.name}`];
          if (r.email) parts.push(`   Email: ${r.email}`);
          if (r.phone) parts.push(`   Τηλ: ${r.phone}`);
          if (r.company) parts.push(`   Εταιρεία: ${r.company}`);
          if (r.type) parts.push(`   Τύπος: ${r.type}`);
          return parts.join('\n');
        });

        const header = mode === 'list'
          ? `Λίστα ${typeLabel} (${results.length}):`
          : `Βρέθηκαν ${results.length} αποτελέσματα για "${searchTerm}":`;

        replyText = `${header}\n\n${lines.join('\n\n')}`;
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
