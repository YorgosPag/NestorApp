/**
 * AGENTIC TOOL RUNNER — Execute tool calls with anti-hallucination guardrails.
 * Extracted from agentic-loop.ts for Single Responsibility (Google SRP).
 * @module services/ai-pipeline/agentic-tool-runner
 * @see ADR-171 (Autonomous AI Agent), ADR-263 (Anti-hallucination guardrails)
 */

import 'server-only';
import { isFabricatedContactValue, isHallucinatedContactName } from './agentic-guardrails';
import type { ChatCompletionMessage } from './agentic-openai-client';
import type { AgenticContext } from './tools/agentic-tool-executor';
import { getAgenticToolExecutor } from './tools/agentic-tool-executor';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('AGENTIC_TOOL_RUNNER');

export interface ToolCallRecord {
  name: string;
  args: string;
  result: string;
}

interface OpenAIToolCall {
  id: string;
  function: { name: string; arguments: string };
}

/**
 * Execute all tool calls for one agentic iteration.
 * Applies guardrails (anti-fabrication, anti-hallucination) before execution.
 * Returns tool call records and messages to append to the conversation.
 */
export async function executeToolCalls(
  toolCalls: OpenAIToolCall[],
  messages: ChatCompletionMessage[],
  userMessage: string,
  context: AgenticContext,
  iteration: number,
  maxToolResultChars: number
): Promise<{ records: ToolCallRecord[]; toolMessages: ChatCompletionMessage[] }> {
  const executor = getAgenticToolExecutor();
  const records: ToolCallRecord[] = [];
  const toolMessages: ChatCompletionMessage[] = [];

  for (const tc of toolCalls) {
    const toolName = tc.function.name;
    const argsString = tc.function.arguments;
    const toolArgs = safeJsonParse<Record<string, unknown>>(argsString, {});

    logger.info('Executing tool call', {
      requestId: context.requestId, iteration, tool: toolName, callId: tc.id,
    });

    // Guardrail 1: Anti-fabrication — block append_contact_info with values NOT in user message
    const fabricationBlock = checkFabricationGuardrail(toolName, toolArgs, userMessage, context);
    if (fabricationBlock) {
      records.push({ name: toolName, args: argsString, result: fabricationBlock });
      toolMessages.push({ role: 'tool', content: fabricationBlock, tool_call_id: tc.id });
      continue;
    }

    // Guardrail 2: Anti-hallucination — block create_contact if name NOT in conversation context
    const hallucinationBlock = checkHallucinationGuardrail(toolName, toolArgs, messages, context);
    if (hallucinationBlock) {
      records.push({ name: toolName, args: argsString, result: hallucinationBlock });
      toolMessages.push({ role: 'tool', content: hallucinationBlock, tool_call_id: tc.id });
      continue;
    }

    // Execute tool
    const result = await executor.executeTool(toolName, toolArgs, context);

    // Format result — include error + data for blocked tools (e.g. ESCO enforcement)
    const resultStr = result.success === false
      ? JSON.stringify({ _blocked: true, error: result.error, ...(result.data ? { data: result.data } : {}) })
      : JSON.stringify(result.data ?? 'no data');
    const truncatedResult = resultStr.length > maxToolResultChars
      ? resultStr.substring(0, maxToolResultChars) + '...[truncated]'
      : resultStr;

    // ADR-259C: Append warning to tool result so AI knows data may be degraded
    const toolResultContent = result.warning
      ? `${truncatedResult}\n⚠️ WARNING: ${result.warning}`
      : truncatedResult;

    records.push({ name: toolName, args: argsString, result: truncatedResult });
    toolMessages.push({ role: 'tool', content: toolResultContent, tool_call_id: tc.id });
  }

  return { records, toolMessages };
}

// ============================================================================
// GUARDRAIL CHECKS — return blocked JSON string or null (pass)
// ============================================================================

function checkFabricationGuardrail(
  toolName: string,
  toolArgs: Record<string, unknown>,
  userMessage: string,
  context: AgenticContext
): string | null {
  if (toolName !== 'append_contact_info') return null;
  if (!isFabricatedContactValue(toolArgs, userMessage)) return null;

  const fabricatedValue = String(toolArgs.value ?? '');
  logger.warn('Anti-fabrication: blocked tool with value not in user message', {
    requestId: context.requestId, tool: toolName, value: fabricatedValue,
  });
  return JSON.stringify({
    _blocked: true,
    error: `BLOCKED: Η τιμή "${fabricatedValue}" δεν αναφέρθηκε από τον χρήστη στο μήνυμά του. ΡΩΤΑ τον χρήστη να σου δώσει τη σωστή τιμή.`,
  });
}

function checkHallucinationGuardrail(
  toolName: string,
  toolArgs: Record<string, unknown>,
  messages: ChatCompletionMessage[],
  context: AgenticContext
): string | null {
  if (toolName !== 'create_contact') return null;

  const contextTexts = messages
    .map(m => (typeof m.content === 'string' ? m.content : '') ?? '')
    .filter(Boolean);

  if (!isHallucinatedContactName(toolArgs, contextTexts)) return null;

  const hallName = `${toolArgs.firstName ?? ''} ${toolArgs.lastName ?? ''}`.trim();
  logger.warn('Anti-hallucination: blocked create_contact with name not in context', {
    requestId: context.requestId, name: hallName,
  });
  return JSON.stringify({
    _blocked: true,
    error: `BLOCKED: Το όνομα "${hallName}" ΔΕΝ αναφέρεται πουθενά στη συνομιλία ή στο έγγραφο. Χρησιμοποίησε ΑΚΡΙΒΩΣ τα ονόματα που αναφέρονται στο έγγραφο ή στο μήνυμα του χρήστη. ΞΑΝΑΔΙΑΒΑΣΕ την ανάλυση εγγράφου και χρησιμοποίησε τα σωστά ονόματα.`,
  });
}
