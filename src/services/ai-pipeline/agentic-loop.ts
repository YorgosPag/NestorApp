/**
 * =============================================================================
 * AGENTIC LOOP — Multi-Step Reasoning Engine
 * =============================================================================
 *
 * Implements the agentic loop: AI calls tools iteratively until it produces
 * a final text answer. Each iteration:
 *   1. Send messages + tools to OpenAI
 *   2. If AI requests tool calls → execute them, append results
 *   3. If AI returns text → done
 *
 * Safety limits:
 * - maxIterations: 5 (prevent infinite loops)
 * - totalTimeoutMs: 50_000 (within Vercel 60s limit)
 * - perCallTimeoutMs: 15_000 (per OpenAI call)
 * - maxToolResultTokens: 3000 (truncate large results)
 *
 * @module services/ai-pipeline/agentic-loop
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';

import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { getCompressedSchema } from '@/config/firestore-schema-map';
import { getAgenticToolExecutor } from './tools/agentic-tool-executor';
import type { AgenticContext } from './tools/agentic-tool-executor';
import type { AgenticToolDefinition } from './tools/agentic-tool-definitions';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('AGENTIC_LOOP');

// ============================================================================
// TYPES
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

export interface AgenticResult {
  answer: string;
  toolCalls: Array<{
    name: string;
    args: string;
    result: string;
  }>;
  iterations: number;
  totalDurationMs: number;
}

/** OpenAI Responses API message format */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: Array<{ type: 'input_text'; text: string }> | string;
  name?: string;
}

/** OpenAI Responses API output item */
interface OpenAIOutputItem {
  type: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  content?: Array<{ type: string; text?: string }>;
  text?: string;
}

const DEFAULT_CONFIG: AgenticLoopConfig = {
  maxIterations: 5,
  totalTimeoutMs: 50_000,
  perCallTimeoutMs: 15_000,
  maxToolResultChars: 8000,
};

// ============================================================================
// AGENTIC SYSTEM PROMPT BUILDER
// ============================================================================

function buildAgenticSystemPrompt(ctx: AgenticContext, chatHistory: ChatMessage[]): string {
  const schema = getCompressedSchema();

  // Format recent chat for context
  const historyStr = chatHistory.length > 0
    ? chatHistory
        .slice(-6) // Last 6 messages (3 turns)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 300)}`)
        .join('\n')
    : 'No previous messages.';

  return `Είσαι ο AI βοηθός του Nestor — μια εφαρμογή διαχείρισης κατασκευαστικών έργων.
Ο χρήστης είναι ο Super Admin. Έχεις πλήρη πρόσβαση στα δεδομένα.

${schema}

ΚΑΝΟΝΕΣ:
1. ΠΑΝΤΑ πρόσθεσε companyId filter στις queries (θα γίνει αυτόματα, αλλά βάλε το και εσύ)
2. Μπορείς να κάνεις πολλαπλά tool calls σε σειρά για σύνθετες ερωτήσεις
3. Αν δεν βρεις αποτελέσματα, δοκίμασε εναλλακτική αναζήτηση (π.χ. partial match, different field)
4. Απάντα ΠΑΝΤΑ στα Ελληνικά
5. Μην επιστρέφεις raw JSON — μορφοποίησε ωραία τα αποτελέσματα
6. Αν χρειάζονται πολλά βήματα (π.χ. "βρες επαφή → βρες τα έργα της"), κάνε τα βήματα σε σειρά
7. Στο τέλος δώσε σαφή, μορφοποιημένη απάντηση στον χρήστη
8. Για αριθμούς/ποσά/εμβαδά, χρησιμοποίησε μονάδες (€, τ.μ., κλπ)
9. Αν η ερώτηση είναι γενική/casual/μετάφραση, μην καλέσεις tools — απάντησε κατευθείαν

ΙΣΤΟΡΙΚΟ ΣΥΝΟΜΙΛΙΑΣ:
${historyStr}`;
}

// ============================================================================
// OPENAI API CALL
// ============================================================================

async function callOpenAI(
  messages: OpenAIMessage[],
  tools: AgenticToolDefinition[],
  timeoutMs: number
): Promise<{
  outputItems: OpenAIOutputItem[];
  outputText: string | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;

  // Convert messages to Responses API format
  const input = messages.map(msg => {
    if (msg.role === 'function') {
      // Function results go as user messages with tool context
      return {
        role: 'user' as const,
        content: [{ type: 'input_text' as const, text: `[Tool result for ${msg.name ?? 'unknown'}]:\n${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}` }],
      };
    }

    return {
      role: msg.role as 'system' | 'user',
      content: Array.isArray(msg.content)
        ? msg.content
        : [{ type: 'input_text' as const, text: msg.content }],
    };
  });

  const requestBody = {
    model,
    input,
    tools,
    tool_choice: 'auto' as const,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(errorPayload.error?.message ?? `OpenAI error (${response.status})`);
    }

    const payload = await response.json() as {
      output?: OpenAIOutputItem[];
      output_text?: string;
    };

    return {
      outputItems: Array.isArray(payload.output) ? payload.output : [],
      outputText: typeof payload.output_text === 'string' ? payload.output_text : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// MAIN AGENTIC LOOP
// ============================================================================

/**
 * Execute the agentic loop — AI reasons with tools iteratively.
 *
 * @param userMessage - The user's message
 * @param chatHistory - Previous conversation messages
 * @param tools - Available tool definitions
 * @param context - Execution context (companyId, permissions, etc.)
 * @param config - Loop configuration overrides
 * @returns Agentic result with answer and tool call history
 */
export async function executeAgenticLoop(
  userMessage: string,
  chatHistory: ChatMessage[],
  tools: AgenticToolDefinition[],
  context: AgenticContext,
  config?: Partial<AgenticLoopConfig>
): Promise<AgenticResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const executor = getAgenticToolExecutor();
  const allToolCalls: AgenticResult['toolCalls'] = [];

  // Build message history for OpenAI
  const messages: OpenAIMessage[] = [
    {
      role: 'system',
      content: buildAgenticSystemPrompt(context, chatHistory),
    },
  ];

  // Add chat history as alternating user/assistant messages
  for (const msg of chatHistory.slice(-6)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: [{ type: 'input_text', text: userMessage }],
  });

  logger.info('Starting agentic loop', {
    requestId: context.requestId,
    messageLength: userMessage.length,
    historyCount: chatHistory.length,
    maxIterations: cfg.maxIterations,
  });

  for (let iteration = 0; iteration < cfg.maxIterations; iteration++) {
    // Check total timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= cfg.totalTimeoutMs) {
      logger.warn('Agentic loop timeout', {
        requestId: context.requestId,
        iteration,
        elapsedMs: elapsed,
      });
      return {
        answer: 'Η αναζήτηση πήρε πολύ χρόνο. Δοκίμασε μια πιο συγκεκριμένη ερώτηση.',
        toolCalls: allToolCalls,
        iterations: iteration + 1,
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Call OpenAI
    const remainingTimeMs = Math.min(
      cfg.perCallTimeoutMs,
      cfg.totalTimeoutMs - elapsed
    );

    const response = await callOpenAI(messages, tools, remainingTimeMs);

    // Check for function calls
    const functionCalls = response.outputItems.filter(
      item => item.type === 'function_call'
    );

    if (functionCalls.length > 0) {
      // Execute each tool call
      for (const fc of functionCalls) {
        const toolName = fc.name ?? 'unknown';
        const argsString = fc.arguments ?? '{}';
        let toolArgs: Record<string, unknown> = {};

        try {
          toolArgs = JSON.parse(argsString) as Record<string, unknown>;
        } catch {
          toolArgs = {};
        }

        logger.info('Executing tool call', {
          requestId: context.requestId,
          iteration,
          tool: toolName,
        });

        const result = await executor.executeTool(toolName, toolArgs, context);

        const resultStr = JSON.stringify(result.data ?? result.error ?? 'no data');
        const truncatedResult = resultStr.length > cfg.maxToolResultChars
          ? resultStr.substring(0, cfg.maxToolResultChars) + '...[truncated]'
          : resultStr;

        allToolCalls.push({
          name: toolName,
          args: argsString,
          result: truncatedResult,
        });

        // Add tool result as function message for next iteration
        messages.push({
          role: 'function',
          name: toolName,
          content: truncatedResult,
        });
      }

      continue; // Next iteration — AI processes tool results
    }

    // No tool calls — AI generated final text answer
    const answer = response.outputText
      ?? extractTextFromOutput(response.outputItems)
      ?? 'Δεν μπόρεσα να επεξεργαστώ το αίτημα.';

    // Clean potential JSON wrapping
    const cleanedAnswer = cleanAITextReply(answer);

    logger.info('Agentic loop completed', {
      requestId: context.requestId,
      iterations: iteration + 1,
      toolCallsTotal: allToolCalls.length,
      totalDurationMs: Date.now() - startTime,
    });

    return {
      answer: cleanedAnswer,
      toolCalls: allToolCalls,
      iterations: iteration + 1,
      totalDurationMs: Date.now() - startTime,
    };
  }

  // Max iterations reached
  logger.warn('Agentic loop max iterations', {
    requestId: context.requestId,
    iterations: cfg.maxIterations,
    toolCallsTotal: allToolCalls.length,
  });

  return {
    answer: 'Ξεπέρασα το μέγιστο αριθμό βημάτων. Δοκίμασε μια πιο απλή ερώτηση.',
    toolCalls: allToolCalls,
    iterations: cfg.maxIterations,
    totalDurationMs: Date.now() - startTime,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract text content from OpenAI output items
 */
function extractTextFromOutput(items: OpenAIOutputItem[]): string | null {
  for (const item of items) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const entry of item.content) {
        if (entry.type === 'output_text' && typeof entry.text === 'string') {
          return entry.text.trim();
        }
      }
    }
  }
  return null;
}

/**
 * Clean AI text reply — strip JSON wrapping if present
 */
function cleanAITextReply(rawText: string): string {
  const trimmed = rawText.trim();

  // Strip markdown code blocks
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

  // Try to extract text from JSON wrapper
  if (candidate.startsWith('{')) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const textValue = parsed.response ?? parsed.message ?? parsed.error ?? parsed.text;
      if (typeof textValue === 'string' && textValue.length > 0) {
        return textValue;
      }
    } catch {
      // Not valid JSON — return as-is
    }
  }

  return trimmed;
}
