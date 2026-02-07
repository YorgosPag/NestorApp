/**
 * =============================================================================
 * AI PIPELINE AUDIT SERVICE
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Records every pipeline execution for full traceability.
 * Stores audit entries in the `ai_pipeline_audit` Firestore collection.
 *
 * @module services/ai-pipeline/audit-service
 * @see ADR-080 (Pipeline Implementation)
 * @see docs/centralized-systems/ai/pipeline.md (Audit Trail)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  PipelineContext,
  PipelineAuditEntry,
  AuditDecision,
} from '@/types/ai-pipeline';
import { PipelineIntentType } from '@/types/ai-pipeline';

// ============================================================================
// AUDIT SERVICE
// ============================================================================

/**
 * Records pipeline execution audit entries
 * @enterprise Every AI decision is recorded for compliance and debugging
 */
export class PipelineAuditService {
  /**
   * Record an audit entry for a pipeline execution
   *
   * @param ctx - Current pipeline context
   * @param decision - The decision taken (auto_processed, manual_triage, etc.)
   * @param moduleId - UC module that handled the request (if any)
   * @returns Firestore document ID of the audit entry
   */
  async record(
    ctx: PipelineContext,
    decision: AuditDecision,
    moduleId?: string
  ): Promise<string> {
    const adminDb = getAdminFirestore();

    const entry: PipelineAuditEntry = {
      requestId: ctx.requestId,
      timestamp: new Date().toISOString(),
      actionType: ctx.understanding?.intent ?? PipelineIntentType.UNKNOWN,
      useCase: moduleId ?? 'unrouted',
      companyId: ctx.companyId,
      projectId: ctx.understanding?.entities.projectId ?? null,
      initiatedBy: ctx.intake.normalized.sender.email
        ?? ctx.intake.normalized.sender.name
        ?? 'unknown',
      handledBy: ctx.approval?.approvedBy ?? 'AI-auto',
      aiConfidence: ctx.understanding?.confidence ?? 0,
      aiModel: 'pipeline-v1', // Updated per provider in production
      decision,
      details: {
        intent: ctx.understanding?.intent ?? null,
        senderType: ctx.understanding?.senderType ?? null,
        threatLevel: ctx.understanding?.threatLevel ?? null,
        proposalSummary: ctx.proposal?.summary ?? null,
        executionSuccess: ctx.executionResult?.success ?? null,
        sideEffects: ctx.executionResult?.sideEffects ?? null,
        errors: ctx.errors.length > 0 ? ctx.errors : null,
      },
      durationMs: Date.now() - new Date(ctx.startedAt).getTime(),
      pipelineState: ctx.state,
      channel: ctx.intake.channel,
      intent: ctx.understanding?.intent ?? PipelineIntentType.UNKNOWN,
    };

    const docRef = await adminDb
      .collection(COLLECTIONS.AI_PIPELINE_AUDIT)
      .add(entry);

    return docRef.id;
  }

  /**
   * Query audit entries for a specific company
   *
   * @param companyId - Tenant company ID
   * @param limit - Maximum entries to return
   * @returns Array of audit entries
   */
  async queryByCompany(
    companyId: string,
    limit: number = 50
  ): Promise<PipelineAuditEntry[]> {
    const adminDb = getAdminFirestore();

    const snapshot = await adminDb
      .collection(COLLECTIONS.AI_PIPELINE_AUDIT)
      .where('companyId', '==', companyId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data() as PipelineAuditEntry);
  }

  /**
   * Query audit entries for a specific request
   *
   * @param requestId - Pipeline request/correlation ID
   * @returns Array of audit entries for this request
   */
  async queryByRequestId(requestId: string): Promise<PipelineAuditEntry[]> {
    const adminDb = getAdminFirestore();

    const snapshot = await adminDb
      .collection(COLLECTIONS.AI_PIPELINE_AUDIT)
      .where('requestId', '==', requestId)
      .orderBy('timestamp', 'asc')
      .get();

    return snapshot.docs.map(doc => doc.data() as PipelineAuditEntry);
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let auditServiceInstance: PipelineAuditService | null = null;

/**
 * Get or create PipelineAuditService singleton
 */
export function getPipelineAuditService(): PipelineAuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = new PipelineAuditService();
  }
  return auditServiceInstance;
}
