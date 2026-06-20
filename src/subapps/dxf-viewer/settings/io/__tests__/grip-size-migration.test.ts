/// <reference types="jest" />
/**
 * @file grip-size-migration.test.ts
 * @description Regression guard for migration v7 → v8 — heals the stale
 * pre-ADR-107 grip base size default (14) to the SSoT GRIP_SIZE_DEFAULT (7),
 * without disturbing the intentional mode-variant sizes.
 */

import { migration_v7_to_v8 } from '../grip-cold-color-migrations';
import { GRIP_SIZE_DEFAULT } from '../../../config/grip-size-default';

const LEGACY = 14;

type GripScope = { gripSize?: number; size?: number };
interface State {
  __standards_version: number;
  grip?: {
    general?: GripScope;
    specific?: Record<string, GripScope>;
    overrides?: Record<string, GripScope>;
  };
}

const migrate = (s: State) => migration_v7_to_v8.migrate(s) as State;

describe('migration v7 → v8 (grip size heal)', () => {
  it('targets version 8', () => {
    expect(migration_v7_to_v8.version).toBe(8);
  });

  it('resets the stale legacy default (14) → GRIP_SIZE_DEFAULT in grip.general', () => {
    const out = migrate({ __standards_version: 7, grip: { general: { gripSize: LEGACY, size: LEGACY } } });
    expect(out.grip?.general?.gripSize).toBe(GRIP_SIZE_DEFAULT);
    expect(out.grip?.general?.size).toBe(GRIP_SIZE_DEFAULT);
    expect(out.__standards_version).toBe(8);
  });

  it('heals stale 14 across specific + overrides scopes', () => {
    const out = migrate({
      __standards_version: 7,
      grip: {
        specific: { normal: { gripSize: LEGACY } },
        overrides: { someMode: { size: LEGACY } },
      },
    });
    expect(out.grip?.specific?.normal?.gripSize).toBe(GRIP_SIZE_DEFAULT);
    expect(out.grip?.overrides?.someMode?.size).toBe(GRIP_SIZE_DEFAULT);
  });

  it('does NOT touch intentional mode-variant sizes (draft 8, hover/selection 12) or already-7', () => {
    const out = migrate({
      __standards_version: 7,
      grip: {
        general: { gripSize: GRIP_SIZE_DEFAULT },
        specific: {
          draft: { gripSize: 8 },
          hover: { gripSize: 12 },
          selection: { gripSize: 12 },
        },
      },
    });
    expect(out.grip?.general?.gripSize).toBe(GRIP_SIZE_DEFAULT);
    expect(out.grip?.specific?.draft?.gripSize).toBe(8);
    expect(out.grip?.specific?.hover?.gripSize).toBe(12);
    expect(out.grip?.specific?.selection?.gripSize).toBe(12);
  });

  it('is a no-op (besides version bump) when grip is absent', () => {
    const out = migrate({ __standards_version: 7 });
    expect(out.__standards_version).toBe(8);
    expect(out.grip).toBeUndefined();
  });

  it('does not mutate the input (pure / deep-cloned)', () => {
    const input: State = { __standards_version: 7, grip: { general: { gripSize: LEGACY } } };
    migrate(input);
    expect(input.grip?.general?.gripSize).toBe(LEGACY);
    expect(input.__standards_version).toBe(7);
  });
});
