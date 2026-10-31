/**
 * **Μία δομημένη ερώτηση σε έγγραφο** (ADR-327 §6 · ADR-923 §5.5) — η κοινή αφαίρεση των αναλυτών εγγράφων: σύστημα + περιεχόμενο
 * + strict schema ⇒ JSON ή `null`. Την μοιράζονται ο αναλυτής προσφορών και ο αναγνώστης σελίδων καταλόγου· κανένας δεν
 * έχει δικό του πελάτη OpenAI. Τη μεταφορά (retry, timeout) την κρατά το `executeResponsesRequest`.
 *
 * `null` = κενή ή μη αναλύσιμη απάντηση: παροδική αστοχία μοντέλου, που την αποφασίζει ο καλών (επανάληψη με ανατροφοδότηση).
 * @module services/ai/structured-document-request
 */

import { safeJsonParse } from '@/lib/json-utils';
import {
  executeResponsesRequest,
  extractOutputText,
  type ResponsesContent,
  type ResponsesRequestConfig,
} from '@/services/ai/openai-responses';

export interface StructuredSchema {
  readonly name: string;
  readonly description?: string;
  readonly strict: boolean;
  readonly schema: Record<string, unknown>;
}

export interface StructuredDocumentRequest {
  readonly model: string;
  readonly system: string;
  readonly content: ResponsesContent[];
  readonly schema: StructuredSchema;
}

export type StructuredDocumentOutcome =
  | { readonly kind: 'parsed'; readonly value: unknown }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unparseable' };

/** Η μεταφορά από το περιβάλλον — `null` χωρίς κλειδί (ο καλών πέφτει στο stub του). */
export function readDocumentAnalyzerTransport(): ResponsesRequestConfig | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').trim(),
    timeoutMs: Number.parseInt(process.env.OPENAI_TIMEOUT_MS || '120000', 10),
    maxRetries: Number.parseInt(process.env.OPENAI_MAX_RETRIES || '2', 10),
  };
}

export async function requestStructuredDocument(
  transport: ResponsesRequestConfig,
  request: StructuredDocumentRequest,
): Promise<StructuredDocumentOutcome> {
  const payload = await executeResponsesRequest(transport, {
    model: request.model,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: request.system }] },
      { role: 'user', content: request.content },
    ],
    text: { format: { type: 'json_schema', ...request.schema } },
  });
  const text = extractOutputText(payload);
  if (!text) return { kind: 'empty' };
  const value = safeJsonParse<unknown>(text, null);
  return value === null ? { kind: 'unparseable' } : { kind: 'parsed', value };
}
