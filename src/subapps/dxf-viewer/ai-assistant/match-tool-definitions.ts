/**
 * @module ai-assistant/match-tool-definitions
 * @description ADR-581 §12 — AI intent contract for «Αντιγραφή Ιδιοτήτων».
 *
 * Isomorphic (client + server): the OpenAI function-tool definition, the zod
 * schema that validates its output, and the pure helpers that reject hallucinated
 * roles + compute the deterministic checklist from the intent.
 *
 * INVARIANT (ADR-185): the LLM decides ONLY *which* roles to transfer vs preserve
 * — role identifier strings, never numbers. All values are computed by the
 * deterministic core (`applyMatchTransfer`). Roles not present in the `offeredRoles`
 * set (hallucinations) are dropped here, before they can reach the applier.
 *
 * @see ADR-581 §12 · ADR-185
 */

import { z } from 'zod';
import type { AgenticToolDefinition } from '@/services/ai-pipeline/tools/agentic-tool-definitions';
// Leaf imports (pure, zero browser deps) — this module is loaded by the server
// route, so we deliberately avoid the barrel (which re-exports persisted stores).
import { asRole } from '../systems/match-properties/semantic-roles';
import type { SemanticRole } from '../systems/match-properties/match-types';

// ============================================================================
// OPENAI TOOL DEFINITION (Chat Completions API format)
// ============================================================================

/** The single intent-planning tool the LLM is forced to call. */
export const MATCH_INTENT_TOOL: AgenticToolDefinition = {
  type: 'function',
  function: {
    name: 'plan_match_properties',
    description:
      'Decide WHICH properties to copy from the source object onto the targets. ' +
      'You receive a list of offered role identifiers (e.g. "style.color", "geometry.width"). ' +
      'Return only role identifiers taken verbatim from that offered list — never invent roles, ' +
      'never output numbers. The deterministic engine computes every actual value; your job is ' +
      'purely the WHICH. Put roles the user wants copied in transferRoles (empty = copy all offered), ' +
      'and roles the user wants left untouched on the targets in preserveRoles.',
    parameters: {
      type: 'object',
      properties: {
        sourceRef: {
          type: ['string', 'null'],
          description:
            'Optional free-text reference to the source object as named by the user ' +
            '(e.g. "that column"). Informational only — the frozen dialog selection is authoritative.',
        },
        targetRefs: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional free-text references to targets as named by the user. ' +
            'Informational only — the frozen dialog selection is authoritative.',
        },
        preserveRoles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Offered role identifiers to KEEP on the targets (do not overwrite).',
        },
        transferRoles: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Offered role identifiers to copy onto the targets. ' +
            'Leave empty to copy every offered role except the preserved ones.',
        },
      },
      required: ['sourceRef', 'targetRefs', 'preserveRoles', 'transferRoles'],
      additionalProperties: false,
    },
    strict: true,
  },
};

// ============================================================================
// ZOD INTENT SCHEMA — validates the parsed tool arguments
// ============================================================================

/**
 * Mirrors {@link MATCH_INTENT_TOOL}. `z.array(z.string())` rejects any numeric
 * element (enforces the "never numbers" invariant); `.strict()` rejects unknown
 * keys. Structural validation only — role membership is checked separately.
 */
export const matchIntentSchema = z
  .object({
    sourceRef: z.string().nullable(),
    targetRefs: z.array(z.string()),
    preserveRoles: z.array(z.string()),
    transferRoles: z.array(z.string()),
  })
  .strict();

export type MatchIntent = z.infer<typeof matchIntentSchema>;

export interface ValidatedMatchIntent {
  readonly intent: MatchIntent;
  /** Role strings the model returned that are NOT in the offered set → dropped. */
  readonly rejectedRoles: readonly string[];
}

/**
 * Parse + sanitise a raw tool-argument object: zod-validate the shape, then drop
 * any role not present in `offeredRoles` (hallucination guard). Returns `null`
 * when the shape itself is invalid.
 */
export function validateMatchIntent(
  raw: unknown,
  offeredRoles: readonly string[],
): ValidatedMatchIntent | null {
  const parsed = matchIntentSchema.safeParse(raw);
  if (!parsed.success) return null;

  const offered = new Set(offeredRoles);
  const rejectedRoles: string[] = [];
  const keepOffered = (roles: readonly string[]): string[] =>
    roles.filter((r) => {
      if (offered.has(r)) return true;
      rejectedRoles.push(r);
      return false;
    });

  return {
    intent: {
      sourceRef: parsed.data.sourceRef,
      targetRefs: parsed.data.targetRefs,
      preserveRoles: keepOffered(parsed.data.preserveRoles),
      transferRoles: keepOffered(parsed.data.transferRoles),
    },
    rejectedRoles,
  };
}

/**
 * Turn a validated intent into the deterministic checklist set:
 *   base = transferRoles (if any) else all offered  →  minus preserveRoles.
 * Always intersected with `offeredRoles` so nothing outside the offer survives.
 */
export function computeSelectedRolesFromIntent(
  offeredRoles: readonly string[],
  intent: MatchIntent,
): Set<SemanticRole> {
  const offered = new Set(offeredRoles);
  const base = intent.transferRoles.length > 0
    ? intent.transferRoles.filter((r) => offered.has(r))
    : [...offeredRoles];
  const preserve = new Set(intent.preserveRoles);
  const selected = new Set<SemanticRole>();
  for (const r of base) {
    if (!preserve.has(r)) selected.add(asRole(r));
  }
  return selected;
}

// ============================================================================
// SHARED REQUEST / RESPONSE CONTRACT (POST /api/dxf-ai/match)
// ============================================================================

export interface MatchAiRequest {
  /** Natural-language instruction (e.g. "copy everything but keep the length"). */
  readonly message: string;
  /** Role identifiers the deterministic engine currently offers for this pair. */
  readonly offeredRoles: readonly string[];
  /** Source entity type (context for the prompt). */
  readonly sourceType: string | null;
  /** Distinct target entity types (context for the prompt). */
  readonly targetTypes: readonly string[];
}

export interface MatchAiResponse {
  readonly intent: MatchIntent;
  readonly rejectedRoles: readonly string[];
  readonly processingTimeMs: number;
}
