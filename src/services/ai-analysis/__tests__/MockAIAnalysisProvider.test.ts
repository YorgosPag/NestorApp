/**
 * =============================================================================
 * MOCK AI ANALYSIS PROVIDER TESTS
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Test suite για MockAIAnalysisProvider.
 * Validates determinism, schema compliance, και provider contract.
 *
 * @module services/ai-analysis/__tests__/MockAIAnalysisProvider.test
 * @enterprise Quality gates για AI provider
 */

import { describe, it, expect } from '@jest/globals';
import { MockAIAnalysisProvider } from '../providers/MockAIAnalysisProvider';
import {
  validateAIAnalysisResult,
  safeValidateAIAnalysisResult,
  isMessageIntentAnalysis,
  isDocumentClassifyAnalysis,
} from '@/schemas/ai-analysis';
import type { MessageIntentInput, DocumentClassifyInput } from '../providers/IAIAnalysisProvider';

// ============================================================================
// TEST SUITE
// ============================================================================

describe('MockAIAnalysisProvider', () => {
  const provider = new MockAIAnalysisProvider();

  // ==========================================================================
  // PROVIDER METADATA TESTS
  // ==========================================================================

  describe('Provider Metadata', () => {
    it('should have correct name and version', () => {
      expect(provider.name).toBe('mock-provider');
      expect(provider.version).toBe('v1.0.0');
    });

    it('should pass health check', async () => {
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  // ==========================================================================
  // MESSAGE INTENT ANALYSIS TESTS
  // ==========================================================================

  describe('Message Intent Analysis', () => {
    it('should classify delivery messages', async () => {
      const input: MessageIntentInput = {
        kind: 'message_intent',
        messageText: 'Την Τετάρτη θα έρθουν τα πλακάκια',
      };

      const result = await provider.analyze(input);

      expect(result.kind).toBe('message_intent');
      expect(isMessageIntentAnalysis(result)).toBe(true);

      if (isMessageIntentAnalysis(result)) {
        expect(result.intentType).toBe('delivery');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.needsTriage).toBe(false);
        expect(result.aiModel).toBe('mock-provider-v1');
      }
    });

    it('should classify appointment messages', async () => {
      const input: MessageIntentInput = {
        kind: 'message_intent',
        messageText: 'Έχουμε ραντεβού για το συμβόλαιο',
      };

      const result = await provider.analyze(input);

      if (isMessageIntentAnalysis(result)) {
        expect(result.intentType).toBe('appointment');
        expect(result.confidence).toBeGreaterThan(0.8);
      }
    });

    it('should classify issue messages', async () => {
      const input: MessageIntentInput = {
        kind: 'message_intent',
        messageText: 'Υπάρχει πρόβλημα με την υδραυλική',
      };

      const result = await provider.analyze(input);

      if (isMessageIntentAnalysis(result)) {
        expect(result.intentType).toBe('issue');
      }
    });

    it('should classify payment messages', async () => {
      const input: MessageIntentInput = {
        kind: 'message_intent',
        messageText: 'Πληρωμή τιμολογίου',
      };

      const result = await provider.analyze(input);

      if (isMessageIntentAnalysis(result)) {
        expect(result.intentType).toBe('payment');
      }
    });

    it('should flag ambiguous messages for triage', async () => {
      const input: MessageIntentInput = {
        kind: 'message_intent',
        messageText: 'Γεια σου',
      };

      const result = await provider.analyze(input);

      if (isMessageIntentAnalysis(result)) {
        expect(result.intentType).toBe('triage_needed');
        expect(result.needsTriage).toBe(true);
        expect(result.confidence).toBeLessThan(0.6);
      }
    });
  });

  // ==========================================================================
  // DOCUMENT CLASSIFICATION TESTS
  // ==========================================================================

  describe('Document Classification', () => {
    it('should classify invoice documents', async () => {
      const input: DocumentClassifyInput = {
        kind: 'document_classify',
        content: 'Invoice #12345',
        filename: 'invoice_2026.pdf',
        mimeType: 'application/pdf',
      };

      const result = await provider.analyze(input);

      expect(result.kind).toBe('document_classify');
      expect(isDocumentClassifyAnalysis(result)).toBe(true);

      if (isDocumentClassifyAnalysis(result)) {
        expect(result.documentType).toBe('invoice');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.signals).toContain('has-vat-number');
        expect(result.needsTriage).toBe(false);
      }
    });

    it('should classify contract documents', async () => {
      const input: DocumentClassifyInput = {
        kind: 'document_classify',
        content: 'Contract agreement',
        filename: 'συμβόλαιο.pdf',
        mimeType: 'application/pdf',
      };

      const result = await provider.analyze(input);

      if (isDocumentClassifyAnalysis(result)) {
        expect(result.documentType).toBe('contract');
        expect(result.signals).toContain('has-signature');
      }
    });

    it('should classify exterior photos', async () => {
      const input: DocumentClassifyInput = {
        kind: 'document_classify',
        content: Buffer.from('fake image data'),
        filename: 'exterior_view.jpg',
        mimeType: 'image/jpeg',
      };

      const result = await provider.analyze(input);

      if (isDocumentClassifyAnalysis(result)) {
        expect(result.documentType).toBe('photo-exterior');
        expect(result.signals).toContain('is-image');
      }
    });

    it('should classify floorplans', async () => {
      const input: DocumentClassifyInput = {
        kind: 'document_classify',
        content: 'DXF drawing data',
        filename: 'κάτοψη.dxf',
        mimeType: 'application/dxf',
      };

      const result = await provider.analyze(input);

      if (isDocumentClassifyAnalysis(result)) {
        expect(result.documentType).toBe('floorplan');
        expect(result.signals).toContain('architectural');
      }
    });

    it('should flag unknown documents for triage', async () => {
      const input: DocumentClassifyInput = {
        kind: 'document_classify',
        content: 'Unknown content',
        filename: 'unknown.txt',
        mimeType: 'text/plain',
      };

      const result = await provider.analyze(input);

      if (isDocumentClassifyAnalysis(result)) {
        expect(result.documentType).toBe('other');
        expect(result.needsTriage).toBe(true);
      }
    });
  });

  // ==========================================================================
  // SCHEMA VALIDATION TESTS
  // ==========================================================================

  describe('Schema Validation', () => {
    it('should produce valid schema-compliant output for messages', async () => {
      const input: MessageIntentInput = {
        kind: 'message_intent',
        messageText: 'Test message',
      };

      const result = await provider.analyze(input);

      // Should not throw
      expect(() => validateAIAnalysisResult(result)).not.toThrow();

      // Safe validation should succeed
      const validation = safeValidateAIAnalysisResult(result);
      expect(validation.success).toBe(true);
    });

    it('should produce valid schema-compliant output for documents', async () => {
      const input: DocumentClassifyInput = {
        kind: 'document_classify',
        content: 'Test document',
        filename: 'test.pdf',
      };

      const result = await provider.analyze(input);

      // Should not throw
      expect(() => validateAIAnalysisResult(result)).not.toThrow();

      // Safe validation should succeed
      const validation = safeValidateAIAnalysisResult(result);
      expect(validation.success).toBe(true);
    });

    it('should reject invalid data', () => {
      const invalidData = {
        kind: 'invalid_kind',
        confidence: 'not-a-number', // Invalid type
      };

      expect(() => validateAIAnalysisResult(invalidData)).toThrow();

      const validation = safeValidateAIAnalysisResult(invalidData);
      expect(validation.success).toBe(false);
    });
  });

  // ==========================================================================
  // DETERMINISM TESTS
  // ==========================================================================

  describe('Determinism', () => {
    it('should return identical results for identical message inputs', async () => {
      const input: MessageIntentInput = {
        kind: 'message_intent',
        messageText: 'Παράδοση υλικών την Παρασκευή',
      };

      const result1 = await provider.analyze(input);
      const result2 = await provider.analyze(input);

      expect(result1).toEqual(result2);

      if (isMessageIntentAnalysis(result1) && isMessageIntentAnalysis(result2)) {
        expect(result1.intentType).toBe(result2.intentType);
        expect(result1.confidence).toBe(result2.confidence);
        expect(result1.needsTriage).toBe(result2.needsTriage);
      }
    });

    it('should return identical results for identical document inputs', async () => {
      const input: DocumentClassifyInput = {
        kind: 'document_classify',
        content: 'Invoice data',
        filename: 'invoice.pdf',
      };

      const result1 = await provider.analyze(input);
      const result2 = await provider.analyze(input);

      expect(result1).toEqual(result2);

      if (isDocumentClassifyAnalysis(result1) && isDocumentClassifyAnalysis(result2)) {
        expect(result1.documentType).toBe(result2.documentType);
        expect(result1.confidence).toBe(result2.confidence);
        expect(result1.signals).toEqual(result2.signals);
      }
    });
  });

  // ==========================================================================
  // COMMON FIELDS TESTS
  // ==========================================================================

  describe('Common Fields', () => {
    it('should include required common fields in all results', async () => {
      const input: MessageIntentInput = {
        kind: 'message_intent',
        messageText: 'Test',
      };

      const result = await provider.analyze(input);

      expect(result).toHaveProperty('aiModel');
      expect(result).toHaveProperty('analysisTimestamp');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('needsTriage');
      expect(result).toHaveProperty('extractedEntities');
      expect(result).toHaveProperty('kind');

      expect(typeof result.aiModel).toBe('string');
      expect(typeof result.analysisTimestamp).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.needsTriage).toBe('boolean');
      expect(typeof result.extractedEntities).toBe('object');
    });

    it('should have confidence between 0 and 1', async () => {
      const input: MessageIntentInput = {
        kind: 'message_intent',
        messageText: 'Test',
      };

      const result = await provider.analyze(input);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should have valid ISO datetime timestamp', async () => {
      const input: MessageIntentInput = {
        kind: 'message_intent',
        messageText: 'Test',
      };

      const result = await provider.analyze(input);

      // Should be valid ISO datetime
      expect(() => new Date(result.analysisTimestamp)).not.toThrow();
      expect(new Date(result.analysisTimestamp).toISOString()).toBe(
        result.analysisTimestamp
      );
    });
  });
});
