/**
 * AGENTIC LOOP TESTS
 *
 * Tests the multi-step AI reasoning loop: tool calling, timeouts,
 * anti-hallucination guardrails, token aggregation, and edge cases.
 *
 * @see ADR-171 (Autonomous AI Agent)
 * @module __tests__/agentic-loop
 */

import '../tools/__tests__/setup';

// ── Mock server-only (via moduleNameMapper) ──

// ── Mock agentic-specific dependencies ──
jest.mock('../agentic-openai-client', () => ({
  callChatCompletions: jest.fn(),
}));

jest.mock('../tools/agentic-tool-executor', () => ({
  getAgenticToolExecutor: jest.fn(),
}));

jest.mock('../agentic-guardrails', () => ({
  isFabricatedContactValue: jest.fn(() => false),
}));

jest.mock('../prompt-enhancer', () => ({
  enhanceSystemPrompt: jest.fn(async () => []),
}));

jest.mock('../agentic-system-prompt', () => ({
  buildAgenticSystemPrompt: jest.fn(() => 'System prompt content'),
}));

jest.mock('../agentic-reply-utils', () => ({
  extractSuggestions: jest.fn((text: string) => ({ cleanAnswer: text, suggestions: [] })),
  cleanAITextReply: jest.fn((text: string) => text),
  enrichWithAttachments: jest.fn((msg: string) => msg),
}));

jest.mock('@/config/ai-analysis-config', () => ({
  AI_COST_CONFIG: {
    LIMITS: {
      ADMIN_MAX_ITERATIONS: 15,
      CUSTOMER_MAX_ITERATIONS: 8,
    },
  },
}));

// ── Import after mocks ──
import { executeAgenticLoop } from '../agentic-loop';
import type { ChatMessage, AgenticLoopConfig } from '../agentic-loop';
import { callChatCompletions } from '../agentic-openai-client';
import { getAgenticToolExecutor } from '../tools/agentic-tool-executor';
import { isFabricatedContactValue } from '../agentic-guardrails';
import { extractSuggestions } from '../agentic-reply-utils';
import type { AgenticContext } from '../tools/agentic-tool-executor';

// ============================================================================
// HELPERS
// ============================================================================

const ZERO_USAGE = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

function makeUsage(prompt = 100, completion = 50) {
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
}

function createContext(overrides?: Partial<AgenticContext>): AgenticContext {
  return {
    companyId: 'comp_test',
    isAdmin: true,
    channel: 'telegram',
    channelSenderId: '5618410820',
    requestId: 'req_loop_001',
    telegramChatId: '5618410820',
    contactMeta: null,
    ...overrides,
  };
}

/** Create a response where AI gives a final text answer (no tool calls) */
function makeTextResponse(text: string, usage = makeUsage()) {
  return {
    message: { content: text, tool_calls: undefined },
    usage,
  };
}

/** Create a response where AI requests tool calls */
function makeToolCallResponse(
  tools: Array<{ name: string; args: Record<string, unknown> }>,
  usage = makeUsage(),
) {
  return {
    message: {
      content: null,
      tool_calls: tools.map((t, i) => ({
        id: `call_${i}`,
        type: 'function' as const,
        function: {
          name: t.name,
          arguments: JSON.stringify(t.args),
        },
      })),
    },
    usage,
  };
}

function createMockExecutor() {
  const executor = {
    executeTool: jest.fn(async () => ({
      success: true,
      data: { result: 'ok' },
    })),
  };
  (getAgenticToolExecutor as jest.Mock).mockReturnValue(executor);
  return executor;
}

const FAST_CONFIG: Partial<AgenticLoopConfig> = {
  maxIterations: 5,
  totalTimeoutMs: 10_000,
  perCallTimeoutMs: 5_000,
  maxToolResultChars: 500,
};

// ============================================================================
// TESTS
// ============================================================================

describe('executeAgenticLoop', () => {
  let executor: ReturnType<typeof createMockExecutor>;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = createMockExecutor();
  });

  // ==========================================================================
  // HAPPY PATH — NO TOOL CALLS
  // ==========================================================================

  describe('Happy path — direct answer', () => {
    it('should return AI answer when no tool calls are made', async () => {
      (callChatCompletions as jest.Mock).mockResolvedValue(
        makeTextResponse('Γεια σου! Πώς μπορώ να βοηθήσω;'),
      );

      const result = await executeAgenticLoop(
        'Γεια',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      expect(result.answer).toBe('Γεια σου! Πώς μπορώ να βοηθήσω;');
      expect(result.toolCalls).toHaveLength(0);
      expect(result.iterations).toBe(1);
    });

    it('should return default answer when AI returns null content', async () => {
      (callChatCompletions as jest.Mock).mockResolvedValue({
        message: { content: null, tool_calls: undefined },
        usage: makeUsage(),
      });

      const result = await executeAgenticLoop(
        'test',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      expect(result.answer).toBe('Δεν μπόρεσα να επεξεργαστώ το αίτημα.');
    });
  });

  // ==========================================================================
  // HAPPY PATH — WITH TOOL CALLS
  // ==========================================================================

  describe('Happy path — with tool calls', () => {
    it('should execute tool calls and return final answer', async () => {
      // Iteration 1: AI requests tool call
      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(
          makeToolCallResponse([
            { name: 'search_contacts', args: { query: 'Δημήτρης' } },
          ]),
        )
        // Iteration 2: AI returns final answer
        .mockResolvedValueOnce(
          makeTextResponse('Βρήκα τον Δημήτρη Οικονόμου.'),
        );

      const result = await executeAgenticLoop(
        'Ψάξε τον Δημήτρη',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      expect(result.answer).toBe('Βρήκα τον Δημήτρη Οικονόμου.');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('search_contacts');
      expect(result.iterations).toBe(2);
      expect(executor.executeTool).toHaveBeenCalledWith(
        'search_contacts',
        { query: 'Δημήτρης' },
        expect.anything(),
      );
    });

    it('should handle multiple sequential tool calls', async () => {
      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(
          makeToolCallResponse([
            { name: 'search_contacts', args: { query: 'Μαρία' } },
          ]),
        )
        .mockResolvedValueOnce(
          makeToolCallResponse([
            { name: 'update_contact_field', args: { field: 'phone', value: '6971234567' } },
          ]),
        )
        .mockResolvedValueOnce(
          makeTextResponse('Ενημέρωσα το τηλέφωνο.'),
        );

      const result = await executeAgenticLoop(
        'Ενημέρωσε τηλέφωνο Μαρίας 6971234567',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      expect(result.toolCalls).toHaveLength(2);
      expect(result.iterations).toBe(3);
    });
  });

  // ==========================================================================
  // TIMEOUT
  // ==========================================================================

  describe('Timeout handling', () => {
    it('should return timeout message when totalTimeoutMs exceeded', async () => {
      (callChatCompletions as jest.Mock).mockResolvedValue(
        makeTextResponse('late answer'),
      );

      // totalTimeoutMs: 0 → immediately expired at first iteration check
      const result = await executeAgenticLoop(
        'test',
        [],
        [],
        createContext(),
        { ...FAST_CONFIG, totalTimeoutMs: 0 },
      );

      expect(result.answer).toContain('πολύ χρόνο');
      expect(result.iterations).toBe(1);
    });
  });

  // ==========================================================================
  // MAX ITERATIONS
  // ==========================================================================

  describe('Max iterations', () => {
    it('should stop after maxIterations and request summary', async () => {
      let callCount = 0;
      (callChatCompletions as jest.Mock).mockImplementation(async () => {
        callCount++;
        // First 3 calls: tool calls (use up the 3 iterations)
        if (callCount <= 3) {
          return makeToolCallResponse([
            { name: 'search_contacts', args: { query: 'loop' } },
          ]);
        }
        // 4th call: summary request (after loop exhaustion)
        return makeTextResponse('Δεν κατάφερα να βρω αποτέλεσμα.');
      });

      const fakeTool = { type: 'function', function: { name: 'search_contacts', parameters: {} } };

      const result = await executeAgenticLoop(
        'Κάνε κάτι πολύπλοκο',
        [],
        [fakeTool] as never,
        createContext(),
        { ...FAST_CONFIG, maxIterations: 3 },
      );

      expect(result.iterations).toBe(3);
      expect(result.answer).toBe('Δεν κατάφερα να βρω αποτέλεσμα.');
      // 3 tool-call iterations + 1 summary = 4 OpenAI calls
      expect(callChatCompletions).toHaveBeenCalledTimes(4);
    });
  });

  // ==========================================================================
  // ANTI-FABRICATION (FIND-F)
  // ==========================================================================

  describe('Anti-fabrication guardrail (FIND-F)', () => {
    it('should block append_contact_info with fabricated phone', async () => {
      (isFabricatedContactValue as jest.Mock).mockReturnValue(true);

      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(
          makeToolCallResponse([
            { name: 'append_contact_info', args: { fieldType: 'phone', value: '6999999999' } },
          ]),
        )
        .mockResolvedValueOnce(
          makeTextResponse('Ζητώ συγγνώμη, χρειάζομαι τον αριθμό.'),
        );

      const result = await executeAgenticLoop(
        'πρόσθεσε τηλέφωνο',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      // Tool should be blocked — executor should NOT be called for this tool
      expect(executor.executeTool).not.toHaveBeenCalled();
      // But the tool call should be recorded
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].result).toContain('BLOCKED');
    });

    it('should allow append_contact_info with real phone from message', async () => {
      (isFabricatedContactValue as jest.Mock).mockReturnValue(false);

      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(
          makeToolCallResponse([
            { name: 'append_contact_info', args: { fieldType: 'phone', value: '6971234567' } },
          ]),
        )
        .mockResolvedValueOnce(
          makeTextResponse('Προστέθηκε.'),
        );

      const result = await executeAgenticLoop(
        'πρόσθεσε τηλέφωνο 6971234567',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      expect(executor.executeTool).toHaveBeenCalled();
      expect(result.toolCalls).toHaveLength(1);
    });
  });

  // ==========================================================================
  // ANTI-HALLUCINATION GUARDRAIL A
  // ==========================================================================

  describe('Anti-hallucination: write claim without tools', () => {
    it('should retry once when AI claims write but made 0 tool calls', async () => {
      (callChatCompletions as jest.Mock)
        // Iteration 1: AI claims "ολοκληρώθηκε" without calling tools
        .mockResolvedValueOnce(makeTextResponse('Η ενημέρωση ολοκληρώθηκε!'))
        // Iteration 2 (retry): AI calls a tool this time
        .mockResolvedValueOnce(
          makeToolCallResponse([
            { name: 'update_contact_field', args: { field: 'phone', value: '6971234567' } },
          ]),
        )
        // Iteration 3: Final answer
        .mockResolvedValueOnce(makeTextResponse('Τώρα ολοκληρώθηκε.'));

      const result = await executeAgenticLoop(
        'Ενημέρωσε το τηλέφωνο σε 6971234567',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      // Should have retried — 3 OpenAI calls total
      expect(callChatCompletions).toHaveBeenCalledTimes(3);
      expect(result.toolCalls).toHaveLength(1);
    });

    it('should return fallback message if retry also claims write without tools', async () => {
      // Both iterations claim write without tools
      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(makeTextResponse('Η ενημέρωση ολοκληρώθηκε!'))
        .mockResolvedValueOnce(makeTextResponse('Αποθηκεύτηκε!'));

      const result = await executeAgenticLoop(
        'Ενημέρωσε κάτι',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      // After retry fails, should return safe fallback
      expect(result.answer).toContain('χρειάζεται αναζήτηση');
    });
  });

  // ==========================================================================
  // ANTI-HALLUCINATION GUARDRAIL B
  // ==========================================================================

  describe('Anti-hallucination: write claim with blocked tool', () => {
    it('should retry when AI claims write but tool was blocked', async () => {
      // Iteration 1: Tool call that gets blocked
      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(
          makeToolCallResponse([
            { name: 'set_contact_esco', args: { profession: 'μηχανικός' } },
          ]),
        );

      // Tool returns blocked
      executor.executeTool.mockResolvedValueOnce({
        success: false,
        error: 'Disambiguation required',
        data: { matches: [{ label: 'μηχανικός δομικών' }, { label: 'μηχανολόγος' }] },
      });

      // Iteration 2: AI claims write despite block
      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(makeTextResponse('Ολοκληρώθηκε η ενημέρωση!'));

      // Iteration 3 (retry): AI asks for disambiguation
      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(makeTextResponse('Ποιο μηχανικός εννοείς;'));

      const result = await executeAgenticLoop(
        'βάλε επάγγελμα μηχανικός',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      // 3 OpenAI calls
      expect(callChatCompletions).toHaveBeenCalledTimes(3);
      expect(result.answer).toBe('Ποιο μηχανικός εννοείς;');
    });
  });

  // ==========================================================================
  // TOKEN USAGE AGGREGATION (ADR-259A)
  // ==========================================================================

  describe('Token usage aggregation', () => {
    it('should aggregate usage across multiple iterations', async () => {
      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(
          makeToolCallResponse(
            [{ name: 'search_contacts', args: {} }],
            makeUsage(100, 50), // 150 total
          ),
        )
        .mockResolvedValueOnce(
          makeTextResponse('Done', makeUsage(200, 80)), // 280 total
        );

      const result = await executeAgenticLoop(
        'test',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      expect(result.totalUsage.prompt_tokens).toBe(300);
      expect(result.totalUsage.completion_tokens).toBe(130);
      expect(result.totalUsage.total_tokens).toBe(430);
    });
  });

  // ==========================================================================
  // TOOL RESULT TRUNCATION
  // ==========================================================================

  describe('Tool result truncation', () => {
    it('should truncate tool results exceeding maxToolResultChars', async () => {
      executor.executeTool.mockResolvedValueOnce({
        success: true,
        data: { bigField: 'x'.repeat(1000) },
      });

      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(
          makeToolCallResponse([{ name: 'firestore_query', args: {} }]),
        )
        .mockResolvedValueOnce(makeTextResponse('Found data'));

      const result = await executeAgenticLoop(
        'query',
        [],
        [],
        createContext(),
        { ...FAST_CONFIG, maxToolResultChars: 100 },
      );

      // Result should be truncated
      expect(result.toolCalls[0].result.length).toBeLessThanOrEqual(115); // 100 + "...[truncated]"
      expect(result.toolCalls[0].result).toContain('[truncated]');
    });
  });

  // ==========================================================================
  // ROLE-AWARE CONFIG (ADR-259A)
  // ==========================================================================

  describe('Role-aware configuration', () => {
    it('should use admin max iterations for admin context', async () => {
      // AI always calls tools — should iterate up to admin limit
      let callCount = 0;
      (callChatCompletions as jest.Mock).mockImplementation(async (_msgs, tools) => {
        callCount++;
        if (tools && tools.length > 0 && callCount <= 20) {
          return makeToolCallResponse([{ name: 'search_contacts', args: {} }]);
        }
        return makeTextResponse('Done');
      });

      const result = await executeAgenticLoop(
        'complex admin task',
        [],
        [],
        createContext({ isAdmin: true }),
        // Don't pass maxIterations — let it use AI_COST_CONFIG defaults
      );

      // Admin default is 15 iterations
      expect(result.iterations).toBeLessThanOrEqual(15);
    });

    it('should use customer max iterations for customer context', async () => {
      let callCount = 0;
      (callChatCompletions as jest.Mock).mockImplementation(async (_msgs, tools) => {
        callCount++;
        if (tools && tools.length > 0 && callCount <= 20) {
          return makeToolCallResponse([{ name: 'search_contacts', args: {} }]);
        }
        return makeTextResponse('Done');
      });

      const result = await executeAgenticLoop(
        'customer question',
        [],
        [],
        createContext({ isAdmin: false }),
      );

      // Customer default is 8 iterations
      expect(result.iterations).toBeLessThanOrEqual(8);
    });
  });

  // ==========================================================================
  // TOOL EXECUTION FAILURE
  // ==========================================================================

  describe('Tool execution failure', () => {
    it('should pass failed tool result to AI with _blocked flag', async () => {
      executor.executeTool.mockResolvedValueOnce({
        success: false,
        error: 'Contact not found',
      });

      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(
          makeToolCallResponse([
            { name: 'update_contact_field', args: { contactId: 'cont_invalid' } },
          ]),
        )
        .mockResolvedValueOnce(makeTextResponse('Δεν βρέθηκε η επαφή.'));

      const result = await executeAgenticLoop(
        'ενημέρωσε στοιχεία',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      expect(result.toolCalls[0].result).toContain('_blocked');
      expect(result.toolCalls[0].result).toContain('Contact not found');
    });
  });

  // ==========================================================================
  // TOOL RESULT WARNING (ADR-259C)
  // ==========================================================================

  describe('Tool result with warning', () => {
    it('should append warning to tool result content', async () => {
      executor.executeTool.mockResolvedValueOnce({
        success: true,
        data: { contacts: [] },
        warning: 'Composite index building — results may be incomplete',
      });

      (callChatCompletions as jest.Mock)
        .mockResolvedValueOnce(
          makeToolCallResponse([{ name: 'firestore_query', args: {} }]),
        )
        .mockResolvedValueOnce(makeTextResponse('No results'));

      // Verify the tool result message sent to OpenAI includes the warning
      const result = await executeAgenticLoop(
        'search',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      // Check that the second call to OpenAI received tool result with warning
      const secondCallMessages = (callChatCompletions as jest.Mock).mock.calls[1][0];
      const toolMessage = secondCallMessages.find(
        (m: Record<string, unknown>) => m.role === 'tool',
      );
      expect(toolMessage.content).toContain('WARNING');
      expect(toolMessage.content).toContain('Composite index');
    });
  });

  // ==========================================================================
  // CHAT HISTORY CONTEXT
  // ==========================================================================

  describe('Chat history processing', () => {
    it('should inject document IDs from previous tool calls as system context', async () => {
      const history: ChatMessage[] = [
        {
          role: 'user',
          content: 'Ψάξε τον Δημήτρη',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant',
          content: 'Βρήκα τον Δημήτρη.',
          timestamp: new Date().toISOString(),
          toolCalls: [
            {
              name: 'search_contacts',
              args: '{"query":"Δημήτρης"}',
              result: '{"docs":[{"id":"cont_abc123"}]}',
            },
          ],
        },
      ];

      (callChatCompletions as jest.Mock).mockResolvedValue(
        makeTextResponse('Ναι, τον θυμάμαι.'),
      );

      await executeAgenticLoop(
        'Τι ξέρεις για τον Δημήτρη;',
        history,
        [],
        createContext(),
        FAST_CONFIG,
      );

      // Check that system context message was injected
      const firstCallMessages = (callChatCompletions as jest.Mock).mock.calls[0][0];
      const systemContextMsg = firstCallMessages.find(
        (m: Record<string, unknown>) =>
          m.role === 'system' && typeof m.content === 'string' && (m.content as string).includes('cont_abc123'),
      );
      expect(systemContextMsg).toBeDefined();
    });

    it('should limit history to last 6 messages', async () => {
      const history: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }));

      (callChatCompletions as jest.Mock).mockResolvedValue(
        makeTextResponse('OK'),
      );

      await executeAgenticLoop(
        'current message',
        history,
        [],
        createContext(),
        FAST_CONFIG,
      );

      const messages = (callChatCompletions as jest.Mock).mock.calls[0][0];
      // Should have: system prompt + last 6 history + user message = 8
      // (maybe +1 for tool context system message if present)
      const userAssistantMsgs = messages.filter(
        (m: Record<string, unknown>) => m.role === 'user' || m.role === 'assistant',
      );
      // Last 6 from history + 1 current = 7
      expect(userAssistantMsgs.length).toBeLessThanOrEqual(7);
    });
  });

  // ==========================================================================
  // ESCO CONTEXT PRESERVATION (FIND-E)
  // ==========================================================================

  describe('ESCO context preservation (FIND-E)', () => {
    it('should preserve ESCO search results in tool context', async () => {
      const history: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Βρήκα τα εξής:',
          timestamp: new Date().toISOString(),
          toolCalls: [
            {
              name: 'search_esco_occupations',
              args: '{"query":"μηχανικός"}',
              result: '{"matches":[{"label":"μηχανικός δομικών","uri":"http://esco/1"}]}',
            },
          ],
        },
      ];

      (callChatCompletions as jest.Mock).mockResolvedValue(
        makeTextResponse('Επέλεξε ένα.'),
      );

      await executeAgenticLoop(
        'Θέλω τον πρώτο',
        history,
        [],
        createContext(),
        FAST_CONFIG,
      );

      const messages = (callChatCompletions as jest.Mock).mock.calls[0][0];
      const contextMsg = messages.find(
        (m: Record<string, unknown>) =>
          m.role === 'system' && typeof m.content === 'string' && (m.content as string).includes('ESCO'),
      );
      expect(contextMsg).toBeDefined();
      expect(contextMsg.content).toContain('μηχανικός δομικών');
    });
  });

  // ==========================================================================
  // SUGGESTIONS EXTRACTION
  // ==========================================================================

  describe('Suggestions extraction', () => {
    it('should extract suggestions from AI answer', async () => {
      (extractSuggestions as jest.Mock).mockReturnValue({
        cleanAnswer: 'Η επαφή ενημερώθηκε.',
        suggestions: ['Δες στοιχεία', 'Πρόσθεσε τηλέφωνο'],
      });

      (callChatCompletions as jest.Mock).mockResolvedValue(
        makeTextResponse('Η επαφή ενημερώθηκε.\n[Δες στοιχεία|Πρόσθεσε τηλέφωνο]'),
      );

      const result = await executeAgenticLoop(
        'ενημέρωσε',
        [],
        [],
        createContext(),
        FAST_CONFIG,
      );

      expect(result.suggestions).toEqual(['Δες στοιχεία', 'Πρόσθεσε τηλέφωνο']);
    });
  });
});
