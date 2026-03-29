/**
 * =============================================================================
 * VERCEL AI SDK — TOOL ADAPTER (replaces agentic-tool-runner.ts + agentic-tool-definitions.ts)
 * =============================================================================
 *
 * Converts 26 AgenticToolDefinition[] (OpenAI JSON format) to Vercel AI SDK
 * ToolSet[string] format using jsonSchema(). Wraps each tool's execute with guardrail
 * checks (anti-fabrication, anti-hallucination, FIND-T).
 *
 * @module services/ai-pipeline/vercel-ai-tool-adapter
 * @see ADR-171 (Autonomous AI Agent — Vercel AI SDK migration)
 * @see ./agentic-tool-runner.ts (LEGACY — disabled, original tool runner with guardrails)
 * @see ./tools/agentic-tool-definitions.ts (REUSED — JSON schemas passed through jsonSchema())
 * @see ./agentic-guardrails.ts (REUSED — anti-fabrication + anti-hallucination functions)
 * @see ./tools/agentic-tool-executor.ts (REUSED — 13 domain handlers, business logic)
 */

import 'server-only';
import { jsonSchema, type ToolSet } from 'ai';
import type { AgenticToolDefinition } from './tools/agentic-tool-definitions';
import type { AgenticContext } from './tools/agentic-tool-executor';
import { getAgenticToolExecutor } from './tools/agentic-tool-executor';
import { isFabricatedContactValue, isHallucinatedContactName } from './agentic-guardrails';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('VERCEL_AI_TOOL_ADAPTER');

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCallRecord {
  name: string;
  args: string;
  result: string;
}

/** Mutable state shared across all tool execute closures within one request */
export interface ToolExecutionState {
  /** All tool call records across all steps */
  allToolCalls: ToolCallRecord[];
  /** Accumulated tool result strings for anti-fabrication checking */
  trustedSources: string[];
  /** Conversation texts for anti-hallucination context */
  conversationTexts: string[];
  /** Whether a search tool was called (for FIND-T guardrail) */
  searchToolCalled: boolean;
}

// ============================================================================
// CONSTANTS — SSoT (mirrored from agentic-tool-runner.ts)
// ============================================================================

/** Tools that require a contactId obtained from a prior search */
const TOOLS_REQUIRING_CONTACT_ID = new Set([
  'update_contact_field', 'append_contact_info', 'set_contact_esco',
  'manage_bank_account', 'manage_relationship', 'attach_file_to_contact',
]);

/** Tools that return contactIds in their results (search tools) */
const SEARCH_TOOL_NAMES = new Set([
  'search_text', 'firestore_query', 'create_contact',
]);

// ============================================================================
// MAIN CONVERTER
// ============================================================================

/**
 * Convert AgenticToolDefinition[] to Vercel AI SDK tool Record.
 *
 * Each tool's `execute` is a closure that captures:
 * - `userMessage` for anti-fabrication
 * - `context` for isAdmin, requestId, etc.
 * - `state` (mutable) for cross-tool guardrail context
 *
 * @param tools - The 26 OpenAI function-calling tool definitions
 * @param userMessage - Current user message text
 * @param context - Agentic context (companyId, isAdmin, channel, etc.)
 * @param state - Mutable state for cross-tool guardrail tracking
 * @param maxToolResultChars - Max chars per tool result (truncation)
 */
export function convertToolDefinitions(
  tools: AgenticToolDefinition[],
  userMessage: string,
  context: AgenticContext,
  state: ToolExecutionState,
  maxToolResultChars: number
): Record<string, ToolSet[string]> {
  const executor = getAgenticToolExecutor();
  const result: Record<string, ToolSet[string]> = {};

  for (const toolDef of tools) {
    const toolName = toolDef.function.name;

    result[toolName] = {
      description: toolDef.function.description,
      inputSchema: jsonSchema(toolDef.function.parameters),
      execute: async (args: Record<string, unknown>) => {
        logger.info('Executing tool via Vercel AI SDK', {
          requestId: context.requestId, tool: toolName,
        });

        const argsString = JSON.stringify(args);

        // ── Guardrail 1: Anti-fabrication (append_contact_info) ──
        if (toolName === 'append_contact_info') {
          const allSources = [userMessage, ...state.trustedSources];
          if (isFabricatedContactValue(args, userMessage, allSources)) {
            const fabricatedValue = String(args.value ?? '');
            logger.warn('Anti-fabrication: blocked tool with fabricated value', {
              requestId: context.requestId, tool: toolName, value: fabricatedValue,
            });
            const blocked = JSON.stringify({
              _blocked: true,
              error: `BLOCKED: Η τιμή "${fabricatedValue}" δεν αναφέρθηκε από τον χρήστη ούτε βρέθηκε σε έγγραφο. ΡΩΤΑ τον χρήστη να σου δώσει τη σωστή τιμή.`,
            });
            state.allToolCalls.push({ name: toolName, args: argsString, result: blocked });
            return blocked;
          }
        }

        // ── Guardrail 2: Anti-hallucination (create_contact) ──
        if (toolName === 'create_contact') {
          if (isHallucinatedContactName(args, state.conversationTexts)) {
            const hallName = `${args.firstName ?? ''} ${args.lastName ?? ''}`.trim();
            logger.warn('Anti-hallucination: blocked create_contact with fabricated name', {
              requestId: context.requestId, name: hallName,
            });
            const blocked = JSON.stringify({
              _blocked: true,
              error: `BLOCKED: Το όνομα "${hallName}" ΔΕΝ αναφέρεται πουθενά στη συνομιλία ή στο έγγραφο. Χρησιμοποίησε ΑΚΡΙΒΩΣ τα ονόματα που αναφέρονται στο έγγραφο ή στο μήνυμα του χρήστη. ΞΑΝΑΔΙΑΒΑΣΕ την ανάλυση εγγράφου και χρησιμοποίησε τα σωστά ονόματα.`,
            });
            state.allToolCalls.push({ name: toolName, args: argsString, result: blocked });
            return blocked;
          }
        }

        // ── Guardrail 3: FIND-T (contact ID verification) ──
        if (TOOLS_REQUIRING_CONTACT_ID.has(toolName) && context.isAdmin) {
          const contactId = String(args.contactId ?? '').trim();
          if (contactId && !state.searchToolCalled) {
            // Check if contactId exists in conversation context (from prior history)
            const contactIdInContext = state.conversationTexts.some(t => t.includes(contactId));
            if (!contactIdInContext) {
              logger.warn('FIND-T: blocked tool call — no prior search for contactId', {
                requestId: context.requestId, tool: toolName, contactId,
              });
              const blocked = JSON.stringify({
                _blocked: true,
                error: `BLOCKED: Δεν έχεις κάνει αναζήτηση πρώτα. ΠΡΕΠΕΙ να καλέσεις search_text ή firestore_query ΠΡΙΝ χρησιμοποιήσεις το ${toolName}. Πάρε το πραγματικό contactId από τα αποτελέσματα αναζήτησης.`,
              });
              state.allToolCalls.push({ name: toolName, args: argsString, result: blocked });
              return blocked;
            }
          }
        }

        // ── Execute tool via existing domain handlers ──
        const toolResult = await executor.executeTool(toolName, args, context);

        // Track search tool usage for FIND-T guardrail
        if (SEARCH_TOOL_NAMES.has(toolName)) {
          state.searchToolCalled = true;
        }

        // Format result — same format as legacy tool runner
        const resultStr = toolResult.success === false
          ? JSON.stringify({
            _blocked: true,
            error: toolResult.error,
            ...(toolResult.data ? { data: toolResult.data } : {}),
          })
          : JSON.stringify({
            _status: 'OK',
            ...(typeof toolResult.data === 'object' && toolResult.data !== null
              ? toolResult.data as Record<string, unknown>
              : { data: toolResult.data ?? 'done' }),
          });

        const truncatedResult = resultStr.length > maxToolResultChars
          ? resultStr.substring(0, maxToolResultChars) + '...[truncated]'
          : resultStr;

        // Append warning if present (ADR-259C)
        const finalResult = toolResult.warning
          ? `${truncatedResult}\n⚠️ WARNING: ${toolResult.warning}`
          : truncatedResult;

        // Record for tracking
        state.allToolCalls.push({ name: toolName, args: argsString, result: truncatedResult });
        // Add to trusted sources for anti-fabrication guardrail
        state.trustedSources.push(truncatedResult);

        return finalResult;
      },
    };
  }

  return result;
}

/**
 * Create a fresh ToolExecutionState for one request.
 * Pass conversation texts (user + assistant messages) for guardrail context.
 */
export function createToolExecutionState(
  conversationTexts: string[]
): ToolExecutionState {
  return {
    allToolCalls: [],
    trustedSources: [],
    conversationTexts,
    searchToolCalled: false,
  };
}
