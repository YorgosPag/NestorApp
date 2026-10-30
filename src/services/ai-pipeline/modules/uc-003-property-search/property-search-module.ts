/**
 * =============================================================================
 * UC-003: PROPERTY SEARCH MODULE (ADR-080)
 * =============================================================================
 *
 * Handles `property_search` intents — customers inquiring about available units.
 *
 * Pipeline steps implemented:
 *   Step 3 LOOKUP  → Parse criteria, query available units
 *   Step 4 PROPOSE → Build unit list + draft reply for operator approval
 *   Step 6 EXECUTE → Send reply + record audit trail
 *   Step 7 ACKNOWLEDGE → Confirm delivery status
 *
 * @module services/ai-pipeline/modules/uc-003-property-search
 * @see ADR-080 (Pipeline Implementation)
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { extractSearchCriteria } from '@/services/property-search.service';
import {
  acknowledgeReply,
  approvalOf,
  collectionHealthCheck,
  findSenderContact,
  lookupOf,
  recordPipelineAudit,
  requesterOf,
  senderDisplayOf,
  senderEmailOf,
  toLookupRecord,
} from '../../shared/customer-request-protocol';
import { sendChannelReply, extractChannelIds } from '../../shared/channel-reply-dispatcher';
import { PipelineIntentType } from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';

import {
  type PropertySearchLookupData,
  queryAvailableUnits,
  buildDraftReply,
} from './property-search-query';
import { nowISO } from '@/lib/date-local';
import { approvedAction, humanApprovedProposal, replySideEffect } from '../../shared/admin-command-protocol';

const logger = createModuleLogger('UC_003_PROPERTY_SEARCH');

// ============================================================================
// MODULE
// ============================================================================

export class PropertySearchModule implements IUCModule {
  readonly moduleId = 'UC-003';
  readonly displayName = 'Αναζήτηση Ακινήτου';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.PROPERTY_SEARCH,
  ];
  readonly requiredRoles: readonly string[] = ['salesManager'];

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const senderEmail = senderEmailOf(ctx);
    const senderName = ctx.intake.normalized.sender.name ?? senderEmail;
    const emailText = ctx.intake.normalized.contentText ?? ctx.intake.normalized.subject ?? '';

    logger.info('UC-003 LOOKUP: Parsing search criteria from email', {
      requestId: ctx.requestId,
      senderEmail,
      companyId: ctx.companyId,
    });

    const criteria = extractSearchCriteria(emailText);

    logger.info('UC-003 LOOKUP: Criteria extracted', {
      requestId: ctx.requestId,
      criteria,
    });

    const { matching, totalAvailable } = await queryAvailableUnits(ctx.companyId, criteria);

    logger.info('UC-003 LOOKUP: Units query complete', {
      requestId: ctx.requestId,
      matchingCount: matching.length,
      totalAvailable,
    });

    const senderContact = await findSenderContact(ctx, 'UC-003', logger, senderEmail);

    const lookupData: PropertySearchLookupData = {
      senderEmail,
      senderName,
      senderContact,
      isKnownContact: senderContact !== null,
      criteria,
      matchingUnits: matching,
      totalAvailable,
      originalSubject: ctx.intake.normalized.subject ?? '',
      companyId: ctx.companyId,
    };

    logger.info('UC-003 LOOKUP: Complete', {
      requestId: ctx.requestId,
      isKnownContact: lookupData.isKnownContact,
      matchingUnits: matching.length,
      totalAvailable,
    });

    return toLookupRecord(lookupData);
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = lookupOf<PropertySearchLookupData>(ctx);

    const senderDisplay = senderDisplayOf(lookup);
    const criteria = lookup?.criteria ?? {};
    const units = lookup?.matchingUnits ?? [];
    const totalAvailable = lookup?.totalAvailable ?? 0;

    const criteriaParts: string[] = [];
    if (criteria.type) criteriaParts.push(criteria.type);
    if (criteria.rooms) criteriaParts.push(`${criteria.rooms} δωματίων`);
    if (criteria.minArea) criteriaParts.push(`~${criteria.minArea} τ.μ.`);
    const criteriaSummary = criteriaParts.length > 0
      ? criteriaParts.join(', ')
      : 'ακίνητο';

    const resultText = units.length > 0
      ? `Βρέθηκαν ${units.length} διαθέσιμα (από ${totalAvailable} συνολικά)`
      : `Δεν βρέθηκαν ακίνητα (${totalAvailable} διαθέσιμα συνολικά)`;

    const summary = `Αναζήτηση: ${criteriaSummary} — ${resultText} — από ${senderDisplay}`;
    const draftReply = buildDraftReply(senderDisplay, criteria, units);

    logger.info('UC-003 PROPOSE: Generating proposal', {
      requestId: ctx.requestId,
      matchingUnits: units.length,
      summary,
    });

    return humanApprovedProposal(ctx, 'reply_property_list', {
      senderEmail: lookup?.senderEmail,
      senderName: senderDisplay,
      contactId: lookup?.senderContact?.contactId ?? null,
      isKnownContact: lookup?.isKnownContact ?? false,
      criteriaSummary,
      matchingUnitsCount: units.length,
      matchingUnits: units.slice(0, 10).map(u => ({
        id: u.id, name: u.name, type: u.type, area: u.area,
        floor: u.floor, building: u.building, price: u.price, rooms: u.rooms,
      })),
      totalAvailable,
      draftReply,
      companyId: ctx.companyId,
    }, summary);
  }

  // ── Step 6: EXECUTE ──

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    logger.info('UC-003 EXECUTE: Processing property search response', {
      requestId: ctx.requestId,
    });

    try {
      const replyAction = approvedAction(ctx, 'reply_property_list');

      if (!replyAction) {
        return {
          success: false,
          sideEffects: [],
          error: 'No reply_property_list action found in approved actions',
        };
      }

      const params = replyAction.params;
      const senderEmail = (params.senderEmail as string) ?? '';
      const draftReply = (params.draftReply as string) ?? '';
      const originalSubject = ctx.intake.normalized.subject ?? 'Αναζήτηση Ακινήτου';

      logger.info('UC-003 EXECUTE: Sending reply via channel dispatcher', {
        requestId: ctx.requestId,
        senderEmail,
        channel: ctx.intake.channel,
        matchingUnits: params.matchingUnitsCount,
        approvedBy: ctx.approval?.approvedBy ?? null,
      });

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        ...extractChannelIds(ctx),
        subject: `Re: ${originalSubject}`,
        textBody: draftReply,
        requestId: ctx.requestId,
      });

      const leadInquiry = {
        type: 'property_search_inquiry',
        companyId: ctx.companyId,
        pipelineRequestId: ctx.requestId,
        sender: { ...requesterOf(params), email: senderEmail ?? null },
        searchCriteria: (params.criteriaSummary as string) ?? null,
        matchingUnitsCount: (params.matchingUnitsCount as number) ?? 0,
        totalAvailable: (params.totalAvailable as number) ?? 0,
        channel: ctx.intake.channel,
        status: replyResult.success ? 'sent' : 'send_failed',
        replyMessageId: replyResult.messageId ?? null,
        replyError: replyResult.error ?? null,
        ...approvalOf(ctx),
        createdAt: nowISO(),
      };

      const auditId = await recordPipelineAudit(leadInquiry);

      if (!replyResult.success) {
        logger.error('UC-003 EXECUTE: Reply send FAILED', {
          requestId: ctx.requestId,
          auditId,
          channel: replyResult.channel,
          error: replyResult.error,
        });

        return {
          success: false,
          sideEffects: [
            `lead_inquiry_recorded:${auditId}`,
            replySideEffect(replyResult),
          ],
          error: `Αποτυχία αποστολής απάντησης: ${replyResult.error ?? 'Άγνωστο σφάλμα'}`,
        };
      }

      logger.info('UC-003 EXECUTE: Reply sent successfully', {
        requestId: ctx.requestId,
        auditId,
        channel: replyResult.channel,
        messageId: replyResult.messageId,
      });

      return {
        success: true,
        sideEffects: [
          `lead_inquiry_recorded:${auditId}`,
          `matching_units:${params.matchingUnitsCount ?? 0}`,
          replySideEffect(replyResult),
        ],
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('UC-003 EXECUTE: Failed', {
        requestId: ctx.requestId,
        error: errorMessage,
      });

      return {
        success: false,
        sideEffects: [],
        error: `Failed to process property search: ${errorMessage}`,
      };
    }
  }

  // ── Step 7: ACKNOWLEDGE ──

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    return acknowledgeReply(ctx, 'UC-003', logger, 'Reply delivery status');
  }

  // ── Health Check ──

  async healthCheck(): Promise<boolean> {
    return collectionHealthCheck(COLLECTIONS.PROPERTIES, 'UC-003', logger);
  }
}
