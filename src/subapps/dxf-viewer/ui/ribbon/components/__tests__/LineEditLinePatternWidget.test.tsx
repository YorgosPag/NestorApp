/**
 * ADR-642 — LineEditLinePatternWidget wiring test.
 *
 * The widget is contextual to the CURRENT linetype value (read from `RibbonFieldStore`):
 *   - user-created → «Επεξεργασία» (edit in place, editName, no assign);
 *   - ISO/built-in → «Διπλότυπο» (duplicateFrom + onCreated re-dispatches the `linetype` key);
 *   - no resolvable def → renders nothing.
 *
 * NOTE: do NOT import `jest` from '@jest/globals' — that breaks `jest.mock` hoisting (the mocks would
 * apply after the module imports). Use the injected globals (see LineNewLinePatternWidget.test.tsx).
 */

import { render } from '@testing-library/react';
import { LineEditLinePatternWidget } from '../LineEditLinePatternWidget';
import { LINE_TOOL_RIBBON_KEYS } from '../../hooks/bridge/line-tool-command-keys';

// Capture the props the widget hands to the shared launcher.
let captured: { labelKey?: string; editName?: string; duplicateFrom?: string; onCreated?: (n: string) => void };
jest.mock('../LinePatternLauncherButton', () => ({
  LinePatternLauncherButton: (props: typeof captured) => {
    captured = props;
    return null;
  },
}));

const mockOnComboboxChange = jest.fn();
jest.mock('../../context/RibbonCommandContext', () => ({
  useRibbonDispatch: () => ({ onComboboxChange: mockOnComboboxChange }),
}));

let mockLinetypeValue: string | null = 'X';
jest.mock('../../context/useRibbonFieldSelectors', () => ({
  useRibbonComboboxState: () => ({ value: mockLinetypeValue, options: [] }),
}));

const mockResolve = jest.fn();
jest.mock('../../../../rendering/linetype-dash-resolver', () => ({
  resolveLinetypeDef: (name: string | null) => mockResolve(name),
}));

beforeEach(() => {
  captured = {};
  mockOnComboboxChange.mockClear();
  mockResolve.mockReset();
  mockLinetypeValue = 'X';
});

describe('LineEditLinePatternWidget', () => {
  it('offers «Επεξεργασία» (edit in place) for a user-created type', () => {
    mockResolve.mockReturnValue({ name: 'GAS', origin: 'user-created' });
    render(<LineEditLinePatternWidget />);
    expect(captured.labelKey).toBe('ribbon.commands.lineEditLineType');
    expect(captured.editName).toBe('GAS');
    expect(captured.duplicateFrom).toBeUndefined();
  });

  it('offers «Διπλότυπο» for a read-only ISO type and re-dispatches the linetype key on create', () => {
    mockResolve.mockReturnValue({ name: 'Dashed', origin: 'iso' });
    render(<LineEditLinePatternWidget />);
    expect(captured.labelKey).toBe('ribbon.commands.lineDuplicateLineType');
    expect(captured.duplicateFrom).toBe('Dashed');
    expect(captured.editName).toBeUndefined();
    captured.onCreated?.('Dashed 2');
    expect(mockOnComboboxChange).toHaveBeenCalledWith(LINE_TOOL_RIBBON_KEYS.linetype, 'Dashed 2');
  });

  it('renders nothing when the current type has no resolvable def (solid / ByLayer)', () => {
    mockResolve.mockReturnValue(null);
    const { container } = render(<LineEditLinePatternWidget />);
    expect(container).toBeEmptyDOMElement();
    expect(captured.labelKey).toBeUndefined();
  });
});
