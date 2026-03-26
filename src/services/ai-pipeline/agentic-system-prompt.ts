/**
 * AGENTIC SYSTEM PROMPT — Builder that assembles modular prompt sections.
 *
 * Architecture (Google-style):
 * Each prompt domain lives in its own file under `prompt-sections/`.
 * This builder prepares context and assembles sections in order.
 *
 * @see ADR-171
 * @see prompt-sections/ for individual section files
 */

import 'server-only';

import { getCompressedSchema } from '@/config/firestore-schema-map';
import { generateTabMappingPrompt } from '@/config/ai-tab-mapping';
import { AI_ROLE_ACCESS_MATRIX, resolveAccessConfig, UNLINKED_ACCESS, UNKNOWN_USER_ACCESS } from '@/config/ai-role-access-matrix';
import type { AgenticContext } from './tools/agentic-tool-executor';
import type { ChatMessage } from './agentic-loop';
import type { PromptSectionContext, PromptSectionBuilder } from './prompt-sections/types';
import { buildHeaderSection } from './prompt-sections/header-section';
import { buildCoreRulesSection } from './prompt-sections/core-rules-section';
import { buildDataQuerySection } from './prompt-sections/data-query-section';
import { buildContactRulesSection } from './prompt-sections/contact-rules-section';
import { buildResponseFormatSection } from './prompt-sections/response-format-section';

// ─── RBAC: ROLE-BASED ACCESS DESCRIPTION (SSoT: ai-role-access-matrix.ts) ───

export function buildRoleDescription(ctx: AgenticContext): string {
  // Super Admin — full access (SSoT: matrix.super_admin)
  if (ctx.isAdmin) {
    return AI_ROLE_ACCESS_MATRIX.super_admin.promptDescription;
  }

  const contact = ctx.contactMeta;

  // Unknown user
  if (!contact) {
    return UNKNOWN_USER_ACCESS.promptDescription;
  }

  const roles = contact.projectRoles;
  const linkedProjectIds = [...new Set(roles.map(r => r.projectId).filter(Boolean))];

  // Known contact but no project links
  if (linkedProjectIds.length === 0) {
    return `Ο χρήστης είναι ο/η ${contact.displayName} (${contact.primaryPersona ?? 'επαφή'}).\n${UNLINKED_ACCESS.promptDescription}`;
  }

  // Resolve access from SSoT matrix
  const accessConfig = resolveAccessConfig(roles);

  // SPEC-257B: Unit-scoped roles show linked units instead of projects
  const linkedUnitIds = contact.linkedUnitIds ?? [];
  if (accessConfig.scopeLevel === 'unit' && linkedUnitIds.length > 0) {
    const unitIdList = linkedUnitIds.join(', ');
    return `Ο χρήστης είναι ο/η ${contact.displayName} (${contact.primaryPersona ?? 'επαφή'}).
Συνδεδεμένα units: ${unitIdList}

${accessConfig.promptDescription}
ΠΕΡΙΟΡΙΣΜΟΣ: ΜΟΝΟ δεδομένα που ανήκουν στα παραπάνω units. ΜΗΝ ψάχνεις άλλα units.`;
  }

  const projectIdList = linkedProjectIds.join(', ');
  return `Ο χρήστης είναι ο/η ${contact.displayName} (${contact.primaryPersona ?? 'επαφή'}).
Συνδεδεμένα έργα: ${projectIdList}

${accessConfig.promptDescription}
ΠΕΡΙΟΡΙΣΜΟΣ: ΜΟΝΟ δεδομένα που ανήκουν στα παραπάνω projects.`;
}

// ─── CHANNEL LABEL RESOLVER ─────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  messenger: 'Facebook Messenger',
  instagram: 'Instagram',
  email: 'Email',
};

// ─── MAIN PROMPT BUILDER ────────────────────────────────────────────────────

/**
 * Section assembly order. New sections = add to this array.
 * Each section receives the same PromptSectionContext.
 */
const PROMPT_SECTIONS: readonly PromptSectionBuilder[] = [
  buildHeaderSection,
  buildCoreRulesSection,
  buildDataQuerySection,
  buildContactRulesSection,
  buildResponseFormatSection,
];

export function buildAgenticSystemPrompt(
  ctx: AgenticContext,
  chatHistory: ChatMessage[],
  learnedPatterns: string = '',
): string {
  const schema = getCompressedSchema();

  // Format recent chat for context
  const historyStr = chatHistory.length > 0
    ? chatHistory
        .slice(-6) // Last 6 messages (3 turns)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 300)}`)
        .join('\n')
    : 'No previous messages.';

  const channelLabel = CHANNEL_LABELS[ctx.channel ?? ''] ?? ctx.channel ?? 'Εφαρμογή';

  // ADR-174: Role-based access description (RBAC)
  const roleDescription = buildRoleDescription(ctx);

  const now = new Date();
  const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`; // DD/MM/YYYY

  // Prepare shared context for all sections
  const sectionCtx: PromptSectionContext = {
    channelLabel,
    today,
    schema,
    roleDescription,
    tabMapping: generateTabMappingPrompt(),
    learnedPatterns,
    historyStr,
  };

  // Assemble all sections with double-newline separator
  return PROMPT_SECTIONS.map(fn => fn(sectionCtx)).join('\n\n');
}
