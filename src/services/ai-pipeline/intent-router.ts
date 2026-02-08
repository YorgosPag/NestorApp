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

import type { UnderstandingResult, DetectedIntent, IUCModule } from '@/types/ai-pipeline';
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

/**
 * Multi-intent routing result
 * @enterprise Aggregates routing results for primary + secondary intents
 * @see ADR-131 (Multi-Intent Pipeline)
 */
export interface MultiRoutingResult {
  /** Routing result for the primary intent */
  primaryRoute: IntentRoutingResult;
  /** Routing results for secondary intents (above confidence threshold) */
  secondaryRoutes: IntentRoutingResult[];
  /** All routable UC modules (deduplicated, primary first) */
  allModules: IUCModule[];
  /** True if ANY intent needs manual review */
  needsManualReview: boolean;
  /** True if ALL routed intents are auto-approvable */
  allAutoApprovable: boolean;
}

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
   * Route multiple intents from a single message
   * Uses detectedIntents[] from UnderstandingResult (primary + secondaries)
   *
   * @param understanding - AI analysis result with detectedIntents
   * @returns Multi-routing result with all modules and aggregate decisions
   * @see ADR-131 (Multi-Intent Pipeline)
   */
  routeMultiple(understanding: UnderstandingResult): MultiRoutingResult {
    // 1. Route primary intent (existing logic)
    const primaryRoute = this.route(understanding);

    // 2. Route secondary intents (skip primary = index 0)
    const secondaryRoutes: IntentRoutingResult[] = (understanding.detectedIntents ?? [])
      .slice(1) // Skip primary
      .filter(di => di.confidence >= PIPELINE_CONFIDENCE_CONFIG.SECONDARY_INTENT_THRESHOLD)
      .map(di => this.routeSingleDetectedIntent(di));

    // 3. Collect all routable intents for module lookup
    const routableIntents = [
      ...(primaryRoute.routed ? [understanding.intent] : []),
      ...secondaryRoutes
        .filter((r): r is RoutedResult => r.routed)
        .map(r => {
          // Find the matching detected intent by moduleId
          const matchingDetected = understanding.detectedIntents.find(
            di => this.registry.getModuleForIntent(di.intent)?.moduleId === r.moduleId
          );
          return matchingDetected?.intent;
        })
        .filter((i): i is import('@/types/ai-pipeline').PipelineIntentTypeValue => i !== undefined),
    ];

    const allModules = this.registry.getModulesForIntents(routableIntents);

    // 4. Aggregate decisions
    const allRouted = [primaryRoute, ...secondaryRoutes].filter(
      (r): r is RoutedResult => r.routed
    );

    const needsManualReview = allRouted.some(r => r.needsManualReview) ||
      !primaryRoute.routed;

    const allAutoApprovable = allRouted.length > 0 &&
      allRouted.every(r => r.autoApprove);

    return {
      primaryRoute,
      secondaryRoutes,
      allModules,
      needsManualReview,
      allAutoApprovable,
    };
  }

  /**
   * Route a single detected intent (without threat/quarantine checks — those apply to the message level)
   * @private Used by routeMultiple() for secondary intents
   */
  private routeSingleDetectedIntent(detected: DetectedIntent): IntentRoutingResult {
    const module = this.registry.getModuleForIntent(detected.intent);
    if (!module) {
      return {
        routed: false,
        reason: 'no_module_registered',
        fallback: 'manual_triage',
        confidence: detected.confidence,
      };
    }

    const autoApprove =
      detected.confidence >= PIPELINE_CONFIDENCE_CONFIG.AUTO_APPROVE_THRESHOLD;
    const needsManualReview =
      detected.confidence < PIPELINE_CONFIDENCE_CONFIG.MANUAL_TRIAGE_THRESHOLD;

    if (detected.confidence < PIPELINE_CONFIDENCE_CONFIG.QUARANTINE_THRESHOLD) {
      return {
        routed: false,
        reason: 'low_confidence',
        fallback: 'manual_triage',
        confidence: detected.confidence,
      };
    }

    return {
      routed: true,
      moduleId: module.moduleId,
      autoApprove,
      needsManualReview,
      confidence: detected.confidence,
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
