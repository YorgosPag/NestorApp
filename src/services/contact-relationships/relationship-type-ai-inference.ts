/**
 * ADR-336 — AI inference for self-extending relationship taxonomy.
 *
 * Single OpenAI Responses-API call that, given a Greek label for a new
 * relationship type, infers:
 *   - English translation
 *   - reverse-direction Greek + English label
 *   - RelationshipCategory bucket from `relationship-metadata.ts`
 *
 * Stays separate from `relationship-type-registry.ts` so the registry can be
 * unit-tested without OpenAI mocking and so this file can be swapped for an
 * alternative provider later. Falls back to deterministic defaults when the
 * OpenAI key is absent or the API errors.
 */

import 'server-only';

import { safeJsonParse } from '@/lib/json-utils';
import { isRecord } from '@/lib/type-guards';
import { createModuleLogger } from '@/lib/telemetry';
import type { RelationshipCategory } from '@/types/contacts/relationships/core/relationship-metadata';

const logger = createModuleLogger('RELATIONSHIP_TYPE_AI');

export interface RelationshipInferenceInput {
  labelEl: string;
  /** Optional user-provided reverse label override (skips reverse inference). */
  reverseLabelEl?: string;
}

export interface RelationshipInferenceResult {
  labelEn: string;
  reverseLabelEl: string;
  reverseLabelEn: string;
  category: RelationshipCategory;
  /** True when the result came from the OpenAI call; false when we used the deterministic fallback. */
  aiBacked: boolean;
}

const VALID_CATEGORIES: ReadonlyArray<RelationshipCategory> = [
  'employment', 'ownership', 'government', 'professional', 'personal', 'property',
];

const RELATIONSHIP_INFER_SCHEMA = {
  name: 'relationship_type_inference',
  description: 'Infer English label, reverse-direction labels, and category for a new relationship type.',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      labelEn: { type: 'string' },
      reverseLabelEl: { type: 'string' },
      reverseLabelEn: { type: 'string' },
      category: { type: 'string', enum: [...VALID_CATEGORIES] },
    },
    required: ['labelEn', 'reverseLabelEl', 'reverseLabelEn', 'category'],
    additionalProperties: false,
  },
} as const;

const SYSTEM_PROMPT = `Είσαι AI σύστημα ταξινόμησης σχέσεων επαφών για ελληνικό CRM.

Σου δίνεται μια ετικέτα σχέσης στα ελληνικά (π.χ. "Υπεύθυνος Πωλητής", "Υπεύθυνος Προμηθειών", "Σύμβουλος έργου").

Επιστρέφεις JSON με:
- labelEn: μετάφραση στα αγγλικά (πεζά γράμματα, καθαρή φράση, π.χ. "sales representative", "procurement officer", "project consultant"). Αν είναι ήδη αγγλική η είσοδος, επιστρέφεις την ίδια.
- reverseLabelEl: ο αντίστροφος ρόλος στα ελληνικά. Παραδείγματα: "Εργαζόμενος" → "Εργοδότης", "Υπεύθυνος Πωλητής" → "Πωλητής εκπρόσωπος για", "Πελάτης" → "Προμηθευτής", "Σύμβουλος" → "Πελάτης συμβουλευτικής". Όταν ο αντίστροφος δεν είναι σαφής, επιστρέφεις την ίδια ετικέτα + " (αντίστροφο)".
- reverseLabelEn: μετάφραση του reverseLabelEl.
- category: Μία από τις παρακάτω 6 (όπως ορίζονται στο relationship-metadata.ts):
  • employment       — εργασιακή σχέση εντός εταιρείας (π.χ. εργαζόμενος, διευθυντής, ασκούμενος)
  • ownership        — μετοχική/διοικητική σχέση (π.χ. μέτοχος, μέλος ΔΣ, CEO)
  • government       — δημόσιος υπάλληλος/αιρετός (π.χ. δήμαρχος, υπουργικός αξιωματούχος)
  • professional     — επαγγελματική σχέση εκτός εργοδοσίας (π.χ. προμηθευτής, σύμβουλος, εκπρόσωπος, πωλητής)
  • personal         — προσωπική σχέση (π.χ. φίλος, οικογένεια, συνάδελφος)
  • property         — σχέση ιδιοκτησίας ακινήτου (π.χ. αγοραστής, οικοπεδούχος)

Αν η ετικέτα είναι ασαφής → category: "professional" (πιο συχνή B2B σχέση).

Επέστρεψε ΜΟΝΟ JSON σύμφωνα με το schema.`;

interface OpenAIErrorPayload {
  error?: { message?: string };
}

function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const direct = payload.output_text;
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();
  const output = payload.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!isRecord(item) || item.type !== 'message') continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;
    for (const entry of content) {
      if (!isRecord(entry) || entry.type !== 'output_text') continue;
      const text = entry.text;
      if (typeof text === 'string' && text.trim().length > 0) return text.trim();
    }
  }
  return null;
}

function buildFallback(input: RelationshipInferenceInput): RelationshipInferenceResult {
  const labelEl = input.labelEl.trim();
  const reverseLabelEl = (input.reverseLabelEl ?? `${labelEl} (αντίστροφο)`).trim();
  return {
    labelEn: labelEl,
    reverseLabelEl,
    reverseLabelEn: reverseLabelEl,
    category: 'professional',
    aiBacked: false,
  };
}

export async function inferRelationshipTypeAttributes(
  input: RelationshipInferenceInput
): Promise<RelationshipInferenceResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    logger.info('OPENAI_API_KEY missing — using deterministic fallback', { labelEl: input.labelEl });
    return buildFallback(input);
  }

  const baseUrl = (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').trim();
  const model = (process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini').trim();
  const timeoutMs = Number.parseInt(process.env.OPENAI_TIMEOUT_MS || '20000', 10);

  const userPromptParts: string[] = [`Ετικέτα: "${input.labelEl}"`];
  if (input.reverseLabelEl) {
    userPromptParts.push(`Ο χρήστης έδωσε ήδη αντίστροφο: "${input.reverseLabelEl}". Χρησιμοποίησε ΑΥΤΟΝ ως reverseLabelEl και μετάφρασέ τον στο reverseLabelEn.`);
  }
  const userPrompt = userPromptParts.join('\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
          { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: RELATIONSHIP_INFER_SCHEMA.name,
            description: RELATIONSHIP_INFER_SCHEMA.description,
            strict: RELATIONSHIP_INFER_SCHEMA.strict,
            schema: RELATIONSHIP_INFER_SCHEMA.schema as Record<string, unknown>,
          },
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as OpenAIErrorPayload;
      logger.warn('OpenAI relationship-type inference failed — using fallback', {
        status: response.status,
        message: err.error?.message,
      });
      return buildFallback(input);
    }
    const payload = await response.json();
    const text = extractOutputText(payload);
    if (!text) return buildFallback(input);
    const parsed = safeJsonParse<{
      labelEn: string;
      reverseLabelEl: string;
      reverseLabelEn: string;
      category: string;
    }>(text, null as never);
    if (!parsed || !VALID_CATEGORIES.includes(parsed.category as RelationshipCategory)) {
      return buildFallback(input);
    }
    return {
      labelEn: (parsed.labelEn ?? input.labelEl).trim() || input.labelEl,
      reverseLabelEl: (parsed.reverseLabelEl ?? '').trim() || `${input.labelEl} (αντίστροφο)`,
      reverseLabelEn: (parsed.reverseLabelEn ?? '').trim() || parsed.labelEn || input.labelEl,
      category: parsed.category as RelationshipCategory,
      aiBacked: true,
    };
  } catch (error) {
    logger.warn('OpenAI relationship-type inference threw — using fallback', { error });
    return buildFallback(input);
  }
}
