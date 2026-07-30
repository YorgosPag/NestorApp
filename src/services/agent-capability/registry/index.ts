/**
 * Capability Registry — Barrel Exports (ADR-734 Φάση 2, στρώμα L2)
 *
 * Η δημόσια επιφάνεια του καταλόγου δυνατοτήτων. Οι δυνατότητες (`capabilities/`)
 * και τα adapters (`adapters/`) καταναλώνουν **μόνο** από εδώ.
 *
 * @module services/agent-capability/registry
 * @see ADR-734 §5.1 (τέσσερα στρώματα), §5.2 (γιατί registry)
 */

// Ο κατάλογος & η πύλη εκτέλεσης
export {
  createCapabilityRegistry,
  capabilityInputSchema,
  capabilityOutputSchema,
} from './capability-registry';
export type { CapabilityRegistry, CapabilityFilter } from './capability-registry';

// Το συμβόλαιο ορισμού
export { defineCapability } from './capability-types';
export type {
  AnyCapability,
  CapabilityAnnotations,
  CapabilityContext,
  CapabilityDescriptor,
  CapabilityDomain,
  CapabilityOutcome,
  CapabilityPolicy,
} from './capability-types';

// Σφάλματα
export { capabilityError, notFoundError } from './capability-errors';
export type { CapabilityError, CapabilityErrorCode } from './capability-errors';

// Παράμετροι — μία δήλωση για schema + έλεγχο + τύπο
export { defineParams, NO_PARAMS } from './parameter-spec';
export type {
  BooleanParamSpec,
  CapabilityParamMap,
  CapabilityParamSpec,
  EnumParamSpec,
  NumberParamSpec,
  ParamValue,
  ParsedArgs,
  StringArrayParamSpec,
  StringParamSpec,
} from './parameter-spec';
export { parseArgs } from './parameter-parse';
export type { ParseResult } from './parameter-parse';
export { paramsToJsonSchema, paramToJsonSchema } from './parameter-json-schema';

// JSON Schema — το υποσύνολο που δέχονται και τα τρία adapters
export {
  arraySchema,
  fieldsToObjectSchema,
  nullable,
  objectSchema,
  optionalField,
  requiredField,
  strictObjectSchema,
} from './json-schema';
export type { JsonSchema, JsonSchemaEnumValue, SchemaField } from './json-schema';
export { vqeOutputSchema } from './vqe-output-schema';
