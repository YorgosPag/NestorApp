/**
 * =============================================================================
 * PROMPT SANITIZER — OWASP LLM01:2025 Prompt Injection Protection
 * =============================================================================
 *
 * Sanitizes user-generated text before it gets stored in Firestore or
 * injected into AI system prompts via learned patterns.
 *
 * Attack vectors addressed:
 * - Role marker injection (system:/assistant:/user:)
 * - Instruction override ("ignore previous instructions")
 * - Control character injection (U+0000-U+001F)
 * - Markdown code block payloads
 *
 * @module services/ai-pipeline/shared/prompt-sanitizer
 * @see ADR-173 (AI Self-Improvement System)
 * @see OWASP LLM01:2025 — Prompt Injection
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_SANITIZED_LENGTH = 500;

/**
 * Role markers that could trick the LLM into changing context.
 * Matched case-insensitively.
 */
const ROLE_MARKER_PATTERNS: RegExp[] = [
  /\b(system|assistant|user)\s*:/gi,
  /\n\n(Human|Assistant|System)\s*:/g,
  /<\|?(system|user|assistant)\|?>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<<\/SYS>>/gi,
];

/**
 * Instruction override phrases that attempt to hijack the prompt.
 */
const INJECTION_PHRASES: readonly string[] = [
  'ignore previous',
  'ignore above',
  'ignore all',
  'disregard instructions',
  'disregard previous',
  'disregard above',
  'new instructions',
  'forget everything',
  'forget your instructions',
  'override instructions',
  'override your',
  'you are now',
  'act as',
  'pretend to be',
  'simulate being',
  'jailbreak',
  'do anything now',
  'developer mode',
] as const;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Sanitize text that will be stored in Firestore and potentially
 * injected into AI system prompts as learned patterns.
 *
 * @param text - Raw user/AI text
 * @param maxLength - Max output length (default: 500)
 * @returns Sanitized text safe for prompt injection
 */
export function sanitizeForPromptInjection(
  text: string,
  maxLength: number = MAX_SANITIZED_LENGTH
): string {
  if (!text) return '';

  let sanitized = text;

  // 1. Strip control characters (U+0000-U+001F except \n \r \t)
  sanitized = stripControlCharacters(sanitized);

  // 2. Remove role markers
  for (const pattern of ROLE_MARKER_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // 3. Remove markdown code blocks (potential payload containers)
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '[code]');

  // 4. Neutralize injection phrases
  sanitized = neutralizeInjectionPhrases(sanitized);

  // 5. Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized.trim();
}

/**
 * Quick check if text contains suspicious prompt injection patterns.
 * Useful for logging/alerting without modifying the text.
 *
 * @param text - Text to check
 * @returns true if suspicious patterns detected
 */
export function containsPromptInjection(text: string): boolean {
  if (!text) return false;

  const lower = text.toLowerCase();

  // Check for injection phrases
  for (const phrase of INJECTION_PHRASES) {
    if (lower.includes(phrase)) return true;
  }

  // Check for role markers
  for (const pattern of ROLE_MARKER_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(text)) return true;
  }

  return false;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Remove control characters (U+0000-U+001F) except common whitespace.
 */
function stripControlCharacters(text: string): string {
  // Keep \n (0x0A), \r (0x0D), \t (0x09)
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Neutralize injection phrases by inserting zero-width spaces.
 * This preserves readability for humans while breaking the pattern
 * for AI interpretation.
 */
function neutralizeInjectionPhrases(text: string): string {
  let result = text;
  const lower = text.toLowerCase();

  for (const phrase of INJECTION_PHRASES) {
    if (lower.includes(phrase)) {
      // Replace with bracketed version to make it visible but harmless
      const escaped = phrase.replace(/\s+/g, ' ');
      result = result.replace(
        new RegExp(escapeRegex(phrase), 'gi'),
        `[blocked: ${escaped}]`
      );
    }
  }

  return result;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
