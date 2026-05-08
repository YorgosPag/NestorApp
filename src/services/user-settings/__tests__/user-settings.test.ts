/**
 * UserSettings — pure-function unit tests.
 *
 * Covers schema, migrations, ID helpers, and the pure `applySliceToDoc`
 * helper used by the repository. The repository itself is exercised through
 * integration tests (requires Firestore mocking) — out of scope here.
 *
 * @module services/user-settings/__tests__/user-settings.test
 */

import {
  USER_SETTINGS_SCHEMA_VERSION,
  userSettingsSchema,
} from '../user-settings-schema';
import {
  buildEmptyUserSettings,
  migrateUserSettings,
} from '../user-settings-migrations';
import { buildUserPreferencesDocId } from '../user-settings-id';
import { applySliceToDoc } from '../user-settings-paths';

describe('user-settings-id', () => {
  it('builds deterministic composite id', () => {
    expect(buildUserPreferencesDocId('user_abc', 'company_xyz')).toBe(
      'user_abc_company_xyz',
    );
  });

  it('throws on missing userId', () => {
    expect(() => buildUserPreferencesDocId('', 'company_xyz')).toThrow();
  });

  it('throws on missing companyId', () => {
    expect(() => buildUserPreferencesDocId('user_abc', '')).toThrow();
  });
});

describe('buildEmptyUserSettings', () => {
  it('produces a schema-valid skeleton at the current version', () => {
    const doc = buildEmptyUserSettings('u1', 'c1');
    expect(doc.userId).toBe('u1');
    expect(doc.companyId).toBe('c1');
    expect(doc.schemaVersion).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(userSettingsSchema.safeParse(doc).success).toBe(true);
  });
});

describe('migrateUserSettings', () => {
  it('stamps schemaVersion on legacy v0 documents', () => {
    const raw = { userId: 'u1', companyId: 'c1' };
    const result = migrateUserSettings(raw);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect((result.data as { schemaVersion: number }).schemaVersion).toBe(1);
  });

  it('is a no-op when already at current version', () => {
    const raw = {
      userId: 'u1',
      companyId: 'c1',
      schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
    };
    const result = migrateUserSettings(raw);
    expect(result.migrated).toBe(false);
  });

  it('does not strip newer-version data (forward-incompatible safe)', () => {
    const raw = {
      userId: 'u1',
      companyId: 'c1',
      schemaVersion: 999,
      futureField: 'keep me',
    };
    const result = migrateUserSettings(raw);
    expect(result.migrated).toBe(false);
    expect((result.data as { futureField: string }).futureField).toBe('keep me');
  });
});

describe('userSettingsSchema', () => {
  it('rejects missing userId', () => {
    expect(
      userSettingsSchema.safeParse({
        companyId: 'c1',
        schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
      }).success,
    ).toBe(false);
  });

  it('rejects wrong schemaVersion literal', () => {
    expect(
      userSettingsSchema.safeParse({
        userId: 'u1',
        companyId: 'c1',
        schemaVersion: 999,
      }).success,
    ).toBe(false);
  });

  it('accepts an optional dxfViewer.cursor slice', () => {
    const doc = {
      userId: 'u1',
      companyId: 'c1',
      schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
      dxfViewer: {
        cursor: {
          crosshair: {
            enabled: true,
            size_percent: 25,
            color: '#ffffff',
            line_width: 1,
            line_style: 'solid' as const,
            opacity: 0.9,
            use_cursor_gap: false,
            center_gap_px: 3,
            lock_to_dpr: true,
            ui_scale: 1,
          },
          cursor: {
            enabled: true,
            shape: 'circle' as const,
            size: 10,
            color: '#22c55e',
            line_style: 'solid' as const,
            line_width: 1,
            opacity: 0.9,
          },
          selection: {
            window: {
              fillColor: '#4444ff',
              fillOpacity: 0.2,
              borderColor: '#4444ff',
              borderOpacity: 1,
              borderStyle: 'solid' as const,
              borderWidth: 2,
            },
            crossing: {
              fillColor: '#22c55e',
              fillOpacity: 0.2,
              borderColor: '#22c55e',
              borderOpacity: 1,
              borderStyle: 'dashed' as const,
              borderWidth: 2,
            },
          },
          behavior: {
            snap_indicator: true,
            coordinate_display: true,
            dynamic_input: true,
            cursor_tooltip: true,
          },
          performance: { use_raf: true, throttle_ms: 16, precision_mode: true },
        },
      },
    };
    expect(userSettingsSchema.safeParse(doc).success).toBe(true);
  });
});

describe('applySliceToDoc', () => {
  const baseDoc = buildEmptyUserSettings('u1', 'c1');

  it('inserts a new dxfViewer slice immutably', () => {
    const next = applySliceToDoc(baseDoc, 'dxfViewer.snap', {
      activeTypes: ['endpoint', 'midpoint'],
    });
    expect(next).not.toBe(baseDoc);
    expect(next.dxfViewer?.snap).toEqual({
      activeTypes: ['endpoint', 'midpoint'],
    });
    expect(baseDoc.dxfViewer).toBeUndefined();
  });

  it('overwrites an existing slice without mutating others', () => {
    const withSnap = applySliceToDoc(baseDoc, 'dxfViewer.snap', {
      activeTypes: ['endpoint'],
    });
    const withRulers = applySliceToDoc(withSnap, 'dxfViewer.rulersGrid', {
      isVisible: true,
    });
    expect(withRulers.dxfViewer?.snap).toEqual({ activeTypes: ['endpoint'] });
    expect(withRulers.dxfViewer?.rulersGrid).toEqual({ isVisible: true });
  });

  it('throws on unsupported path', () => {
    // @ts-expect-error testing runtime guard
    expect(() => applySliceToDoc(baseDoc, 'wrong.path', {})).toThrow();
  });
});
