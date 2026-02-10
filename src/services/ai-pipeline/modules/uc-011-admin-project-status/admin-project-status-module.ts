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
 * Queries projects, units, buildings, and construction phases from Firestore.
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
// STATUS LABELS
// ============================================================================

const STATUS_LABELS: Record<string, string> = {
  planning: 'Σχεδιασμός',
  in_progress: 'Σε εξέλιξη',
  completed: 'Ολοκληρωμένο',
  on_hold: 'Σε αναμονή',
  cancelled: 'Ακυρωμένο',
};

// ============================================================================
// TYPES
// ============================================================================

/** Lookup mode: single project vs multi-project search */
type LookupMode = 'single' | 'list' | 'search';

interface ProjectInfo {
  projectId: string;
  name: string;
  status: string | null;
  statusLabel: string | null;
  address: string | null;
  description: string | null;
  progress: number;
  updatedAt: string | null;
}

interface UnitStats {
  total: number;
  sold: number;
  available: number;
  reserved: number;
  other: number;
}

interface ProjectWithDetails {
  project: ProjectInfo;
  unitStats: UnitStats;
  hasGantt: boolean;
  buildingCount: number;
}

interface ProjectLookupData {
  mode: LookupMode;
  searchTerm: string;
  searchCriteria: string | null;
  companyId: string;
  /** Single mode: one project */
  singleProject: ProjectWithDetails | null;
  /** List/search mode: all matching projects */
  projects: ProjectWithDetails[];
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
    const projectName = (ctx.understanding?.entities?.projectName as string) ?? null;
    const searchCriteria = (ctx.understanding?.entities?.searchCriteria as string) ?? null;

    // Determine mode
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
      const adminDb = getAdminFirestore();

      // Fetch all company projects
      const projectsSnapshot = await adminDb
        .collection(COLLECTIONS.PROJECTS)
        .where('companyId', '==', ctx.companyId)
        .limit(50)
        .get();

      if (projectsSnapshot.empty) {
        return lookupData as unknown as Record<string, unknown>;
      }

      // Build project list
      const allProjects: Array<{ id: string; info: ProjectInfo }> = [];
      for (const doc of projectsSnapshot.docs) {
        const data = doc.data();
        const status = (data.status as string) ?? null;
        allProjects.push({
          id: doc.id,
          info: {
            projectId: doc.id,
            name: (data.name ?? data.title ?? 'Χωρίς όνομα') as string,
            status,
            statusLabel: status ? (STATUS_LABELS[status] ?? status) : null,
            address: (data.address as string) ?? null,
            description: (data.description as string) ?? null,
            progress: typeof data.progress === 'number' ? data.progress : 0,
            updatedAt: (data.updatedAt as string) ?? (data.lastModified as string) ?? null,
          },
        });
      }

      // ── Single mode: find matching project ──
      if (mode === 'single' && projectName) {
        const normalizedSearch = projectName.toLowerCase().trim();
        const match = allProjects.find(
          (p) => p.info.name.toLowerCase().includes(normalizedSearch)
        );

        if (match) {
          const details = await this.enrichProjectDetails(adminDb, [match], ctx.companyId);
          lookupData.singleProject = details[0] ?? null;
        }
        return lookupData as unknown as Record<string, unknown>;
      }

      // ── List/Search mode: enrich all projects ──
      const enriched = await this.enrichProjectDetails(adminDb, allProjects, ctx.companyId);

      // ── Apply search criteria filter ──
      if (mode === 'search' && searchCriteria) {
        const criteria = searchCriteria.toLowerCase().trim();
        lookupData.projects = enriched.filter(
          (p) => this.matchesCriteria(p, criteria)
        );
      } else {
        lookupData.projects = enriched;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('UC-011 LOOKUP: Project query failed', {
        requestId: ctx.requestId,
        error: msg,
      });
    }

    return lookupData as unknown as Record<string, unknown>;
  }

  /**
   * Enrich projects with unit stats, building count, and Gantt availability.
   * Uses batch queries to minimize Firestore reads.
   */
  private async enrichProjectDetails(
    adminDb: FirebaseFirestore.Firestore,
    projects: Array<{ id: string; info: ProjectInfo }>,
    companyId: string,
  ): Promise<ProjectWithDetails[]> {
    const projectIds = projects.map((p) => p.id);

    // Batch: get all units for these projects
    const unitsSnapshot = await adminDb
      .collection(COLLECTIONS.UNITS)
      .where('companyId', '==', companyId)
      .get();

    // Batch: get all buildings for these projects
    const buildingsSnapshot = await adminDb
      .collection(COLLECTIONS.BUILDINGS)
      .where('companyId', '==', companyId)
      .get();

    // Index units by projectId
    const unitsByProject = new Map<string, UnitStats>();
    for (const unitDoc of unitsSnapshot.docs) {
      const data = unitDoc.data();
      const projId = data.projectId as string;
      if (!projectIds.includes(projId)) continue;

      if (!unitsByProject.has(projId)) {
        unitsByProject.set(projId, { total: 0, sold: 0, available: 0, reserved: 0, other: 0 });
      }
      const stats = unitsByProject.get(projId)!;
      stats.total++;
      const unitStatus = ((data.status ?? '') as string).toLowerCase();
      if (unitStatus === 'sold' || unitStatus === 'πωλημένο') stats.sold++;
      else if (unitStatus === 'available' || unitStatus === 'διαθέσιμο') stats.available++;
      else if (unitStatus === 'reserved' || unitStatus === 'κρατημένο') stats.reserved++;
      else stats.other++;
    }

    // Index buildings by projectId, track buildingIds
    const buildingsByProject = new Map<string, string[]>();
    const allCompanyBuildingIds = new Set<string>();
    for (const buildDoc of buildingsSnapshot.docs) {
      const data = buildDoc.data();
      const projId = data.projectId as string;
      allCompanyBuildingIds.add(buildDoc.id);
      if (!projectIds.includes(projId)) continue;

      if (!buildingsByProject.has(projId)) {
        buildingsByProject.set(projId, []);
      }
      buildingsByProject.get(projId)!.push(buildDoc.id);
    }

    // Gantt detection: query construction_phases by buildingId (batched)
    // Legacy phases may not have companyId, so we query per building batch
    const buildingsWithGantt = new Set<string>();
    const buildingIdArray = Array.from(allCompanyBuildingIds);

    // Firestore 'in' operator supports max 30 values per query
    const BATCH_SIZE = 30;
    for (let i = 0; i < buildingIdArray.length; i += BATCH_SIZE) {
      const batch = buildingIdArray.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;

      const phasesSnapshot = await adminDb
        .collection(COLLECTIONS.CONSTRUCTION_PHASES)
        .where('buildingId', 'in', batch)
        .limit(1000)
        .get();

      for (const phaseDoc of phasesSnapshot.docs) {
        const data = phaseDoc.data();
        buildingsWithGantt.add(data.buildingId as string);
      }
    }

    // Build enriched results
    return projects.map(({ id, info }) => {
      const unitStats = unitsByProject.get(id) ?? { total: 0, sold: 0, available: 0, reserved: 0, other: 0 };
      const buildingIds = buildingsByProject.get(id) ?? [];
      const hasGantt = buildingIds.some((bid) => buildingsWithGantt.has(bid));

      return {
        project: info,
        unitStats,
        hasGantt,
        buildingCount: buildingIds.length,
      };
    });
  }

  /**
   * Check if a project matches the search criteria.
   * Supports: gantt, status keywords, feature keywords.
   */
  private matchesCriteria(project: ProjectWithDetails, criteria: string): boolean {
    // Gantt/timeline criteria
    if (
      criteria.includes('gantt') ||
      criteria.includes('χρονοδιάγραμμα') ||
      criteria.includes('timeline') ||
      criteria.includes('φάσεις') ||
      criteria.includes('κατασκευ')
    ) {
      return project.hasGantt;
    }

    // Status criteria
    const statusMap: Record<string, string[]> = {
      planning: ['σχεδιασμ', 'planning', 'σχέδιο'],
      in_progress: ['εξέλιξη', 'progress', 'ενεργ', 'τρέχ'],
      completed: ['ολοκληρ', 'completed', 'τελειωμ', 'finished'],
      on_hold: ['αναμονή', 'hold', 'παύση'],
      cancelled: ['ακυρ', 'cancelled'],
    };

    for (const [status, keywords] of Object.entries(statusMap)) {
      if (keywords.some((kw) => criteria.includes(kw))) {
        return project.project.status === status;
      }
    }

    // Building count criteria
    if (criteria.includes('κτήρι') || criteria.includes('κτίρι') || criteria.includes('building')) {
      return project.buildingCount > 0;
    }

    // Units criteria
    if (criteria.includes('unit') || criteria.includes('ακίνητ') || criteria.includes('μονάδ')) {
      return project.unitStats.total > 0;
    }

    // Default: include all (no matching filter found)
    return true;
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
        ? this.formatSingleProjectReply(params)
        : this.formatMultiProjectReply(params);

      const telegramChatId = (params.telegramChatId as string)
        ?? (ctx.intake.rawPayload.chatId as string)
        ?? (ctx.intake.normalized.sender.telegramId)
        ?? undefined;

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
        telegramChatId: telegramChatId ?? undefined,
        inAppCommandId: (ctx.intake.rawPayload?.commandId as string) ?? undefined,
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('UC-011 EXECUTE: Failed', { requestId: ctx.requestId, error: errorMessage });
      return { success: false, sideEffects: [], error: errorMessage };
    }
  }

  // ── FORMAT HELPERS ──

  private formatSingleProjectReply(params: Record<string, unknown>): string {
    const details = params.singleProject as ProjectWithDetails | null;

    if (!details) {
      return `Δεν βρέθηκε έργο με όνομα "${(params.searchTerm as string) ?? ''}".`;
    }

    const { project, unitStats, hasGantt, buildingCount } = details;
    const lines: string[] = [`Έργο: ${project.name}`];

    if (project.statusLabel) lines.push(`Κατάσταση: ${project.statusLabel}`);
    if (project.address) lines.push(`Διεύθυνση: ${project.address}`);
    if (project.progress > 0) lines.push(`Πρόοδος: ${project.progress}%`);
    if (buildingCount > 0) lines.push(`Κτήρια: ${buildingCount}`);
    lines.push(`Gantt: ${hasGantt ? 'Ναι' : 'Όχι'}`);

    if (unitStats.total > 0) {
      lines.push('');
      lines.push(`Units: ${unitStats.total} σύνολο`);
      lines.push(`  Πωλημένα: ${unitStats.sold}`);
      lines.push(`  Διαθέσιμα: ${unitStats.available}`);
      if (unitStats.reserved > 0) lines.push(`  Κρατημένα: ${unitStats.reserved}`);
      if (unitStats.other > 0) lines.push(`  Λοιπά: ${unitStats.other}`);
    }

    if (project.updatedAt) lines.push(`\nΤελευταία ενημέρωση: ${project.updatedAt}`);
    return lines.join('\n');
  }

  private formatMultiProjectReply(params: Record<string, unknown>): string {
    const projects = (params.projects as ProjectWithDetails[]) ?? [];
    const searchCriteria = (params.searchCriteria as string) ?? null;
    const mode = params.mode as LookupMode;

    if (projects.length === 0) {
      if (searchCriteria) {
        return `Δεν βρέθηκαν έργα με κριτήριο "${searchCriteria}".`;
      }
      return 'Δεν βρέθηκαν έργα.';
    }

    const lines: string[] = [];

    // Header
    if (mode === 'search' && searchCriteria) {
      lines.push(`Έργα με κριτήριο "${searchCriteria}" (${projects.length}):`);
    } else {
      lines.push(`Όλα τα έργα (${projects.length}):`);
    }
    lines.push('');

    // Project entries
    for (const { project, unitStats, hasGantt, buildingCount } of projects) {
      const statusPart = project.statusLabel ? ` [${project.statusLabel}]` : '';
      const progressPart = project.progress > 0 ? ` ${project.progress}%` : '';
      const ganttPart = hasGantt ? ' | Gantt' : '';
      const unitsPart = unitStats.total > 0
        ? ` | ${unitStats.total} units (${unitStats.sold} πωλ./${unitStats.available} διαθ.)`
        : '';
      const buildingsPart = buildingCount > 0 ? ` | ${buildingCount} κτήρια` : '';

      lines.push(`- ${project.name}${statusPart}${progressPart}${buildingsPart}${unitsPart}${ganttPart}`);
    }

    return lines.join('\n');
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
