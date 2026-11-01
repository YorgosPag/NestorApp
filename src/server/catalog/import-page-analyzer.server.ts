import 'server-only';

/**
 * Ο αναγνώστης σελίδας με OpenAI (ADR-923 §5.5 · §21.4): εικόνα **+** κείμενο της σελίδας, σχήμα οικογένειας ως strict structured
 * output, `temperature` στην προεπιλογή του σχήματος. Περνά από την ίδια αφαίρεση με τον αναλυτή προσφορών
 * (`requestStructuredDocument`): κανένας δεύτερος πελάτης.
 *
 * 🔴 **Μοντέλο: `gpt-4o`, ποτέ το γενικό `OPENAI_VISION_MODEL`.** Το τελευταίο στην παραγωγή είναι `gpt-4o-mini`, που
 * μετρήθηκε 65,2 % ανά πεδίο έναντι 91,4 % (§21.3), με σχεδόν ίδιο κόστος εισόδου. Δικό του κλειδί περιβάλλοντος.
 * @module server/catalog/import-page-analyzer.server
 */

import { readDocumentAnalyzerTransport, requestStructuredDocument, type StructuredSchema } from '@/services/ai/structured-document-request';
import { tokenCostUsd } from '@/config/ai-analysis-config';
import type { ResponsesContent, ResponsesRequestConfig, ResponsesUsage } from '@/services/ai/openai-responses';
import {
  addUsage,
  NO_USAGE,
  type CatalogAnalyzerAnswer,
  type CatalogPageInput,
  type CatalogPageReading,
  type CatalogTableMapInput,
  type CatalogTableMapping,
  type ICatalogPageAnalyzer,
} from '@/subapps/catalog/import/page-analyzer';
import type { ImportPagesUsage } from '@/subapps/catalog/types/catalog-import';
import {
  isRawPageExtraction,
  PAGE_EXTRACTION_SCHEMA_NAME,
  PAGE_EXTRACTION_SYSTEM_PROMPT,
  pageExtractionPrompt,
  pageExtractionSchema,
} from '@/subapps/catalog/import/page-extraction';
import { isRawPageMapping, PAGE_MAPPING_SCHEMA_NAME, PAGE_MAPPING_SYSTEM_PROMPT, pageMappingPrompt, pageMappingSchema } from '@/subapps/catalog/import/page-table-mapping';

const DEFAULT_MODEL = 'gpt-4o';
/** Μια κενή ή σπασμένη απάντηση είναι παροδική: ξαναρωτάμε μία φορά πριν μετρήσει η σελίδα ως αποτυχημένη. */
const PARSE_ATTEMPTS = 2;

const pageContent = (text: string, png: Buffer): ResponsesContent[] => [
  { type: 'input_text', text },
  { type: 'input_image', image_url: `data:image/png;base64,${png.toString('base64')}` },
];

interface PageQuestion<TValue> {
  readonly system: string;
  readonly content: ResponsesContent[];
  readonly schema: StructuredSchema;
  readonly accepts: (value: unknown) => value is TValue;
}

class OpenAICatalogPageAnalyzer implements ICatalogPageAnalyzer {
  constructor(
    private readonly transport: ResponsesRequestConfig,
    private readonly model: string,
  ) {}

  readPage(input: CatalogPageInput): Promise<CatalogPageReading> {
    const schema = pageExtractionSchema(input.attributes.map((attribute) => attribute.code));
    return this.ask({
      system: PAGE_EXTRACTION_SYSTEM_PROMPT,
      content: pageContent(pageExtractionPrompt(input.attributes, input.tokens, input.feedback), input.png),
      schema: { name: PAGE_EXTRACTION_SCHEMA_NAME, strict: true, schema },
      accepts: isRawPageExtraction,
    });
  }

  mapTables(input: CatalogTableMapInput): Promise<CatalogTableMapping> {
    const schema = pageMappingSchema(input.attributes.map((attribute) => attribute.code));
    return this.ask({
      system: PAGE_MAPPING_SYSTEM_PROMPT,
      content: pageContent(pageMappingPrompt(input.attributes, input.tables, input.feedback), input.png),
      schema: { name: PAGE_MAPPING_SCHEMA_NAME, strict: true, schema },
      accepts: isRawPageMapping,
    });
  }

  private async ask<TValue>(question: PageQuestion<TValue>): Promise<CatalogAnalyzerAnswer<TValue>> {
    let usage = NO_USAGE;
    let rawText: string | null = null;
    for (let attempt = 0; attempt < PARSE_ATTEMPTS; attempt += 1) {
      const outcome = await requestStructuredDocument(this.transport, { model: this.model, system: question.system, content: question.content, schema: question.schema });
      usage = addUsage(usage, this.costed(outcome.usage));
      rawText = outcome.text;
      if (outcome.kind === 'parsed' && question.accepts(outcome.value)) return { kind: 'read', value: outcome.value, usage, model: this.model, rawText };
    }
    return { kind: 'failed', usage, model: this.model, rawText };
  }

  private costed(usage: ResponsesUsage | null): ImportPagesUsage {
    if (!usage) return { ...NO_USAGE, requests: 1, costUsd: null };
    return { requests: 1, ...usage, costUsd: tokenCostUsd(this.model, usage.inputTokens, usage.outputTokens) };
  }
}

const UNAVAILABLE_ANALYZER: ICatalogPageAnalyzer = {
  readPage: () => Promise.resolve({ kind: 'unavailable' }),
  mapTables: () => Promise.resolve({ kind: 'unavailable' }),
};

export function createCatalogPageAnalyzer(): ICatalogPageAnalyzer {
  const transport = readDocumentAnalyzerTransport();
  if (!transport) return UNAVAILABLE_ANALYZER;
  return new OpenAICatalogPageAnalyzer(transport, (process.env.OPENAI_CATALOG_VISION_MODEL || DEFAULT_MODEL).trim());
}
