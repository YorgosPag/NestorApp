/**
 * @fileoverview **ΣΧΗΜΑΤΑ zod → `components.schemas` του OpenAPI 3.1** — ονομασμένα, με `$ref`, ντετερμινιστικά.
 * @related ADR-904 Ε6 · `capture-api-schemas.ts` · `capture-api-document.ts`
 * @module contracts/capture-api/capture-api-json-schema
 *
 * 🔑 **Το εγγενές `z.toJSONSchema` του zod v4** — καμία εξάρτηση τρίτου (N.5: λιγότερη επιφάνεια αλυσίδας εφοδιασμού).
 * Εδώ ζουν μόνο τρεις **κανονικοποιήσεις** που ζητά το OpenAPI/ο γεννήτορας Kotlin και όχι το JSON Schema:
 *  1. `anyOf` + `discriminator` ⇒ `oneOf` + `discriminator.mapping` (αλλιώς ο Kotlin βγάζει «όλα προαιρετικά»)·
 *  2. το τεράστιο `pattern` του `date-time` φεύγει — το `format` είναι το πρότυπο, και ο Kotlin το αποκωδικοποιεί·
 *  3. τα `$schema`/`$id` ανά σχήμα φεύγουν — ζουν **μία** φορά στο έγγραφο·
 *  4. `anyOf: [{ type: X }, { type: 'null' }]` ⇒ `type: [X, 'null']` — η μορφή «nullable» του OpenAPI 3.1, που ο
 *     γεννήτορας Kotlin κάνει `X?` (το `anyOf` θα γινόταν τύπος-περιτύλιγμα).
 *
 * ⚠️ **`io: 'input'`, επίτηδες**: το zod `object` **πετά** άγνωστα κλειδιά — δεν τα απορρίπτει. Η είσοδος λέει
 * λοιπόν την αλήθεια («επιτρέπονται πρόσθετα πεδία»), και για τις **αποκρίσεις** αυτό είναι ακριβώς το ζητούμενο:
 * νέο πεδίο του διακομιστή δεν σπάει εφαρμογή που ήδη βρίσκεται στο κατάστημα.
 *
 * **Layering**: leaf.
 */

import { z } from 'zod/v4';

/** Ένα σχήμα JSON, όπως το βγάζει το zod — δέντρο αντικειμένων. */
export type JsonSchemaNode = { [key: string]: unknown };

const COMPONENT_PREFIX = '#/components/schemas/';

function isNode(value: unknown): value is JsonSchemaNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Η σταθερή τιμή του διακριτή μέσα σε ένα μέλος (`properties.kind.const`), ή `null`. */
function discriminatorValueOf(member: JsonSchemaNode, property: string): string | null {
  const properties = member.properties;
  if (!isNode(properties)) return null;
  const field = properties[property];
  return isNode(field) && typeof field.const === 'string' ? field.const : null;
}

/** `anyOf` + `discriminator` ⇒ `oneOf` + `mapping` από τα **ονομασμένα** μέλη (`$ref`). */
function withDiscriminatedOneOf(node: JsonSchemaNode, components: Readonly<Record<string, JsonSchemaNode>>): JsonSchemaNode {
  const discriminator = node.discriminator;
  if (!isNode(discriminator) || typeof discriminator.propertyName !== 'string' || !Array.isArray(node.anyOf)) return node;
  const property = discriminator.propertyName;
  const mapping: Record<string, string> = {};
  for (const member of node.anyOf) {
    const ref = isNode(member) && typeof member.$ref === 'string' ? member.$ref : null;
    const target = ref === null ? undefined : components[ref.slice(COMPONENT_PREFIX.length)];
    const value = target === undefined ? null : discriminatorValueOf(target, property);
    if (ref === null || value === null) {
      throw new Error(`discriminated union on "${property}": every member must be a named component with a const`);
    }
    mapping[value] = ref;
  }
  const { anyOf, ...rest } = node;
  return { ...rest, oneOf: anyOf, discriminator: { propertyName: property, mapping } };
}

/** `anyOf: [{ type: X, … }, { type: 'null' }]` ⇒ `{ type: [X, 'null'], … }` (και `null` στο `enum`, αν υπάρχει). */
function withNullableType(node: JsonSchemaNode): JsonSchemaNode {
  const branches = node.anyOf;
  if (!Array.isArray(branches) || branches.length !== 2) return node;
  const nullIndex = branches.findIndex((b) => isNode(b) && b.type === 'null' && Object.keys(b).length === 1);
  const other = branches[1 - nullIndex];
  if (nullIndex === -1 || !isNode(other) || typeof other.type !== 'string') return node;
  const { anyOf, ...rest } = node;
  const merged: JsonSchemaNode = { ...rest, ...other, type: [other.type, 'null'] };
  if (Array.isArray(other.enum)) merged.enum = [...other.enum, null];
  return merged;
}

/** Αναδρομική κανονικοποίηση ενός κόμβου (βλ. τις τρεις κανονικοποιήσεις στην κεφαλίδα). */
function normalizeNode(value: unknown, components: Readonly<Record<string, JsonSchemaNode>>): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeNode(item, components));
  if (!isNode(value)) return value;
  const out: JsonSchemaNode = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === '$schema' || key === '$id') continue;
    if (key === 'pattern' && value.format === 'date-time') continue;
    out[key] = normalizeNode(child, components);
  }
  return withNullableType(withDiscriminatedOneOf(out, components));
}

function declaresObject(node: JsonSchemaNode): boolean {
  return node.type === 'object' || (Array.isArray(node.type) && node.type.includes('object'));
}

/**
 * **Κάθε object κάτω από τη ρίζα ενός component είναι `$ref`** — ποτέ ανώνυμο. Ένα ανώνυμο εμφωλευμένο object δεν
 * έχει όνομα κλάσης στους πελάτες (Kotlin/Swift): ο γεννήτορας της εφαρμογής είναι fail-closed και θα το απέρριπτε
 * **στο build του κινητού** — εδώ απορρίπτεται **πριν** γραφτεί το συμβόλαιο (CHECK 3.98). Πρακτική Stripe/Smithy:
 * κάθε σχήμα του API ονομάζεται.
 */
function assertNoAnonymousObjects(value: unknown, path: string, isRoot: boolean): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoAnonymousObjects(item, `${path}[${i}]`, false));
    return;
  }
  if (!isNode(value)) return;
  if (!isRoot && declaresObject(value)) {
    throw new Error(`${path}: anonymous nested object — name it in CAPTURE_API_SCHEMAS`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'enum' && key !== 'const') assertNoAnonymousObjects(child, `${path}.${key}`, false);
  }
}

/**
 * **Τα ονομασμένα σχήματα του συμβολαίου ως `components.schemas`.** Τα ονόματα δίνονται **εδώ**, από τον καλούντα —
 * όχι με `.meta({ id })` στα ίδια τα σχήματα, που θα τα έγραφε στο **καθολικό** μητρώο του zod (κοινό για όλη την
 * εφαρμογή, άρα συγκρούσεις ονομάτων με ξένα σχήματα).
 */
export function componentSchemasOf(named: Readonly<Record<string, z.ZodType>>): Record<string, JsonSchemaNode> {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(named)) registry.add(schema, { id });
  const { schemas } = z.toJSONSchema(registry, {
    io: 'input',
    unrepresentable: 'throw',
    uri: (id) => `${COMPONENT_PREFIX}${id}`,
  });
  const raw: Record<string, JsonSchemaNode> = {};
  for (const [id, schema] of Object.entries(schemas)) raw[id] = schema as JsonSchemaNode;
  const out: Record<string, JsonSchemaNode> = {};
  for (const id of Object.keys(raw).sort()) {
    const normalized = normalizeNode(raw[id], raw);
    if (!isNode(normalized)) throw new Error(`component ${id} is not an object schema`);
    assertNoAnonymousObjects(normalized, id, true);
    out[id] = normalized;
  }
  return out;
}
