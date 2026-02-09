/**
 * =============================================================================
 * AI ANALYSIS PROVIDER INTERFACE
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Provider interface για AI analysis operations.
 * Enables dependency injection και testability.
 *
 * @module services/ai-analysis/providers/IAIAnalysisProvider
 * @enterprise Provider pattern για AI integration
 *
 * ARCHITECTURE:
 * - Interface-based design (DI-ready)
 * - Discriminated union input/output
 * - Provider-agnostic (OpenAI, Anthropic, Mock, etc.)
 */

import type { AIAnalysisResult } from '@/schemas/ai-analysis';

// ============================================================================
// ANALYSIS INPUT (Discriminated Union)
// ============================================================================

/**
 * Message intent analysis input
 * @enterprise For analyzing messages from communication channels
 */
export interface MessageIntentInput {
  /** Discriminator field */
  kind: 'message_intent';

  /** Message text to analyze */
  messageText: string;

  /** Optional context for better analysis */
  context?: {
    /** Sender name */
    senderName?: string;
    /** Channel source (telegram, email, viber) */
    channel?: string;
    /** Previous message in thread */
    previousMessage?: string;
    /** ADR-145: Whether the sender is a verified super admin (uses admin-specific prompt) */
    isAdminCommand?: boolean;
  };
}

/**
 * Document classification input
 * @enterprise For analyzing uploaded files/attachments
 *
 * ⚠️ SERVER-ONLY: Buffer type requires Node.js environment.
 * Do NOT import this interface in client-side code.
 */
export interface DocumentClassifyInput {
  /** Discriminator field */
  kind: 'document_classify';

  /** File content (text or buffer) - Buffer is server-only! */
  content: string | Buffer;

  /** Original filename (for context) */
  filename?: string;

  /** MIME type (for context) */
  mimeType?: string;

  /** File size in bytes (for context) */
  sizeBytes?: number;
}

/**
 * Analysis input (discriminated union)
 * @enterprise Use `input.kind` to discriminate between types
 */
export type AnalysisInput = MessageIntentInput | DocumentClassifyInput;

// ============================================================================
// PROVIDER OPTIONS
// ============================================================================

/**
 * Provider configuration options
 * @enterprise Runtime configuration for provider behavior
 */
export interface ProviderOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;

  /** Maximum retries on failure (default: 2) */
  maxRetries?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Custom model override (provider-specific) */
  model?: string;
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

/**
 * AI Analysis Provider Interface
 * @enterprise Implement this interface για custom AI providers
 *
 * @example MockAIAnalysisProvider - Deterministic test fixtures
 * @example OpenAIProvider - Real OpenAI API integration
 * @example AnthropicProvider - Claude API integration
 */
export interface IAIAnalysisProvider {
  /**
   * Provider name (for logging/debugging)
   * @example 'mock-provider', 'openai-provider', 'anthropic-provider'
   */
  readonly name: string;

  /**
   * Provider version (for audit trail)
   * @example '1.0.0', 'gpt-4o-2024-11-20'
   */
  readonly version: string;

  /**
   * Analyze input and return structured result
   *
   * @param input - Analysis input (message or document)
   * @param options - Provider options (timeout, retries, etc.)
   * @returns Promise resolving to AI analysis result
   * @throws Error if analysis fails after retries
   *
   * @enterprise
   * - MUST validate output με AIAnalysisResultSchema
   * - MUST include audit trail (model, timestamp)
   * - MUST handle timeouts gracefully
   * - MUST be idempotent (same input → same output για deterministic providers)
   */
  analyze(
    input: AnalysisInput,
    options?: ProviderOptions
  ): Promise<AIAnalysisResult>;

  /**
   * Health check για provider availability
   * @returns Promise resolving to true if provider is healthy
   *
   * @enterprise
   * - SHOULD NOT throw (return false on failure)
   * - SHOULD be fast (<1s)
   * - MAY skip for mock providers (always return true)
   */
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// PROVIDER FACTORY TYPE
// ============================================================================

/**
 * Provider factory function type
 * @enterprise For creating provider instances με configuration
 *
 * @example
 * ```typescript
 * const createOpenAIProvider: ProviderFactory = (config) => {
 *   return new OpenAIProvider(config.apiKey);
 * };
 * ```
 */
export type ProviderFactory = (config: {
  apiKey?: string;
  baseUrl?: string;
  [key: string]: unknown;
}) => IAIAnalysisProvider;
