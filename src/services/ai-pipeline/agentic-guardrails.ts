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
 * FIND-F fix: Detect phone/email values NOT present in the user's original message.
 * Prevents AI from fabricating contact info (hallucinated emails/phones).
 *
 * @returns true if the value appears to be fabricated (NOT in user message)
 */
export function isFabricatedContactValue(
  toolArgs: Record<string, unknown>,
  userMessage: string
): boolean {
  const fieldType = String(toolArgs.fieldType ?? '');
  if (fieldType !== 'phone' && fieldType !== 'email') return false;

  const value = String(toolArgs.value ?? '').trim();
  if (!value) return false;

  if (fieldType === 'email') {
    // Email: case-insensitive match — only strip spaces (preserve dots, @)
    const normalizedEmail = value.toLowerCase().trim();
    const msgLower = userMessage.toLowerCase();
    return !msgLower.includes(normalizedEmail);
  }

  // Phone: normalize both — remove +30 prefix, spaces, dashes, parentheses
  const normalizedMsg = userMessage.replace(/[\s\-().]/g, '');
  const normalizedPhone = value.replace(/^\+30/, '').replace(/[\s\-().]/g, '');
  return !normalizedMsg.includes(normalizedPhone);
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
