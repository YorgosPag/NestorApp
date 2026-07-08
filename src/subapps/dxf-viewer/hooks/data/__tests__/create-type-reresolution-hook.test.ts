/**
 * ADR-604 Φ1 — shape smoke for `createTypeReresolutionHook`.
 *
 * The factory returns a React hook (calls `useEffect`), so behaviour is covered by
 * the integration path; here we just guard the contract that binding a pure
 * `reresolveScene` SSoT yields a distinct callable hook per binding (no shared
 * closure leakage between entities).
 */

import { createTypeReresolutionHook, type ReresolveSceneFn } from '../create-type-reresolution-hook';

describe('createTypeReresolutionHook (ADR-604 Φ1)', () => {
  const identity: ReresolveSceneFn = (scene) => scene;

  it('returns a callable hook function', () => {
    const hook = createTypeReresolutionHook(identity);
    expect(typeof hook).toBe('function');
  });

  it('produces a distinct hook per binding', () => {
    const a = createTypeReresolutionHook(identity);
    const b = createTypeReresolutionHook((scene) => scene);
    expect(a).not.toBe(b);
  });
});
