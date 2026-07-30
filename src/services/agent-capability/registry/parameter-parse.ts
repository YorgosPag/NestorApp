/**
 * Έλεγχος εισόδου από την **ίδια** προδιαγραφή που παρήγαγε το JSON Schema
 *
 * Το strict mode του OpenAI εγγυάται συμμόρφωση **μόνο** για τον δικό του
 * client. Ένας MCP client, ένα REST call ή ένα κακόβουλο μήνυμα δεν δεσμεύονται
 * από τίποτα. Άρα ο έλεγχος εδώ **δεν είναι διπλός** — είναι ο μόνος που
 * υπάρχει, και ζει στο ντετερμινιστικό στρώμα (ADR-734 §5.4).
 *
 * Κανόνας: **fail-closed**. Άγνωστο κλειδί, λάθος τύπος, μη πεπερασμένος
 * αριθμός ⇒ απόρριψη. Ένα εργαλείο που αγνοεί σιωπηλά ένα φίλτρο επιστρέφει
 * **περισσότερα** δεδομένα από όσα ζητήθηκαν — σε σύστημα που παράγει αριθμούς
 * προς υπογραφή αυτό είναι σφάλμα τιμής, όχι μορφής.
 *
 * @module services/agent-capability/registry/parameter-parse
 * @see ADR-734 §5.4
 */

import { type CapabilityError, capabilityError } from './capability-errors';
import type {
  CapabilityParamMap,
  CapabilityParamSpec,
  EnumParamSpec,
  NumberParamSpec,
  ParsedArgs,
  StringArrayParamSpec,
  StringParamSpec,
} from './parameter-spec';

/** Αποτέλεσμα ελέγχου — διακριτή ένωση, ποτέ exception για αναμενόμενη αστοχία. */
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CapabilityError };

function invalid(name: string, reason: string): { ok: false; error: CapabilityError } {
  return {
    ok: false,
    error: capabilityError('INVALID_ARGUMENT', `Invalid argument "${name}": ${reason}`, {
      parameter: name,
      reason,
    }),
  };
}

/** `null`/`undefined` ⇒ «απών». Το strict mode στέλνει `null` για τα προαιρετικά. */
function isAbsent(raw: unknown): boolean {
  return raw === null || raw === undefined;
}

type ScalarResult =
  | { readonly ok: true; readonly value: string | number | boolean | readonly string[] }
  | { readonly ok: false; readonly error: CapabilityError };

function parseString(name: string, spec: StringParamSpec, raw: unknown): ScalarResult {
  if (typeof raw !== 'string') return invalid(name, 'expected a string');
  const value = raw.trim();
  if (value.length === 0) return invalid(name, 'must not be empty');
  if (spec.maxLength !== undefined && value.length > spec.maxLength) {
    return invalid(name, `exceeds maxLength ${spec.maxLength}`);
  }
  return { ok: true, value };
}

function parseNumber(name: string, spec: NumberParamSpec, raw: unknown): ScalarResult {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return invalid(name, 'expected a finite number');
  }
  if (spec.integer === true && !Number.isInteger(raw)) return invalid(name, 'expected an integer');
  if (spec.minimum !== undefined && raw < spec.minimum) return invalid(name, `below minimum ${spec.minimum}`);
  if (spec.maximum !== undefined && raw > spec.maximum) return invalid(name, `above maximum ${spec.maximum}`);
  return { ok: true, value: raw };
}

function parseEnum(name: string, spec: EnumParamSpec, raw: unknown): ScalarResult {
  if (typeof raw !== 'string') return invalid(name, 'expected a string');
  if (!spec.values.includes(raw)) return invalid(name, `expected one of: ${spec.values.join(', ')}`);
  return { ok: true, value: raw };
}

function parseStringArray(
  name: string,
  spec: StringArrayParamSpec,
  raw: unknown,
): ScalarResult {
  if (!Array.isArray(raw)) return invalid(name, 'expected an array of strings');
  if (spec.maxItems !== undefined && raw.length > spec.maxItems) {
    return invalid(name, `exceeds maxItems ${spec.maxItems}`);
  }
  const value: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') return invalid(name, 'expected an array of strings');
    const trimmed = entry.trim();
    if (trimmed.length === 0) return invalid(name, 'array entries must not be empty');
    value.push(trimmed);
  }
  return { ok: true, value };
}

/** Δρομολόγηση ανά είδος. Ένα `switch` — ο compiler απαιτεί πληρότητα. */
function parseOne(name: string, spec: CapabilityParamSpec, raw: unknown): ScalarResult {
  switch (spec.kind) {
    case 'string': return parseString(name, spec, raw);
    case 'number': return parseNumber(name, spec, raw);
    case 'boolean':
      return typeof raw === 'boolean' ? { ok: true, value: raw } : invalid(name, 'expected a boolean');
    case 'enum': return parseEnum(name, spec, raw);
    case 'stringArray': return parseStringArray(name, spec, raw);
  }
}

/**
 * Ελέγχει τα ωμά ορίσματα και επιστρέφει το **τυπωμένο** αντικείμενο.
 *
 * Η μοναδική δήλωση τύπου (`as ParsedArgs<M>`) βρίσκεται ακριβώς στο σημείο όπου
 * ο έλεγχος μόλις **απέδειξε** το σχήμα — δεν είναι παράκαμψη, είναι η μετάβαση
 * από «ελεγμένο σε χρόνο εκτέλεσης» σε «γνωστό σε χρόνο μεταγλώττισης».
 */
export function parseArgs<M extends CapabilityParamMap>(
  params: M,
  rawArgs: Readonly<Record<string, unknown>>,
): ParseResult<ParsedArgs<M>> {
  const declared = Object.keys(params);

  for (const key of Object.keys(rawArgs)) {
    if (!declared.includes(key)) {
      return invalid(key, 'unknown parameter');
    }
  }

  const parsed: Record<string, unknown> = {};

  for (const name of declared) {
    const spec = params[name];
    const raw = rawArgs[name];

    if (isAbsent(raw)) {
      if (spec.optional !== true) return invalid(name, 'is required');
      continue;
    }

    const outcome = parseOne(name, spec, raw);
    if (!outcome.ok) return outcome;
    parsed[name] = outcome.value;
  }

  return { ok: true, value: parsed as ParsedArgs<M> };
}
