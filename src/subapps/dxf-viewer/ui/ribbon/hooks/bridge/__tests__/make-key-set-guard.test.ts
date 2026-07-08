/**
 * ADR-587 Φ3b — Coverage test: shared key-set guard factory + migrated pilots.
 *
 * Αποδεικνύει ότι ο `makeKeySetGuard` factory (SSoT για το predicate boilerplate)
 * είναι **behavior-preserving** vs το πρώην inline `new Set(...).has(...)`:
 *   1. Ο factory ≡ Set membership (true για μέλη, false για ξένα/άδειο).
 *   2. Κάθε migrated pilot guard (annotation-symbol / mep-fixture / wall)
 *      επιστρέφει true ΑΚΡΙΒΩΣ για τα δικά του keys και false για ξένα.
 *   3. Τα named exports (`isXRibbonKey`) διατηρούνται (adapter — ο `useRibbonCommands`
 *      composer τα καλεί ονομαστικά).
 *
 * Σπάει αν migrated guard αποκλίνει από Set membership ή αν χαθεί named export.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-587-entity-type-descriptor-registry-ssot.md
 */

import { makeKeySetGuard } from '../make-key-set-guard';
import {
  ANNOTATION_SYMBOL_RIBBON_KEYS,
  isAnnotationSymbolRibbonKey,
  isAnnotationSymbolRibbonStringKey,
} from '../annotation-symbol-command-keys';
import {
  MEP_FIXTURE_RIBBON_KEYS,
  MEP_FIXTURE_RIBBON_KEYS_ACTIONS,
  MEP_FIXTURE_RIBBON_NUMBER_KEYS,
  MEP_FIXTURE_RIBBON_STRING_KEYS,
  MEP_FIXTURE_RIBBON_VISIBILITY_KEYS,
  isMepFixtureActionKey,
  isMepFixtureRibbonKey,
  isMepFixtureRibbonStringKey,
  isMepFixtureVisibilityKey,
} from '../mep-fixture-command-keys';
import {
  WALL_RIBBON_KEYS,
  WALL_RIBBON_KEYS_ACTIONS,
  WALL_RIBBON_NUMBER_KEYS,
  WALL_RIBBON_STRING_KEYS,
  WALL_RIBBON_TOGGLE_KEYS,
  WALL_RIBBON_TILT_KEYS,
  isWallActionKey,
  isWallRibbonKey,
  isWallRibbonStringKey,
  isWallRibbonToggleKey,
  isWallTiltKey,
} from '../wall-command-keys';

describe('makeKeySetGuard — factory semantics', () => {
  it('returns true exactly for members of the source set', () => {
    const guard = makeKeySetGuard(['a', 'b', 'c']);
    expect(guard('a')).toBe(true);
    expect(guard('b')).toBe(true);
    expect(guard('c')).toBe(true);
  });

  it('returns false for non-members and empty string', () => {
    const guard = makeKeySetGuard(['a', 'b']);
    expect(guard('z')).toBe(false);
    expect(guard('')).toBe(false);
    expect(guard('ab')).toBe(false);
  });

  it('an empty key list guards nothing', () => {
    const guard = makeKeySetGuard([]);
    expect(guard('anything')).toBe(false);
  });

  it('accepts any Iterable source (array / Object.values / Set)', () => {
    const guard = makeKeySetGuard(new Set(['x', 'y']));
    expect(guard('x')).toBe(true);
    expect(guard('y')).toBe(true);
    expect(guard('w')).toBe(false);
  });
});

/**
 * Table-driven behavior equivalence: για κάθε migrated guard, οι δικές του keys → true,
 * μια ξένη key → false. Ο πίνακας «καρφώνει» ότι ο factory παράγει ΑΚΡΙΒΩΣ ό,τι το
 * πρώην inline `new Set(keys).has(k)`.
 */
describe('migrated pilot guards ≡ Set membership (behavior-preserving)', () => {
  const cases: ReadonlyArray<{
    name: string;
    guard: (k: string) => boolean;
    members: readonly string[];
  }> = [
    {
      name: 'annotation-symbol · number',
      guard: isAnnotationSymbolRibbonKey,
      members: [ANNOTATION_SYMBOL_RIBBON_KEYS.params.sizeMm, ANNOTATION_SYMBOL_RIBBON_KEYS.params.rotation],
    },
    {
      name: 'annotation-symbol · string',
      guard: isAnnotationSymbolRibbonStringKey,
      members: [ANNOTATION_SYMBOL_RIBBON_KEYS.stringParams.symbolId],
    },
    {
      name: 'mep-fixture · number',
      guard: isMepFixtureRibbonKey,
      members: MEP_FIXTURE_RIBBON_NUMBER_KEYS,
    },
    {
      name: 'mep-fixture · string',
      guard: isMepFixtureRibbonStringKey,
      members: MEP_FIXTURE_RIBBON_STRING_KEYS,
    },
    {
      name: 'mep-fixture · action',
      guard: isMepFixtureActionKey,
      members: Object.values(MEP_FIXTURE_RIBBON_KEYS_ACTIONS),
    },
    {
      name: 'mep-fixture · visibility',
      guard: isMepFixtureVisibilityKey,
      members: [
        MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.rectangularParams,
        MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.hasCircuit,
      ],
    },
    {
      name: 'wall · number',
      guard: isWallRibbonKey,
      members: WALL_RIBBON_NUMBER_KEYS,
    },
    {
      name: 'wall · string',
      guard: isWallRibbonStringKey,
      members: WALL_RIBBON_STRING_KEYS,
    },
    {
      name: 'wall · toggle',
      guard: isWallRibbonToggleKey,
      members: WALL_RIBBON_TOGGLE_KEYS,
    },
    {
      name: 'wall · tilt',
      guard: isWallTiltKey,
      members: WALL_RIBBON_TILT_KEYS,
    },
    {
      name: 'wall · action',
      guard: isWallActionKey,
      members: Object.values(WALL_RIBBON_KEYS_ACTIONS),
    },
  ];

  it.each(cases)('$name — every registered key is guarded true', ({ guard, members }) => {
    expect(members.length).toBeGreaterThan(0);
    for (const key of members) {
      expect(guard(key)).toBe(true);
    }
  });

  it.each(cases)('$name — foreign keys guarded false', ({ guard, members }) => {
    expect(guard('')).toBe(false);
    expect(guard('__not_a_real_command_key__')).toBe(false);
    // A key from a different registry must not leak through.
    const foreign = WALL_RIBBON_KEYS.params.height + '.__foreign__';
    if (!members.includes(foreign)) {
      expect(guard(foreign)).toBe(false);
    }
  });
});
