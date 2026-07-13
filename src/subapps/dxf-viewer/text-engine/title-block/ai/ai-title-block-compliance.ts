/**
 * ADR-651 Φάση Δ (§8 #5) — **AI semantic compliance** για την πινακίδα.
 *
 * Επεκτείνει (ΔΕΝ αντικαθιστά) τον rule-based έλεγχο της Φάσης Ε (`title-block-compliance.ts`,
 * «πεδίο υπάρχει/κενό»). Ο rule-based τρέχει ΠΡΩΤΑ και τα ευρήματά του δίνονται στο μοντέλο ως
 * context, ώστε το AI να προσθέσει **σημασιολογικά** ευρήματα που ένας κανόνας δεν πιάνει
 * (π.χ. «κλίμακα 1:500 ασυνήθιστη για κάτοψη άδειας», «λείπει ειδικότητα μελετητή»).
 *
 * **Προειδοποίηση, ΠΟΤΕ φραγή** (Απόφαση #4): το UI τα δείχνει ως υποδείξεις· η εκτύπωση/
 * κατάθεση δεν μπλοκάρεται ποτέ. Graceful: αποτυχία AI ⇒ `[]` (ο rule-based μένει η ασφαλής
 * βάση). Server-only (κλειδί OpenAI).
 *
 * @see ../title-block-compliance.ts — ο rule-based έλεγχος (Φάση Ε, η βάση)
 */

import 'server-only';

import { generateObject } from 'ai';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getOpenAIProvider } from '@/services/ai/openai-provider';
import { recordUsage } from '@/services/ai-pipeline/ai-usage.service';
import type { PlaceholderScope } from '../../templates/resolver/scope.types';
import type { TextTemplate } from '../../templates/template.types';
import { resolveTitleBlockContent } from '../title-block-rows';
import { validateTitleBlock, type TitleBlockIssue } from '../title-block-compliance';
import { AI_TITLE_BLOCK_USAGE_CHANNEL, type AiTitleBlockLocale } from './ai-title-block-generator';
import { aiComplianceSchema, type AiComplianceWarning } from './ai-title-block-schema';

const logger = createModuleLogger('AiTitleBlockCompliance');

export interface AiComplianceInput {
  readonly userId: string;
  readonly template: TextTemplate;
  readonly scope: PlaceholderScope;
  readonly locale: AiTitleBlockLocale;
  readonly withStampBox: boolean;
  readonly stampImageUrl?: string;
}

/** Σύντομη περιγραφή των ΛΥΜΕΝΩΝ γραμμών — τι «βλέπει» ο μελετητής στο τυπωμένο φύλλο. */
function describeResolved(template: TextTemplate, scope: PlaceholderScope): string {
  const content = resolveTitleBlockContent(template, scope);
  const lines = content.rows.map((row) =>
    row.value ? `${row.label} ${row.value}` : `${row.label} (κενό)`,
  );
  if (content.heading) lines.unshift(`[${content.heading}]`);
  return lines.join('\n');
}

/** Σύντομη περιγραφή των rule-based ευρημάτων (ώστε το AI να μην τα επαναλάβει). */
function describeRuleBased(issues: readonly TitleBlockIssue[]): string {
  if (issues.length === 0) return '(none)';
  return issues.map((i) => `${i.kind}${i.path ? ` (${i.path})` : ''}`).join(', ');
}

/**
 * AI semantic έλεγχος. Επιστρέφει **επιπλέον** προειδοποιήσεις πέρα από τον rule-based.
 * Ποτέ throw — αποτυχία ⇒ κενός πίνακας.
 */
export async function aiValidateTitleBlock(
  input: AiComplianceInput,
): Promise<readonly AiComplianceWarning[]> {
  const ruleBased = validateTitleBlock({
    template: input.template,
    scope: input.scope,
    withStampBox: input.withStampBox,
    stampImageUrl: input.stampImageUrl,
  });

  const lang = input.locale === 'el' ? 'Greek (Ελληνικά)' : 'English';
  const system = `You are a Greek building-permit (ΤΕΕ / πολεοδομία) compliance reviewer for drawing
title blocks. A rule-based check already found the field-presence gaps listed below — do NOT repeat
them. Report ONLY ADDITIONAL semantic issues a rule cannot catch: implausible scale for the drawing
type, a discipline/role that does not match the fields, an owner vs client confusion, a missing
signature context, wording that would be rejected at submission, etc.

This is advisory only (a warning, never a hard block). If nothing semantic is wrong, return an empty
"warnings" array. Write each "message" in ${lang}. Use "warning" severity for likely-rejection issues
and "info" for softer suggestions. Set "relatedPath" to a known placeholder path when applicable, else null.`;

  const prompt = `Resolved title block (what prints on the sheet):
${describeResolved(input.template, input.scope)}

Has stamp cell: ${input.withStampBox ? 'yes' : 'no'}${input.withStampBox && !input.stampImageUrl ? ' (no stamp image uploaded)' : ''}
Rule-based findings already reported: ${describeRuleBased(ruleBased)}`;

  try {
    const result = await generateObject({
      model: getOpenAIProvider()(AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL),
      schema: aiComplianceSchema,
      system,
      prompt,
      maxRetries: 1,
    });
    await recordUsage(input.userId, AI_TITLE_BLOCK_USAGE_CHANNEL, {
      prompt_tokens: result.usage?.inputTokens ?? 0,
      completion_tokens: result.usage?.outputTokens ?? 0,
      total_tokens: result.usage?.totalTokens ?? 0,
    });
    return result.object.warnings;
  } catch (err) {
    logger.warn('AI title-block compliance failed', { userId: input.userId, err });
    return [];
  }
}
