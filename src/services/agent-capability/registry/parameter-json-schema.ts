/**
 * Παραγωγή JSON Schema από την προδιαγραφή παραμέτρων
 *
 * Ο **ένας** μεταφραστής `CapabilityParamSpec` → JSON Schema. Τον καταναλώνουν
 * και τα τρία adapters: OpenAI (`function.parameters`), MCP (`inputSchema`),
 * REST (επικύρωση σώματος). Χειρόγραφο σχήμα δίπλα σε εργαλείο = τριπλότυπο
 * (ADR-734 §5.2) και το απαγορεύει το `.ssot-registry.json`.
 *
 * @module services/agent-capability/registry/parameter-json-schema
 * @see ADR-734 §5.1, §5.2
 */

import type { CapabilityParamMap, CapabilityParamSpec } from './parameter-spec';
import { type JsonSchema, nullable, strictObjectSchema } from './json-schema';

/** Ο βασικός τύπος μιας παραμέτρου, πριν την προαιρετικότητα. */
function baseSchema(spec: CapabilityParamSpec): JsonSchema {
  switch (spec.kind) {
    case 'string':
      return {
        type: 'string',
        description: spec.description,
        ...(spec.maxLength !== undefined ? { maxLength: spec.maxLength } : {}),
      };
    case 'number':
      return {
        type: spec.integer === true ? 'integer' : 'number',
        description: spec.description,
        ...(spec.minimum !== undefined ? { minimum: spec.minimum } : {}),
        ...(spec.maximum !== undefined ? { maximum: spec.maximum } : {}),
      };
    case 'boolean':
      return { type: 'boolean', description: spec.description };
    case 'enum':
      return { type: 'string', description: spec.description, enum: [...spec.values] };
    case 'stringArray':
      return {
        type: 'array',
        description: spec.description,
        items: { type: 'string' },
        ...(spec.maxItems !== undefined ? { maxItems: spec.maxItems } : {}),
      };
  }
}

/** Σχήμα μιας παραμέτρου, με nullable όταν είναι προαιρετική. */
export function paramToJsonSchema(spec: CapabilityParamSpec): JsonSchema {
  const base = baseSchema(spec);
  return spec.optional === true ? nullable(base) : base;
}

/**
 * Σχήμα εισόδου μιας δυνατότητας.
 *
 * Η σειρά των κλειδιών ακολουθεί τη σειρά **δήλωσης** — ντετερμινιστική έξοδος,
 * ώστε δύο εκτελέσεις να παράγουν ταυτόσημο σχήμα (σημασία για διαγνωστικά και
 * για συγκρίσεις σε tests).
 */
export function paramsToJsonSchema(params: CapabilityParamMap): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const [name, spec] of Object.entries(params)) {
    properties[name] = paramToJsonSchema(spec);
  }
  return strictObjectSchema(properties);
}
