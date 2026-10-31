import 'server-only';

/**
 * Ο αναγνώστης σελίδας με OpenAI (ADR-923 §5.5 · §21.4): εικόνα **+** αριθμημένα κομμάτια κειμένου, σχήμα οικογένειας ως
 * strict structured output, `temperature` στην προεπιλογή του σχήματος. Περνά από την ίδια αφαίρεση με τον αναλυτή προσφορών
 * (`requestStructuredDocument`): κανένας δεύτερος πελάτης.
 *
 * 🔴 **Μοντέλο: `gpt-4o`, ποτέ το γενικό `OPENAI_VISION_MODEL`.** Το τελευταίο στην παραγωγή είναι `gpt-4o-mini`, που
 * μετρήθηκε 65,2 % ανά πεδίο έναντι 91,4 % (§21.3), με σχεδόν ίδιο κόστος εισόδου. Δικό του κλειδί περιβάλλοντος.
 * @module server/catalog/import-page-analyzer.server
 */

import { readDocumentAnalyzerTransport, requestStructuredDocument } from '@/services/ai/structured-document-request';
import type { ResponsesContent, ResponsesRequestConfig } from '@/services/ai/openai-responses';
import type { CatalogPageInput, CatalogPageReading, ICatalogPageAnalyzer } from '@/subapps/catalog/import/page-analyzer';
import {
  isRawPageExtraction,
  PAGE_EXTRACTION_SCHEMA_NAME,
  PAGE_EXTRACTION_SYSTEM_PROMPT,
  pageExtractionPrompt,
  pageExtractionSchema,
} from '@/subapps/catalog/import/page-extraction';

const DEFAULT_MODEL = 'gpt-4o';
/** Μια κενή ή σπασμένη απάντηση είναι παροδική: ξαναρωτάμε μία φορά πριν μετρήσει η σελίδα ως αποτυχημένη. */
const PARSE_ATTEMPTS = 2;

function pageContent(input: CatalogPageInput): ResponsesContent[] {
  return [
    { type: 'input_text', text: pageExtractionPrompt(input.attributes, input.tokens, input.feedback) },
    { type: 'input_image', image_url: `data:image/png;base64,${input.png.toString('base64')}` },
  ];
}

class OpenAICatalogPageAnalyzer implements ICatalogPageAnalyzer {
  constructor(
    private readonly transport: ResponsesRequestConfig,
    private readonly model: string,
  ) {}

  async readPage(input: CatalogPageInput): Promise<CatalogPageReading> {
    const schema = pageExtractionSchema(input.attributes.map((attribute) => attribute.code));
    for (let attempt = 0; attempt < PARSE_ATTEMPTS; attempt += 1) {
      const outcome = await requestStructuredDocument(this.transport, {
        model: this.model,
        system: PAGE_EXTRACTION_SYSTEM_PROMPT,
        content: pageContent(input),
        schema: { name: PAGE_EXTRACTION_SCHEMA_NAME, strict: true, schema },
      });
      if (outcome.kind === 'parsed' && isRawPageExtraction(outcome.value)) return { kind: 'read', extraction: outcome.value };
    }
    return { kind: 'failed' };
  }
}

const UNAVAILABLE_ANALYZER: ICatalogPageAnalyzer = { readPage: () => Promise.resolve({ kind: 'unavailable' }) };

export function createCatalogPageAnalyzer(): ICatalogPageAnalyzer {
  const transport = readDocumentAnalyzerTransport();
  if (!transport) return UNAVAILABLE_ANALYZER;
  return new OpenAICatalogPageAnalyzer(transport, (process.env.OPENAI_CATALOG_VISION_MODEL || DEFAULT_MODEL).trim());
}
