/**
 * =============================================================================
 * VERCEL AI ENGINE — Drop-in replacement for agentic-loop.ts
 * =============================================================================
 *
 * Uses Vercel AI SDK `generateText()` with `maxSteps` instead of the custom
 * agentic loop. Same function signature, same return type (AgenticResult).
 *
 * Replaces:
 *   - ./agentic-loop.ts (LEGACY — custom multi-step loop)
 *   - ./agentic-openai-client.ts (LEGACY — raw fetch to OpenAI)
 *   - ./agentic-tool-runner.ts (LEGACY — manual tool execution + guardrails)
 *
 * Reuses:
 *   - ./agentic-system-prompt.ts — dynamic RBAC system prompt builder
 *   - ./agentic-guardrails.ts — anti-fabrication + anti-hallucination functions
 *   - ./tools/agentic-tool-executor.ts — 13 domain handlers (business logic)
 *   - ./tools/agentic-tool-definitions.ts — 26 tool JSON schemas (via jsonSchema())
 *   - ./agentic-reply-utils.ts — extractSuggestions, cleanAITextReply, enrichWithAttachments
 *   - ./prompt-enhancer.ts — ADR-173 learned patterns
 *   - ./chat-history-service.ts — Firestore chat history
 *
 * To ROLLBACK to legacy:
 *   In agentic-path-executor.ts, change:
 *     import { executeAgenticLoop } from './vercel-ai-engine';
 *   to:
 *     import { executeAgenticLoop } from './agentic-loop';
 *
 * @module services/ai-pipeline/vercel-ai-engine
 * @see ADR-171 (Autonomous AI Agent — Vercel AI SDK migration)
 */

import 'server-only';
import { generateText, stepCountIs, type ModelMessage, type ToolSet } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { AI_ANALYSIS_DEFAULTS, AI_COST_CONFIG } from '@/config/ai-analysis-config';
import { buildAgenticSystemPrompt } from './agentic-system-prompt';
import { enhanceSystemPrompt } from './prompt-enhancer';
import { extractSuggestions, cleanAITextReply, enrichWithAttachments } from './agentic-reply-utils';
import { convertToolDefinitions, createToolExecutionState, type ToolCallRecord } from './vercel-ai-tool-adapter';
import type { AgenticToolDefinition } from './tools/agentic-tool-definitions';
import type { AgenticContext } from './tools/agentic-tool-executor';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { captureMessage as sentryCaptureMessage } from '@/lib/telemetry/sentry';

const logger = createModuleLogger('VERCEL_AI_ENGINE');

// ============================================================================
// TYPES — Re-export compatible interfaces (drop-in for agentic-loop.ts)
// ============================================================================

export interface AgenticLoopConfig {
  maxIterations: number;
  totalTimeoutMs: number;
  perCallTimeoutMs: number;
  maxToolResultChars: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    name: string;
    args: string;
    result: string;
  }>;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AgenticResult {
  answer: string;
  suggestions: string[];
  toolCalls: ToolCallRecord[];
  iterations: number;
  totalDurationMs: number;
  /** ADR-259A: Aggregated token usage across all iterations */
  totalUsage: OpenAIUsage;
}

// ============================================================================
// CONFIG
// ============================================================================

const DEFAULT_CONFIG: AgenticLoopConfig = {
  maxIterations: AI_COST_CONFIG.LIMITS.ADMIN_MAX_ITERATIONS,
  totalTimeoutMs: process.env.NODE_ENV === 'production' ? 55_000 : 80_000,
  perCallTimeoutMs: 30_000,
  maxToolResultChars: 12_000,
};

// ============================================================================
// WRITE CLAIM DETECTION (Guardrails A & B — post-processing)
// ============================================================================

const WRITE_CLAIM_PATTERNS = /ολοκληρώθηκε|ενημερώθηκε|διορθώθηκε|αποθηκεύτηκε|ενημέρωσα|διόρθωσα|αποθήκευσα|άλλαξα|τροποποίησα|προστέθηκε|αφαιρέθηκε|δηλώθηκε/i;

const WRITE_TOOL_NAMES = new Set([
  'update_contact_field', 'append_contact_info', 'set_contact_esco',
  'firestore_write', 'manage_bank_account', 'manage_relationship',
  'create_contact', 'manage_activities', 'attach_file_to_contact',
]);

// ============================================================================
// OPENAI PROVIDER (lazy singleton)
// ============================================================================

let _openaiProvider: ReturnType<typeof createOpenAI> | null = null;

function getOpenAIProvider() {
  if (!_openaiProvider) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    _openaiProvider = createOpenAI({
      apiKey,
      baseURL: AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL,
    });
  }
  return _openaiProvider;
}

// ============================================================================
// MAIN FUNCTION — Drop-in replacement for executeAgenticLoop()
// ============================================================================

export async function executeAgenticLoop(
  userMessage: string,
  chatHistory: ChatMessage[],
  tools: AgenticToolDefinition[],
  context: AgenticContext,
  config?: Partial<AgenticLoopConfig>
): Promise<AgenticResult> {
  // ADR-259A: Role-aware maxIterations
  const roleMaxIterations = context.isAdmin
    ? AI_COST_CONFIG.LIMITS.ADMIN_MAX_ITERATIONS
    : AI_COST_CONFIG.LIMITS.CUSTOMER_MAX_ITERATIONS;
  const cfg = { ...DEFAULT_CONFIG, maxIterations: roleMaxIterations, ...config };
  const startTime = Date.now();

  // ADR-173: Fetch learned patterns for dynamic prompt enhancement
  const learnedPatterns = await enhanceSystemPrompt(userMessage);

  // Build system prompt (RBAC-aware, with Firestore schema)
  const systemPrompt = buildAgenticSystemPrompt(context, chatHistory, learnedPatterns);

  // Convert chat history to Vercel AI SDK ModelMessage format
  const { messages, conversationTexts, toolContextParts } = convertChatHistory(chatHistory);

  // Inject tool context as developer note (document IDs from prior tool calls)
  if (toolContextParts.length > 0) {
    messages.push({
      role: 'assistant',
      content: `[Εσωτερικό context — ΜΗΝ το αναφέρεις στον χρήστη] Document IDs από προηγούμενα tool calls: ${toolContextParts.join('; ')}`,
    });
    // Follow with empty user to maintain alternation
    messages.push({
      role: 'user',
      content: '(συνέχεια)',
    });
  }

  // Add current user message — with document images if available (ADR-265)
  const enrichedText = enrichWithAttachments(userMessage, context.attachments);
  if (context.documentImages && context.documentImages.length > 0) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text' as const, text: enrichedText },
        ...context.documentImages.map(img => ({
          type: 'image' as const,
          image: new URL(img.base64DataUri),
        })),
      ],
    });
  } else {
    messages.push({ role: 'user', content: enrichedText });
  }

  // Create mutable state for guardrail context across tool calls
  const allConversationTexts = [userMessage, ...conversationTexts];
  const toolState = createToolExecutionState(allConversationTexts);

  // Convert tools to Vercel AI SDK format with guardrailed execute closures
  const vercelTools = convertToolDefinitions(
    tools, userMessage, context, toolState, cfg.maxToolResultChars
  );

  logger.info('Starting Vercel AI engine', {
    requestId: context.requestId,
    messageLength: userMessage.length,
    historyCount: chatHistory.length,
    maxSteps: cfg.maxIterations,
  });

  // Set up timeout via AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.totalTimeoutMs);

  try {
    const model = AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;

    const result = await generateText({
      model: getOpenAIProvider()(model),
      system: systemPrompt,
      messages,
      tools: vercelTools,
      stopWhen: stepCountIs(cfg.maxIterations),
      abortSignal: controller.signal,
      maxRetries: 3,
    });

    clearTimeout(timeout);

    // Aggregate token usage across all steps (ADR-259A)
    const totalUsage = aggregateTokenUsage(result.steps);
    const iterations = result.steps.length;

    // Get final text
    let finalText = result.text || 'Δεν μπόρεσα να επεξεργαστώ το αίτημα.';
    finalText = cleanAITextReply(finalText);

    // Apply loop-level guardrails (post-processing)
    const guardrailResult = await applyPostProcessingGuardrails(
      finalText, toolState, context, cfg, systemPrompt, messages, vercelTools, model
    );

    if (guardrailResult) {
      finalText = guardrailResult.answer;
      // Merge additional token usage from retry
      totalUsage.prompt_tokens += guardrailResult.retryUsage.prompt_tokens;
      totalUsage.completion_tokens += guardrailResult.retryUsage.completion_tokens;
      totalUsage.total_tokens += guardrailResult.retryUsage.total_tokens;
    }

    // Extract suggestions
    const { cleanAnswer, suggestions } = extractSuggestions(finalText);

    logger.info('Vercel AI engine completed', {
      requestId: context.requestId,
      iterations,
      toolCallsTotal: toolState.allToolCalls.length,
      suggestionsCount: suggestions.length,
      totalDurationMs: Date.now() - startTime,
    });

    return {
      answer: cleanAnswer,
      suggestions,
      toolCalls: toolState.allToolCalls,
      iterations,
      totalDurationMs: Date.now() - startTime,
      totalUsage,
    };

  } catch (error: unknown) {
    clearTimeout(timeout);

    // Handle timeout (AbortError)
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Vercel AI engine timeout', {
        requestId: context.requestId,
        elapsedMs: Date.now() - startTime,
      });
      sentryCaptureMessage('Vercel AI engine timeout', 'warning', {
        tags: { component: 'vercel-ai-engine', channel: context.channel, isAdmin: String(context.isAdmin) },
        extra: { requestId: context.requestId, elapsedMs: Date.now() - startTime, toolCalls: toolState.allToolCalls.length },
      });
      return {
        answer: 'Η αναζήτηση πήρε πολύ χρόνο. Δοκίμασε μια πιο συγκεκριμένη ερώτηση.',
        suggestions: [],
        toolCalls: toolState.allToolCalls,
        iterations: 0,
        totalDurationMs: Date.now() - startTime,
        totalUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
    }

    // Re-throw other errors (will be caught by agentic-path-executor.ts)
    throw error;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert ChatMessage[] (legacy format) to Vercel AI SDK ModelMessage[].
 * Also extracts conversation texts for guardrail context and tool context parts.
 */
function convertChatHistory(chatHistory: ChatMessage[]): {
  messages: ModelMessage[];
  conversationTexts: string[];
  toolContextParts: string[];
} {
  const messages: ModelMessage[] = [];
  const conversationTexts: string[] = [];
  const toolContextParts: string[] = [];

  for (const msg of chatHistory.slice(-6)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
    conversationTexts.push(msg.content);

    // Collect document IDs + ESCO results from tool calls for internal context
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        const resultStr = tc.result ?? '';
        const idMatches = resultStr.match(/"id"\s*:\s*"([^"]+)"/g);
        const ids = idMatches
          ? idMatches.map(m => m.replace(/"id"\s*:\s*"/, '').replace(/"$/, '')).slice(0, 3)
          : [];
        if (ids.length > 0) {
          toolContextParts.push(`${tc.name}: ${ids.join(', ')}`);
        }
        // FIND-E fix: Preserve ESCO match results for disambiguation
        if (tc.name === 'search_esco_occupations' || tc.name === 'search_esco_skills' || tc.name === 'set_contact_esco') {
          toolContextParts.push(`ESCO(${tc.name}): ${resultStr.substring(0, 600)}`);
        }
      }
    }
  }

  return { messages, conversationTexts, toolContextParts };
}

/**
 * Aggregate token usage from Vercel AI SDK step results.
 * Maps to OpenAIUsage format (snake_case) for backward compatibility.
 */
function aggregateTokenUsage(steps: ReadonlyArray<{ usage?: { inputTokens?: number; outputTokens?: number } }>): OpenAIUsage {
  const usage: OpenAIUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  for (const step of steps) {
    if (step.usage) {
      const input = step.usage.inputTokens ?? 0;
      const output = step.usage.outputTokens ?? 0;
      usage.prompt_tokens += input;
      usage.completion_tokens += output;
      usage.total_tokens += input + output;
    }
  }

  return usage;
}

/**
 * Post-processing guardrails (A & B) — run after generateText() completes.
 *
 * Guardrail A: AI claims write but 0 tool calls → retry with correction.
 * Guardrail B: AI claims write but last write tool was blocked → retry with correction.
 *
 * Returns null if no guardrail triggered, or the corrected result.
 */
async function applyPostProcessingGuardrails(
  finalText: string,
  toolState: { allToolCalls: ToolCallRecord[] },
  context: AgenticContext,
  cfg: AgenticLoopConfig,
  systemPrompt: string,
  originalMessages: ModelMessage[],
  vercelTools: Record<string, unknown>,
  model: string
): Promise<{ answer: string; retryUsage: OpenAIUsage } | null> {
  const isWriteClaim = WRITE_CLAIM_PATTERNS.test(finalText);
  if (!isWriteClaim) return null;

  // Skip Guardrail A for file-only messages (describing analysis IS correct)
  const skipGuardrailA = context.isDocumentPreviewOnly === true;

  // Guardrail A: write claim but 0 tool calls
  if (toolState.allToolCalls.length === 0 && !skipGuardrailA) {
    logger.warn('Guardrail A: AI claimed write without tool calls — RETRYING', {
      requestId: context.requestId,
      claimedAnswer: finalText.slice(0, 100),
    });

    return retryWithCorrection(
      finalText,
      [
        'ΛΑΘΟΣ — δεν εκτέλεσες κανένα εργαλείο.',
        'Για να κάνεις αλλαγές ΠΡΕΠΕΙ να καλέσεις tools (search_esco_occupations, search_esco_skills, set_contact_esco, κλπ).',
        'Δεν αρκεί να πεις ότι έγινε — πρέπει να χρησιμοποιήσεις τα εργαλεία.',
        'ΞΕΚΙΝΑ ΤΩΡΑ: κάλεσε τα κατάλληλα εργαλεία.',
      ].join(' '),
      // Fallback if retry also fails
      'Δεν μπόρεσα να εκτελέσω την αλλαγή — χρειάζεται αναζήτηση και ενημέρωση μέσω εργαλείων. Δοκίμασε ξανά ή δώσε περισσότερες λεπτομέρειες (π.χ. όνομα επαφής + τιμή πεδίου).',
      systemPrompt, originalMessages, vercelTools, model, cfg
    );
  }

  // Guardrail B: write claim but last write tool was blocked
  const lastWriteCall = [...toolState.allToolCalls]
    .reverse()
    .find(tc => WRITE_TOOL_NAMES.has(tc.name));
  const lastWriteWasBlocked = lastWriteCall
    ? safeJsonParse<{ _blocked?: boolean }>(lastWriteCall.result, {})?._blocked === true
    : false;

  if (lastWriteWasBlocked) {
    logger.warn('Guardrail B: AI claimed write but last write was blocked — RETRYING', {
      requestId: context.requestId,
      blockedTool: lastWriteCall?.name,
      claimedAnswer: finalText.slice(0, 100),
    });

    return retryWithCorrection(
      finalText,
      [
        `ΛΑΘΟΣ — το εργαλείο ${lastWriteCall?.name} ΑΠΕΡΡΙΦΘΗ από τον server.`,
        'Η εγγραφή ΔΕΝ έγινε. Ο server σου επέστρεψε επιλογές (matches).',
        'ΠΡΕΠΕΙ να δείξεις τις επιλογές στον χρήστη και να ρωτήσεις "Ποιο εννοείς;".',
        'ΜΗΝ λες ότι ολοκληρώθηκε — δεν ολοκληρώθηκε.',
      ].join(' '),
      'Η εγγραφή δεν ολοκληρώθηκε — χρειάζεται αποσαφήνιση. Δοκίμασε ξανά.',
      systemPrompt, originalMessages, vercelTools, model, cfg
    );
  }

  return null;
}

/**
 * Retry once with a correction message appended to the conversation.
 * Returns the corrected answer + token usage from the retry call.
 */
async function retryWithCorrection(
  originalAnswer: string,
  correction: string,
  fallbackAnswer: string,
  systemPrompt: string,
  originalMessages: ModelMessage[],
  vercelTools: Record<string, unknown>,
  model: string,
  cfg: AgenticLoopConfig
): Promise<{ answer: string; retryUsage: OpenAIUsage }> {
  try {
    const retryMessages: ModelMessage[] = [
      ...originalMessages,
      { role: 'assistant', content: originalAnswer },
      { role: 'user', content: correction },
    ];

    const retryController = new AbortController();
    const retryTimeout = setTimeout(() => retryController.abort(), cfg.perCallTimeoutMs);

    const retryResult = await generateText({
      model: getOpenAIProvider()(model),
      system: systemPrompt,
      messages: retryMessages,
      tools: vercelTools as ToolSet,
      stopWhen: stepCountIs(cfg.maxIterations),
      abortSignal: retryController.signal,
    });

    clearTimeout(retryTimeout);

    const retryUsage = aggregateTokenUsage(retryResult.steps);
    const retryText = cleanAITextReply(retryResult.text || fallbackAnswer);
    const { cleanAnswer } = extractSuggestions(retryText);

    return { answer: cleanAnswer, retryUsage };
  } catch {
    // Retry failed — use fallback
    return {
      answer: fallbackAnswer,
      retryUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }
}
