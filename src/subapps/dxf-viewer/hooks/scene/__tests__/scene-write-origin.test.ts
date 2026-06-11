import {
  originSchedulesAutoSave,
  DEFAULT_SCENE_WRITE_ORIGIN,
  type SceneWriteOrigin,
} from '../scene-write-origin';

describe('scene-write-origin (ADR-040 auto-save gating SSoT)', () => {
  describe('originSchedulesAutoSave — truth table', () => {
    it('local-edit → true (user edits MUST auto-save)', () => {
      expect(originSchedulesAutoSave('local-edit')).toBe(true);
    });

    it.each<SceneWriteOrigin>(['remote-echo', 'load', 'system-reconcile'])(
      '%s → false (non-local writes MUST NOT auto-save)',
      (origin) => {
        expect(originSchedulesAutoSave(origin)).toBe(false);
      },
    );
  });

  describe('DEFAULT_SCENE_WRITE_ORIGIN', () => {
    it('is local-edit (backward-compatible opt-OUT migration)', () => {
      expect(DEFAULT_SCENE_WRITE_ORIGIN).toBe('local-edit');
    });

    it('the default DOES schedule auto-save (existing user-edit call sites unaffected)', () => {
      expect(originSchedulesAutoSave(DEFAULT_SCENE_WRITE_ORIGIN)).toBe(true);
    });
  });
});
