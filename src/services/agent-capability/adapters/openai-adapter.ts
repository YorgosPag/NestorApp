/**
 * OpenAI adapter — παράγει ορισμούς Chat Completions **από** το registry (L3)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΠΑΡΑΓΕΙ ΤΟΝ ΥΠΑΡΧΟΝΤΑ ΤΥΠΟ ΚΑΙ ΔΕΝ ΦΤΙΑΧΝΕΙ ΔΕΥΤΕΡΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `AgenticToolDefinition` (`ai-pipeline/tools/agentic-tool-definitions.ts`)
 * είναι ήδη το SSoT μορφής για OpenAI function calling στο έργο, με 40 ορισμούς
 * και έξι ζωντανούς καταναλωτές (`agentic-loop`, `agentic-openai-client`,
 * `agentic-path-executor`, `ai-pipeline/index`, το route
 * `financial-intelligence/query`, οι handlers). Δεύτερος τύπος = τριπλότυπο και
 * ευθεία παραβίαση N.12/N.18. Εδώ γίνεται **πρόσθεση**, όχι μετασχηματισμός: οι
 * 40 χειρόγραφοι ορισμοί μένουν ως έχουν· οι νέοι **παράγονται**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STRICT MODE
 * ─────────────────────────────────────────────────────────────────────────────
 * `strict: true` σε όλα. Η προϋπόθεσή του — `additionalProperties: false` και
 * **όλα** τα κλειδιά στο `required` — δεν αφήνεται στη μνήμη του συγγραφέα: την
 * επιβάλλει η `strictObjectSchema()` μέσα στο `paramsToJsonSchema()`.
 *
 * ⚠️ Το strict mode δεσμεύει **μόνο** τον client του OpenAI. Ο έλεγχος εισόδου
 * στο `parameter-parse.ts` παραμένει ο μόνος πραγματικός (ADR-734 §5.4).
 *
 * @module services/agent-capability/adapters/openai-adapter
 * @see ADR-734 §5.1 (L3), §5.2
 */

import type { AgenticToolDefinition } from '@/services/ai-pipeline/tools/agentic-tool-definitions';
import { type AnyCapability, capabilityInputSchema } from '../registry';

/** Ένας ορισμός Chat Completions από έναν ορισμό δυνατότητας. */
export function toOpenAiToolDefinition(capability: AnyCapability): AgenticToolDefinition {
  return {
    type: 'function',
    function: {
      name: capability.name,
      description: capability.description,
      parameters: capabilityInputSchema(capability),
      strict: true,
    },
  };
}

/**
 * Οι ορισμοί ενός καταλόγου δυνατοτήτων.
 *
 * Η σειρά είναι αυτή του `registry.list()` — ταξινομημένη κατά όνομα, άρα
 * σταθερή μεταξύ εκτελέσεων. Σταθερή σειρά ⇒ σταθερό prompt prefix ⇒ το prompt
 * caching του παρόχου δουλεύει αντί να ακυρώνεται σε κάθε αναδιάταξη.
 */
export function toOpenAiToolDefinitions(
  capabilities: readonly AnyCapability[],
): AgenticToolDefinition[] {
  return capabilities.map(toOpenAiToolDefinition);
}
