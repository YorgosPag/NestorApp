/**
 * =============================================================================
 * UC-011: ADMIN PROJECT STATUS MODULE — ADR-145
 * =============================================================================
 *
 * Super admin command: "Τι γίνεται με το έργο Πανόραμα;"
 * Queries project by name and returns status, unit stats, latest updates.
 *
 * @module services/ai-pipeline/modules/uc-011-admin-project-status
 * @see ADR-145 (Super Admin AI Assistant)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
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

const logger = createModuleLogger('UC_011_ADMIN_PROJECT_STATUS');

// ============================================================================
// TYPES
// ============================================================================

interface ProjectStatusLookupData {
  searchTerm: string;
  project: ProjectInfo | null;
  unitStats: UnitStats | null;
  companyId: string;
}

interface ProjectInfo {
  projectId: string;
  name: string;
  status: string | null;
  address: string | null;
  description: string | null;
  updatedAt: string | null;
}

interface UnitStats {
  total: number;
  sold: number;
  available: number;
  reserved: number;
  other: number;
}

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
    const searchTerm = (ctx.understanding?.entities?.projectName as string)
      ?? ctx.intake.normalized.contentText?.replace(/τι γίνεται|με|το|έργο|πρόοδος|κατάσταση/gi, '').trim()
      ?? '';

    logger.info('UC-011 LOOKUP: Searching project by name', {
      requestId: ctx.requestId,
      searchTerm,
    });

    let project: ProjectInfo | null = null;
    let unitStats: UnitStats | null = null;

    if (searchTerm.length > 0) {
      try {
        const adminDb = getAdminFirestore();
        const normalizedSearch = searchTerm.toLowerCase().trim();

        // Search projects by name
        const projectsSnapshot = await adminDb
          .collection(COLLECTIONS.PROJECTS)
          .where('companyId', '==', ctx.companyId)
          .limit(50)
          .get();

        for (const doc of projectsSnapshot.docs) {
          const data = doc.data();
          const projectName = ((data.name ?? data.title ?? '') as string).toLowerCase();
          if (projectName.includes(normalizedSearch)) {
            project = {
              projectId: doc.id,
              name: (data.name ?? data.title ?? 'Χωρίς όνομα') as string,
              status: (data.status as string) ?? null,
              address: (data.address as string) ?? null,
              description: (data.description as string) ?? null,
              updatedAt: (data.updatedAt as string) ?? (data.lastModified as string) ?? null,
            };
            break;
          }
        }

        // Get unit stats if project found
        if (project) {
          const unitsSnapshot = await adminDb
            .collection(COLLECTIONS.UNITS)
            .where('projectId', '==', project.projectId)
            .get();

          const stats: UnitStats = { total: 0, sold: 0, available: 0, reserved: 0, other: 0 };
          for (const unitDoc of unitsSnapshot.docs) {
            const unitData = unitDoc.data();
            stats.total++;
            const unitStatus = ((unitData.status ?? '') as string).toLowerCase();
            if (unitStatus === 'sold' || unitStatus === 'πωλημένο') stats.sold++;
            else if (unitStatus === 'available' || unitStatus === 'διαθέσιμο') stats.available++;
            else if (unitStatus === 'reserved' || unitStatus === 'κρατημένο') stats.reserved++;
            else stats.other++;
          }
          unitStats = stats;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('UC-011 LOOKUP: Project search failed', {
          requestId: ctx.requestId,
          error: msg,
        });
      }
    }

    const lookupData: ProjectStatusLookupData = {
      searchTerm,
      project,
      unitStats,
      companyId: ctx.companyId,
    };

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as ProjectStatusLookupData | undefined;
    const project = lookup?.project;

    const summary = project
      ? `Κατάσταση έργου: ${project.name}`
      : `Δεν βρέθηκε έργο για "${lookup?.searchTerm ?? ''}"`;

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_project_status_reply',
          params: {
            searchTerm: lookup?.searchTerm ?? null,
            project: project ?? null,
            unitStats: lookup?.unitStats ?? null,
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
      const project = params.project as ProjectInfo | null;
      const unitStats = params.unitStats as UnitStats | null;
      const searchTerm = (params.searchTerm as string) ?? '';

      let replyText: string;
      if (!project) {
        replyText = `Δεν βρέθηκε έργο με όνομα "${searchTerm}".`;
      } else {
        const lines = [`Έργο: ${project.name}`];
        if (project.status) lines.push(`Κατάσταση: ${project.status}`);
        if (project.address) lines.push(`Διεύθυνση: ${project.address}`);
        if (unitStats) {
          lines.push('');
          lines.push(`Units: ${unitStats.total} σύνολο`);
          lines.push(`  Πωλημένα: ${unitStats.sold}`);
          lines.push(`  Διαθέσιμα: ${unitStats.available}`);
          if (unitStats.reserved > 0) lines.push(`  Κρατημένα: ${unitStats.reserved}`);
          if (unitStats.other > 0) lines.push(`  Λοιπά: ${unitStats.other}`);
        }
        if (project.updatedAt) lines.push(`\nΤελευταία ενημέρωση: ${project.updatedAt}`);
        replyText = lines.join('\n');
      }

      const telegramChatId = (params.telegramChatId as string)
        ?? (ctx.intake.rawPayload.chatId as string)
        ?? (ctx.intake.normalized.sender.telegramId)
        ?? undefined;

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
        telegramChatId: telegramChatId ?? undefined,
        subject: `Κατάσταση: ${project?.name ?? searchTerm}`,
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
