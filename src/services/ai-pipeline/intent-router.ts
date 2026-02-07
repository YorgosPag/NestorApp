/**
 * =============================================================================
 * AI PIPELINE INTENT ROUTER
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Routes AI-detected intents to appropriate UC modules.
 * Handles confidence thresholds, threat detection, and fallback to manual triage.
 *
 * @module services/ai-pipeline/intent-router
 * @see ADR-080 (Pipeline Implementation)
 * @see docs/centralized-systems/ai/pipeline.md (Cross-Cutting Patterns)
 */

import type { UnderstandingResult } from '@/types/ai-pipeline';
import type { ModuleRegistry } from './module-registry';
import { PIPELINE_CONFIDENCE_CONFIG, PIPELINE_THREAT_CONFIG } from '@/config/ai-pipeline-config';

// ============================================================================
// ROUTING RESULT TYPES
// ============================================================================

/**
 * Result when intent is successfully routed to a module
 */
interface RoutedResult {
  routed: true;
  moduleId: string;
  autoApprove: boolean;
  needsManualReview: boolean;
  confidence: number;
}

/**
 * Result when intent cannot be routed
 */
interface UnroutedResult {
  routed: false;
  reason: 'no_module_registered' | 'threat_detected' | 'low_confidence';
  fallback: 'manual_triage' | 'quarantine';
  confidence: number;
}

/**
 * Discriminated union for routing results
 */
export type IntentRoutingResult = RoutedResult | UnroutedResult;

// ============================================================================
// INTENT ROUTER
// ============================================================================

/**
 * Routes understanding results to UC modules
 * @enterprise Centralized routing logic with confidence + threat checks
 */
export class IntentRouter {
  constructor(
    private registry: ModuleRegistry
  ) {}

  /**
   * Route an understanding result to the appropriate UC module
   *
   * @param understanding - AI analysis result with intent, confidence, threat level
   * @returns Routing result (routed to module or fallback)
   */
  route(understanding: UnderstandingResult): IntentRoutingResult {
    // 1. Threat detection — highest priority
    if (this.isThreatDetected(understanding)) {
      return {
        routed: false,
        reason: 'threat_detected',
        fallback: 'quarantine',
        confidence: understanding.confidence,
      };
    }

    // 2. Check if module exists for this intent
    const module = this.registry.getModuleForIntent(understanding.intent);
    if (!module) {
      return {
        routed: false,
        reason: 'no_module_registered',
        fallback: 'manual_triage',
        confidence: understanding.confidence,
      };
    }

    // 3. Confidence thresholds
    const autoApprove =
      understanding.confidence >= PIPELINE_CONFIDENCE_CONFIG.AUTO_APPROVE_THRESHOLD;
    const needsManualReview =
      understanding.confidence < PIPELINE_CONFIDENCE_CONFIG.MANUAL_TRIAGE_THRESHOLD;

    // 4. Low confidence → manual triage even if module exists
    if (understanding.confidence < PIPELINE_CONFIDENCE_CONFIG.QUARANTINE_THRESHOLD) {
      return {
        routed: false,
        reason: 'low_confidence',
        fallback: 'manual_triage',
        confidence: understanding.confidence,
      };
    }

    return {
      routed: true,
      moduleId: module.moduleId,
      autoApprove,
      needsManualReview,
      confidence: understanding.confidence,
    };
  }

  /**
   * Check if a message should be quarantined based on threat signals
   */
  private isThreatDetected(understanding: UnderstandingResult): boolean {
    // Check threat level
    if (understanding.threatLevel === PIPELINE_THREAT_CONFIG.QUARANTINE_THREAT_LEVEL) {
      return true;
    }

    // Check sender type
    const quarantineTypes: readonly string[] = PIPELINE_THREAT_CONFIG.QUARANTINE_SENDER_TYPES;
    if (quarantineTypes.includes(understanding.senderType)) {
      return true;
    }

    return false;
  }
}
