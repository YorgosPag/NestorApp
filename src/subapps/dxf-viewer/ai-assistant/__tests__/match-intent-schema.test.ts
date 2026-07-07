/**
 * ADR-581 §12 — AI intent contract tests.
 *
 * Locks the INVARIANT (ADR-185): the LLM emits only role-identifier strings +
 * booleans, NEVER numbers; hallucinated roles (outside the offered set) are
 * dropped before they can reach the deterministic applier.
 */

import {
  MATCH_INTENT_TOOL,
  matchIntentSchema,
  validateMatchIntent,
  computeSelectedRolesFromIntent,
  type MatchIntent,
} from '../match-tool-definitions';

const OFFERED = ['style.color', 'style.linetype', 'geometry.width', 'geometry.height'];

function intent(partial: Partial<MatchIntent>): MatchIntent {
  return {
    sourceRef: null,
    targetRefs: [],
    preserveRoles: [],
    transferRoles: [],
    ...partial,
  };
}

describe('MATCH_INTENT_TOOL definition', () => {
  it('is a strict single-purpose function tool', () => {
    expect(MATCH_INTENT_TOOL.type).toBe('function');
    expect(MATCH_INTENT_TOOL.function.name).toBe('plan_match_properties');
    expect(MATCH_INTENT_TOOL.function.strict).toBe(true);
    const params = MATCH_INTENT_TOOL.function.parameters as {
      required: string[];
      additionalProperties: boolean;
    };
    expect(params.additionalProperties).toBe(false);
    expect(params.required).toEqual(['sourceRef', 'targetRefs', 'preserveRoles', 'transferRoles']);
  });
});

describe('matchIntentSchema', () => {
  it('accepts a well-formed intent', () => {
    const res = matchIntentSchema.safeParse(
      intent({ transferRoles: ['style.color'], preserveRoles: ['geometry.height'] }),
    );
    expect(res.success).toBe(true);
  });

  it('rejects numeric role elements (never numbers invariant)', () => {
    const res = matchIntentSchema.safeParse({
      sourceRef: null,
      targetRefs: [],
      preserveRoles: [],
      transferRoles: [42, 100], // numbers → must fail
    });
    expect(res.success).toBe(false);
  });

  it('rejects unknown top-level keys (strict)', () => {
    const res = matchIntentSchema.safeParse({
      sourceRef: null,
      targetRefs: [],
      preserveRoles: [],
      transferRoles: [],
      widthMm: 300, // hallucinated numeric field → must fail
    });
    expect(res.success).toBe(false);
  });

  it('rejects a missing required key', () => {
    const res = matchIntentSchema.safeParse({
      sourceRef: null,
      targetRefs: [],
      preserveRoles: [],
      // transferRoles missing
    });
    expect(res.success).toBe(false);
  });
});

describe('validateMatchIntent — hallucination guard', () => {
  it('drops roles that are not in the offered set', () => {
    const raw = intent({
      transferRoles: ['style.color', 'geometry.rebarDiameter' /* hallucinated */],
      preserveRoles: ['material.primary' /* hallucinated */],
    });
    const validated = validateMatchIntent(raw, OFFERED);
    expect(validated).not.toBeNull();
    expect(validated!.intent.transferRoles).toEqual(['style.color']);
    expect(validated!.intent.preserveRoles).toEqual([]);
    expect(validated!.rejectedRoles).toEqual(
      expect.arrayContaining(['geometry.rebarDiameter', 'material.primary']),
    );
  });

  it('returns null for a structurally invalid payload', () => {
    expect(validateMatchIntent({ nope: true }, OFFERED)).toBeNull();
    expect(validateMatchIntent(null, OFFERED)).toBeNull();
  });

  it('keeps every offered role when all are legitimate', () => {
    const validated = validateMatchIntent(intent({ transferRoles: OFFERED }), OFFERED);
    expect(validated!.intent.transferRoles).toEqual(OFFERED);
    expect(validated!.rejectedRoles).toEqual([]);
  });
});

describe('computeSelectedRolesFromIntent', () => {
  it('empty transferRoles = all offered', () => {
    const set = computeSelectedRolesFromIntent(OFFERED, intent({}));
    expect([...set].sort()).toEqual([...OFFERED].sort());
  });

  it('subtracts preserved roles from the base set', () => {
    const set = computeSelectedRolesFromIntent(
      OFFERED,
      intent({ preserveRoles: ['geometry.height'] }),
    );
    expect(set.has('geometry.height' as never)).toBe(false);
    expect(set.has('geometry.width' as never)).toBe(true);
  });

  it('explicit transferRoles restrict the base set (intersected with offered)', () => {
    const set = computeSelectedRolesFromIntent(
      OFFERED,
      intent({ transferRoles: ['style.color', 'geometry.width', 'not.offered'] }),
    );
    expect([...set].sort()).toEqual(['geometry.width', 'style.color']);
  });

  it('preserve wins over transfer when a role is in both', () => {
    const set = computeSelectedRolesFromIntent(
      OFFERED,
      intent({ transferRoles: ['style.color'], preserveRoles: ['style.color'] }),
    );
    expect(set.size).toBe(0);
  });
});
