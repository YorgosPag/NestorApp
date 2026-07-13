/**
 * ADR-651 Φάση Δ — **AI generator (server-only)** για την πινακίδα: Εικόνα→σχήμα & Κείμενο→σχήμα.
 *
 * Τρέχει ΜΟΝΟ server-side (το κλειδί OpenAI ποτέ στον client). Χρησιμοποιεί τον **ενεργό**
 * provider SSoT (`getOpenAIProvider`, ADR-294/171) μέσω `generateObject` του Vercel AI SDK —
 * μηδέν νέος OpenAI client, μηδέν coupling με το accounting analyzer. Ίδιο μοτίβο με το
 * `ai-query-translator` (ADR-268): structured output με Zod schema, validate/strip αργότερα
 * στο `reconcile`. Το usage καταγράφεται στον υπάρχοντα SSoT (`recordUsage`, ADR-259A).
 *
 * Graceful: κάθε αποτυχία (χωρίς κλειδί, δίκτυο, LLM) ⇒ `null` — ο καλών πέφτει σε manual
 * preset, ΠΟΤΕ crash/μπλοκάρισμα (N.7.2 #4, Απόφαση #4).
 *
 * ⚠️ Ο κώδικας εδώ **δεν τροποποιεί** το `src/services/ai-pipeline/` — μόνο καταναλώνει το
 * κοινό provider + usage SSoT (άρα το N.10 δεν ενεργοποιείται).
 */

import 'server-only';

import { generateObject } from 'ai';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getOpenAIProvider } from '@/services/ai/openai-provider';
import { recordUsage } from '@/services/ai-pipeline/ai-usage.service';
import {
  ALL_PLACEHOLDER_PATHS,
  PLACEHOLDER_REGISTRY,
} from '../../templates/resolver/variables';
import { aiTitleBlockSchema, type AiTitleBlock } from './ai-title-block-schema';

const logger = createModuleLogger('AiTitleBlockGenerator');

/** Το κανάλι για το usage tracking (ADR-259A) — ξεχωριστό από το chat/accounting. */
export const AI_TITLE_BLOCK_USAGE_CHANNEL = 'dxf-title-block-ai';

export type AiTitleBlockLocale = AiTitleBlock['locale'];

interface UsageLike {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

/** Κατέγραψε το usage (fire-and-forget· η αποτυχία δεν σπάει τη δημιουργία). */
async function trackUsage(userId: string, usage: UsageLike | undefined): Promise<void> {
  const prompt = usage?.inputTokens ?? 0;
  const completion = usage?.outputTokens ?? 0;
  await recordUsage(userId, AI_TITLE_BLOCK_USAGE_CHANNEL, {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: usage?.totalTokens ?? prompt + completion,
  });
}

/** Οδηγός γνωστών placeholder paths — ο πυρήνας του «map σε ζωντανό δεδομένο, όχι ελεύθερα». */
function knownPathsGuide(): string {
  return ALL_PLACEHOLDER_PATHS.map(
    (path) => `- ${path} — e.g. "${PLACEHOLDER_REGISTRY[path].sample}"`,
  ).join('\n');
}

/** Κοινό system prompt (Εικόνα + Κείμενο): δομή + αντιστοίχιση σε γνωστά δεδομένα. */
function buildSystemPrompt(locale: AiTitleBlockLocale): string {
  const lang = locale === 'el' ? 'Greek (Ελληνικά)' : 'English';
  return `You are an expert architect who designs drawing title blocks (πινακίδα σχεδίου) for
Greek building-permit drawings (ΤΕΕ / πολεοδομία), following ISO 7200 practice.

Produce a STRUCTURED title block, not free text and not an image. Fill the schema:
- One "heading" (the design-office name row) — usually bound to the company placeholder.
- A list of "rows", each a labelled field in reading order. KEEP the field order and set
  of fields you see / that the request implies — reproduce the STRUCTURE, then let our
  renderer redraw it cleanly ("same layout, but clean").
- "withStampBox": true when a stamp/signature cell is present or appropriate (permit sheets).

FIELD ↔ DATA BINDING (critical):
For every row and the heading, map it to ONE of the KNOWN placeholder paths below whenever the
field represents live project / company / engineer data. Put that path in "placeholderPath".
Use "placeholderPath": null with a "literalValue" ONLY for genuinely static text that is not one
of the known data points. Never invent placeholder paths — unknown paths are dropped.

KNOWN PLACEHOLDER PATHS:
${knownPathsGuide()}

RULES:
- "label" is the fixed caption WITHOUT a trailing colon (e.g. "Έργο", not "Έργο:").
- Write labels and any literal text in ${lang}.
- "emphasis": use "default" for primary fields (project, drawing title, engineer), "caption"
  for secondary ones (scale, date, sheet number, checker).
- For a Greek building permit, prefer including: project name, location, client, drawing type,
  scale, engineer name, discipline, TEE registration number, date — and a stamp cell.
- Set "locale" to "${locale}". Set "confidence" honestly and add a short "notes".`;
}

/** Το user instruction ανά ροή. */
const IMAGE_INSTRUCTION =
  'Recreate this title block as a structured, editable template. Keep which fields exist and their order; map each to a known placeholder path where it is live data.';
const TEXT_INSTRUCTION = (prompt: string): string =>
  `Design a title block for this request: "${prompt}". Map each field to a known placeholder path where it is live data.`;

/** Κοινή εκτέλεση `generateObject` + usage + graceful null. */
async function runGenerate(
  userId: string,
  model: string,
  system: string,
  input: { readonly prompt: string } | { readonly imageDataUrl: string; readonly text: string },
): Promise<AiTitleBlock | null> {
  try {
    const provider = getOpenAIProvider();
    const result =
      'imageDataUrl' in input
        ? await generateObject({
            model: provider(model),
            schema: aiTitleBlockSchema,
            system,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: input.text },
                  { type: 'image', image: input.imageDataUrl },
                ],
              },
            ],
            maxRetries: 2,
          })
        : await generateObject({
            model: provider(model),
            schema: aiTitleBlockSchema,
            system,
            prompt: input.prompt,
            maxRetries: 2,
          });

    await trackUsage(userId, result.usage);
    return result.object;
  } catch (err) {
    logger.warn('AI title-block generation failed', { userId, err });
    return null;
  }
}

/** Εικόνα → πινακίδα: το vision μοντέλο αναδημιουργεί τη δομή ως structured template. */
export async function generateTitleBlockFromImage(args: {
  readonly userId: string;
  readonly imageDataUrl: string;
  readonly locale: AiTitleBlockLocale;
}): Promise<AiTitleBlock | null> {
  return runGenerate(
    args.userId,
    AI_ANALYSIS_DEFAULTS.OPENAI.VISION_MODEL,
    buildSystemPrompt(args.locale),
    { imageDataUrl: args.imageDataUrl, text: IMAGE_INSTRUCTION },
  );
}

/** Φυσική γλώσσα → πινακίδα: το μοντέλο σχεδιάζει ΤΕΕ-συμβατή πινακίδα από περιγραφή. */
export async function generateTitleBlockFromText(args: {
  readonly userId: string;
  readonly prompt: string;
  readonly locale: AiTitleBlockLocale;
}): Promise<AiTitleBlock | null> {
  return runGenerate(
    args.userId,
    AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
    buildSystemPrompt(args.locale),
    { prompt: TEXT_INSTRUCTION(args.prompt) },
  );
}
