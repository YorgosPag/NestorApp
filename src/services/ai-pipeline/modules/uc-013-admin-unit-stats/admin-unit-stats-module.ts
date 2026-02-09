/**
 * =============================================================================
 * UC-013: ADMIN BUSINESS STATS MODULE — ADR-145
 * =============================================================================
 *
 * Super admin commands:
 *   "Πόσα ακίνητα έχουμε πωλημένα;" → unit stats
 *   "Πόσες επαφές έχουμε;" → contact stats
 *   "Πόσα έργα έχουμε;" → project stats
 *
 * Detects stats type from the original message text and queries accordingly.
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

type StatsType = 'units' | 'contacts' | 'projects' | 'all';

interface BusinessStatsLookupData {
  statsType: StatsType;
  projectFilter: string | null;
  totalStats: AggregateUnitStats;
  projectBreakdown: ProjectUnitBreakdown[];
  contactStats: ContactStats | null;
  projectStats: ProjectStats | null;
  companyId: string;
}

interface ContactStats {
  total: number;
  individuals: number;
  companies: number;
}

interface ProjectStats {
  total: number;
  names: string[];
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
  readonly displayName = 'Admin: Στατιστικά Επιχείρησης';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.ADMIN_UNIT_STATS,
  ];
  readonly requiredRoles: readonly string[] = [];

  // ── Helpers ──

  /**
   * Detect what type of stats the admin is asking about
   * by analyzing the original message text.
   */
  private detectStatsType(messageText: string): StatsType {
    const text = messageText.toLowerCase();
    const contactKeywords = ['επαφ', 'contact', 'πελάτ', 'φυσικ', 'εταιρ', 'πρόσωπ', 'customer', 'client'];
    const projectKeywords = ['έργ', 'project', 'πρότζεκτ'];
    const unitKeywords = ['ακίνητ', 'unit', 'μονάδ', 'διαμέρ', 'στούντι', 'πωλημέν', 'πώληση'];

    const hasContacts = contactKeywords.some(kw => text.includes(kw));
    const hasProjects = projectKeywords.some(kw => text.includes(kw));
    const hasUnits = unitKeywords.some(kw => text.includes(kw));

    // If multiple → return 'all'; if specific → return that
    if (hasContacts && !hasUnits && !hasProjects) return 'contacts';
    if (hasProjects && !hasUnits && !hasContacts) return 'projects';
    if (hasUnits && !hasContacts && !hasProjects) return 'units';
    if (!hasContacts && !hasProjects && !hasUnits) return 'units'; // default
    return 'all';
  }

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const projectFilter = (ctx.understanding?.entities?.projectName as string) ?? null;
    const messageText = ctx.intake.normalized.contentText ?? '';
    const statsType = this.detectStatsType(messageText);

    logger.info('UC-013 LOOKUP: Aggregating business statistics', {
      requestId: ctx.requestId,
      statsType,
      projectFilter,
    });

    const adminDb = getAdminFirestore();
    const totalStats: AggregateUnitStats = { total: 0, sold: 0, available: 0, reserved: 0, other: 0 };
    const projectBreakdown: ProjectUnitBreakdown[] = [];
    let contactStats: ContactStats | null = null;
    let projectStats: ProjectStats | null = null;

    try {
      // ── Contact stats (if requested) ──
      if (statsType === 'contacts' || statsType === 'all') {
        const contactsSnapshot = await adminDb
          .collection(COLLECTIONS.CONTACTS)
          .where('companyId', '==', ctx.companyId)
          .get();

        let individuals = 0;
        let companies = 0;
        for (const doc of contactsSnapshot.docs) {
          const data = doc.data();
          const type = ((data.type ?? data.contactType ?? '') as string).toLowerCase();
          if (type === 'company' || type === 'εταιρεία' || type === 'εταιρία') {
            companies++;
          } else {
            individuals++;
          }
        }
        contactStats = { total: contactsSnapshot.size, individuals, companies };
      }

      // ── Project stats (if requested) ──
      const projectsSnapshot = await adminDb
        .collection(COLLECTIONS.PROJECTS)
        .where('companyId', '==', ctx.companyId)
        .get();

      const projectMap = new Map<string, string>();
      const projectNames: string[] = [];
      for (const doc of projectsSnapshot.docs) {
        const data = doc.data();
        const name = (data.name ?? data.title ?? 'Χωρίς όνομα') as string;
        projectMap.set(doc.id, name);
        projectNames.push(name);
      }

      if (statsType === 'projects' || statsType === 'all') {
        projectStats = { total: projectsSnapshot.size, names: projectNames };
      }

      // ── Unit stats (if requested) ──
      if (statsType === 'units' || statsType === 'all') {
        const unitsSnapshot = await adminDb
          .collection(COLLECTIONS.UNITS)
          .where('companyId', '==', ctx.companyId)
          .get();

        const perProject = new Map<string, ProjectUnitBreakdown>();

        for (const doc of unitsSnapshot.docs) {
          const data = doc.data();
          const projectId = (data.projectId as string) ?? 'unknown';
          const projectName = projectMap.get(projectId) ?? 'Χωρίς έργο';

          if (projectFilter) {
            const normalizedFilter = projectFilter.toLowerCase().trim();
            if (!projectName.toLowerCase().includes(normalizedFilter)) continue;
          }

          if (!perProject.has(projectId)) {
            perProject.set(projectId, {
              projectId, projectName,
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
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('UC-013 LOOKUP: Stats aggregation failed', {
        requestId: ctx.requestId,
        error: msg,
      });
    }

    const lookupData: BusinessStatsLookupData = {
      statsType,
      projectFilter,
      totalStats,
      projectBreakdown,
      contactStats,
      projectStats,
      companyId: ctx.companyId,
    };

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as BusinessStatsLookupData | undefined;
    const statsType = lookup?.statsType ?? 'units';

    // Build dynamic summary
    const summaryParts: string[] = [];
    if (lookup?.contactStats && (statsType === 'contacts' || statsType === 'all')) {
      summaryParts.push(`${lookup.contactStats.total} επαφές`);
    }
    if (lookup?.projectStats && (statsType === 'projects' || statsType === 'all')) {
      summaryParts.push(`${lookup.projectStats.total} έργα`);
    }
    if (lookup?.totalStats && (statsType === 'units' || statsType === 'all')) {
      summaryParts.push(`${lookup.totalStats.total} ακίνητα`);
    }
    const summary = summaryParts.length > 0
      ? `Στατιστικά: ${summaryParts.join(', ')}`
      : 'Δεν βρέθηκαν στοιχεία';

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_unit_stats_reply',
          params: {
            statsType,
            projectFilter: lookup?.projectFilter ?? null,
            totalStats: lookup?.totalStats ?? null,
            projectBreakdown: lookup?.projectBreakdown ?? [],
            contactStats: lookup?.contactStats ?? null,
            projectStats: lookup?.projectStats ?? null,
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
      const statsType = (params.statsType as StatsType) ?? 'units';
      const totalStats = params.totalStats as AggregateUnitStats | null;
      const projectBreakdown = (params.projectBreakdown as ProjectUnitBreakdown[]) ?? [];
      const projectFilter = params.projectFilter as string | null;
      const cStats = params.contactStats as ContactStats | null;
      const pStats = params.projectStats as ProjectStats | null;

      // Format reply based on stats type
      const lines: string[] = [];

      // ── Contact stats ──
      if (cStats && (statsType === 'contacts' || statsType === 'all')) {
        lines.push('Στατιστικά επαφών:');
        lines.push('');
        lines.push(`Σύνολο: ${cStats.total}`);
        lines.push(`  Φυσικά πρόσωπα: ${cStats.individuals}`);
        lines.push(`  Εταιρείες: ${cStats.companies}`);
      }

      // ── Project stats ──
      if (pStats && (statsType === 'projects' || statsType === 'all')) {
        if (lines.length > 0) lines.push('');
        lines.push('Στατιστικά έργων:');
        lines.push('');
        lines.push(`Σύνολο: ${pStats.total}`);
        if (pStats.names.length > 0) {
          for (const name of pStats.names) {
            lines.push(`  • ${name}`);
          }
        }
      }

      // ── Unit stats ──
      if (totalStats && (statsType === 'units' || statsType === 'all')) {
        if (lines.length > 0) lines.push('');
        if (projectFilter) {
          lines.push(`Στατιστικά ακινήτων (φίλτρο: "${projectFilter}"):`);
        } else {
          lines.push('Στατιστικά ακινήτων:');
        }
        lines.push('');
        lines.push(`Σύνολο: ${totalStats.total}`);
        lines.push(`  Πωλημένα: ${totalStats.sold}`);
        lines.push(`  Διαθέσιμα: ${totalStats.available}`);
        if (totalStats.reserved > 0) lines.push(`  Κρατημένα: ${totalStats.reserved}`);
        if (totalStats.other > 0) lines.push(`  Λοιπά: ${totalStats.other}`);

        if (projectBreakdown.length > 1) {
          lines.push('');
          lines.push('Ανά έργο:');
          for (const proj of projectBreakdown) {
            lines.push(`  ${proj.projectName}: ${proj.total} (${proj.sold} πωλ., ${proj.available} διαθ.)`);
          }
        }
      }

      if (lines.length === 0) {
        lines.push('Δεν βρέθηκαν στοιχεία.');
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
        inAppCommandId: (ctx.intake.rawPayload?.commandId as string) ?? undefined,
        subject: 'Στατιστικά επιχείρησης',
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
