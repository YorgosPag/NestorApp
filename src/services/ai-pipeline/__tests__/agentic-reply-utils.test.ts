/**
 * AGENTIC REPLY UTILS TESTS
 *
 * Tests post-processing utilities for AI agent responses:
 * extractSuggestions, stripGenericClosingPhrases, cleanAITextReply, enrichWithAttachments.
 *
 * @see ADR-171 (Autonomous AI Agent)
 * @module __tests__/agentic-reply-utils
 */

// ── Mocks ──
jest.mock('@/lib/json-utils', () => ({
  safeJsonParse: jest.fn(<T>(str: string, fallback: T): T => {
    try { return JSON.parse(str) as T; } catch { return fallback; }
  }),
}));

jest.mock('@/lib/type-guards', () => ({
  isNonEmptyString: jest.fn((v: unknown) => typeof v === 'string' && (v as string).length > 0),
}));

// ── Import after mocks ──
import {
  extractSuggestions,
  stripGenericClosingPhrases,
  cleanAITextReply,
  enrichWithAttachments,
} from '../agentic-reply-utils';

// ============================================================================
// extractSuggestions
// ============================================================================

describe('extractSuggestions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('extracts suggestions from closed [SUGGESTIONS]...[/SUGGESTIONS] tags', () => {
    const raw = 'Η απάντηση.\n[SUGGESTIONS]\nΕπιλογή Α\nΕπιλογή Β\n[/SUGGESTIONS]';
    const { cleanAnswer, suggestions } = extractSuggestions(raw);

    expect(cleanAnswer).toBe('Η απάντηση.');
    expect(suggestions).toEqual(['Επιλογή Α', 'Επιλογή Β']);
  });

  it('extracts suggestions from open [SUGGESTIONS] tag (no closing)', () => {
    const raw = 'Πληροφορίες.\n[SUGGESTIONS]\nΝαι\nΌχι';
    const { cleanAnswer, suggestions } = extractSuggestions(raw);

    expect(cleanAnswer).toBe('Πληροφορίες.');
    expect(suggestions).toEqual(['Ναι', 'Όχι']);
  });

  it('returns empty suggestions when no tag present', () => {
    const raw = 'Απλή απάντηση χωρίς suggestions.';
    const { cleanAnswer, suggestions } = extractSuggestions(raw);

    expect(cleanAnswer).toBe('Απλή απάντηση χωρίς suggestions.');
    expect(suggestions).toEqual([]);
  });

  it('filters suggestions longer than 40 characters', () => {
    const longSuggestion = 'Α'.repeat(41);
    const raw = `Απάντηση.\n[SUGGESTIONS]\nΜικρή\n${longSuggestion}\nΆλλη\n[/SUGGESTIONS]`;
    const { suggestions } = extractSuggestions(raw);

    expect(suggestions).toEqual(['Μικρή', 'Άλλη']);
  });

  it('limits to maximum 3 suggestions', () => {
    const raw = 'Απάντηση.\n[SUGGESTIONS]\nΑ\nΒ\nΓ\nΔ\nΕ\n[/SUGGESTIONS]';
    const { suggestions } = extractSuggestions(raw);

    expect(suggestions).toHaveLength(3);
    expect(suggestions).toEqual(['Α', 'Β', 'Γ']);
  });

  it('strips filler phrases from the clean answer', () => {
    const raw = 'Τα δεδομένα.\nΑν χρειάζεσαι κάτι άλλο ενημέρωσέ με.\n[SUGGESTIONS]\nΟΚ\n[/SUGGESTIONS]';
    const { cleanAnswer } = extractSuggestions(raw);

    expect(cleanAnswer).not.toContain('Αν χρειάζεσαι');
  });
});

// ============================================================================
// stripGenericClosingPhrases
// ============================================================================

describe('stripGenericClosingPhrases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes "Tools used:" technical footer', () => {
    const text = 'Αποτέλεσμα.\n(Tools used: firestore_query, contact_search)';
    const result = stripGenericClosingPhrases(text);

    expect(result).toBe('Αποτέλεσμα.');
  });

  it('removes "Document IDs:" technical footer', () => {
    const text = 'Τα δεδομένα.\nDocument IDs: doc_001, doc_002';
    const result = stripGenericClosingPhrases(text);

    expect(result).toBe('Τα δεδομένα.');
  });

  it('removes Greek filler phrases', () => {
    const text = 'Πληροφορίες.\nΜη διστάσεις να ρωτήσεις ξανά!';
    const result = stripGenericClosingPhrases(text);

    expect(result).toBe('Πληροφορίες.');
  });

  it('preserves normal text without filler', () => {
    const text = 'Η επαφή Γιάννης Παπαδόπουλος βρέθηκε.';
    const result = stripGenericClosingPhrases(text);

    expect(result).toBe('Η επαφή Γιάννης Παπαδόπουλος βρέθηκε.');
  });
});

// ============================================================================
// cleanAITextReply
// ============================================================================

describe('cleanAITextReply', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns plain text as-is', () => {
    const result = cleanAITextReply('Καλημέρα Γιώργο!');
    expect(result).toBe('Καλημέρα Γιώργο!');
  });

  it('extracts response field from JSON-wrapped reply', () => {
    const json = JSON.stringify({ response: 'Η απάντηση' });
    const result = cleanAITextReply(json);
    expect(result).toBe('Η απάντηση');
  });

  it('strips ```json code block wrapping', () => {
    const wrapped = '```json\n{"response": "Μέσα σε code block"}\n```';
    const result = cleanAITextReply(wrapped);
    expect(result).toBe('Μέσα σε code block');
  });

  it('extracts message field from nested JSON', () => {
    const json = JSON.stringify({ message: 'Το μήνυμα' });
    const result = cleanAITextReply(json);
    expect(result).toBe('Το μήνυμα');
  });

  it('returns trimmed text when JSON has no recognized fields', () => {
    const json = JSON.stringify({ unknown: 'value' });
    const result = cleanAITextReply(json);
    // No recognized field → returns trimmed original
    expect(result).toBe(json);
  });
});

// ============================================================================
// enrichWithAttachments
// ============================================================================

describe('enrichWithAttachments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('prepends image attachment metadata with "Φωτογραφία"', () => {
    const result = enrichWithAttachments('Δες αυτό', [
      { fileRecordId: 'fr_001', filename: 'photo.jpg', contentType: 'image/jpeg' },
    ]);

    expect(result).toContain('[Συνημμένο Φωτογραφία: photo.jpg, fileRecordId: fr_001]');
    expect(result).toContain('Δες αυτό');
  });

  it('prepends document attachment metadata with "Έγγραφο"', () => {
    const result = enrichWithAttachments('Τεκμηρίωση', [
      { fileRecordId: 'fr_002', filename: 'report.pdf', contentType: 'application/pdf' },
    ]);

    expect(result).toContain('[Συνημμένο Έγγραφο: report.pdf, fileRecordId: fr_002]');
  });

  it('handles mixed image and document attachments', () => {
    const result = enrichWithAttachments('Αρχεία', [
      { fileRecordId: 'fr_003', filename: 'img.png', contentType: 'image/png' },
      { fileRecordId: 'fr_004', filename: 'doc.xlsx', contentType: 'application/vnd.ms-excel' },
    ]);

    expect(result).toContain('Φωτογραφία');
    expect(result).toContain('Έγγραφο');
  });

  it('returns message as-is when attachments is undefined', () => {
    const result = enrichWithAttachments('Χωρίς αρχεία', undefined);
    expect(result).toBe('Χωρίς αρχεία');
  });

  it('returns message as-is when attachments array is empty', () => {
    const result = enrichWithAttachments('Τίποτα', []);
    expect(result).toBe('Τίποτα');
  });
});
