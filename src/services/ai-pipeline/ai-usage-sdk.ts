/**
 * AI USAGE — SDK MAPPING (ADR-259A)
 *
 * Η **μία** αντιστοίχιση από το usage του Vercel AI SDK (`inputTokens`/`outputTokens`, προαιρετικά) στο `OpenAIUsage`
 * (snake_case) που καταγράφει το `recordUsage`. Καθαρό module, χωρίς Firestore: το εισάγουν και καλούντες που δοκιμάζονται
 * με mock του `ai-usage.service`, ώστε το test να ελέγχει την **αληθινή** αντιστοίχιση.
 *
 * @module services/ai-pipeline/ai-usage-sdk
 * @see SPEC-259A (OpenAI Usage Tracking + Cost Protection)
 */

import type { OpenAIUsage } from './agentic-openai-client';

/** Το σχήμα usage του Vercel AI SDK (`result.usage`, `step.usage`): κάθε πεδίο μπορεί να λείπει. */
export interface SdkUsageLike {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

/** Μία κλήση. Χωρίς `totalTokens` από τον πάροχο, το σύνολο είναι είσοδος + έξοδος. */
export function usageFromSdk(usage: SdkUsageLike | undefined): OpenAIUsage {
  const prompt = usage?.inputTokens ?? 0;
  const completion = usage?.outputTokens ?? 0;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: usage?.totalTokens ?? prompt + completion };
}

/** Το άθροισμα των βημάτων ενός `generateText` με εργαλεία (κάθε βήμα είναι χωριστή χρεωμένη κλήση). */
export function usageFromSdkSteps(steps: ReadonlyArray<{ readonly usage?: SdkUsageLike }>): OpenAIUsage {
  return steps.reduce<OpenAIUsage>((sum, step) => {
    const one = usageFromSdk(step.usage);
    return {
      prompt_tokens: sum.prompt_tokens + one.prompt_tokens,
      completion_tokens: sum.completion_tokens + one.completion_tokens,
      total_tokens: sum.total_tokens + one.total_tokens,
    };
  }, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
}
