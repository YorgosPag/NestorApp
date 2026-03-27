/**
 * AGENTIC GUARDRAILS — Anti-hallucination + anti-fabrication checks for the agentic loop.
 * @module services/ai-pipeline/agentic-guardrails
 * @see ADR-263 (Telegram Bot Testing Playbook — Findings FIND-F, FIND-E)
 */

import 'server-only';

/** Lightweight accent strip for comparison (NFD + remove combining marks) */
function norm(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Stem-based substring match for Greek names.
 * Greek declensions change the last 1-2 characters (e.g. Γραβάνης→Γραβάνη,
 * Αχιλλέας→Αχιλλέα). By trimming the last 2 chars we match across cases.
 *
 * Short names (≤4 chars) use exact match to avoid false positives.
 */
function stemMatch(name: string, context: string): boolean {
  if (!name || name.length <= 2) return true; // too short to check
  if (name.length <= 4) return context.includes(name);
  const stem = name.slice(0, Math.max(4, name.length - 2));
  return context.includes(stem);
}

/**
 * FIND-F fix: Detect phone/email values NOT present in the user's message
 * OR in tool results from prior iterations (e.g. read_document, document preview).
 *
 * Google-level: if the user asked the agent to read a document and the value
 * was extracted from that document, it is NOT fabricated — it is legitimate
 * data from a trusted source the user explicitly requested.
 *
 * @param trustedSources - Additional trusted text sources (tool results, document previews)
 * @returns true if the value appears to be fabricated (NOT in any trusted source)
 */
export function isFabricatedContactValue(
  toolArgs: Record<string, unknown>,
  userMessage: string,
  trustedSources: string[] = []
): boolean {
  const fieldType = String(toolArgs.fieldType ?? '');
  if (fieldType !== 'phone' && fieldType !== 'email') return false;

  const value = String(toolArgs.value ?? '').trim();
  if (!value) return false;

  // Combine user message + all trusted sources (tool results, document content)
  const allSources = [userMessage, ...trustedSources];

  if (fieldType === 'email') {
    const normalizedEmail = value.toLowerCase().trim();
    return !allSources.some(src => src.toLowerCase().includes(normalizedEmail));
  }

  // Phone: normalize — remove +30 prefix, spaces, dashes, parentheses
  const normalizedPhone = value.replace(/^\+30/, '').replace(/[\s\-().]/g, '');
  return !allSources.some(src => {
    const normalizedSrc = src.replace(/[\s\-().]/g, '');
    return normalizedSrc.includes(normalizedPhone);
  });
}

/**
 * Anti-hallucination guardrail for create_contact: verify that firstName/lastName
 * actually appear somewhere in the conversation context (user messages, document
 * analysis, or AI responses). Prevents the AI from inventing names like "Παυαρος Μελχισεδεκος".
 *
 * Comparison is accent-insensitive and case-insensitive so "ΓΡΑΒΑΝΗΣ" matches "Γραβάνης".
 *
 * @param toolArgs - The create_contact arguments (firstName, lastName, companyName)
 * @param conversationTexts - All message contents from the agentic loop messages array
 * @returns true if the name appears fabricated (NOT found in context)
 */
export function isHallucinatedContactName(
  toolArgs: Record<string, unknown>,
  conversationTexts: string[]
): boolean {
  const contactType = String(toolArgs.contactType ?? '');
  const firstName = norm(String(toolArgs.firstName ?? ''));
  const lastName = norm(String(toolArgs.lastName ?? ''));
  const companyName = norm(String(toolArgs.companyName ?? ''));

  // Skip check if no meaningful name parts
  if (!firstName && !lastName && !companyName) return false;

  // Build normalized context from all conversation messages
  const fullContext = norm(conversationTexts.join(' '));

  // Company contacts: check companyName (stem-based for Greek declensions)
  if (contactType === 'company') {
    return companyName.length > 2 && !stemMatch(companyName, fullContext);
  }

  // Individual contacts: BOTH firstName AND lastName must appear in context
  // Uses stem matching to handle Greek declensions (e.g. Γραβάνης↔Γραβάνη)
  const firstNameOk = stemMatch(firstName, fullContext);
  const lastNameOk = stemMatch(lastName, fullContext);

  return !firstNameOk || !lastNameOk;
}
