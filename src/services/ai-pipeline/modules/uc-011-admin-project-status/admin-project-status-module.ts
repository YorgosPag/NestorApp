/**
 * =============================================================================
 * UC-011: ADMIN PROJECT STATUS MODULE — ADR-145
 * =============================================================================
 *
 * Super admin command: Dual mode
 *   Mode 1: "Τι γίνεται με το έργο Πανόραμα;" → single project lookup
 *   Mode 2: "Ποια έργα έχουν gantt;" → multi-project search with criteria
 *   Mode 3: "Δείξε μου τα έργα" → list all projects
 *
 * @module services/ai-pipeline/modules/uc-011-admin-project-status
 * @see ADR-145 (Super Admin AI Assistant)
 */

import 'server-only';

import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
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

import type { LookupMode, ProjectLookupData, ProjectWithDetails } from './project-status-types';
import { fetchProjectDetails } from './project-status-data-fetcher';
import { matchesCriteria, formatSingleProjectReply, formatMultiProjectReply } from './project-status-formatter';

const logger = createModuleLogger('UC_011_ADMIN_PROJECT_STATUS');

// ============================================================================
// MODULE
// ============================================================================

export class AdminProjectStatusModule implements IUCModule {
  readonly moduleId = 'UC-011';
  readonly displayName = 'Admin: Κατάσταση Έργου';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.ADMIN_PROJECT_STATUS,
  ];
  readonly requiredRoles: readonly string[] = [];

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const projectName = (ctx.understanding?.entities?.projectName as string) ?? null;
    const searchCriteria = (ctx.understanding?.entities?.searchCriteria as string) ?? null;

    const mode: LookupMode = projectName
      ? 'single'
      : searchCriteria
        ? 'search'
        : 'list';

    logger.info('UC-011 LOOKUP: Project query', {
      requestId: ctx.requestId,
      mode,
      projectName: projectName ?? '(all)',
      searchCriteria: searchCriteria ?? '(none)',
    });

    const lookupData: ProjectLookupData = {
      mode,
      searchTerm: projectName ?? '',
      searchCriteria,
      companyId: ctx.companyId,
      singleProject: null,
      projects: [],
    };

    try {
      const allProjectDetails = await fetchProjectDetails(ctx.companyId, ctx.requestId);

      if (mode === 'single' && projectName) {
        const normalizedSearch = projectName.toLowerCase().trim();
        const match = allProjectDetails.find((p) =>
          p.project.name.toLowerCase().includes(normalizedSearch) ||
          p.ganttDetails.some((g) => g.buildingName.toLowerCase().includes(normalizedSearch))
        );
        lookupData.singleProject = match ?? null;
        return lookupData as unknown as Record<string, unknown>;
      }

      if (mode === 'search' && searchCriteria) {
        const criteria = searchCriteria.toLowerCase().trim();
        lookupData.projects = allProjectDetails.filter(
          (p) => matchesCriteria(p, criteria)
        );
      } else {
        lookupData.projects = allProjectDetails;
      }
    } catch (error) {
      const msg = getErrorMessage(error);
      logger.warn('UC-011 LOOKUP: Project query failed', {
        requestId: ctx.requestId,
        error: msg,
      });
    }

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as ProjectLookupData | undefined;
    const mode = lookup?.mode ?? 'single';

    let summary: string;
    if (mode === 'single') {
      summary = lookup?.singleProject
        ? `Κατάσταση έργου: ${lookup.singleProject.project.name}`
        : `Δεν βρέθηκε έργο για "${lookup?.searchTerm ?? ''}"`;
    } else {
      const count = lookup?.projects.length ?? 0;
      summary = mode === 'search'
        ? `Αποτελέσματα αναζήτησης: ${count} έργα (κριτήριο: ${lookup?.searchCriteria ?? ''})`
        : `Λίστα έργων: ${count} σύνολο`;
    }

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_project_status_reply',
          params: {
            mode,
            searchTerm: lookup?.searchTerm ?? null,
            searchCriteria: lookup?.searchCriteria ?? null,
            singleProject: lookup?.singleProject ?? null,
            projects: lookup?.projects ?? [],
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
      const action = actions.find(a => a.type === 'admin_project_status_reply');

      if (!action) {
        return { success: false, sideEffects: [], error: 'No admin_project_status_reply action found' };
      }

      const params = action.params;
      const mode = (params.mode as LookupMode) ?? 'single';

      const replyText = mode === 'single'
        ? formatSingleProjectReply(params)
        : formatMultiProjectReply(params);

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        ...extractChannelIds(ctx),
        subject: mode === 'single'
          ? `Κατάσταση: ${(params.singleProject as ProjectWithDetails | null)?.project.name ?? params.searchTerm}`
          : 'Έργα',
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
      const errorMessage = getErrorMessage(error);
      logger.error('UC-011 EXECUTE: Failed', { requestId: ctx.requestId, error: errorMessage });
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
