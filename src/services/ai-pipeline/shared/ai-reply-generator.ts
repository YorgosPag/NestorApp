/**
 * =============================================================================
 * 🏢 ENTERPRISE: AI REPLY GENERATOR
 * =============================================================================
 *
 * Centralized utility for generating dynamic, context-aware email replies
 * using OpenAI. Used by UC modules to create natural-sounding replies instead
 * of static templates.
 *
 * Architecture:
 *   - Calls OpenAI Responses API directly (NOT via OpenAIAnalysisProvider)
 *   - Free-form text output (no JSON schema)
 *   - Non-fatal: always falls back to static template on failure
 *   - Reusable by any UC module (appointment, property search, etc.)
 *
 * @module services/ai-pipeline/shared/ai-reply-generator
 * @see ADR-080 (Pipeline Implementation)
 * @see ADR-169 (Modular AI Architecture)
 */

import 'server-only';

import { isRecord, isNonEmptyTrimmedString } from '@/lib/type-guards';
import { getErrorMessage } from '@/lib/error-utils';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { PIPELINE_REPLY_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { SenderHistoryEntry } from './sender-history';

const logger = createModuleLogger('ai-reply-generator');

// ============================================================================
// TYPES
// ============================================================================

/** Context for generating an AI reply — passed by the UC module */
export interface AIReplyContext {
  /** Use case identifier for prompt selection */
  useCase: 'appointment' | 'property_search' | 'complaint' | 'general_inquiry' | 'document_request' | 'general' | 'admin_conversational';
  /** Sender's name for greeting */
  senderName: string;
  /** Whether sender is a known CRM contact */
  isKnownContact: boolean;
  /** Original email body (will be trimmed to MAX_ORIGINAL_MESSAGE_CHARS) */
  originalMessage: string;
  /** Original email subject */
  originalSubject: string;
  /** Module-specific context — injected into the prompt */
  moduleContext: Record<string, string | null>;
  /** Previous emails from same sender (privacy-safe: subject + date + intent only) */
  senderHistory?: SenderHistoryEntry[];
  /** Whether this sender has contacted before */
  isReturningContact?: boolean;
}

/** Result from the AI reply generation */
export interface AIReplyResult {
  /** The generated reply text */
  replyText: string;
  /** Whether AI generation was used (false = static fallback) */
  aiGenerated: boolean;
  /** Model used for generation (null if fallback) */
  model: string | null;
  /** Generation time in ms */
  durationMs: number;
}

// ============================================================================
// SYSTEM PROMPTS — per use case
// ============================================================================

const SYSTEM_PROMPTS: Record<AIReplyContext['useCase'], string> = {
  appointment: `Είσαι βοηθός κτηματομεσιτικού/κατασκευαστικού γραφείου στην Ελλάδα.
Γράψε ΕΠΑΓΓΕΛΜΑΤΙΚΟ email απάντησης στα ελληνικά σε πελάτη που ζήτησε ραντεβού.

ΚΑΝΟΝΕΣ:
1. Τόνος: Ευγενικός, επαγγελματικός, σύντομος
2. Γλώσσα: Ελληνικά (πληθυντικός ευγενείας — εσείς/σας)
3. Μορφή: Plain text μόνο — ΧΩΡΙΣ HTML tags, markdown, αστερίσκους ή formatting
4. Μήκος: 5-10 γραμμές μέγιστο
5. Ξεκίνα πάντα με "Αγαπητέ/ή [Ονομα],"
6. Τέλειωσε πάντα με "Με εκτίμηση," — ΧΩΡΙΣ υπογραφή μετά (προστίθεται αυτόματα)
7. ΜΗΝ υποσχεθείς πράγματα που δεν γνωρίζεις
8. ΜΗΝ αναφέρεις εσωτερικές διαδικασίες ή AI
9. Αναφέρσου στο ΠΕΡΙΕΧΟΜΕΝΟ του μηνύματος του πελάτη — μην αγνοείς τι έγραψε
10. Αν υπάρχει ημερομηνία/ώρα, επιβεβαίωσέ τα
11. Αν δεν υπάρχει ημερομηνία/ώρα, ανέφερε ότι θα επικοινωνήσετε σύντομα για καθορισμό`,

  property_search: `Είσαι βοηθός κτηματομεσιτικού/κατασκευαστικού γραφείου στην Ελλάδα.
Γράψε ΕΠΑΓΓΕΛΜΑΤΙΚΟ email απάντησης στα ελληνικά σε πελάτη που αναζητά ακίνητο.

ΚΑΝΟΝΕΣ:
1. Τόνος: Ευγενικός, επαγγελματικός, σύντομος
2. Γλώσσα: Ελληνικά (πληθυντικός ευγενείας — εσείς/σας)
3. Μορφή: Plain text μόνο — ΧΩΡΙΣ HTML tags, markdown, αστερίσκους ή formatting
4. Μήκος: 5-12 γραμμές μέγιστο
5. Ξεκίνα πάντα με "Αγαπητέ/ή [Ονομα],"
6. Τέλειωσε πάντα με "Με εκτίμηση," — ΧΩΡΙΣ υπογραφή μετά
7. ΜΗΝ υποσχεθείς πράγματα που δεν γνωρίζεις
8. ΜΗΝ αναφέρεις εσωτερικές διαδικασίες ή AI
9. Αναφέρσου στα κριτήρια αναζήτησης του πελάτη`,

  complaint: `Είσαι βοηθός κτηματομεσιτικού/κατασκευαστικού γραφείου στην Ελλάδα.
Γράψε ΕΠΑΓΓΕΛΜΑΤΙΚΟ email απάντησης στα ελληνικά σε πελάτη που υπέβαλε παράπονο ή αναφορά βλάβης.

ΚΑΝΟΝΕΣ:
1. Τόνος: ΕΜΠΑΘΗΤΙΚΟΣ, κατανοητικός, σοβαρός, επαγγελματικός
2. Γλώσσα: Ελληνικά (πληθυντικός ευγενείας — εσείς/σας)
3. Μορφή: Plain text μόνο — ΧΩΡΙΣ HTML tags, markdown, αστερίσκους ή formatting
4. Μήκος: 5-10 γραμμές μέγιστο
5. Ξεκίνα πάντα με "Αγαπητέ/ή [Ονομα],"
6. Τέλειωσε πάντα με "Με εκτίμηση," — ΧΩΡΙΣ υπογραφή μετά
7. ΑΝΑΓΝΩΡΙΣΕ το παράπονο — δείξε ότι κατανοείς τη δυσαρέσκεια
8. ΔΙΑΒΕΒΑΙΩΣΕ ότι θα εξεταστεί με προτεραιότητα
9. ΜΗΝ υποσχεθείς αποτέλεσμα ή χρονοδιάγραμμα
10. ΜΗΝ αναφέρεις εσωτερικές διαδικασίες ή AI
11. ΜΗΝ δικαιολογείς — κατανόηση χωρίς δικαιολογίες`,

  general_inquiry: `Είσαι βοηθός κτηματομεσιτικού/κατασκευαστικού γραφείου στην Ελλάδα.
Γράψε ΕΠΑΓΓΕΛΜΑΤΙΚΟ email απάντησης στα ελληνικά σε πελάτη που υπέβαλε γενικό αίτημα ή ερώτηση.

ΚΑΝΟΝΕΣ:
1. Τόνος: Ευγενικός, επαγγελματικός, σύντομος
2. Γλώσσα: Ελληνικά (πληθυντικός ευγενείας — εσείς/σας)
3. Μορφή: Plain text μόνο — ΧΩΡΙΣ HTML tags, markdown, αστερίσκους ή formatting
4. Μήκος: 5-8 γραμμές μέγιστο
5. Ξεκίνα πάντα με "Αγαπητέ/ή [Ονομα],"
6. Τέλειωσε πάντα με "Με εκτίμηση," — ΧΩΡΙΣ υπογραφή μετά
7. Ευχαρίστησε για το ενδιαφέρον/την επικοινωνία
8. ΑΝΑΓΝΩΡΙΣΕ το ερώτημα — αναφέρσου στο περιεχόμενό του
9. Ενημέρωσε ότι θα επικοινωνήσετε σύντομα
10. ΜΗΝ υποσχεθείς πράγματα που δεν γνωρίζεις
11. ΜΗΝ αναφέρεις εσωτερικές διαδικασίες ή AI`,

  document_request: `Είσαι βοηθός κτηματομεσιτικού/κατασκευαστικού γραφείου στην Ελλάδα.
Γράψε ΕΠΑΓΓΕΛΜΑΤΙΚΟ email απάντησης στα ελληνικά σε πελάτη που ζήτησε έγγραφο, τιμολόγιο ή αναφορά.

ΚΑΝΟΝΕΣ:
1. Τόνος: Ευγενικός, επαγγελματικός, σύντομος
2. Γλώσσα: Ελληνικά (πληθυντικός ευγενείας — εσείς/σας)
3. Μορφή: Plain text μόνο — ΧΩΡΙΣ HTML tags, markdown, αστερίσκους ή formatting
4. Μήκος: 5-10 γραμμές μέγιστο
5. Ξεκίνα πάντα με "Αγαπητέ/ή [Ονομα],"
6. Τέλειωσε πάντα με "Με εκτίμηση," — ΧΩΡΙΣ υπογραφή μετά
7. ΑΝΑΓΝΩΡΙΣΕ τι ζήτησε — αν είναι τιμολόγιο, αναφέρσου σε αυτό· αν είναι έγγραφο/αναφορά, αναφέρσου αντίστοιχα
8. Ενημέρωσε ότι το αίτημα καταγράφηκε και θα ετοιμαστεί σύντομα
9. ΜΗΝ υποσχεθείς χρονοδιάγραμμα ή ημερομηνία αποστολής
10. ΜΗΝ αναφέρεις εσωτερικές διαδικασίες ή AI
11. Αν υπάρχουν λεπτομέρειες στο μήνυμα (αριθμός συμβολαίου, ονομασία εγγράφου), αναφέρσου σε αυτές`,

  general: `Είσαι βοηθός κτηματομεσιτικού/κατασκευαστικού γραφείου στην Ελλάδα.
Γράψε ΕΠΑΓΓΕΛΜΑΤΙΚΟ email απάντησης στα ελληνικά.

ΚΑΝΟΝΕΣ:
1. Τόνος: Ευγενικός, επαγγελματικός, σύντομος
2. Γλώσσα: Ελληνικά (πληθυντικός ευγενείας — εσείς/σας)
3. Μορφή: Plain text μόνο — ΧΩΡΙΣ HTML tags, markdown, αστερίσκους ή formatting
4. Μήκος: 5-8 γραμμές μέγιστο
5. Ξεκίνα πάντα με "Αγαπητέ/ή [Ονομα],"
6. Τέλειωσε πάντα με "Με εκτίμηση," — ΧΩΡΙΣ υπογραφή μετά
7. ΜΗΝ υποσχεθείς πράγματα που δεν γνωρίζεις
8. ΜΗΝ αναφέρεις εσωτερικές διαδικασίες ή AI`,

  admin_conversational: `Είσαι ο AI βοηθός του ιδιοκτήτη ενός κτηματομεσιτικού/κατασκευαστικού γραφείου στην Ελλάδα.
Απάντησε ΑΜΕΣΑ και ΣΥΝΤΟΜΑ στα ελληνικά (2-5 γραμμές μέγιστο).

ΚΑΝΟΝΕΣ:
1. Μορφή: Plain text μόνο — ΧΩΡΙΣ HTML, markdown, αστερίσκους
2. Απάντησε ΑΜΕΣΑ στην ερώτηση — μην κάνεις εισαγωγή
3. Αν δεν ξέρεις, πες "Δεν γνωρίζω αυτήν την πληροφορία."
4. ΜΗΝ αναφέρεις ότι είσαι AI. Μίλα φυσικά.
5. Αν σε χαιρετούν, χαιρέτα πίσω ζεστά
6. Αν ρωτούν κάτι γενικό (μετάφραση, σημασία λέξης, συμβουλή), απάντα κατευθείαν`,
};

// ============================================================================
// INTERNAL: Prompt builders
// ============================================================================

function buildUserPrompt(context: AIReplyContext): string {
  const { senderName, originalSubject, originalMessage, moduleContext, senderHistory, isReturningContact } = context;

  const trimmedMessage = originalMessage.slice(0, PIPELINE_REPLY_CONFIG.MAX_ORIGINAL_MESSAGE_CHARS);

  // Build module-specific context lines
  const contextLines: string[] = [];
  for (const [key, value] of Object.entries(moduleContext)) {
    if (value !== null) {
      contextLines.push(`- ${key}: ${value}`);
    }
  }

  const contextBlock = contextLines.length > 0
    ? `\nΠληροφορίες:\n${contextLines.join('\n')}`
    : '';

  // Build sender history block (if available)
  let historyBlock = '';
  if (isReturningContact && senderHistory && senderHistory.length > 0) {
    const historyLines = senderHistory.map((entry) => {
      const dateFormatted = entry.date.slice(0, 10); // YYYY-MM-DD
      const intentLabel = entry.intent ? `, ${entry.intent}` : '';
      return `  - "${entry.subject}" (${dateFormatted}${intentLabel})`;
    });

    historyBlock = `\nΙστορικό αποστολέα (ο πελάτης έχει στείλει ${senderHistory.length} προηγούμενα emails):\n${historyLines.join('\n')}`;
  }

  return `Ο πελάτης ${senderName} έστειλε:
Θέμα: ${originalSubject || '(χωρίς θέμα)'}
Μήνυμα: ${trimmedMessage || '(κενό μήνυμα)'}
${contextBlock}${historyBlock}

Γράψε την απάντηση.`;
}

// ============================================================================
// INTERNAL: OpenAI Responses API call (free-form text, no JSON schema)
// ============================================================================

/**
 * Extract output text from OpenAI Responses API payload.
 * Mirrors the pattern from OpenAIAnalysisProvider (lines 74-101).
 */
function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  // Direct output_text field (shortcut in newer API versions)
  const outputText = payload.output_text;
  if (isNonEmptyTrimmedString(outputText)) {
    return outputText.trim();
  }

  // Walk the output array for message content
  const output = payload.output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item.type !== 'message') continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;

    for (const entry of content) {
      if (!isRecord(entry)) continue;
      if (entry.type !== 'output_text') continue;
      const text = entry.text;
      if (isNonEmptyTrimmedString(text)) {
        return text.trim();
      }
    }
  }

  return null;
}

interface OpenAIErrorPayload {
  error?: {
    message?: string;
    type?: string;
  };
}

/**
 * Call OpenAI Responses API for free-form text generation.
 * No JSON schema — just system prompt + user prompt → plain text reply.
 */
async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  requestId: string,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set — skipping AI reply generation', { requestId });
    return null;
  }

  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;
  const timeoutMs = PIPELINE_REPLY_CONFIG.TIMEOUT_MS;
  const maxRetries = PIPELINE_REPLY_CONFIG.MAX_RETRIES;

  const requestBody = {
    model,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: userPrompt }],
      },
    ],
    // No text.format — we want free-form text output, NOT JSON
  };

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
        const errorPayload = (await response.json().catch(() => ({}))) as OpenAIErrorPayload;
        const message = errorPayload.error?.message || `OpenAI error (${response.status})`;
        throw new Error(message);
      }

      const payload: unknown = await response.json();
      return extractOutputText(payload);
    } catch (error) {
      if (attempt >= maxRetries) {
        logger.error('OpenAI reply generation failed after retries', {
          requestId,
          error: getErrorMessage(error),
        });
        return null;
      }
      attempt += 1;
    }
  }

  return null;
}

// ============================================================================
// INTERNAL: Reply validation
// ============================================================================

/**
 * Basic sanity checks on the AI-generated reply.
 * Ensures it looks like a valid Greek professional email.
 */
function validateReply(text: string): boolean {
  // Must start with a greeting
  if (!text.includes('Αγαπητ') && !text.includes('αγαπητ')) {
    return false;
  }

  // Must not contain HTML tags
  if (/<[a-z/][^>]*>/i.test(text)) {
    return false;
  }

  // Must not contain markdown formatting
  if (/^#{1,6}\s/m.test(text) || /\*\*[^*]+\*\*/m.test(text)) {
    return false;
  }

  // Must not be too long
  if (text.length > PIPELINE_REPLY_CONFIG.MAX_REPLY_CHARS) {
    return false;
  }

  // Must have reasonable length (at least 50 chars)
  if (text.length < 50) {
    return false;
  }

  return true;
}

// ============================================================================
// ADMIN CONVERSATIONAL REPLY (ADR-145: Smart Fallback)
// ============================================================================

/**
 * Generate a conversational AI reply for admin general questions.
 *
 * Unlike email replies, this does NOT require "Αγαπητέ" greeting format.
 * Used by UC-014 when admin asks a non-business question (e.g., translations,
 * general knowledge, greetings).
 *
 * @param message - The admin's original message
 * @param requestId - Pipeline request ID for logging
 * @returns The AI response text, or null if generation fails
 */
export async function generateAdminConversationalReply(
  message: string,
  requestId: string,
): Promise<{ replyText: string | null; aiGenerated: boolean; durationMs: number }> {
  const startTime = Date.now();
  const systemPrompt = SYSTEM_PROMPTS.admin_conversational;

  const userPrompt = `Ο ιδιοκτήτης ρωτάει:\n${message.slice(0, 500)}\n\nΑπάντησε.`;

  try {
    const replyText = await callOpenAI(systemPrompt, userPrompt, requestId);
    const durationMs = Date.now() - startTime;

    if (!replyText || replyText.length < 5) {
      logger.warn('Admin conversational reply returned empty', { requestId, durationMs });
      return { replyText: null, aiGenerated: false, durationMs };
    }

    // Basic sanity: no HTML, reasonable length
    if (/<[a-z/][^>]*>/i.test(replyText) || replyText.length > 2000) {
      logger.warn('Admin conversational reply failed basic validation', { requestId, durationMs });
      return { replyText: null, aiGenerated: false, durationMs };
    }

    logger.info('Admin conversational reply succeeded', {
      requestId,
      durationMs,
      replyLength: replyText.length,
    });

    return { replyText, aiGenerated: true, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Admin conversational reply failed', {
      requestId,
      error: getErrorMessage(error),
      durationMs,
    });
    return { replyText: null, aiGenerated: false, durationMs };
  }
}

// ============================================================================
// COMPOSITE REPLY — Multi-Intent (ADR-131)
// ============================================================================

const COMPOSITE_REPLY_SYSTEM_PROMPT = `Είσαι βοηθός κτηματομεσιτικού/κατασκευαστικού γραφείου στην Ελλάδα.
Σου δίνονται ΠΟΛΛΑΠΛΕΣ μερικές απαντήσεις (κάθε μία για διαφορετικό θέμα) και πρέπει να τις ΣΥΝΘΕΣΕΙΣ σε ΜΙΑ ενιαία, ολοκληρωμένη απάντηση.

ΚΑΝΟΝΕΣ:
1. Τόνος: Ευγενικός, επαγγελματικός, σύντομος
2. Γλώσσα: Ελληνικά (πληθυντικός ευγενείας — εσείς/σας)
3. Μορφή: Plain text μόνο — ΧΩΡΙΣ HTML tags, markdown, αστερίσκους ή formatting
4. Μήκος: 8-15 γραμμές μέγιστο
5. Ξεκίνα πάντα με "Αγαπητέ/ή [Ονομα],"
6. Τέλειωσε πάντα με "Με εκτίμηση," — ΧΩΡΙΣ υπογραφή μετά
7. ΕΝΟΠΟΙΗΣΕ τα θέματα σε φυσική ροή — ΟΧΙ αριθμημένη λίστα
8. Αναφέρσου σε ΟΛΑ τα θέματα — μην αγνοήσεις κανένα
9. ΜΗΝ αναφέρεις εσωτερικές διαδικασίες ή AI`;

/** Input for composite reply generation */
export interface CompositeReplyInput {
  /** Draft replies from individual UC modules */
  moduleReplies: Array<{
    useCase: string;
    draftReply: string;
  }>;
  /** Sender name for greeting */
  senderName: string;
  /** Original email body */
  originalMessage: string;
  /** Original email subject */
  originalSubject: string;
}

function buildCompositeUserPrompt(input: CompositeReplyInput): string {
  const trimmedMessage = input.originalMessage.slice(0, PIPELINE_REPLY_CONFIG.MAX_ORIGINAL_MESSAGE_CHARS);

  const repliesBlock = input.moduleReplies
    .map((r, i) => `--- Μερική Απάντηση ${i + 1} (${r.useCase}) ---\n${r.draftReply}`)
    .join('\n\n');

  return `Ο πελάτης ${input.senderName} έστειλε:
Θέμα: ${input.originalSubject || '(χωρίς θέμα)'}
Μήνυμα: ${trimmedMessage || '(κενό μήνυμα)'}

Μερικές απαντήσεις προς σύνθεση:
${repliesBlock}

Σύνθεσε ΜΙΑ ενιαία απάντηση που καλύπτει ΟΛΑ τα θέματα.`;
}

/**
 * Generate a composite reply by merging multiple module-specific draft replies
 * into ONE unified, natural-sounding email.
 *
 * Single-reply shortcut: if only 1 module reply, returns it directly (zero overhead).
 *
 * @see ADR-131 (Multi-Intent Pipeline)
 */
export async function generateCompositeReply(
  input: CompositeReplyInput,
  requestId: string,
): Promise<AIReplyResult> {
  // Single reply — no composition needed
  if (input.moduleReplies.length <= 1) {
    return {
      replyText: input.moduleReplies[0]?.draftReply ?? '',
      aiGenerated: input.moduleReplies.length > 0,
      model: null,
      durationMs: 0,
    };
  }

  const startTime = Date.now();

  try {
    const userPrompt = buildCompositeUserPrompt(input);

    logger.info('Composite reply generation started', {
      requestId,
      moduleCount: input.moduleReplies.length,
      useCases: input.moduleReplies.map(r => r.useCase).join(','),
    });

    const replyText = await callOpenAI(COMPOSITE_REPLY_SYSTEM_PROMPT, userPrompt, requestId);
    const durationMs = Date.now() - startTime;

    if (!replyText || !validateReply(replyText)) {
      logger.warn('Composite reply failed validation — using concatenation fallback', {
        requestId,
        durationMs,
      });
      // Fallback: join individual replies with separator
      const fallbackText = input.moduleReplies.map(r => r.draftReply).join('\n\n');
      return {
        replyText: fallbackText,
        aiGenerated: false,
        model: null,
        durationMs,
      };
    }

    logger.info('Composite reply generation succeeded', {
      requestId,
      durationMs,
      model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
      replyLength: replyText.length,
    });

    return {
      replyText,
      aiGenerated: true,
      model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Composite reply unexpected error — using concatenation fallback', {
      requestId,
      error: getErrorMessage(error),
      durationMs,
    });

    const fallbackText = input.moduleReplies.map(r => r.draftReply).join('\n\n');
    return {
      replyText: fallbackText,
      aiGenerated: false,
      model: null,
      durationMs,
    };
  }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Generate a dynamic AI reply for a customer email.
 *
 * Calls OpenAI to produce a natural, context-aware reply in Greek.
 * If ANYTHING fails (API error, timeout, bad output), falls back to
 * the provided static template function.
 *
 * @param context — Use case, sender info, original message, module-specific data
 * @param fallbackFn — Static template function (e.g. buildAppointmentReply)
 * @param requestId — Pipeline request ID for logging/correlation
 */
export async function generateAIReply(
  context: AIReplyContext,
  fallbackFn: () => string,
  requestId: string,
): Promise<AIReplyResult> {
  const startTime = Date.now();

  try {
    const systemPrompt = SYSTEM_PROMPTS[context.useCase];
    const userPrompt = buildUserPrompt(context);

    logger.info('AI reply generation started', {
      requestId,
      useCase: context.useCase,
      senderName: context.senderName,
    });

    const replyText = await callOpenAI(systemPrompt, userPrompt, requestId);
    const durationMs = Date.now() - startTime;

    if (!replyText) {
      logger.warn('AI reply generation returned empty — using fallback', { requestId, durationMs });
      return {
        replyText: fallbackFn(),
        aiGenerated: false,
        model: null,
        durationMs,
      };
    }

    // Validate the generated reply
    if (!validateReply(replyText)) {
      logger.warn('AI reply failed validation — using fallback', {
        requestId,
        durationMs,
        replyLength: replyText.length,
      });
      return {
        replyText: fallbackFn(),
        aiGenerated: false,
        model: null,
        durationMs,
      };
    }

    logger.info('AI reply generation succeeded', {
      requestId,
      durationMs,
      model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
      replyLength: replyText.length,
    });

    return {
      replyText,
      aiGenerated: true,
      model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('AI reply generation unexpected error — using fallback', {
      requestId,
      error: getErrorMessage(error),
      durationMs,
    });

    return {
      replyText: fallbackFn(),
      aiGenerated: false,
      model: null,
      durationMs,
    };
  }
}
