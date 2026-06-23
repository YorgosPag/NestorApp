/**
 * ADR-507 — tests για το hatch select-mode flag («Επιλογή γραμμοσκίασης», one-shot).
 */

import {
  isHatchSelectArmed,
  armHatchSelect,
  disarmHatchSelect,
} from '../hatch-select-mode-store';
import { toolHintOverrideStore } from '../../../hooks/toolHintOverrideStore';

describe('hatch-select-mode-store', () => {
  beforeEach(() => {
    disarmHatchSelect();
    toolHintOverrideStore.setOverride(null);
  });

  it('defaults to disarmed', () => {
    expect(isHatchSelectArmed()).toBe(false);
  });

  it('arms and disarms', () => {
    armHatchSelect();
    expect(isHatchSelectArmed()).toBe(true);
    disarmHatchSelect();
    expect(isHatchSelectArmed()).toBe(false);
  });

  it('disarm is idempotent (no-op when already off)', () => {
    expect(isHatchSelectArmed()).toBe(false);
    disarmHatchSelect();
    expect(isHatchSelectArmed()).toBe(false);
  });

  it('clears the status-hint override on disarm (any path)', () => {
    armHatchSelect();
    toolHintOverrideStore.setOverride('Κάνε κλικ σε γραμμοσκίαση για επιλογή');
    expect(toolHintOverrideStore.getSnapshot()).not.toBeNull();
    disarmHatchSelect();
    expect(toolHintOverrideStore.getSnapshot()).toBeNull();
  });
});
