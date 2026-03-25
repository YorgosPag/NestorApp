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
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  logger,
} from '../executor-shared';

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

    const { searchProcedures, DOCUMENT_SOURCE_LABELS } = await import(
      '@/config/legal-procedures-kb'
    );

    const matches = searchProcedures(query);

    if (matches.length === 0) {
      return {
        success: true,
        data: {
          message: 'Δεν βρέθηκε σχετική διαδικασία.',
          suggestion: 'Δοκιμάστε: "συμβόλαιο", "δάνειο", "μεταβίβαση", "προσύμφωνο"',
          procedures: [],
        },
        count: 0,
      };
    }

    const db = getAdminFirestore();
    const linkedUnitIds = ctx.contactMeta?.linkedUnitIds ?? [];
    const linkedProjectIds = [...new Set(
      (ctx.contactMeta?.projectRoles ?? []).map(r => r.projectId).filter(Boolean),
    )];

    const termToDocNames = new Map<string, Set<string>>();
    for (const { procedure } of matches.slice(0, 2)) {
      for (const doc of procedure.requiredDocuments) {
        if (doc.source === 'system' && doc.searchTerms.length > 0) {
          for (const term of doc.searchTerms) {
            const existing = termToDocNames.get(term) ?? new Set();
            existing.add(doc.name);
            termToDocNames.set(term, existing);
          }
        }
      }
    }

    const availableDocNames = new Set<string>();

    if (termToDocNames.size > 0 && (linkedUnitIds.length > 0 || linkedProjectIds.length > 0)) {
      try {
        const filesQuery = db.collection(COLLECTIONS.FILES)
          .where('companyId', '==', ctx.companyId)
          .where('status', '==', 'ready')
          .limit(100);

        const filesSnap = await filesQuery.get();

        for (const fileDoc of filesSnap.docs) {
          const data = fileDoc.data();
          const purpose = String(data.purpose ?? '').toLowerCase();
          const category = String(data.category ?? '').toLowerCase();
          const displayName = String(data.displayName ?? '').toLowerCase();
          const entityId = String(data.entityId ?? '');
          const fileProjectId = String(data.projectId ?? '');

          const isAccessible =
            linkedUnitIds.includes(entityId) ||
            linkedProjectIds.includes(fileProjectId) ||
            linkedProjectIds.includes(entityId);

          if (!isAccessible) continue;

          const searchableText = `${purpose} ${category} ${displayName}`;

          for (const [term, docNames] of termToDocNames) {
            if (searchableText.includes(term.toLowerCase())) {
              for (const name of docNames) {
                availableDocNames.add(name);
              }
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to check document availability for KB', {
          requestId: ctx.requestId,
          error: getErrorMessage(err),
        });
      }
    }

    const enrichedProcedures = matches.slice(0, 2).map(({ procedure, matchScore }) => ({
      id: procedure.id,
      title: procedure.title,
      category: procedure.category,
      description: procedure.description,
      matchScore,
      requiredDocuments: procedure.requiredDocuments.map(doc => ({
        name: doc.name,
        source: doc.source,
        sourceLabel: DOCUMENT_SOURCE_LABELS[doc.source],
        availableInSystem: availableDocNames.has(doc.name),
        canBeSent: availableDocNames.has(doc.name),
      })),
    }));

    logger.info('Knowledge base search completed', {
      query,
      matchCount: matches.length,
      topMatch: enrichedProcedures[0]?.id,
      availableDocsCount: availableDocNames.size,
      requestId: ctx.requestId,
    });

    return {
      success: true,
      data: { procedures: enrichedProcedures },
      count: enrichedProcedures.length,
    };
  }
}
