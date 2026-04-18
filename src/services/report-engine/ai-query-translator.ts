/**
 * @module services/report-engine/ai-query-translator
 * @enterprise ADR-268 — AI Natural Language → Structured Query
 *
 * Translates user text (EL/EN) into a BuilderQueryRequest via OpenAI gpt-4o-mini.
 * Uses Vercel AI SDK generateObject() with JSON schema for structured output.
 * Server-only.
 */

import 'server-only';
import { generateObject } from 'ai';
import { z } from 'zod';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { createModuleLogger } from '@/lib/telemetry';
import { generateTempId } from '@/services/enterprise-id.service';
import { getOpenAIProvider } from '@/services/ai/openai-provider';
import {
  getDomainDefinition,
  getDefaultColumns,
} from '@/config/report-builder/domain-definitions';
import {
  VALID_DOMAIN_IDS,
  OPERATORS_BY_TYPE,
  isValidDomainId,
  isValidOperatorForType,
  type AITranslatedQuery,
  type ReportBuilderFilter,
} from '@/config/report-builder/report-builder-types';

const logger = createModuleLogger('AIQueryTranslator');

// ============================================================================
// Zod Schema for Structured Output
// ============================================================================

const translatedQuerySchema = z.object({
  domain: z.enum(['projects', 'buildings', 'floors', 'properties']),
  filters: z.array(z.object({
    fieldKey: z.string(),
    operator: z.string(),
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.tuple([z.number(), z.number()]),
      z.tuple([z.string(), z.string()]),
    ]),
  })),
  columns: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
});

// ============================================================================
// Main Entry Point
// ============================================================================

export async function translateNaturalLanguageQuery(
  query: string,
  locale: 'en' | 'el',
): Promise<AITranslatedQuery> {
  const systemPrompt = buildTranslatorSystemPrompt(locale);
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;

  try {
    const result = await generateObject({
      model: getOpenAIProvider()(model),
      schema: translatedQuerySchema,
      system: systemPrompt,
      prompt: query,
      maxRetries: 2,
    });

    const validated = validateTranslatedQuery(result.object);
    logger.info('AI query translated', {
      query: query.slice(0, 100),
      domain: validated.domain,
      filters: validated.filters.length,
      confidence: validated.confidence,
    });

    return validated;
  } catch (err) {
    logger.error('AI query translation failed', { error: String(err) });
    throw new Error('Failed to translate query. Please try rephrasing.');
  }
}

// ============================================================================
// System Prompt Builder
// ============================================================================

function buildTranslatorSystemPrompt(locale: 'en' | 'el'): string {
  const domainSchemas = VALID_DOMAIN_IDS.map((id) => {
    const def = getDomainDefinition(id);
    const fieldDescriptions = def.fields.map((f) => {
      let desc = `  - ${f.key} (${f.type})`;
      if (f.enumValues) {
        desc += ` [values: ${f.enumValues.join(', ')}]`;
      }
      const ops = OPERATORS_BY_TYPE[f.type];
      desc += ` [operators: ${ops.join(', ')}]`;
      return desc;
    });
    return `Domain: ${id}\nFields:\n${fieldDescriptions.join('\n')}`;
  }).join('\n\n');

  const lang = locale === 'el'
    ? 'Ο χρήστης γράφει στα Ελληνικά. Κατανόησε ελληνικούς όρους κατασκευής/ακινήτων.'
    : 'The user writes in English.';

  return `You are a query translator for a construction/real estate management system.
Convert natural language questions into structured query configurations.

${lang}

Available domains and their fields:

${domainSchemas}

Rules:
1. Choose the most relevant domain based on the user's question.
2. Use EXACT field keys from the schema above (dot-path notation).
3. For enum fields, use EXACT enum values listed.
4. Filters use AND logic. Maximum 10 filters.
5. Select columns relevant to answering the question (5-8 columns).
6. Set confidence 0-1 based on interpretation clarity.
7. If ambiguous, choose the most likely interpretation and set confidence < 0.7.
8. The explanation should be a brief human-readable summary of what you understood.

Common Greek terms mapping:
- "πουλημένα/sold" → commercialStatus = "sold"
- "ετοιμοπαράδοτα" → operationalStatus = "ready"
- "υπό κατασκευή" → operationalStatus = "under-construction"
- "τετραγωνικά/τ.μ." → areas.gross
- "τιμή πώλησης" → commercial.finalPrice
- "αγοραστής" → commercial.ownerContactIds (array-contains) / owners[]
- "ενεργειακή κλάση" → energy.class
- "κτήριο/πολυκατοικία" → buildings domain
- "διαμέρισμα/μονάδα" → units domain
- "έργο/project" → projects domain`;
}

// ============================================================================
// Validation — strip invalid fields/operators
// ============================================================================

function validateTranslatedQuery(
  raw: z.infer<typeof translatedQuerySchema>,
): AITranslatedQuery {
  const domain = isValidDomainId(raw.domain) ? raw.domain : 'projects';
  const def = getDomainDefinition(domain);
  const validFieldKeys = new Set(def.fields.map((f) => f.key));

  // Validate filters
  const validFilters: ReportBuilderFilter[] = [];
  for (const f of raw.filters) {
    if (!validFieldKeys.has(f.fieldKey)) continue;

    const fieldDef = def.fields.find((fd) => fd.key === f.fieldKey);
    if (!fieldDef) continue;

    if (!isValidOperatorForType(f.operator as never, fieldDef.type)) continue;

    validFilters.push({
      id: generateTempId(),
      fieldKey: f.fieldKey,
      operator: f.operator as ReportBuilderFilter['operator'],
      value: f.value as ReportBuilderFilter['value'],
    });
  }

  // Validate columns
  const validColumns = raw.columns.filter((c) => validFieldKeys.has(c));
  const columns = validColumns.length > 0
    ? validColumns
    : getDefaultColumns(domain);

  return {
    domain,
    filters: validFilters.slice(0, 10),
    columns,
    confidence: Math.max(0, Math.min(1, raw.confidence)),
    explanation: raw.explanation || 'Query translated',
  };
}
