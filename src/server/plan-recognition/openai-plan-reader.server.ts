import 'server-only';

/**
 * Ο **μοναδικός** προσαρμογέας της θύρας `PlanReader` (ADR-929 Δ5, §9.1): OpenAI μέσω του **κοινού**
 * `requestStructuredDocument`, όπως ο αναγνώστης σελίδων καταλόγου και ο αναλυτής προσφορών. Κανένας δεύτερος πελάτης.
 *
 * 🔑 **Μοντέλο με μέτρηση, όχι με γνώμη (Δ13).** Δικό του κλειδί περιβάλλοντος (`OPENAI_PLAN_VISION_MODEL`), όπως ο
 * κατάλογος. Η προεπιλογή είναι ο νικητής της μέτρησης στο χρυσό σύνολο (ADR-929 §6.4).
 * 🔑 **Ένα πέρασμα, χωρίς αυτόματη επανάληψη μεταφοράς** (`maxRetries: 0`). Ένα timeout μπορεί να έχει ήδη χρεωθεί·
 * η επανάληψη ανήκει στον πελάτη, με το **ίδιο** `Idempotency-Key`, και κρίνεται εκεί.
 * 🔑 **Εκτίμηση πριν την κλήση** (Δ16 #2): tokens εικόνας από τον κανόνα της οικογένειας (`imageInputTokens`), tokens
 * κειμένου από το μήκος, και ο προϋπολογισμός εξόδου. Άγνωστο μοντέλο ⇒ `null` ⇒ η κλήση δεν γίνεται.
 *
 * @module server/plan-recognition/openai-plan-reader.server
 */

import { imageDetailFor, imageInputTokens, tokenCostUsd } from '@/config/ai-analysis-config';
import type { ResponsesReasoningEffort, ResponsesRequestConfig, ResponsesUsage } from '@/services/ai/openai-responses';
import { readDocumentAnalyzerTransport, requestStructuredDocument } from '@/services/ai/structured-document-request';
import type {
  PlanReader,
  PlanReaderInput,
  PlanReaderOutcome,
  PlanReaderUsage,
} from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reader-port';
import { PLAN_READING_SYSTEM_PROMPT, planReadingUserText } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-prompt';
import {
  parsePlanViewReading,
  PLAN_READING_SCHEMA_NAME,
  planReadingJsonSchema,
} from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-wire';

/** Ο νικητής της μέτρησης ως τώρα (ADR-929 §6.4: προσωρινός, μένει η σάρωση άδειας). Αλλάζει **μόνο** με νέα μέτρηση. */
export const DEFAULT_PLAN_READER_MODEL = 'gpt-6.1-terra';
/**
 * Ο συλλογισμός ανά μοντέλο, όπως μετρήθηκε· απουσία ⇒ η προεπιλογή του μοντέλου. Κενό επίτηδες: στο `gpt-6.1-terra`
 * το `low` έριξε την ανάκληση διαστάσεων 74 % → 53 % και το `medium` δεν ξεπέρασε την προεπιλογή (§6.4).
 */
const REASONING_BY_MODEL: Readonly<Record<string, ResponsesReasoningEffort>> = {};
/** Ανώτατη έξοδος που υπολογίζεται στην εκτίμηση (συλλογισμός + JSON μιας πυκνής σάρωσης άδειας). */
const OUTPUT_TOKEN_BUDGET = 16_000;
/** Χονδρική αντιστοιχία χαρακτήρων ⇒ tokens για την εκτίμηση του κειμένου. */
const CHARS_PER_TOKEN = 3;

function bytesToDataUri(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64')}`;
}

class OpenAIPlanReader implements PlanReader {
  constructor(
    private readonly transport: ResponsesRequestConfig,
    readonly model: string,
    private readonly reasoningEffort: ResponsesReasoningEffort | undefined,
  ) {}

  estimateCostUsd(input: PlanReaderInput): number | null {
    const imageTokens = imageInputTokens(this.model, input.image.widthPx, input.image.heightPx);
    if (imageTokens === null) return null;
    const textChars = PLAN_READING_SYSTEM_PROMPT.length + planReadingUserText(input.segments).length;
    return tokenCostUsd(this.model, imageTokens + Math.ceil(textChars / CHARS_PER_TOKEN), OUTPUT_TOKEN_BUDGET);
  }

  async read(input: PlanReaderInput): Promise<PlanReaderOutcome> {
    const detail = imageDetailFor(this.model) ?? 'high';
    const started = Date.now();
    const base = { model: this.model };
    try {
      const outcome = await requestStructuredDocument(this.transport, {
        model: this.model,
        system: PLAN_READING_SYSTEM_PROMPT,
        content: [
          { type: 'input_text', text: planReadingUserText(input.segments) },
          { type: 'input_image', image_url: bytesToDataUri(input.image.bytes, input.image.mimeType), detail },
        ],
        schema: { name: PLAN_READING_SCHEMA_NAME, strict: true, schema: planReadingJsonSchema() },
        reasoningEffort: this.reasoningEffort,
      });
      const usage = this.costed(outcome.usage);
      const latencyMs = Date.now() - started;
      if (outcome.kind !== 'parsed') return { ...base, kind: 'failed', failure: outcome.kind, usage, latencyMs, detail: outcome.text ?? '' };
      const parsed = parsePlanViewReading(outcome.value, input.segments.map((s) => s.id));
      if (!parsed.ok) return { ...base, kind: 'failed', failure: 'invalid-shape', usage, latencyMs, detail: parsed.issues.slice(0, 5).join('; ') };
      return { ...base, kind: 'read', reading: parsed.reading, dropped: parsed.dropped, usage, latencyMs };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { ...base, kind: 'failed', failure: 'transport', usage: null, latencyMs: Date.now() - started, detail };
    }
  }

  private costed(usage: ResponsesUsage | null): PlanReaderUsage | null {
    if (!usage) return null;
    return { ...usage, costUsd: tokenCostUsd(this.model, usage.inputTokens, usage.outputTokens) };
  }
}

/** Μόνο για τη μέτρηση: άλλο μοντέλο ή άλλος συλλογισμός από την παραγωγή. */
export interface PlanReaderOverrides {
  readonly model?: string;
  readonly reasoningEffort?: ResponsesReasoningEffort | null;
}

/** Ο αναγνώστης από το περιβάλλον, ή `null` χωρίς κλειδί (η ροή συνεχίζει μόνο με γεωμετρία, Δ15 #1). */
export function createPlanReader(overrides: PlanReaderOverrides = {}): PlanReader | null {
  const transport = readDocumentAnalyzerTransport();
  if (!transport) return null;
  const model = (overrides.model ?? process.env.OPENAI_PLAN_VISION_MODEL ?? DEFAULT_PLAN_READER_MODEL).trim();
  const effort = overrides.reasoningEffort === undefined ? REASONING_BY_MODEL[model] : overrides.reasoningEffort ?? undefined;
  return new OpenAIPlanReader({ ...transport, maxRetries: 0 }, model, effort);
}
