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

interface GanttBuildingDetail {
  buildingName: string;
  phaseCount: number;
}

interface ProjectWithDetails {
  project: ProjectInfo;
  unitStats: UnitStats;
  hasGantt: boolean;
  buildingCount: number;
  /** Building-level Gantt details (Google-style: answer at EVERY level of hierarchy) */
  ganttDetails: GanttBuildingDetail[];
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
   *
   * STRATEGY: Bottom-Up Discovery (Google/OpenAI approach)
   * ──────────────────────────────────────────────────────
   * Uses REQUIRED fields only — never depends on optional companyId in buildings/units:
   *   Projects (companyId) → Buildings (projectId ✅) → Units (buildingId ✅)
   *                                                   → Phases (buildingId ✅)
   *
   * This ensures:
   * 1. ALL buildings are found (projectId is required, companyId is optional)
   * 2. ALL units are found (via buildingId, not companyId)
   * 3. ALL Gantt data is found (via buildingId)
   * 4. Response shows BOTH project-level AND building-level Gantt info
   */
  private async enrichProjectDetails(
    adminDb: FirebaseFirestore.Firestore,
    projects: Array<{ id: string; info: ProjectInfo }>,
    _companyId: string,
  ): Promise<ProjectWithDetails[]> {
    const projectIds = projects.map((p) => p.id);
    const BATCH_SIZE = 30; // Firestore 'in' operator max

    // ── STEP 1: Buildings by projectId (REQUIRED field — always populated) ──
    const buildingsByProject = new Map<string, Array<{ id: string; name: string }>>();
    const allBuildingIds: string[] = [];
    const buildingToProject = new Map<string, string>();

    for (let i = 0; i < projectIds.length; i += BATCH_SIZE) {
      const batch = projectIds.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;

      const snapshot = await adminDb
        .collection(COLLECTIONS.BUILDINGS)
        .where('projectId', 'in', batch)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const projId = data.projectId as string;
        allBuildingIds.push(doc.id);
        buildingToProject.set(doc.id, projId);

        if (!buildingsByProject.has(projId)) {
          buildingsByProject.set(projId, []);
        }
        buildingsByProject.get(projId)!.push({
          id: doc.id,
          name: (data.name as string) ?? doc.id,
        });
      }
    }

    logger.info('UC-011 ENRICH: Buildings discovery', {
      totalBuildings: allBuildingIds.length,
      projectsWithBuildings: buildingsByProject.size,
      projectIds: projectIds.slice(0, 5),
    });

    // ── STEP 2: Construction phases by buildingId → Gantt detection ──
    const buildingsWithGantt = new Set<string>();
    const ganttPhaseCount = new Map<string, number>();

    for (let i = 0; i < allBuildingIds.length; i += BATCH_SIZE) {
      const batch = allBuildingIds.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;

      const snapshot = await adminDb
        .collection(COLLECTIONS.CONSTRUCTION_PHASES)
        .where('buildingId', 'in', batch)
        .limit(1000)
        .get();

      for (const doc of snapshot.docs) {
        const bId = doc.data().buildingId as string;
        buildingsWithGantt.add(bId);
        ganttPhaseCount.set(bId, (ganttPhaseCount.get(bId) ?? 0) + 1);
      }
    }

    logger.info('UC-011 ENRICH: Gantt detection', {
      buildingsWithGantt: buildingsWithGantt.size,
      totalPhases: Array.from(ganttPhaseCount.values()).reduce((a, b) => a + b, 0),
    });

    // ── STEP 3: Units by buildingId → unit stats mapped to projects ──
    const unitsByProject = new Map<string, UnitStats>();

    for (let i = 0; i < allBuildingIds.length; i += BATCH_SIZE) {
      const batch = allBuildingIds.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;

      const snapshot = await adminDb
        .collection(COLLECTIONS.UNITS)
        .where('buildingId', 'in', batch)
        .limit(2000)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const bId = data.buildingId as string;
        const projId = buildingToProject.get(bId);
        if (!projId) continue;

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
    }

    // ── STEP 4: Assemble enriched results with building-level Gantt details ──
    const emptyStats: UnitStats = { total: 0, sold: 0, available: 0, reserved: 0, other: 0 };

    return projects.map(({ id, info }) => {
      const buildings = buildingsByProject.get(id) ?? [];
      const ganttBuildings = buildings
        .filter((b) => buildingsWithGantt.has(b.id))
        .map((b) => ({
          buildingName: b.name,
          phaseCount: ganttPhaseCount.get(b.id) ?? 0,
        }));

      return {
        project: info,
        unitStats: unitsByProject.get(id) ?? emptyStats,
        hasGantt: ganttBuildings.length > 0,
        buildingCount: buildings.length,
        ganttDetails: ganttBuildings,
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

    const { project, unitStats, hasGantt, buildingCount, ganttDetails } = details;
    const lines: string[] = [`Έργο: ${project.name}`];

    if (project.statusLabel) lines.push(`Κατάσταση: ${project.statusLabel}`);
    if (project.address) lines.push(`Διεύθυνση: ${project.address}`);
    if (project.progress > 0) lines.push(`Πρόοδος: ${project.progress}%`);
    if (buildingCount > 0) lines.push(`Κτήρια: ${buildingCount}`);

    // Gantt: show building-level details
    if (hasGantt && ganttDetails.length > 0) {
      const ganttLines = ganttDetails
        .map((g) => `  ${g.buildingName} (${g.phaseCount} φάσεις)`)
        .join('\n');
      lines.push(`Gantt: Ναι\n${ganttLines}`);
    } else {
      lines.push('Gantt: Όχι');
    }

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

    // Project entries — hierarchical with building-level Gantt details
    for (const { project, unitStats, hasGantt, buildingCount, ganttDetails } of projects) {
      const statusPart = project.statusLabel ? ` [${project.statusLabel}]` : '';
      const progressPart = project.progress > 0 ? ` ${project.progress}%` : '';
      const unitsPart = unitStats.total > 0
        ? ` | ${unitStats.total} units (${unitStats.sold} πωλ./${unitStats.available} διαθ.)`
        : '';
      const buildingsPart = buildingCount > 0 ? ` | ${buildingCount} κτήρια` : '';

      lines.push(`- ${project.name}${statusPart}${progressPart}${buildingsPart}${unitsPart}`);

      // Show building-level Gantt details (Google approach: answer at EVERY hierarchy level)
      if (hasGantt && ganttDetails.length > 0) {
        for (const g of ganttDetails) {
          lines.push(`    Gantt: ${g.buildingName} (${g.phaseCount} φάσεις)`);
        }
      }
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
