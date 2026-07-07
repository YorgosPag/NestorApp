/// <reference types="jest" />
/**
 * @file grip-warm-color-migration.test.ts
 * @description Regression guard for migration v8 → v9 — heals the stale orange
 * grip warm (hover) default (#FF7F00) to the re-valued GRIP_WARM_COLOR SSoT
 * (magenta/ροζ), WITHOUT touching user-customised warm colours (ADR-559 §3b / ADR-445).
 */

import { migration_v8_to_v9 } from '../grip-cold-color-migrations';
import { GRIP_WARM_COLOR } from '../../../config/color-config';

const LEGACY_ORANGE = '#FF7F00';

type GripScope = { colors?: { cold?: string | null; warm?: string } };
interface State {
  __standards_version: number;
  grip?: {
    general?: GripScope;
    specific?: Record<string, GripScope>;
    overrides?: Record<string, GripScope>;
  };
}

const migrate = (s: State) => migration_v8_to_v9.migrate(s) as State;

describe('migration v8 → v9 (grip warm colour heal)', () => {
  it('targets version 9', () => {
    expect(migration_v8_to_v9.version).toBe(9);
  });

  it('the SSoT warm colour is now magenta/ροζ', () => {
    expect(GRIP_WARM_COLOR).toBe('#ff00ff');
  });

  it('heals stale orange (#FF7F00) → GRIP_WARM_COLOR in grip.general', () => {
    const out = migrate({ __standards_version: 8, grip: { general: { colors: { warm: LEGACY_ORANGE } } } });
    expect(out.grip?.general?.colors?.warm).toBe(GRIP_WARM_COLOR);
    expect(out.__standards_version).toBe(9);
  });

  it('heals stale orange across specific + overrides scopes', () => {
    const out = migrate({
      __standards_version: 8,
      grip: {
        specific: { normal: { colors: { warm: LEGACY_ORANGE } } },
        overrides: { someMode: { colors: { warm: LEGACY_ORANGE } } },
      },
    });
    expect(out.grip?.specific?.normal?.colors?.warm).toBe(GRIP_WARM_COLOR);
    expect(out.grip?.overrides?.someMode?.colors?.warm).toBe(GRIP_WARM_COLOR);
  });

  it('does NOT touch user-customised warm colours', () => {
    const custom = '#123456';
    const out = migrate({ __standards_version: 8, grip: { general: { colors: { warm: custom } } } });
    expect(out.grip?.general?.colors?.warm).toBe(custom);
  });

  it('is idempotent (already at the SSoT warm colour stays)', () => {
    const out = migrate({ __standards_version: 8, grip: { general: { colors: { warm: GRIP_WARM_COLOR } } } });
    expect(out.grip?.general?.colors?.warm).toBe(GRIP_WARM_COLOR);
  });

  it('is a no-op (besides version bump) when grip is absent', () => {
    const out = migrate({ __standards_version: 8 });
    expect(out.__standards_version).toBe(9);
    expect(out.grip).toBeUndefined();
  });

  it('does not mutate the input (pure / deep-cloned)', () => {
    const input: State = { __standards_version: 8, grip: { general: { colors: { warm: LEGACY_ORANGE } } } };
    migrate(input);
    expect(input.grip?.general?.colors?.warm).toBe(LEGACY_ORANGE);
    expect(input.__standards_version).toBe(8);
  });
});
