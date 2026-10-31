/**
 * Η **μετρημένη χρήση** ενός αιτήματος Responses: ό,τι χρεώνεται, από την ίδια την απάντηση. `null` όταν δεν υπάρχει, ποτέ
 * μηδενικά: «δεν ξέρω» και «δωρεάν» δεν είναι το ίδιο.
 * @module services/ai/openai-responses/extract-usage
 */

export interface ResponsesUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export function extractResponsesUsage(payload: unknown): ResponsesUsage | null {
  const usage = (payload as { readonly usage?: { readonly input_tokens?: unknown; readonly output_tokens?: unknown } } | null)?.usage;
  const inputTokens = usage?.input_tokens;
  const outputTokens = usage?.output_tokens;
  return typeof inputTokens === 'number' && typeof outputTokens === 'number' ? { inputTokens, outputTokens } : null;
}
