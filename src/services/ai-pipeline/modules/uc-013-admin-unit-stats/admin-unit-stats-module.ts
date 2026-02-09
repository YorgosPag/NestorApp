/**
 * =============================================================================
 * UC-013: ADMIN UNIT STATS MODULE — ADR-145
 * =============================================================================
 *
 * Super admin command: "Πόσα ακίνητα έχουμε πωλημένα;"
 * Aggregates unit statistics (sold, available, reserved) across projects.
 *
 * @module services/ai-pipeline/modules/uc-013-admin-unit-stats
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

const logger = createModuleLogger('UC_013_ADMIN_UNIT_STATS');

// ============================================================================
// TYPES
// ============================================================================

interface UnitStatsLookupData {
  projectFilter: string | null;
  totalStats: AggregateUnitStats;
  projectBreakdown: ProjectUnitBreakdown[];
  companyId: string;
}

interface AggregateUnitStats {
  total: number;
  sold: number;
  available: number;
  reserved: number;
  other: number;
}

interface ProjectUnitBreakdown {
  projectId: string;
  projectName: string;
  total: number;
  sold: number;
  available: number;
  reserved: number;
  other: number;
}

// ============================================================================
// MODULE
// ============================================================================

export class AdminUnitStatsModule implements IUCModule {
  readonly moduleId = 'UC-013';
  readonly displayName = 'Admin: Στατιστικά Ακινήτων';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.ADMIN_UNIT_STATS,
  ];
  readonly requiredRoles: readonly string[] = [];

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const projectFilter = (ctx.understanding?.entities?.projectName as string) ?? null;

    logger.info('UC-013 LOOKUP: Aggregating unit statistics', {
      requestId: ctx.requestId,
      projectFilter,
    });

    const adminDb = getAdminFirestore();
    const totalStats: AggregateUnitStats = { total: 0, sold: 0, available: 0, reserved: 0, other: 0 };
    const projectBreakdown: ProjectUnitBreakdown[] = [];

    try {
      // Get all projects for this company
      const projectsSnapshot = await adminDb
        .collection(COLLECTIONS.PROJECTS)
        .where('companyId', '==', ctx.companyId)
        .get();

      const projectMap = new Map<string, string>();
      for (const doc of projectsSnapshot.docs) {
        const data = doc.data();
        projectMap.set(doc.id, (data.name ?? data.title ?? 'Χωρίς όνομα') as string);
      }

      // Get all units for this company
      const unitsSnapshot = await adminDb
        .collection(COLLECTIONS.UNITS)
        .where('companyId', '==', ctx.companyId)
        .get();

      // Aggregate by project
      const perProject = new Map<string, ProjectUnitBreakdown>();

      for (const doc of unitsSnapshot.docs) {
        const data = doc.data();
        const projectId = (data.projectId as string) ?? 'unknown';
        const projectName = projectMap.get(projectId) ?? 'Χωρίς έργο';

        // Skip if filtering by project and doesn't match
        if (projectFilter) {
          const normalizedFilter = projectFilter.toLowerCase().trim();
          if (!projectName.toLowerCase().includes(normalizedFilter)) continue;
        }

        if (!perProject.has(projectId)) {
          perProject.set(projectId, {
            projectId,
            projectName,
            total: 0, sold: 0, available: 0, reserved: 0, other: 0,
          });
        }

        const stats = perProject.get(projectId)!;
        stats.total++;
        totalStats.total++;

        const status = ((data.status ?? '') as string).toLowerCase();
        if (status === 'sold' || status === 'πωλημένο') {
          stats.sold++; totalStats.sold++;
        } else if (status === 'available' || status === 'διαθέσιμο') {
          stats.available++; totalStats.available++;
        } else if (status === 'reserved' || status === 'κρατημένο') {
          stats.reserved++; totalStats.reserved++;
        } else {
          stats.other++; totalStats.other++;
        }
      }

      projectBreakdown.push(...Array.from(perProject.values()));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('UC-013 LOOKUP: Stats aggregation failed', {
        requestId: ctx.requestId,
        error: msg,
      });
    }

    const lookupData: UnitStatsLookupData = {
      projectFilter,
      totalStats,
      projectBreakdown,
      companyId: ctx.companyId,
    };

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as UnitStatsLookupData | undefined;
    const stats = lookup?.totalStats;

    const summary = stats
      ? `Στατιστικά: ${stats.total} units (${stats.sold} πωλημένα, ${stats.available} διαθέσιμα)`
      : 'Δεν βρέθηκαν στοιχεία units';

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_unit_stats_reply',
          params: {
            projectFilter: lookup?.projectFilter ?? null,
            totalStats: stats ?? null,
            projectBreakdown: lookup?.projectBreakdown ?? [],
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
      const action = actions.find(a => a.type === 'admin_unit_stats_reply');

      if (!action) {
        return { success: false, sideEffects: [], error: 'No admin_unit_stats_reply action found' };
      }

      const params = action.params;
      const totalStats = params.totalStats as AggregateUnitStats | null;
      const projectBreakdown = (params.projectBreakdown as ProjectUnitBreakdown[]) ?? [];
      const projectFilter = params.projectFilter as string | null;

      // Format reply
      const lines: string[] = [];

      if (projectFilter) {
        lines.push(`Στατιστικά ακινήτων (φίλτρο: "${projectFilter}"):`);
      } else {
        lines.push('Στατιστικά ακινήτων (όλα τα έργα):');
      }

      if (totalStats) {
        lines.push('');
        lines.push(`Σύνολο: ${totalStats.total}`);
        lines.push(`  Πωλημένα: ${totalStats.sold}`);
        lines.push(`  Διαθέσιμα: ${totalStats.available}`);
        if (totalStats.reserved > 0) lines.push(`  Κρατημένα: ${totalStats.reserved}`);
        if (totalStats.other > 0) lines.push(`  Λοιπά: ${totalStats.other}`);
      }

      if (projectBreakdown.length > 1) {
        lines.push('');
        lines.push('Ανά έργο:');
        for (const proj of projectBreakdown) {
          lines.push(`  ${proj.projectName}: ${proj.total} (${proj.sold} πωλ., ${proj.available} διαθ.)`);
        }
      }

      const replyText = lines.join('\n');

      const telegramChatId = (params.telegramChatId as string)
        ?? (ctx.intake.rawPayload.chatId as string)
        ?? (ctx.intake.normalized.sender.telegramId)
        ?? undefined;

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
        telegramChatId: telegramChatId ?? undefined,
        subject: 'Στατιστικά ακινήτων',
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
      logger.error('UC-013 EXECUTE: Failed', { requestId: ctx.requestId, error: errorMessage });
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
