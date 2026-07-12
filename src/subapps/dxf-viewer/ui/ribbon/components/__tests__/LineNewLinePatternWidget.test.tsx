/**
 * ADR-510 Φ2E #3 — LineNewLinePatternWidget wiring test.
 *
 * The widget must forward the editor's `onCreated(name)` into the SAME ribbon
 * dispatch the «Τύπος» dropdown uses, keyed by `LINE_TOOL_RIBBON_KEYS.linetype`
 * — that is what makes a newly-created pattern assign to the selected line (or
 * seed draw-defaults) through `useRibbonLineToolBridge`. Zero new assign logic.
 */

import { render } from '@testing-library/react';
import { LineNewLinePatternWidget } from '../LineNewLinePatternWidget';
import { LINE_TOOL_RIBBON_KEYS } from '../../hooks/bridge/line-tool-command-keys';

// Capture the props the widget hands to the shared launcher (button + dialog).
let capturedOnCreated: ((name: string) => void) | undefined;
let capturedLabelKey: string | undefined;
jest.mock('../LinePatternLauncherButton', () => ({
  LinePatternLauncherButton: (props: { labelKey: string; onCreated?: (name: string) => void }) => {
    capturedOnCreated = props.onCreated;
    capturedLabelKey = props.labelKey;
    return null;
  },
}));

// Spy on the stable ribbon dispatch — the widget reads `onComboboxChange` from it.
const mockOnComboboxChange = jest.fn();
jest.mock('../../context/RibbonCommandContext', () => ({
  useRibbonDispatch: () => ({ onComboboxChange: mockOnComboboxChange }),
}));

beforeEach(() => {
  capturedOnCreated = undefined;
  capturedLabelKey = undefined;
  mockOnComboboxChange.mockClear();
});

describe('LineNewLinePatternWidget', () => {
  it('uses the line-specific label key', () => {
    render(<LineNewLinePatternWidget />);
    expect(capturedLabelKey).toBe('ribbon.commands.lineNewLineType');
  });

  it('dispatches the created linetype name through the linetype combobox key', () => {
    render(<LineNewLinePatternWidget />);
    expect(capturedOnCreated).toBeDefined();
    capturedOnCreated?.('MY-DASH');
    expect(mockOnComboboxChange).toHaveBeenCalledWith(
      LINE_TOOL_RIBBON_KEYS.linetype,
      'MY-DASH',
    );
  });
});
