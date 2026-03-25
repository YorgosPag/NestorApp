/**
 * AGENTIC LOOP LOGIC — Unit Tests (Google-level)
 *
 * Tests the internal logic of the agentic loop WITHOUT calling OpenAI:
 * - FIND-E: ESCO context injection into chat history messages
 * - FIND-F: Anti-fabrication guardrail integration (tool blocked before execution)
 * - Chat history processing (document ID extraction, context injection)
 *
 * Strategy: We test the chat history → messages transformation logic
 * by replicating the exact code path from agentic-loop.ts lines 96-131.
 *
 * @see ADR-263 Section 8
 */

import { isFabricatedContactValue } from '../../../agentic-guardrails';
import type { ChatMessage } from '../../../agentic-loop';

// ── Helper: Replicate chat history → toolContextParts logic from agentic-loop.ts ──

function buildToolContextParts(chatHistory: ChatMessage[]): string[] {
  const toolContextParts: string[] = [];

  for (const msg of chatHistory.slice(-6)) {
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
        // FIND-E fix
        if (tc.name === 'search_esco_occupations' || tc.name === 'search_esco_skills' || tc.name === 'set_contact_esco') {
          toolContextParts.push(`ESCO(${tc.name}): ${resultStr.substring(0, 600)}`);
        }
      }
    }
  }

  return toolContextParts;
}

// ── Helper: Replicate anti-fabrication check from agentic-loop.ts ──

function shouldBlockAppendContactInfo(
  toolName: string,
  toolArgs: Record<string, unknown>,
  userMessage: string
): boolean {
  return toolName === 'append_contact_info' && isFabricatedContactValue(toolArgs, userMessage);
}

// ============================================================================
// TESTS
// ============================================================================

describe('Agentic Loop Logic', () => {
  // ========================================================================
  // FIND-E: ESCO Context Injection
  // ========================================================================

  describe('FIND-E: ESCO context injection', () => {
    test('should include ESCO search results in tool context', () => {
      const chatHistory: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Βρέθηκαν 3 επαγγέλματα. Ποιο εννοείς;',
          timestamp: new Date().toISOString(),
          toolCalls: [
            {
              name: 'search_esco_occupations',
              args: '{"query":"μηχανικός"}',
              result: JSON.stringify([
                { labelEl: 'Μηχανικός δομικών έργων', uri: 'http://esco/1', iscoCode: '2142' },
                { labelEl: 'Μηχανικός ηλεκτρολόγος', uri: 'http://esco/2', iscoCode: '2151' },
              ]),
            },
          ],
        },
      ];

      const parts = buildToolContextParts(chatHistory);

      expect(parts.some(p => p.startsWith('ESCO(search_esco_occupations)'))).toBe(true);
      expect(parts.some(p => p.includes('Μηχανικός δομικών'))).toBe(true);
      expect(parts.some(p => p.includes('http://esco/1'))).toBe(true);
    });

    test('should include ESCO skills results in tool context', () => {
      const chatHistory: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Βρέθηκαν δεξιότητες',
          timestamp: new Date().toISOString(),
          toolCalls: [
            {
              name: 'search_esco_skills',
              args: '{"query":"CAD"}',
              result: JSON.stringify([{ label: 'CAD design', uri: 'http://esco/skill/1' }]),
            },
          ],
        },
      ];

      const parts = buildToolContextParts(chatHistory);

      expect(parts.some(p => p.startsWith('ESCO(search_esco_skills)'))).toBe(true);
      expect(parts.some(p => p.includes('CAD design'))).toBe(true);
    });

    test('should include set_contact_esco results in context', () => {
      const chatHistory: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Ενημερώθηκε',
          timestamp: new Date().toISOString(),
          toolCalls: [
            {
              name: 'set_contact_esco',
              args: '{"contactId":"cont_1","profession":"αρχιτέκτονας"}',
              result: JSON.stringify({ success: true, profession: 'αρχιτέκτονας' }),
            },
          ],
        },
      ];

      const parts = buildToolContextParts(chatHistory);

      expect(parts.some(p => p.startsWith('ESCO(set_contact_esco)'))).toBe(true);
    });

    test('should NOT include non-ESCO tools as ESCO context', () => {
      const chatHistory: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Βρέθηκε η επαφή',
          timestamp: new Date().toISOString(),
          toolCalls: [
            {
              name: 'search_text',
              args: '{"query":"Νίκος"}',
              result: JSON.stringify({ id: 'cont_123', name: 'Νίκος' }),
            },
          ],
        },
      ];

      const parts = buildToolContextParts(chatHistory);

      expect(parts.some(p => p.startsWith('ESCO('))).toBe(false);
      // But document ID should still be extracted
      expect(parts.some(p => p.includes('cont_123'))).toBe(true);
    });

    test('should truncate ESCO results at 600 chars', () => {
      const longResult = JSON.stringify(
        Array.from({ length: 50 }, (_, i) => ({
          labelEl: `Πολύ μεγάλο επάγγελμα ${i} με πολλές λεπτομέρειες`,
          uri: `http://esco/occupation/${i}`,
          iscoCode: `${2000 + i}`,
        }))
      );

      const chatHistory: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Results',
          timestamp: new Date().toISOString(),
          toolCalls: [
            { name: 'search_esco_occupations', args: '{}', result: longResult },
          ],
        },
      ];

      const parts = buildToolContextParts(chatHistory);
      const escoPart = parts.find(p => p.startsWith('ESCO('));

      expect(escoPart).toBeDefined();
      // ESCO( prefix + 600 chars max
      expect(escoPart!.length).toBeLessThanOrEqual('ESCO(search_esco_occupations): '.length + 600);
    });

    test('should handle empty tool results gracefully', () => {
      const chatHistory: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Δεν βρέθηκε',
          timestamp: new Date().toISOString(),
          toolCalls: [
            { name: 'search_esco_occupations', args: '{}', result: '' },
          ],
        },
      ];

      const parts = buildToolContextParts(chatHistory);

      expect(parts.some(p => p.startsWith('ESCO(search_esco_occupations): '))).toBe(true);
    });

    test('should process only last 6 messages', () => {
      const oldHistory: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        role: 'assistant' as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
        toolCalls: [
          {
            name: 'search_esco_occupations',
            args: '{}',
            result: JSON.stringify({ index: i }),
          },
        ],
      }));

      const parts = buildToolContextParts(oldHistory);

      // Only last 6 messages processed — indices 4-9
      expect(parts.some(p => p.includes('"index":0'))).toBe(false);
      expect(parts.some(p => p.includes('"index":3'))).toBe(false);
      expect(parts.some(p => p.includes('"index":4'))).toBe(true);
      expect(parts.some(p => p.includes('"index":9'))).toBe(true);
    });

    test('should skip user messages (no toolCalls)', () => {
      const chatHistory: ChatMessage[] = [
        {
          role: 'user',
          content: '1',
          timestamp: new Date().toISOString(),
        },
      ];

      const parts = buildToolContextParts(chatHistory);

      expect(parts).toHaveLength(0);
    });
  });

  // ========================================================================
  // FIND-F: Anti-fabrication integration
  // ========================================================================

  describe('FIND-F: Anti-fabrication integration in loop', () => {
    test('should block append_contact_info with fabricated phone', () => {
      const blocked = shouldBlockAppendContactInfo(
        'append_contact_info',
        { fieldType: 'phone', value: '6999888777', contactId: 'cont_1', label: 'κινητό' },
        'Πρόσθεσε email nikos@test.gr στον Νίκο'
      );
      expect(blocked).toBe(true);
    });

    test('should allow append_contact_info with legitimate phone', () => {
      const blocked = shouldBlockAppendContactInfo(
        'append_contact_info',
        { fieldType: 'phone', value: '6971234567', contactId: 'cont_1', label: 'κινητό' },
        'Πρόσθεσε κινητό 6971234567 στον Νίκο'
      );
      expect(blocked).toBe(false);
    });

    test('should NOT check other tools (update_contact_field)', () => {
      const blocked = shouldBlockAppendContactInfo(
        'update_contact_field',
        { fieldType: 'phone', value: '6999888777', contactId: 'cont_1' },
        'Πρόσθεσε κάτι'
      );
      expect(blocked).toBe(false);
    });

    test('should NOT check other tools (firestore_query)', () => {
      const blocked = shouldBlockAppendContactInfo(
        'firestore_query',
        { collection: 'contacts' },
        'Ψάξε τον Νίκο'
      );
      expect(blocked).toBe(false);
    });

    test('should block fabricated email in real scenario (FIND-F reproduction)', () => {
      // Exact FIND-F scenario: AI adds info@deddehe.gr that was never requested
      const blocked = shouldBlockAppendContactInfo(
        'append_contact_info',
        { fieldType: 'email', value: 'info@deddehe.gr', contactId: 'cont_abc', label: 'εργασία' },
        'Ο Νίκος δουλεύει ως ηλεκτρολόγος μηχανικός στην ΔΕΔΔΗΕ ΑΕ'
      );
      expect(blocked).toBe(true); // AI fabricated this email!
    });

    test('should block fabricated phone in real scenario (FIND-F reproduction)', () => {
      // FIND-F: AI also added 2312345678 that was never requested
      const blocked = shouldBlockAppendContactInfo(
        'append_contact_info',
        { fieldType: 'phone', value: '2312345678', contactId: 'cont_abc', label: 'εργασία' },
        'Ο Νίκος δουλεύει ως ηλεκτρολόγος μηχανικός στην ΔΕΔΔΗΕ ΑΕ'
      );
      expect(blocked).toBe(true); // AI fabricated this phone!
    });
  });

  // ========================================================================
  // Document ID extraction from tool results
  // ========================================================================

  describe('Document ID extraction', () => {
    test('should extract document IDs from tool results', () => {
      const chatHistory: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Βρέθηκε',
          timestamp: new Date().toISOString(),
          toolCalls: [
            {
              name: 'firestore_query',
              args: '{}',
              result: JSON.stringify([{ id: 'cont_abc123', name: 'Test' }]),
            },
          ],
        },
      ];

      const parts = buildToolContextParts(chatHistory);

      expect(parts.some(p => p.includes('cont_abc123'))).toBe(true);
      expect(parts.some(p => p.startsWith('firestore_query: cont_abc123'))).toBe(true);
    });

    test('should limit to 3 IDs per tool call', () => {
      const manyDocs = Array.from({ length: 10 }, (_, i) => ({
        id: `cont_${i}`, name: `Contact ${i}`,
      }));

      const chatHistory: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Βρέθηκαν 10',
          timestamp: new Date().toISOString(),
          toolCalls: [
            { name: 'firestore_query', args: '{}', result: JSON.stringify(manyDocs) },
          ],
        },
      ];

      const parts = buildToolContextParts(chatHistory);
      const idPart = parts.find(p => p.startsWith('firestore_query:'));

      expect(idPart).toBeDefined();
      // Only 3 IDs should be extracted
      const idCount = (idPart!.match(/cont_/g) ?? []).length;
      expect(idCount).toBe(3);
    });

    test('should handle tool results without IDs', () => {
      const chatHistory: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Count: 5',
          timestamp: new Date().toISOString(),
          toolCalls: [
            { name: 'firestore_count', args: '{}', result: JSON.stringify({ count: 5 }) },
          ],
        },
      ];

      const parts = buildToolContextParts(chatHistory);

      // No IDs to extract, but no crash either
      expect(parts.some(p => p.startsWith('firestore_count:'))).toBe(false);
    });
  });
});
