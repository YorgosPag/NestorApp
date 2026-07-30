/**
 * JSON Schema — ο ελάχιστος τύπος που καταλαβαίνουν **και τα τρία** adapters
 *
 * Σκόπιμα δηλωμένος ως `type` (alias) και όχι ως `interface`: μόνο τα aliases
 * αποκτούν υπονοούμενη index signature στην TypeScript, άρα μόνο αυτά είναι
 * αναθέσιμα στο `Record<string, unknown>` που απαιτεί το υπάρχον
 * `AgenticToolDefinition.function.parameters`. Με `interface` ο adapter θα
 * χρειαζόταν cast — δηλαδή θα έκρυβε την ασυμφωνία αντί να τη λύσει.
 *
 * Το λεξιλόγιο περιορίζεται στο υποσύνολο που δέχεται το **strict mode** του
 * OpenAI (Structured Outputs). Ό,τι δεν εκφράζεται εκεί δεν δηλώνεται ούτε εδώ.
 *
 * @module services/agent-capability/registry/json-schema
 * @see ADR-734 §5.1 (L3 adapters)
 */

/** Πρωτογενής τιμή που επιτρέπεται σε `enum`. */
export type JsonSchemaEnumValue = string | number | boolean | null;

/** Κόμβος JSON Schema — αναδρομικός, μόνο τα κλειδιά που χρησιμοποιούμε. */
export type JsonSchema = {
  readonly type?: string | readonly string[];
  readonly description?: string;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: JsonSchema;
  readonly anyOf?: readonly JsonSchema[];
  readonly enum?: readonly JsonSchemaEnumValue[];
  readonly maxLength?: number;
  readonly maxItems?: number;
  readonly minimum?: number;
  readonly maximum?: number;
};

/**
 * Αντικείμενο **κλειστό** (strict mode): `additionalProperties: false` και
 * **όλα** τα κλειδιά στο `required`. Η προαιρετικότητα εκφράζεται με nullable
 * τύπο μέσα στο πεδίο, ποτέ με απουσία από το `required`.
 *
 * Μία συνάρτηση για κάθε αντικείμενο του σχήματος ⇒ κανένα σημείο δεν μπορεί να
 * ξεχάσει το `additionalProperties: false`.
 */
export function strictObjectSchema(
  properties: Readonly<Record<string, JsonSchema>>,
  description?: string,
): JsonSchema {
  return {
    type: 'object',
    ...(description !== undefined ? { description } : {}),
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

/**
 * Αντικείμενο **εξόδου** — εδώ το `required` σημαίνει ό,τι λέει το πρότυπο JSON
 * Schema: «αυτά τα κλειδιά υπάρχουν πάντα». Δεν ισχύει ο περιορισμός του strict
 * mode (αυτός αφορά μόνο *παραγωγή* από το μοντέλο, δηλαδή τις εισόδους), οπότε
 * ένα πεδίο που ο κώδικας **παραλείπει** δηλώνεται ως μη υποχρεωτικό αντί για
 * υποχρεωτικό-με-null. Σχήμα που περιγράφει ανακριβώς την έξοδο είναι χειρότερο
 * από απουσία σχήματος.
 */
export function objectSchema(
  properties: Readonly<Record<string, JsonSchema>>,
  required: readonly string[],
  description?: string,
): JsonSchema {
  return {
    type: 'object',
    ...(description !== undefined ? { description } : {}),
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * Πεδίο αντικειμένου μαζί με το αν είναι υποχρεωτικό.
 *
 * Υπάρχει ώστε η δήλωση ενός σχήματος να μπορεί να τυποποιηθεί ως
 * `Readonly<Record<keyof T, SchemaField>>`: τότε **ο compiler** απαιτεί εγγραφή
 * για κάθε πεδίο του `T` και η λίστα `required` **παράγεται** αντί να γράφεται
 * δεύτερη φορά. Νέο πεδίο στον τύπο ⇒ κόκκινη μεταγλώττιση, όχι σιωπηλά
 * ελλιπές σχήμα προς τον πράκτορα.
 */
export type SchemaField = {
  readonly schema: JsonSchema;
  readonly required: boolean;
};

/** Δηλώνει υποχρεωτικό πεδίο. */
export function requiredField(schema: JsonSchema): SchemaField {
  return { schema, required: true };
}

/** Δηλώνει πεδίο που μπορεί να **απουσιάζει** (όχι «να είναι null»). */
export function optionalField(schema: JsonSchema): SchemaField {
  return { schema, required: false };
}

/** Συνθέτει αντικείμενο από `SchemaField` — `properties` + `required` μαζί. */
export function fieldsToObjectSchema(
  fields: Readonly<Record<string, SchemaField>>,
  description?: string,
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [name, field] of Object.entries(fields)) {
    properties[name] = field.schema;
    if (field.required) required.push(name);
  }
  return objectSchema(properties, required, description);
}

/** Πίνακας από `items`. */
export function arraySchema(items: JsonSchema, description?: string): JsonSchema {
  return {
    type: 'array',
    ...(description !== undefined ? { description } : {}),
    items,
  };
}

/** Επιτρέπει `null` δίπλα στον βασικό τύπο (ο τρόπος του strict mode). */
export function nullable(schema: JsonSchema): JsonSchema {
  const baseTypes = schema.type === undefined
    ? []
    : (Array.isArray(schema.type) ? [...schema.type] : [schema.type]);

  if (baseTypes.includes('null')) return schema;

  const withNullEnum = schema.enum !== undefined && !schema.enum.includes(null)
    ? { enum: [...schema.enum, null] }
    : {};

  return { ...schema, type: [...baseTypes, 'null'], ...withNullEnum };
}
