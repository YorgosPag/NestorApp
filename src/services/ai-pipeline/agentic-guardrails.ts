/**
 * AGENTIC GUARDRAILS — Anti-hallucination + anti-fabrication checks for the agentic loop.
 * @module services/ai-pipeline/agentic-guardrails
 * @see ADR-263 (Telegram Bot Testing Playbook — Findings FIND-F, FIND-E)
 */

import 'server-only';

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
