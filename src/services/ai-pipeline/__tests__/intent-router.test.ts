/**
 * INTENT ROUTER TESTS
 *
 * Tests centralized routing: confidence thresholds, threat quarantine,
 * module lookup, and multi-intent aggregation.
 *
 * @see ADR-080 (Pipeline), ADR-131 (Multi-Intent)
 * @module __tests__/intent-router
 */

jest.mock('@/config/ai-pipeline-config', () => ({
  PIPELINE_CONFIDENCE_CONFIG: {
    AUTO_APPROVE_THRESHOLD: 90,
    MANUAL_TRIAGE_THRESHOLD: 60,
    QUARANTINE_THRESHOLD: 30,
    SECONDARY_INTENT_THRESHOLD: 50,
  },
  PIPELINE_THREAT_CONFIG: {
    QUARANTINE_SENDER_TYPES: ['spam', 'phishing'],
    QUARANTINE_THREAT_LEVEL: 'high',
  },
}));

import { IntentRouter } from '../intent-router';
import { ModuleRegistry } from '../module-registry';
import type { UnderstandingResult, IUCModule, PipelineIntentTypeValue } from '@/types/ai-pipeline';
import { PipelineIntentType, ThreatLevel, SenderType, Urgency } from '@/types/ai-pipeline';

// ============================================================================
// HELPERS
// ============================================================================

function createMockModule(
  moduleId: string,
  intents: readonly PipelineIntentTypeValue[]
): IUCModule {
  return {
    moduleId,
    displayName: `Module ${moduleId}`,
    handledIntents: intents,
    requiredRoles: [],
    lookup: jest.fn(),
    propose: jest.fn(),
    execute: jest.fn(),
    acknowledge: jest.fn(),
  } as unknown as IUCModule;
}

function createUnderstanding(overrides?: Partial<UnderstandingResult>): UnderstandingResult {
  return {
    intent: PipelineIntentType.APPOINTMENT_REQUEST,
    confidence: 85,
    senderType: SenderType.CUSTOMER,
    urgency: Urgency.NORMAL,
    threatLevel: ThreatLevel.NONE,
    detectedIntents: [
      { intent: PipelineIntentType.APPOINTMENT_REQUEST, confidence: 85 },
    ],
    summary: 'Test message',
    ...overrides,
  } as UnderstandingResult;
}

function setupRouter(...modules: IUCModule[]): IntentRouter {
  const registry = new ModuleRegistry();
  for (const mod of modules) registry.register(mod);
  return new IntentRouter(registry);
}

// ============================================================================
// TESTS
// ============================================================================

describe('IntentRouter', () => {
  const appointmentModule = createMockModule('UC-001', [PipelineIntentType.APPOINTMENT_REQUEST]);
  const complaintModule = createMockModule('UC-004', [PipelineIntentType.COMPLAINT]);

  describe('route (single intent)', () => {
    it('routes to module when confidence above quarantine threshold', () => {
      const router = setupRouter(appointmentModule);
      const result = router.route(createUnderstanding({ confidence: 50 }));

      expect(result.routed).toBe(true);
      if (result.routed) {
        expect(result.moduleId).toBe('UC-001');
      }
    });

    it('auto-approves when confidence >= 90', () => {
      const router = setupRouter(appointmentModule);
      const result = router.route(createUnderstanding({ confidence: 95 }));

      expect(result.routed).toBe(true);
      if (result.routed) {
        expect(result.autoApprove).toBe(true);
        expect(result.needsManualReview).toBe(false);
      }
    });

    it('needs manual review when confidence < 60', () => {
      const router = setupRouter(appointmentModule);
      const result = router.route(createUnderstanding({ confidence: 45 }));

      expect(result.routed).toBe(true);
      if (result.routed) {
        expect(result.autoApprove).toBe(false);
        expect(result.needsManualReview).toBe(true);
      }
    });

    it('quarantines when confidence < 30 (low_confidence)', () => {
      const router = setupRouter(appointmentModule);
      const result = router.route(createUnderstanding({ confidence: 20 }));

      expect(result.routed).toBe(false);
      if (!result.routed) {
        expect(result.reason).toBe('low_confidence');
        expect(result.fallback).toBe('manual_triage');
      }
    });

    it('quarantines when threat level is high', () => {
      const router = setupRouter(appointmentModule);
      const result = router.route(
        createUnderstanding({ confidence: 95, threatLevel: ThreatLevel.HIGH })
      );

      expect(result.routed).toBe(false);
      if (!result.routed) {
        expect(result.reason).toBe('threat_detected');
        expect(result.fallback).toBe('quarantine');
      }
    });

    it('quarantines spam sender type', () => {
      const router = setupRouter(appointmentModule);
      const result = router.route(
        createUnderstanding({ confidence: 95, senderType: 'spam' as SenderType })
      );

      expect(result.routed).toBe(false);
      if (!result.routed) {
        expect(result.reason).toBe('threat_detected');
      }
    });

    it('quarantines phishing sender type', () => {
      const router = setupRouter(appointmentModule);
      const result = router.route(
        createUnderstanding({ confidence: 95, senderType: 'phishing' as SenderType })
      );

      expect(result.routed).toBe(false);
      if (!result.routed) {
        expect(result.reason).toBe('threat_detected');
      }
    });

    it('returns no_module_registered when no module handles intent', () => {
      const router = setupRouter(); // empty registry
      const result = router.route(createUnderstanding({ confidence: 95 }));

      expect(result.routed).toBe(false);
      if (!result.routed) {
        expect(result.reason).toBe('no_module_registered');
        expect(result.fallback).toBe('manual_triage');
      }
    });

    it('threat check runs before module lookup', () => {
      const router = setupRouter(); // no module registered
      const result = router.route(
        createUnderstanding({ threatLevel: ThreatLevel.HIGH })
      );

      // Threat → quarantine, not no_module_registered
      expect(result.routed).toBe(false);
      if (!result.routed) {
        expect(result.reason).toBe('threat_detected');
      }
    });

    it('preserves confidence in result', () => {
      const router = setupRouter(appointmentModule);
      const result = router.route(createUnderstanding({ confidence: 73 }));
      expect(result.confidence).toBe(73);
    });
  });

  describe('routeMultiple (multi-intent)', () => {
    it('routes primary and secondary intents', () => {
      const router = setupRouter(appointmentModule, complaintModule);

      const result = router.routeMultiple(
        createUnderstanding({
          intent: PipelineIntentType.APPOINTMENT_REQUEST,
          confidence: 85,
          detectedIntents: [
            { intent: PipelineIntentType.APPOINTMENT_REQUEST, confidence: 85 },
            { intent: PipelineIntentType.COMPLAINT, confidence: 70 },
          ],
        })
      );

      expect(result.primaryRoute.routed).toBe(true);
      expect(result.secondaryRoutes).toHaveLength(1);
      expect(result.secondaryRoutes[0].routed).toBe(true);
      expect(result.allModules).toHaveLength(2);
    });

    it('filters secondary intents below threshold (50)', () => {
      const router = setupRouter(appointmentModule, complaintModule);

      const result = router.routeMultiple(
        createUnderstanding({
          detectedIntents: [
            { intent: PipelineIntentType.APPOINTMENT_REQUEST, confidence: 85 },
            { intent: PipelineIntentType.COMPLAINT, confidence: 40 }, // below 50
          ],
        })
      );

      expect(result.secondaryRoutes).toHaveLength(0);
      expect(result.allModules).toHaveLength(1);
    });

    it('sets needsManualReview when primary unrouted', () => {
      const router = setupRouter(); // empty registry

      const result = router.routeMultiple(createUnderstanding({ confidence: 95 }));

      expect(result.primaryRoute.routed).toBe(false);
      expect(result.needsManualReview).toBe(true);
    });

    it('allAutoApprovable is true only when all routed intents are >= 90', () => {
      const router = setupRouter(appointmentModule, complaintModule);

      const result = router.routeMultiple(
        createUnderstanding({
          confidence: 95,
          detectedIntents: [
            { intent: PipelineIntentType.APPOINTMENT_REQUEST, confidence: 95 },
            { intent: PipelineIntentType.COMPLAINT, confidence: 92 },
          ],
        })
      );

      expect(result.allAutoApprovable).toBe(true);
    });

    it('allAutoApprovable is false when any routed intent < 90', () => {
      const router = setupRouter(appointmentModule, complaintModule);

      const result = router.routeMultiple(
        createUnderstanding({
          confidence: 95,
          detectedIntents: [
            { intent: PipelineIntentType.APPOINTMENT_REQUEST, confidence: 95 },
            { intent: PipelineIntentType.COMPLAINT, confidence: 75 },
          ],
        })
      );

      expect(result.allAutoApprovable).toBe(false);
    });

    it('deduplicates modules across intents', () => {
      const multiModule = createMockModule('UC-MULTI', [
        PipelineIntentType.APPOINTMENT_REQUEST,
        PipelineIntentType.COMPLAINT,
      ]);
      const router = setupRouter(multiModule);

      const result = router.routeMultiple(
        createUnderstanding({
          detectedIntents: [
            { intent: PipelineIntentType.APPOINTMENT_REQUEST, confidence: 85 },
            { intent: PipelineIntentType.COMPLAINT, confidence: 80 },
          ],
        })
      );

      expect(result.allModules).toHaveLength(1); // same module, deduplicated
    });
  });
});
