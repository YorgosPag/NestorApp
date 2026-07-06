/**
 * ADR-362 §7 — DimStyleEditorStore unit tests (mirror του DimTextOverrideStore).
 *
 * Pure store semantics: initial NONE, request sets styleId + notifies, clear resets,
 * re-request after consume re-notifies (field-compare equals guard).
 */

import {
  getDimStyleEditorRequest,
  subscribeDimStyleEditor,
  requestEditDimStyle,
  clearDimStyleEditorRequest,
  __resetDimStyleEditorStoreForTests,
} from '../DimStyleEditorStore';

afterEach(() => __resetDimStyleEditorStoreForTests());

describe('DimStyleEditorStore', () => {
  it('starts with no pending request (styleId = null)', () => {
    expect(getDimStyleEditorRequest().styleId).toBeNull();
  });

  it('requestEditDimStyle sets the styleId and notifies subscribers', () => {
    const listener = jest.fn();
    const unsub = subscribeDimStyleEditor(listener);
    requestEditDimStyle('style-A');
    expect(getDimStyleEditorRequest().styleId).toBe('style-A');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('clearDimStyleEditorRequest resets to null and notifies', () => {
    requestEditDimStyle('style-A');
    const listener = jest.fn();
    const unsub = subscribeDimStyleEditor(listener);
    clearDimStyleEditorRequest();
    expect(getDimStyleEditorRequest().styleId).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('re-requesting the SAME id after a consume re-notifies (null → id is a change)', () => {
    const listener = jest.fn();
    const unsub = subscribeDimStyleEditor(listener);
    requestEditDimStyle('style-A');
    clearDimStyleEditorRequest();
    requestEditDimStyle('style-A');
    expect(getDimStyleEditorRequest().styleId).toBe('style-A');
    expect(listener).toHaveBeenCalledTimes(3); // set, clear, set
    unsub();
  });

  it('redundant set to the SAME pending id does not notify (equals guard)', () => {
    requestEditDimStyle('style-A');
    const listener = jest.fn();
    const unsub = subscribeDimStyleEditor(listener);
    requestEditDimStyle('style-A');
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});
