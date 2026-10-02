/**
 * =============================================================================
 * KNOWLEDGE BASE HANDLER — Legal Procedures & Document Availability Search
 * =============================================================================
 *
 * Extracted from customer-handler.ts for SRP compliance (Google N.7.1).
 *
 * Tools:
 * - search_knowledge_base: Search legal procedures & document availability
 *
 * @module services/ai-pipeline/tools/handlers/knowledge-base-handler
 * @see ADR-171 (Autonomous AI Agent)
 * @see SPEC-257G (Knowledge Base)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { ChecklistItem, ConveyanceRole } from '@/config/conveyance-checklist/types';
import type { DocumentSource, LegalProcedure } from '@/config/legal-procedures-kb';
import { filesForMatchers } from '@/lib/conveyance/evidence-match';
import {
  collectEvidenceForTargets,
  evidenceTargets,
  type EvidenceTarget,
} from '@/services/conveyance/conveyance-evidence.server';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  logger,
} from '../executor-shared';

/** Πόσες διαδικασίες επιστρέφονται στον agent. */
const TOP_PROCEDURES = 2;
/** Όριο ακινήτων ανά επαφή για τον έλεγχο διαθεσιμότητας (κόστος ανάγνωσης). */
const MAX_LINKED_PROPERTIES = 3;
/** Ο agent μιλά σε πελάτη-αγοραστή — βλέπει ό,τι βλέπει ο αγοραστής (ADR-901 Ε-7). */
const KB_VIEWER: ConveyanceRole = 'buyer';

const NO_MATCH_RESULT: ToolResult = {
  success: true,
  data: {
    message: 'Δεν βρέθηκε σχετική διαδικασία.',
    suggestion: 'Δοκιμάστε: "συμβόλαιο", "δάνειο", "μεταβίβαση", "προσύμφωνο"',
    procedures: [],
  },
  count: 0,
};

interface KbLabels {
  readonly sources: Readonly<Record<DocumentSource, string>>;
  readonly available: string;
}

/** Μία διαδικασία στο σχήμα που ξέρει ο agent — αμετάβλητο από το SPEC-257G. */
function enrichProcedure(procedure: LegalProcedure, matchScore: number, availableItemIds: ReadonlySet<string>, labels: KbLabels) {
  return {
    id: procedure.id,
    title: procedure.title,
    category: procedure.category,
    description: procedure.description,
    matchScore,
    requiredDocuments: procedure.requiredDocuments.map((doc) => {
      const available = availableItemIds.has(doc.itemId);
      return {
        name: doc.name,
        source: doc.source,
        sourceLabel: available ? labels.available : labels.sources[doc.source],
        availableInSystem: available,
        canBeSent: available,
      };
    }),
  };
}

// ============================================================================
// HANDLER
// ============================================================================

export class KnowledgeBaseHandler implements ToolHandler {
  readonly toolNames = ['search_knowledge_base'] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (toolName !== 'search_knowledge_base') {
      return { success: false, error: `Unknown KB tool: ${toolName}` };
    }
    return this.executeSearchKnowledgeBase(args, ctx);
  }

  // --------------------------------------------------------------------------
  // search_knowledge_base
  // --------------------------------------------------------------------------

  private async executeSearchKnowledgeBase(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const query = String(args.query ?? '').trim();
    if (!query) {
      return { success: false, error: 'query is required' };
    }

    const { searchProcedures, DOCUMENT_SOURCE_LABELS, AVAILABLE_IN_SYSTEM_LABEL } = await import(
      '@/config/legal-procedures-kb'
    );

    const matches = searchProcedures(query);
    if (matches.length === 0) return NO_MATCH_RESULT;

    const topMatches = matches.slice(0, TOP_PROCEDURES);
    const items = topMatches.flatMap(({ procedure }) => procedure.requiredDocuments.map((doc) => doc.item));
    const availableItemIds = await this.availableItemIds(items, ctx);
    const labels = { sources: DOCUMENT_SOURCE_LABELS, available: AVAILABLE_IN_SYSTEM_LABEL };
    const enrichedProcedures = topMatches.map((match) => enrichProcedure(match.procedure, match.matchScore, availableItemIds, labels));

    logger.info('Knowledge base search completed', {
      query,
      matchCount: matches.length,
      topMatch: enrichedProcedures[0]?.id,
      availableDocsCount: availableItemIds.size,
      requestId: ctx.requestId,
    });

    return {
      success: true,
      data: { procedures: enrichedProcedures },
      count: enrichedProcedures.length,
    };
  }

  // --------------------------------------------------------------------------
  // Διαθεσιμότητα — ο ΙΔΙΟΣ συλλέκτης/matcher με την υπόθεση μεταβίβασης (ADR-901 §2 Ε-Α)
  // --------------------------------------------------------------------------

  /** Τα (επίπεδο, οντότητα) που αφορούν την επαφή: τα ακίνητά της (με την ιεραρχία τους) + τα έργα της. */
  private async targetsFor(ctx: AgenticContext): Promise<EvidenceTarget[]> {
    const db = getAdminFirestore();
    const propertyIds = (ctx.contactMeta?.linkedPropertyIds ?? []).slice(0, MAX_LINKED_PROPERTIES);
    const subjects = await Promise.all(propertyIds.map((id) => loadConveyanceSubject(db, ctx.companyId, id)));
    const targets = subjects.flatMap((s) => (s ? [...evidenceTargets(s.subject, s.parties)] : []));
    const projectIds = new Set((ctx.contactMeta?.projectRoles ?? []).map((r) => r.projectId).filter(Boolean));
    for (const projectId of projectIds) targets.push({ level: 'project', entityType: ENTITY_TYPES.PROJECT, entityId: projectId });
    return targets;
  }

  /**
   * Ποιες γραμμές έχουν αρχείο-τεκμήριο. Μόνο γραμμές **ορατές στον αγοραστή** (ADR-901 §5.10):
   * ο agent μιλά σε πελάτη και δεν επιβεβαιώνει καν την ύπαρξη προσωπικών εγγράφων του πωλητή.
   */
  private async availableItemIds(items: readonly ChecklistItem[], ctx: AgenticContext): Promise<Set<string>> {
    const available = new Set<string>();
    const askable = items.filter((item) => item.visibleTo.includes(KB_VIEWER) && item.satisfaction.kind === 'files');
    if (askable.length === 0) return available;
    try {
      const evidence = await collectEvidenceForTargets(getAdminFirestore(), ctx.companyId, await this.targetsFor(ctx));
      for (const item of askable) {
        if (item.satisfaction.kind === 'files' && filesForMatchers(item.satisfaction.matchers, evidence).length > 0) {
          available.add(item.id);
        }
      }
    } catch (err) {
      logger.warn('Failed to check document availability for KB', { requestId: ctx.requestId, error: getErrorMessage(err) });
    }
    return available;
  }
}
