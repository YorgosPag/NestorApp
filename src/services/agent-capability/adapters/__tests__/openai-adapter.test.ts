/**
 * OpenAI adapter — ελέγχεται πάνω στα **πραγματικά** επτά εργαλεία, όχι σε
 * πλασματικά: ο σκοπός του είναι να παράγει ορισμούς που το strict mode δέχεται.
 *
 * @module services/agent-capability/adapters/__tests__/openai-adapter
 * @see ADR-734 §5.2, §5.3
 */

import type { JsonSchema } from '../../registry';
import { createBoqCapabilityRegistry } from '../../capabilities/boq';
import { createFakeBoqService } from '../../capabilities/boq/__tests__/fake-boq-service';
import { toOpenAiToolDefinitions } from '../index';

const registry = createBoqCapabilityRegistry({ boq: createFakeBoqService({ items: [] }).service });
const definitions = toOpenAiToolDefinitions(registry.list());

/** Το `parameters` είναι `Record<string, unknown>` στο υπάρχον συμβόλαιο. */
function asSchema(parameters: Record<string, unknown>): JsonSchema {
  return parameters as JsonSchema;
}

describe('toOpenAiToolDefinitions', () => {
  it('παράγει έναν ορισμό ανά δυνατότητα, με τη σειρά του καταλόγου', () => {
    expect(definitions.map((d) => d.function.name)).toEqual(registry.list().map((c) => c.name));
  });

  it.each([0, 1, 2, 3, 4, 5, 6])('ορισμός #%s: strict + κλειστό σχήμα + όλα τα κλειδιά υποχρεωτικά', (index) => {
    const definition = definitions[index];
    const schema = asSchema(definition.function.parameters);

    expect(definition.type).toBe('function');
    expect(definition.function.strict).toBe(true);
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(Object.keys(schema.properties ?? {}));
  });

  it('τα ονόματα τηρούν τον περιορισμό του OpenAI και το namespace του §5.3', () => {
    for (const definition of definitions) {
      expect(definition.function.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
      expect(definition.function.name.startsWith('boq_')).toBe(true);
    }
  });

  it('κάθε περιγραφή είναι ουσιαστική — εκεί κρίνεται η επιλογή εργαλείου', () => {
    for (const definition of definitions) {
      expect(definition.function.description.length).toBeGreaterThan(80);
    }
  });

  it('κάθε παράμετρος φέρει περιγραφή προς το μοντέλο', () => {
    for (const definition of definitions) {
      const schema = asSchema(definition.function.parameters);
      for (const property of Object.values(schema.properties ?? {})) {
        expect(property.description).toBeTruthy();
      }
    }
  });

  it('δεν εκτίθεται ΠΟΤΕ παράμετρος tenant στο μοντέλο', () => {
    for (const definition of definitions) {
      const schema = asSchema(definition.function.parameters);
      expect(Object.keys(schema.properties ?? {})).not.toContain('companyId');
    }
  });

  it('η παραγωγή είναι ντετερμινιστική — ίδιο prompt prefix σε κάθε εκτέλεση', () => {
    expect(JSON.stringify(toOpenAiToolDefinitions(registry.list()))).toBe(JSON.stringify(definitions));
  });
});
