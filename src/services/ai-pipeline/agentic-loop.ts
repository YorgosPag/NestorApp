/**
 * =============================================================================
 * AGENTIC LOOP — Multi-Step Reasoning Engine (Chat Completions API)
 * =============================================================================
 *
 * Implements the agentic loop: AI calls tools iteratively until it produces
 * a final text answer. Each iteration:
 *   1. Send messages + tools to OpenAI Chat Completions API
 *   2. If AI requests tool calls → execute them, append results
 *   3. If AI returns text → done
 *
 * Uses Chat Completions API (not Responses API) because:
 * - Well-established multi-turn tool calling with tool_call_id tracking
 * - Proper assistant + tool message format for iterative reasoning
 * - Better error handling for complex multi-step flows
 *
 * Safety limits:
 * - maxIterations: 5 (prevent infinite loops)
 * - totalTimeoutMs: 50_000 (within Vercel 60s limit)
 * - perCallTimeoutMs: 15_000 (per OpenAI call)
 * - maxToolResultChars: 8000 (truncate large results)
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

// ── Chat Completions API types ──

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Only for assistant messages with tool calls */
  tool_calls?: ChatCompletionToolCall[];
  /** Only for tool result messages */
  tool_call_id?: string;
}

interface ChatCompletionToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatCompletionChoice {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: ChatCompletionToolCall[];
  };
  finish_reason: string;
}

const DEFAULT_CONFIG: AgenticLoopConfig = {
  maxIterations: 7,
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
1. Μπορείς να κάνεις πολλαπλά tool calls σε σειρά για σύνθετες ερωτήσεις
2. Αν δεν βρεις αποτελέσματα, δοκίμασε εναλλακτική αναζήτηση (π.χ. χωρίς φίλτρα, partial match, different field)
3. Απάντα ΠΑΝΤΑ στα Ελληνικά
4. Μην επιστρέφεις raw JSON — μορφοποίησε ωραία τα αποτελέσματα
5. Αν χρειάζονται πολλά βήματα (π.χ. "βρες κτήριο → βρες τις φάσεις"), κάνε τα βήματα σε σειρά
6. Στο τέλος δώσε σαφή, μορφοποιημένη απάντηση στον χρήστη
7. Για αριθμούς/ποσά/εμβαδά, χρησιμοποίησε μονάδες (€, τ.μ., κλπ)
8. Αν η ερώτηση είναι γενική/casual (π.χ. "γεια σου", "τι ώρα είναι;"), απάντησε κατευθείαν χωρίς tools
9. Τα values σε φίλτρα ΠΑΝΤΑ ως string (ακόμα και αριθμούς: "42", booleans: "true")
10. ΚΡΙΣΙΜΟ: ΠΑΝΤΑ κάλεσε tools πριν πεις ότι κάτι δεν δουλεύει! Μην παραιτηθείς χωρίς να δοκιμάσεις

ΥΠΟΧΡΕΩΤΙΚΑ JOINS — ΣΧΕΣΕΙΣ ΔΕΔΟΜΕΝΩΝ:
Τα δεδομένα είναι οργανωμένα σε ιεραρχία: projects → buildings → construction_phases → construction_tasks.
Όταν επιστρέφεις αποτελέσματα ΑΠΟ ΚΑΤΑΣΚΕΥΑΣΤΙΚΑ COLLECTIONS, ΠΑΝΤΑ κάνε resolve τα parent names:
- construction_phases: πάρε το buildingId → firestore_get_document("buildings", buildingId) → πάρε building.name + building.projectId → firestore_get_document("projects", projectId) → πάρε project.name
- construction_tasks: πάρε phaseId → resolve phase → resolve building → resolve project
- buildings: πάρε projectId → firestore_get_document("projects", projectId) → πάρε project.name
- units: πάρε buildingId → resolve building → resolve project
- Ποτέ μην δείχνεις φάσεις/κτήρια/μονάδες χωρίς να αναφέρεις ΣΕ ΠΟΙΟ ΕΡΓΟ και ΚΤΗΡΙΟ ανήκουν!

COLLECTIONS ΠΟΥ ΔΕΝ ΧΡΕΙΑΖΟΝΤΑΙ JOINS (απάντα κατευθείαν):
- contacts, leads, appointments, tasks, obligations, invoices, payments, messages
- Για αυτά: ΜΙΑ query αρκεί. ΜΗΝ κάνεις get_document για κάθε εγγραφή.
- Παράδειγμα: "ποιες επαφές υπάρχουν" → firestore_query("contacts") → μορφοποίηση → τέλος!

ΠΟΤΕ ΝΑ ΣΤΑΜΑΤΑΣ ΝΑ ΚΑΛΕΙΣ TOOLS:
- Αν έχεις ΗΔΗ τα δεδομένα που χρειάζεσαι → ΣΤΑΜΑΤΑ, δώσε απάντηση
- Αν μια query επέστρεψε αποτελέσματα → μορφοποίησέ τα αμέσως (εκτός αν χρειάζονται joins)
- ΜΗΝ ξανα-καλείς tool για δεδομένα που ήδη έχεις
- Μέγιστο 2-3 tool calls για απλές ερωτήσεις, 4-5 μόνο για σύνθετες με joins

ΣΗΜΑΝΤΙΚΟ ΓΙΑ DOCUMENT IDs:
- Κάθε αποτέλεσμα query επιστρέφει "id" (document ID)
- ΔΕΝ μπορείς να κάνεις filter where('id', '==', ...) — τα IDs δεν είναι Firestore fields!
- Για να πάρεις document με γνωστό ID χρησιμοποίησε firestore_get_document
- Παράδειγμα: αν πάρεις construction_phase με buildingId: "abc123", κάνε firestore_get_document("buildings", "abc123")

ΣΗΜΑΝΤΙΚΟ ΓΙΑ companyId:
- Το companyId προστίθεται ΑΥΤΟΜΑΤΑ σε κάθε query — ΜΗΝ το βάζεις στα filters
- Για child collections (construction_phases, construction_tasks, floors) το companyId αγνοείται αυτόματα
- Αυτά τα collections συνδέονται μέσω parent ID (buildingId, phaseId κλπ)

ΣΤΡΑΤΗΓΙΚΗ ΑΝΑΖΗΤΗΣΗΣ:
- Για "ποια έργα έχουν X": ξεκίνα από projects query
- Για "φάσεις κατασκευής": query construction_phases → για κάθε μοναδικό buildingId κάνε get_document("buildings") → για κάθε projectId κάνε get_document("projects") → παρουσίασε ομαδοποιημένα ανά Έργο > Κτήριο > Φάσεις
- Για "στατιστικά": χρήσε firestore_count αντί πλήρες query
- Αν query επιστρέφει 0 αποτελέσματα, δοκίμασε χωρίς φίλτρα ή με search_text
- ΠΟΤΕ μην δίνεις "δεν βρέθηκαν" αν δεν δοκίμασες τουλάχιστον 2 διαφορετικές αναζητήσεις

ΙΣΤΟΡΙΚΟ ΣΥΝΟΜΙΛΙΑΣ:
${historyStr}`;
}

// ============================================================================
// OPENAI CHAT COMPLETIONS API CALL
// ============================================================================

async function callChatCompletions(
  messages: ChatCompletionMessage[],
  tools: AgenticToolDefinition[],
  timeoutMs: number
): Promise<{
  message: ChatCompletionChoice['message'];
  finishReason: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;

  const requestBody = {
    model,
    messages,
    tools,
    tool_choice: 'auto' as const,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
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
      const errorText = await response.text().catch(() => '');
      let errorMsg = `OpenAI error (${response.status})`;
      try {
        const errorPayload = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorPayload.error?.message) {
          errorMsg = errorPayload.error.message;
        }
      } catch {
        if (errorText.length > 0 && errorText.length < 500) {
          errorMsg += `: ${errorText}`;
        }
      }
      throw new Error(errorMsg);
    }

    const payload = await response.json() as {
      choices?: ChatCompletionChoice[];
    };

    const choice = payload.choices?.[0];
    if (!choice) {
      throw new Error('OpenAI returned no choices');
    }

    return {
      message: choice.message,
      finishReason: choice.finish_reason,
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

  // Build message history for OpenAI Chat Completions
  const messages: ChatCompletionMessage[] = [
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
    content: userMessage,
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

    // Call OpenAI Chat Completions
    const remainingTimeMs = Math.min(
      cfg.perCallTimeoutMs,
      cfg.totalTimeoutMs - elapsed
    );

    const response = await callChatCompletions(messages, tools, remainingTimeMs);

    // Check for tool calls
    const toolCalls = response.message.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      // Add the assistant message WITH tool_calls to conversation
      messages.push({
        role: 'assistant',
        content: response.message.content ?? null,
        tool_calls: toolCalls,
      });

      // Execute each tool call and add results
      for (const tc of toolCalls) {
        const toolName = tc.function.name;
        const argsString = tc.function.arguments;
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
          callId: tc.id,
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

        // Add tool result message with matching tool_call_id
        messages.push({
          role: 'tool',
          content: truncatedResult,
          tool_call_id: tc.id,
        });
      }

      continue; // Next iteration — AI processes tool results
    }

    // No tool calls — AI generated final text answer
    const answer = response.message.content
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
