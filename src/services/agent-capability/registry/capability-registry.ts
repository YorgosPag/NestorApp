/**
 * Capability Registry — το SSoT του στρώματος L2 (ADR-734 §5.2)
 *
 * Δύο δουλειές, καμία άλλη:
 *   1. **Κατάλογος** — ένας ορισμός ανά δυνατότητα, από τον οποίο παράγονται τα
 *      schemas όλων των adapters.
 *   2. **Πύλη εκτέλεσης** — η *μοναδική* πόρτα προς τους handlers, όπου
 *      επιβάλλεται η πολιτική **πριν** τρέξει κώδικας δυνατότητας.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΟΙ ΕΛΕΓΧΟΙ ΚΑΤΑΣΚΕΥΗΣ ΔΕΝ ΕΙΝΑΙ ΚΑΛΛΩΠΙΣΜΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ρίχνουν κατά τη **φόρτωση του module**, όχι στο πρώτο κακό αίτημα. Ένα λάθος
 * όνομα ή μια παράμετρος `companyId` δεν φτάνει ποτέ σε περιβάλλον εκτέλεσης:
 * σπάει στο πρώτο import, δηλαδή στο πρώτο test.
 *
 * @module services/agent-capability/registry/capability-registry
 * @see ADR-734 §5.2, §5.3, §5.4
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { type CapabilityError, capabilityError } from './capability-errors';
import type {
  AnyCapability,
  CapabilityContext,
  CapabilityDomain,
  CapabilityOutcome,
} from './capability-types';
import type { JsonSchema } from './json-schema';
import { paramsToJsonSchema } from './parameter-json-schema';
import { parseArgs } from './parameter-parse';
import { vqeOutputSchema } from './vqe-output-schema';

const logger = createModuleLogger('CapabilityRegistry');

// ============================================================================
// ΚΑΝΟΝΕΣ ΚΑΤΑΣΚΕΥΗΣ
// ============================================================================

/** OpenAI: `^[a-zA-Z0-9_-]{1,64}$`. Εμείς αυστηρότερα — μία γραφή, μία μορφή. */
const CAPABILITY_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const CAPABILITY_NAME_MAX_LENGTH = 64;

/**
 * Ονόματα παραμέτρων που **απαγορεύεται** να δηλώσει δυνατότητα.
 *
 * Ο tenant δεν είναι ποτέ όρισμα εργαλείου: αν ο πράκτορας μπορεί να τον
 * δηλώσει, μπορεί να διαβάσει άλλον πελάτη. Έρχεται αποκλειστικά από το
 * `CapabilityContext`, δηλαδή από το ταυτοποιημένο στρώμα (ADR-734 §7).
 */
const FORBIDDEN_PARAM_NAMES: readonly string[] = ['companyId', 'tenantId', 'organizationId'];

/**
 * Διακόπτης Φάσης 4. Όσο είναι `false`, καμία δυνατότητα εγγραφής δεν εκτελείται
 * **ακόμη κι αν καταχωρηθεί** — fail-closed. Το άνοιγμά του είναι ρητή,
 * τεκμηριωμένη απόφαση, όχι παρενέργεια ενός merge.
 */
const WRITE_CAPABILITIES_ENABLED = false;

function assertValidCapability(capability: AnyCapability): void {
  const { name, domain, params, policy, annotations } = capability;

  if (!CAPABILITY_NAME_PATTERN.test(name) || name.length > CAPABILITY_NAME_MAX_LENGTH) {
    throw new Error(`ADR-734: invalid capability name "${name}" — expected ${CAPABILITY_NAME_PATTERN} (max ${CAPABILITY_NAME_MAX_LENGTH}).`);
  }
  if (!name.startsWith(`${domain}_`)) {
    throw new Error(`ADR-734 §5.3: capability "${name}" must start with its domain prefix "${domain}_".`);
  }
  for (const paramName of Object.keys(params)) {
    if (FORBIDDEN_PARAM_NAMES.includes(paramName)) {
      throw new Error(`ADR-734 §7: capability "${name}" declares "${paramName}" as a parameter — tenant identity comes from CapabilityContext only.`);
    }
  }
  if (annotations.readOnlyHint !== (policy.access === 'read')) {
    throw new Error(`ADR-734 §5.4: capability "${name}" has readOnlyHint=${annotations.readOnlyHint} but policy.access="${policy.access}" — the hint must not contradict the enforced policy.`);
  }
}

// ============================================================================
// ΤΟ REGISTRY
// ============================================================================

/** Κριτήρια καταλόγου — υποδομή για progressive disclosure (ADR-734 §3.2β). */
export interface CapabilityFilter {
  readonly domain?: CapabilityDomain;
  readonly access?: 'read' | 'write';
}

export interface CapabilityRegistry {
  /** Όλες οι δυνατότητες, ταξινομημένες κατά όνομα (ντετερμινιστική έξοδος). */
  list(filter?: CapabilityFilter): readonly AnyCapability[];
  /** Ο ορισμός, ή `undefined` αν δεν υπάρχει. */
  get(name: string): AnyCapability | undefined;
  /** Η **μοναδική** πόρτα εκτέλεσης — πολιτική, έλεγχος, handler, με αυτή τη σειρά. */
  invoke(
    name: string,
    rawArgs: Readonly<Record<string, unknown>>,
    ctx: CapabilityContext,
  ): Promise<CapabilityOutcome<unknown>>;
}

/** Το σχήμα εισόδου μιας δυνατότητας (OpenAI `parameters` / MCP `inputSchema`). */
export function capabilityInputSchema(capability: AnyCapability): JsonSchema {
  return paramsToJsonSchema(capability.params);
}

/** Το σχήμα εξόδου — πάντα φάκελος VQE γύρω από το `valueSchema`. */
export function capabilityOutputSchema(capability: AnyCapability): JsonSchema {
  return vqeOutputSchema(capability.valueSchema);
}

/**
 * Χτίζει registry από έναν κατάλογο ορισμών.
 *
 * @throws {Error} σε διπλό όνομα ή σε ορισμό που παραβιάζει τους κανόνες §5.3/§5.4.
 */
export function createCapabilityRegistry(capabilities: readonly AnyCapability[]): CapabilityRegistry {
  const byName = new Map<string, AnyCapability>();

  for (const capability of capabilities) {
    assertValidCapability(capability);
    if (byName.has(capability.name)) {
      throw new Error(`ADR-734 §5.2: duplicate capability name "${capability.name}".`);
    }
    byName.set(capability.name, capability);
  }

  const sorted: readonly AnyCapability[] = [...byName.values()].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );

  return {
    list(filter?: CapabilityFilter): readonly AnyCapability[] {
      if (filter === undefined) return sorted;
      return sorted.filter(
        (c) =>
          (filter.domain === undefined || c.domain === filter.domain) &&
          (filter.access === undefined || c.policy.access === filter.access),
      );
    },

    get(name: string): AnyCapability | undefined {
      return byName.get(name);
    },

    async invoke(name, rawArgs, ctx): Promise<CapabilityOutcome<unknown>> {
      const capability = byName.get(name);
      if (capability === undefined) {
        return fail(capabilityError('NOT_FOUND', `Unknown capability: ${name}`, { capability: name }));
      }

      const denied = evaluatePolicy(capability, ctx);
      if (denied !== null) return fail(denied);

      const parsed = parseArgs(capability.params, rawArgs);
      if (!parsed.ok) return fail(parsed.error);

      try {
        return await capability.handler(parsed.value, ctx);
      } catch (error) {
        // Ο handler δεν επιτρέπεται να διαρρεύσει exception προς τον πράκτορα:
        // stack traces και μηνύματα υποδομής είναι πληροφορία που δεν του ανήκει.
        logger.error('Capability handler threw', {
          capability: name,
          requestId: ctx.requestId,
          error: getErrorMessage(error),
        });
        return fail(capabilityError('INTERNAL', `Capability "${name}" failed.`, { capability: name }));
      }
    },
  };
}

/** Επιβολή πολιτικής. `null` ⇒ επιτρέπεται. Ταυτοποίηση πριν εξουσιοδότηση. */
function evaluatePolicy(capability: AnyCapability, ctx: CapabilityContext): CapabilityError | null {
  if (ctx.companyId.trim().length === 0) {
    return capabilityError('UNAUTHENTICATED', 'Missing tenant identity.');
  }
  if (capability.policy.access === 'write' && !WRITE_CAPABILITIES_ENABLED) {
    return capabilityError('PERMISSION_DENIED', 'Write capabilities are not enabled.', {
      capability: capability.name,
    });
  }
  if (capability.policy.requiresAdmin && !ctx.isAdmin) {
    return capabilityError('PERMISSION_DENIED', `Capability "${capability.name}" requires an administrator.`, {
      capability: capability.name,
    });
  }
  return null;
}

function fail(error: CapabilityError): CapabilityOutcome<never> {
  return { ok: false, error };
}
