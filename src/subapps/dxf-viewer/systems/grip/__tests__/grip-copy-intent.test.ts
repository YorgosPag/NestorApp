/**
 * ADR-561 EXT — `isGripCopyIntent` SSoT tests. The ONE predicate for «is the grip gesture a
 * COPY?»: true when the «Copy» toggle is on OR Control/⌘ is held live (either alone suffices).
 */
import { isGripCopyIntent } from '../grip-copy-intent';
import { GripCopyModeStore } from '../GripCopyModeStore';
import { CtrlKeyTracker } from '../../../keyboard/CtrlKeyTracker';

describe('isGripCopyIntent (ADR-561 EXT)', () => {
  afterEach(() => {
    GripCopyModeStore.clear();
    CtrlKeyTracker._setForTest(false);
  });

  it('false when neither the toggle nor Ctrl is active', () => {
    expect(isGripCopyIntent()).toBe(false);
  });

  it('true when the «Copy» toggle is on (Ctrl released)', () => {
    GripCopyModeStore.toggle();
    expect(isGripCopyIntent()).toBe(true);
  });

  it('true when Ctrl/⌘ is held (toggle off)', () => {
    CtrlKeyTracker._setForTest(true);
    expect(isGripCopyIntent()).toBe(true);
  });
});
