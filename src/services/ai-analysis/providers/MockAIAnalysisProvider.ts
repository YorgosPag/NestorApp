/**
 * =============================================================================
 * MOCK AI ANALYSIS PROVIDER - DETERMINISTIC TESTING
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Mock provider με deterministic fixtures.
 * Provides consistent, reproducible results για testing.
 *
 * @module services/ai-analysis/providers/MockAIAnalysisProvider
 * @enterprise Deterministic test provider
 *
 * FEATURES:
 * - Deterministic output (same input → same output)
 * - Input-based fixture mapping
 * - NO randomness, NO external dependencies
 * - Instant response (<1ms)
 */

import type {
  IAIAnalysisProvider,
  AnalysisInput,
  ProviderOptions,
} from './IAIAnalysisProvider';
import type {
  AIAnalysisResult,
  MessageIntentAnalysis,
  DocumentClassifyAnalysis,
} from '@/schemas/ai-analysis';

// ============================================================================
// DETERMINISTIC FIXTURES
// ============================================================================

/**
 * Deterministic message intent fixtures
 * @enterprise Keyword-based mapping για consistent results
 */
const MESSAGE_INTENT_FIXTURES: Record<string, MessageIntentAnalysis> = {
  // Delivery intents
  delivery: {
    kind: 'message_intent',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.95,
    needsTriage: false,
    intentType: 'delivery',
    extractedEntities: {},
    rawMessage: 'delivery test message',
  },

  // Appointment intents
  appointment: {
    kind: 'message_intent',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.92,
    needsTriage: false,
    intentType: 'appointment',
    eventDate: '2026-01-15T10:00:00.000Z',
    extractedEntities: {},
    rawMessage: 'appointment test message',
  },

  // Issue intents
  issue: {
    kind: 'message_intent',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.88,
    needsTriage: false,
    intentType: 'issue',
    extractedEntities: {},
    rawMessage: 'issue test message',
  },

  // Payment intents
  payment: {
    kind: 'message_intent',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.90,
    needsTriage: false,
    intentType: 'payment',
    extractedEntities: {},
    rawMessage: 'payment test message',
  },

  // Info update intents
  info: {
    kind: 'message_intent',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.85,
    needsTriage: false,
    intentType: 'info_update',
    extractedEntities: {},
    rawMessage: 'info test message',
  },

  // Ambiguous (triage needed)
  ambiguous: {
    kind: 'message_intent',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.45,
    needsTriage: true,
    intentType: 'triage_needed',
    extractedEntities: {},
    rawMessage: 'ambiguous test message',
  },
};

/**
 * Deterministic document classification fixtures
 * @enterprise Keyword-based mapping για consistent results
 */
const DOCUMENT_CLASSIFY_FIXTURES: Record<string, DocumentClassifyAnalysis> = {
  // Invoice documents
  invoice: {
    kind: 'document_classify',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.96,
    needsTriage: false,
    documentType: 'invoice',
    extractedEntities: {},
    signals: ['has-vat-number', 'has-amount', 'has-date'],
  },

  // Contract documents
  contract: {
    kind: 'document_classify',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.94,
    needsTriage: false,
    documentType: 'contract',
    extractedEntities: {},
    signals: ['has-signature', 'has-terms', 'has-parties'],
  },

  // Photo exterior
  'photo-exterior': {
    kind: 'document_classify',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.91,
    needsTriage: false,
    documentType: 'photo-exterior',
    extractedEntities: {},
    signals: ['is-image', 'outdoor-scene'],
  },

  // Photo interior
  'photo-interior': {
    kind: 'document_classify',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.89,
    needsTriage: false,
    documentType: 'photo-interior',
    extractedEntities: {},
    signals: ['is-image', 'indoor-scene'],
  },

  // Floorplan
  floorplan: {
    kind: 'document_classify',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.93,
    needsTriage: false,
    documentType: 'floorplan',
    extractedEntities: {},
    signals: ['is-drawing', 'has-dimensions', 'architectural'],
  },

  // Unknown/other
  other: {
    kind: 'document_classify',
    aiModel: 'mock-provider-v1',
    analysisTimestamp: '2026-01-01T12:00:00.000Z',
    confidence: 0.50,
    needsTriage: true,
    documentType: 'other',
    extractedEntities: {},
    signals: [],
  },
};

// ============================================================================
// MOCK PROVIDER IMPLEMENTATION
// ============================================================================

/**
 * Mock AI Analysis Provider
 * @enterprise Deterministic provider για testing
 *
 * DETERMINISM STRATEGY:
 * - Keyword matching στο input text
 * - Predefined fixtures για common cases
 * - Fallback to default fixtures
 * - NO randomness, NO external calls
 */
export class MockAIAnalysisProvider implements IAIAnalysisProvider {
  readonly name = 'mock-provider';
  readonly version = 'v1.0.0';

  /**
   * Analyze input με deterministic fixtures
   */
  async analyze(
    input: AnalysisInput,
    options?: ProviderOptions
  ): Promise<AIAnalysisResult> {
    // Simulate processing delay (optional, for realistic testing)
    if (options?.debug) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    if (input.kind === 'message_intent') {
      return this.analyzeMessageIntent(input.messageText);
    } else {
      return this.analyzeDocument(input);
    }
  }

  /**
   * Health check (always healthy για mock)
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Analyze message intent με keyword matching
   */
  private analyzeMessageIntent(messageText: string): MessageIntentAnalysis {
    const lowerText = messageText.toLowerCase();

    // Keyword matching για deterministic results
    if (
      lowerText.includes('παράδοση') ||
      lowerText.includes('delivery') ||
      lowerText.includes('θα έρθουν') ||
      lowerText.includes('πλακάκια')
    ) {
      return {
        ...MESSAGE_INTENT_FIXTURES.delivery,
        rawMessage: messageText,
      };
    }

    if (
      lowerText.includes('ραντεβού') ||
      lowerText.includes('appointment') ||
      lowerText.includes('συνάντηση') ||
      lowerText.includes('συμβόλαιο')
    ) {
      return {
        ...MESSAGE_INTENT_FIXTURES.appointment,
        rawMessage: messageText,
      };
    }

    if (
      lowerText.includes('πρόβλημα') ||
      lowerText.includes('issue') ||
      lowerText.includes('βλάβη')
    ) {
      return {
        ...MESSAGE_INTENT_FIXTURES.issue,
        rawMessage: messageText,
      };
    }

    if (
      lowerText.includes('πληρωμή') ||
      lowerText.includes('payment') ||
      lowerText.includes('τιμολόγιο')
    ) {
      return {
        ...MESSAGE_INTENT_FIXTURES.payment,
        rawMessage: messageText,
      };
    }

    if (
      lowerText.includes('ενημέρωση') ||
      lowerText.includes('info') ||
      lowerText.includes('update')
    ) {
      return {
        ...MESSAGE_INTENT_FIXTURES.info,
        rawMessage: messageText,
      };
    }

    // Default: ambiguous (triage needed)
    return {
      ...MESSAGE_INTENT_FIXTURES.ambiguous,
      rawMessage: messageText,
    };
  }

  /**
   * Analyze document με filename/content matching
   */
  private analyzeDocument(
    input: Extract<AnalysisInput, { kind: 'document_classify' }>
  ): DocumentClassifyAnalysis {
    const filename = input.filename?.toLowerCase() || '';
    const contentStr =
      typeof input.content === 'string'
        ? input.content.toLowerCase()
        : '';

    // Filename-based matching
    if (
      filename.includes('invoice') ||
      filename.includes('τιμολ') ||
      contentStr.includes('invoice')
    ) {
      return DOCUMENT_CLASSIFY_FIXTURES.invoice;
    }

    if (
      filename.includes('contract') ||
      filename.includes('συμβ') ||
      contentStr.includes('contract')
    ) {
      return DOCUMENT_CLASSIFY_FIXTURES.contract;
    }

    // Photo classification: Keywords first, then fallback to generic image
    if (
      filename.includes('exterior') ||
      filename.includes('εξωτ') ||
      filename.includes('outside')
    ) {
      return DOCUMENT_CLASSIFY_FIXTURES['photo-exterior'];
    }

    if (
      filename.includes('interior') ||
      filename.includes('εσωτ') ||
      filename.includes('inside')
    ) {
      return DOCUMENT_CLASSIFY_FIXTURES['photo-interior'];
    }

    // Fallback για generic images (χωρίς specific keywords)
    if (input.mimeType?.startsWith('image/')) {
      // Default to exterior για generic photos
      return DOCUMENT_CLASSIFY_FIXTURES['photo-exterior'];
    }

    if (
      filename.includes('floorplan') ||
      filename.includes('κατοψ') ||
      filename.endsWith('.dxf')
    ) {
      return DOCUMENT_CLASSIFY_FIXTURES.floorplan;
    }

    // Default: other (triage needed)
    return DOCUMENT_CLASSIFY_FIXTURES.other;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create mock provider instance
 * @enterprise Factory για DI containers
 */
export function createMockAIAnalysisProvider(): IAIAnalysisProvider {
  return new MockAIAnalysisProvider();
}
