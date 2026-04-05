/**
 * =============================================================================
 * UC-013: ADMIN BUSINESS STATS MODULE — ADR-145
 * =============================================================================
 *
 * Super admin commands:
 *   "Πόσα ακίνητα έχουμε πωλημένα;" → property stats
 *   "Πόσες επαφές έχουμε;" → contact stats
 *   "Πόσα έργα έχουμε;" → project stats
 *
 * Detects stats type from the original message text and queries accordingly.
 *
 * @module services/ai-pipeline/modules/uc-013-admin-property-stats
 * @see ADR-145 (Super Admin AI Assistant)
 */

import 'server-only';

import { getPropertyTypeLabelEL } from '@/constants/property-types';
import {
  normalizeCommercialStatus,
  isListedCommercialStatus,
} from '@/constants/commercial-statuses';
import { isCompanyContactType } from '@/constants/contact-types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
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

const logger = createModuleLogger('UC_013_ADMIN_PROPERTY_STATS');

// ============================================================================
// TYPES
// ============================================================================

type StatsType = 'properties' | 'contacts' | 'projects' | 'all' | 'property_categories';

const VALID_STATS_TYPES: ReadonlySet<string> = new Set<StatsType>([
  'properties', 'contacts', 'projects', 'all', 'property_categories',
]);

function isValidStatsType(value: string): value is StatsType {
  return VALID_STATS_TYPES.has(value);
}

interface BusinessStatsLookupData {
  statsType: StatsType;
  projectFilter: string | null;
  totalStats: AggregatePropertyStats;
  projectBreakdown: ProjectPropertyBreakdown[];
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

interface AggregatePropertyStats {
  total: number;
  sold: number;
  available: number;
  reserved: number;
  other: number;
  /** Breakdown by property type (e.g., apartment: 5, studio: 3) */
  byType: Record<string, number>;
}

interface ProjectPropertyBreakdown {
  projectId: string;
  projectName: string;
  total: number;
  sold: number;
  available: number;
  reserved: number;
  other: number;
}

// ============================================================================
// PROPERTY TYPE LABEL RESOLVER — ADR-287 Batch 11B
// ============================================================================
// Delegates σε SSoT resolver (@/constants/property-types) για canonical
// Greek labels. Fallback για 'parking' (not a canonical PropertyType) και για
// unknown types (επιστρέφει το raw input όπως είχε πριν).

function resolvePropertyTypeLabel(typeKey: string): string {
  const canonicalLabel = getPropertyTypeLabelEL(typeKey);
  if (canonicalLabel !== null) return canonicalLabel;
  if (typeKey.trim().toLowerCase() === 'parking') return 'Parking';
  return typeKey;
}

// ============================================================================
// MODULE
// ============================================================================

export class AdminPropertyStatsModule implements IUCModule {
  readonly moduleId = 'UC-013';
  readonly displayName = 'Admin: Στατιστικά Επιχείρησης';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.ADMIN_PROPERTY_STATS,
  ];
  readonly requiredRoles: readonly string[] = [];

  // ── Helpers ──

  /**
   * Detect what type of stats the admin is asking about
   * by analyzing the original message text.
   */
  private detectStatsType(messageText: string): StatsType {
    const text = messageText.toLowerCase();

    // Category/type breakdown keywords — must check FIRST (before generic property keywords)
    const categoryKeywords = ['κατηγορί', 'τύπο', 'τυπο', 'είδ', 'ειδ', 'categories', 'types'];
    const hasCategories = categoryKeywords.some(kw => text.includes(kw));
    if (hasCategories && text.includes('ακίνητ')) return 'property_categories';

    const contactKeywords = ['επαφ', 'contact', 'πελάτ', 'φυσικ', 'εταιρ', 'πρόσωπ', 'customer', 'client'];
    const projectKeywords = ['έργ', 'project', 'πρότζεκτ'];
    const propertyKeywords = [
      // Property types
      'ακίνητ', 'property', 'μονάδ', 'διαμέρ', 'στούντι', 'σπίτι', 'σπίτ',
      'κατοικ', 'οικόπεδ', 'αποθήκ', 'γκαράζ', 'γραφεί', 'κατάστημ',
      'parking', 'στάθμ', 'μεζονέτ', 'ρετιρέ', 'loft', 'penthouse',
      // Status & sales
      'πωλημέν', 'πώληση', 'πουλημέν', 'πουλήθ', 'sold',
      'διαθέσ', 'available', 'κρατημέν', 'reserved', 'αδιάθετ',
    ];

    const hasContacts = contactKeywords.some(kw => text.includes(kw));
    const hasProjects = projectKeywords.some(kw => text.includes(kw));
    const hasProperties = propertyKeywords.some(kw => text.includes(kw));

    // If multiple → return 'all'; if specific → return that
    if (hasContacts && !hasProperties && !hasProjects) return 'contacts';
    if (hasProjects && !hasProperties && !hasContacts) return 'projects';
    if (hasProperties && !hasContacts && !hasProjects) return 'properties';
    if (hasCategories) return 'property_categories'; // fallback: categories asked but no "ακίνητ" keyword
    if (!hasContacts && !hasProjects && !hasProperties) return 'properties'; // default
    return 'all';
  }

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const projectFilter = (ctx.understanding?.entities?.projectName as string) ?? null;
    const messageText = ctx.intake.normalized.contentText ?? '';

    // AI tool calling extracts statsType semantically — fallback to keyword detection
    const aiStatsType = (ctx.understanding?.entities?.statsType as string) ?? null;
    const statsType: StatsType = (aiStatsType && isValidStatsType(aiStatsType))
      ? aiStatsType
      : this.detectStatsType(messageText);

    logger.info('UC-013 LOOKUP: Aggregating business statistics', {
      requestId: ctx.requestId,
      statsType,
      projectFilter,
    });

    const adminDb = getAdminFirestore();
    const totalStats: AggregatePropertyStats = { total: 0, sold: 0, available: 0, reserved: 0, other: 0, byType: {} };
    const projectBreakdown: ProjectPropertyBreakdown[] = [];
    let contactStats: ContactStats | null = null;
    let projectStats: ProjectStats | null = null;

    try {
      // ── Contact stats (if requested) ──
      if (statsType === 'contacts' || statsType === 'all') {
        const contactsSnapshot = await adminDb
          .collection(COLLECTIONS.CONTACTS)
          .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
          .get();

        let individuals = 0;
        let companies = 0;
        for (const doc of contactsSnapshot.docs) {
          const data = doc.data();
          // ADR-287 Batch 10B — Normalize via SSoT resolver (canonical ContactType)
          const rawType = data.type ?? data.contactType;
          if (isCompanyContactType(rawType)) {
            companies++;
          } else {
            // individuals bucket includes: 'individual', 'service', null, unknown
            individuals++;
          }
        }
        contactStats = { total: contactsSnapshot.size, individuals, companies };
      }

      // ── Project stats (if requested) ──
      const projectsSnapshot = await adminDb
        .collection(COLLECTIONS.PROJECTS)
        .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
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

      // ── Property stats (if requested) ──
      if (statsType === 'properties' || statsType === 'all' || statsType === 'property_categories') {
        const propertiesSnapshot = await adminDb
          .collection(COLLECTIONS.PROPERTIES)
          .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
          .get();

        const perProject = new Map<string, ProjectPropertyBreakdown>();

        for (const doc of propertiesSnapshot.docs) {
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

          // Collect property type for category breakdown
          const propertyType = ((data.type ?? '') as string);
          if (propertyType) {
            const typeKey = propertyType.toLowerCase();
            totalStats.byType[typeKey] = (totalStats.byType[typeKey] ?? 0) + 1;
          }

          // ADR-287 Batch 10A — Normalize via SSoT resolver (canonical CommercialStatus)
          const canonicalStatus = normalizeCommercialStatus(data.status);
          if (canonicalStatus === 'sold') {
            stats.sold++; totalStats.sold++;
          } else if (canonicalStatus && isListedCommercialStatus(canonicalStatus)) {
            // for-sale / for-rent / for-sale-and-rent → διαθέσιμο bucket
            stats.available++; totalStats.available++;
          } else if (canonicalStatus === 'reserved') {
            stats.reserved++; totalStats.reserved++;
          } else {
            // rented / unavailable / null (unknown) → λοιπά
            stats.other++; totalStats.other++;
          }
        }

        projectBreakdown.push(...Array.from(perProject.values()));
      }
    } catch (error) {
      const msg = getErrorMessage(error);
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
    const statsType = lookup?.statsType ?? 'properties';

    // Build dynamic summary
    const summaryParts: string[] = [];
    if (lookup?.contactStats && (statsType === 'contacts' || statsType === 'all')) {
      summaryParts.push(`${lookup.contactStats.total} επαφές`);
    }
    if (lookup?.projectStats && (statsType === 'projects' || statsType === 'all')) {
      summaryParts.push(`${lookup.projectStats.total} έργα`);
    }
    if (lookup?.totalStats && (statsType === 'properties' || statsType === 'all')) {
      summaryParts.push(`${lookup.totalStats.total} ακίνητα`);
    }
    const summary = summaryParts.length > 0
      ? `Στατιστικά: ${summaryParts.join(', ')}`
      : 'Δεν βρέθηκαν στοιχεία';

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_property_stats_reply',
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
      const action = actions.find(a => a.type === 'admin_property_stats_reply');

      if (!action) {
        return { success: false, sideEffects: [], error: 'No admin_property_stats_reply action found' };
      }

      const params = action.params;
      const statsType = (params.statsType as StatsType) ?? 'properties';
      const totalStats = params.totalStats as AggregatePropertyStats | null;
      const projectBreakdown = (params.projectBreakdown as ProjectPropertyBreakdown[]) ?? [];
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

      // ── Property stats ──
      if (totalStats && (statsType === 'properties' || statsType === 'all' || statsType === 'property_categories')) {
        if (lines.length > 0) lines.push('');

        if (statsType === 'property_categories') {
          // Category/type breakdown mode
          lines.push('Κατηγορίες ακινήτων:');
          lines.push('');
          lines.push(`Σύνολο: ${totalStats.total}`);

          const byType = totalStats.byType as Record<string, number>;
          const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);

          if (typeEntries.length > 0) {
            lines.push('');
            lines.push('Ανά τύπο:');
            for (const [typeName, count] of typeEntries) {
              const label = resolvePropertyTypeLabel(typeName);
              lines.push(`  ${label}: ${count}`);
            }
          } else {
            lines.push('');
            lines.push('Δεν βρέθηκαν καταχωρημένοι τύποι.');
          }
        } else {
          // Standard stats mode
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

          // Also show type breakdown if available
          const byType = totalStats.byType as Record<string, number>;
          const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
          if (typeEntries.length > 1) {
            lines.push('');
            lines.push('Ανά τύπο:');
            for (const [typeName, count] of typeEntries) {
              const label = resolvePropertyTypeLabel(typeName);
              lines.push(`  ${label}: ${count}`);
            }
          }

          if (projectBreakdown.length > 1) {
            lines.push('');
            lines.push('Ανά έργο:');
            for (const proj of projectBreakdown) {
              lines.push(`  ${proj.projectName}: ${proj.total} (${proj.sold} πωλ., ${proj.available} διαθ.)`);
            }
          }
        }
      }

      if (lines.length === 0) {
        lines.push('Δεν βρέθηκαν στοιχεία.');
      }

      const replyText = lines.join('\n');

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        ...extractChannelIds(ctx),
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
      const errorMessage = getErrorMessage(error);
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
