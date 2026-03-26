/**
 * AGENTIC LOOP — Multi-step AI reasoning with iterative tool calling.
 * AI calls tools until it produces a final text answer.
 * @module services/ai-pipeline/agentic-loop
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';
import { AI_COST_CONFIG } from '@/config/ai-analysis-config';
import { callChatCompletions } from './agentic-openai-client';
import type { OpenAIUsage, ChatCompletionMessage } from './agentic-openai-client';
import type { AgenticContext } from './tools/agentic-tool-executor';
import type { AgenticToolDefinition } from './tools/agentic-tool-definitions';
import { executeToolCalls, type ToolCallRecord } from './agentic-tool-runner';
import { enhanceSystemPrompt } from './prompt-enhancer';
import { buildAgenticSystemPrompt } from './agentic-system-prompt';
import { extractSuggestions, cleanAITextReply, enrichWithAttachments } from './agentic-reply-utils';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { captureMessage as sentryCaptureMessage } from '@/lib/telemetry/sentry';

const logger = createModuleLogger('AGENTIC_LOOP');

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
export type { OpenAIUsage } from './agentic-openai-client';

export interface AgenticResult {
  answer: string;
  suggestions: string[];
  toolCalls: ToolCallRecord[];
  iterations: number;
  totalDurationMs: number;
  /** ADR-259A: Aggregated token usage across all iterations */
  totalUsage: OpenAIUsage;
}

const DEFAULT_CONFIG: AgenticLoopConfig = {
  // SSoT: AI_COST_CONFIG.LIMITS — overridden per role in executeAgenticLoop()
  maxIterations: AI_COST_CONFIG.LIMITS.ADMIN_MAX_ITERATIONS,
  // 55s for Vercel (60s limit), but localhost has no limit
  totalTimeoutMs: process.env.NODE_ENV === 'production' ? 55_000 : 120_000,
  perCallTimeoutMs: 30_000,
  maxToolResultChars: 12_000,
};

export async function executeAgenticLoop(
  userMessage: string,
  chatHistory: ChatMessage[],
  tools: AgenticToolDefinition[],
  context: AgenticContext,
  config?: Partial<AgenticLoopConfig>
): Promise<AgenticResult> {
  // ADR-259A: Role-aware maxIterations (customer: 8, admin: 15)
  const roleMaxIterations = context.isAdmin
    ? AI_COST_CONFIG.LIMITS.ADMIN_MAX_ITERATIONS
    : AI_COST_CONFIG.LIMITS.CUSTOMER_MAX_ITERATIONS;
  const cfg = { ...DEFAULT_CONFIG, maxIterations: roleMaxIterations, ...config };
  const startTime = Date.now();
  const allToolCalls: AgenticResult['toolCalls'] = [];
  // ADR-259A: Aggregate token usage across all iterations
  const totalUsage: OpenAIUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  // ADR-173: Fetch learned patterns for dynamic prompt enhancement
  const learnedPatterns = await enhanceSystemPrompt(userMessage);

  // Build message history for OpenAI Chat Completions
  const messages: ChatCompletionMessage[] = [
    {
      role: 'system',
      content: buildAgenticSystemPrompt(context, chatHistory, learnedPatterns),
    },
  ];

  // Add chat history as alternating user/assistant messages
  // Tool call context injected as system note (not inside assistant content — prevents AI from copying technical IDs into replies)
  const toolContextParts: string[] = [];

  for (const msg of chatHistory.slice(-6)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });

    // Collect document IDs + ESCO results from tool calls for internal context (system-level, not user-facing)
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
        // FIND-E fix: Preserve ESCO match results so AI can map "1" → URI for disambiguation
        if (tc.name === 'search_esco_occupations' || tc.name === 'search_esco_skills' || tc.name === 'set_contact_esco') {
          toolContextParts.push(`ESCO(${tc.name}): ${resultStr.substring(0, 600)}`);
        }
      }
    }
  }

  // Inject tool context as system note (AI sees it for lookups, but won't echo it in replies)
  if (toolContextParts.length > 0) {
    messages.push({
      role: 'system',
      content: `[Εσωτερικό context — ΜΗΝ το αναφέρεις στον χρήστη] Document IDs από προηγούμενα tool calls: ${toolContextParts.join('; ')}`,
    });
  }

  // Add current user message (enriched with attachment metadata if present)
  messages.push({
    role: 'user',
    content: enrichWithAttachments(userMessage, context.attachments),
  });

  logger.info('Starting agentic loop', {
    requestId: context.requestId,
    messageLength: userMessage.length,
    historyCount: chatHistory.length,
    maxIterations: cfg.maxIterations,
  });

  // Anti-hallucination retry flag — at most ONE retry per loop execution
  let hasRetried = false;

  for (let iteration = 0; iteration < cfg.maxIterations; iteration++) {
    // Check total timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= cfg.totalTimeoutMs) {
      logger.warn('Agentic loop timeout', {
        requestId: context.requestId,
        iteration,
        elapsedMs: elapsed,
      });
      // ADR-259D: Capture timeout as Sentry warning
      sentryCaptureMessage('Agentic loop timeout', 'warning', {
        tags: { component: 'agentic-loop', channel: context.channel, isAdmin: String(context.isAdmin) },
        extra: { requestId: context.requestId, iteration, elapsedMs: elapsed, toolCalls: allToolCalls.length },
      });
      return {
        answer: 'Η αναζήτηση πήρε πολύ χρόνο. Δοκίμασε μια πιο συγκεκριμένη ερώτηση.',
        suggestions: [],
        toolCalls: allToolCalls,
        iterations: iteration + 1,
        totalDurationMs: Date.now() - startTime,
        totalUsage,
      };
    }

    // Call OpenAI Chat Completions
    const remainingTimeMs = Math.min(
      cfg.perCallTimeoutMs,
      cfg.totalTimeoutMs - elapsed
    );

    const response = await callChatCompletions(messages, tools, remainingTimeMs);

    // ADR-259A: Aggregate token usage
    totalUsage.prompt_tokens += response.usage.prompt_tokens;
    totalUsage.completion_tokens += response.usage.completion_tokens;
    totalUsage.total_tokens += response.usage.total_tokens;

    // Check for tool calls
    const toolCalls = response.message.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      // Add the assistant message WITH tool_calls to conversation
      messages.push({
        role: 'assistant',
        content: response.message.content ?? null,
        tool_calls: toolCalls,
      });

      // Execute tool calls with guardrails (anti-fabrication + anti-hallucination)
      const { records, toolMessages } = await executeToolCalls(
        toolCalls, messages, userMessage, context, iteration, cfg.maxToolResultChars
      );
      allToolCalls.push(...records);
      messages.push(...toolMessages);

      continue; // Next iteration — AI processes tool results
    }

    // No tool calls — AI generated final text answer
    const answer = response.message.content
      ?? 'Δεν μπόρεσα να επεξεργαστώ το αίτημα.';

    // Clean potential JSON wrapping
    const cleanedAnswer = cleanAITextReply(answer);

    // Phase 6B: Extract suggested follow-up actions from AI response
    const { cleanAnswer: rawFinalAnswer, suggestions } = extractSuggestions(cleanedAnswer);

    // Phase 6C: Anti-hallucination guardrails
    const WRITE_CLAIM_PATTERNS = /ολοκληρώθηκε|ενημερώθηκε|διορθώθηκε|αποθηκεύτηκε|ενημέρωσα|διόρθωσα|αποθήκευσα|άλλαξα|τροποποίησα|προστέθηκε|αφαιρέθηκε|δηλώθηκε/i;
    const isWriteClaim = WRITE_CLAIM_PATTERNS.test(rawFinalAnswer);

    // Guardrail A: AI claims write but made 0 tool calls
    if (isWriteClaim && allToolCalls.length === 0 && !hasRetried) {
      hasRetried = true;
      logger.warn('Anti-hallucination: AI claimed write without tool calls — RETRYING', {
        requestId: context.requestId,
        claimedAnswer: rawFinalAnswer.slice(0, 100),
      });

      messages.push({ role: 'assistant', content: rawFinalAnswer });
      messages.push({
        role: 'user',
        content: [
          'ΛΑΘΟΣ — δεν εκτέλεσες κανένα εργαλείο.',
          'Για να κάνεις αλλαγές ΠΡΕΠΕΙ να καλέσεις tools (search_esco_occupations, search_esco_skills, set_contact_esco, κλπ).',
          'Δεν αρκεί να πεις ότι έγινε — πρέπει να χρησιμοποιήσεις τα εργαλεία.',
          'ΞΕΚΙΝΑ ΤΩΡΑ: κάλεσε τα κατάλληλα εργαλεία.',
        ].join(' '),
      });
      continue;
    }

    // Guardrail B (FIND-N fix): Check only the LAST write tool call, not entire history.
    // Previously .find() matched ANY blocked call — even if a later retry succeeded,
    // the final answer was still overridden to "δεν ολοκληρώθηκε".
    const WRITE_TOOL_NAMES = new Set([
      'update_contact_field', 'append_contact_info', 'set_contact_esco',
      'firestore_write', 'manage_bank_account', 'manage_relationship',
      'create_contact', 'manage_activities', 'attach_file_to_contact',
    ]);
    const lastWriteCall = [...allToolCalls].reverse().find(tc => WRITE_TOOL_NAMES.has(tc.name));
    const lastWriteWasBlocked = lastWriteCall
      ? safeJsonParse<{ _blocked?: boolean }>(lastWriteCall.result, {})?._blocked === true
      : false;

    if (isWriteClaim && lastWriteWasBlocked && !hasRetried) {
      hasRetried = true;
      logger.warn('Anti-hallucination: AI claimed write but last write tool was blocked — RETRYING', {
        requestId: context.requestId,
        blockedTool: lastWriteCall?.name,
        claimedAnswer: rawFinalAnswer.slice(0, 100),
      });

      messages.push({ role: 'assistant', content: rawFinalAnswer });
      messages.push({
        role: 'user',
        content: [
          `ΛΑΘΟΣ — το εργαλείο ${lastWriteCall?.name} ΑΠΕΡΡΙΦΘΗ από τον server.`,
          'Η εγγραφή ΔΕΝ έγινε. Ο server σου επέστρεψε επιλογές (matches).',
          'ΠΡΕΠΕΙ να δείξεις τις επιλογές στον χρήστη και να ρωτήσεις "Ποιο εννοείς;".',
          'ΜΗΝ λες ότι ολοκληρώθηκε — δεν ολοκληρώθηκε.',
        ].join(' '),
      });
      continue;
    }

    const finalAnswer = (isWriteClaim && allToolCalls.length === 0)
      ? 'Δεν μπόρεσα να εκτελέσω την αλλαγή — χρειάζεται αναζήτηση και ενημέρωση μέσω εργαλείων. Δοκίμασε ξανά ή δώσε περισσότερες λεπτομέρειες (π.χ. όνομα επαφής + τιμή πεδίου).'
      : (isWriteClaim && lastWriteWasBlocked)
        ? 'Η εγγραφή δεν ολοκληρώθηκε — χρειάζεται αποσαφήνιση. Δοκίμασε ξανά.'
        : rawFinalAnswer;

    logger.info('Agentic loop completed', {
      requestId: context.requestId,
      iterations: iteration + 1,
      toolCallsTotal: allToolCalls.length,
      suggestionsCount: suggestions.length,
      totalDurationMs: Date.now() - startTime,
    });

    return {
      answer: finalAnswer,
      suggestions,
      toolCalls: allToolCalls,
      iterations: iteration + 1,
      totalDurationMs: Date.now() - startTime,
      totalUsage,
    };
  }

  // Max iterations reached — ask AI to summarize what it found so far
  logger.warn('Agentic loop max iterations, requesting summary', {
    requestId: context.requestId,
    iterations: cfg.maxIterations,
    toolCallsTotal: allToolCalls.length,
  });

  // Final attempt: ask AI to answer with whatever data it collected
  try {
    messages.push({
      role: 'user',
      content: 'ΣΤΑΜΑΤΑ τις αναζητήσεις. Με βάση τα δεδομένα που ΕΧΕΙΣ ΗΔΗ συλλέξει, δώσε την καλύτερη δυνατή απάντηση στον χρήστη. Αν δεν βρήκες τίποτα, πες ακριβώς τι δεν μπόρεσες να βρεις.',
    });

    const summaryResponse = await callChatCompletions(messages, [], cfg.perCallTimeoutMs);
    // ADR-259A: Aggregate summary call usage
    totalUsage.prompt_tokens += summaryResponse.usage.prompt_tokens;
    totalUsage.completion_tokens += summaryResponse.usage.completion_tokens;
    totalUsage.total_tokens += summaryResponse.usage.total_tokens;
    const summaryContent = summaryResponse.message?.content;

    if (summaryContent) {
      const { cleanAnswer: summaryAnswer, suggestions: summarySuggestions } = extractSuggestions(summaryContent);
      return {
        answer: summaryAnswer,
        suggestions: summarySuggestions,
        toolCalls: allToolCalls,
        iterations: cfg.maxIterations,
        totalDurationMs: Date.now() - startTime,
        totalUsage,
      };
    }
  } catch {
    // Non-fatal — fall through to default message
  }

  // ADR-259D: Capture max iterations exhaustion as Sentry warning
  sentryCaptureMessage('Agentic loop exhausted max iterations', 'warning', {
    tags: { component: 'agentic-loop', channel: context.channel, isAdmin: String(context.isAdmin) },
    extra: { requestId: context.requestId, maxIterations: cfg.maxIterations, toolCalls: allToolCalls.length, totalTokens: totalUsage.total_tokens },
  });

  return {
    answer: 'Η αναζήτηση ήταν πολύπλοκη αλλά δεν κατάφερα να ολοκληρώσω. Δοκίμασε πιο συγκεκριμένη ερώτηση.',
    suggestions: [],
    toolCalls: allToolCalls,
    iterations: cfg.maxIterations,
    totalDurationMs: Date.now() - startTime,
    totalUsage,
  };
}

