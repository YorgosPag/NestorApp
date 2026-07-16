/**
 * Unit tests — SelectionModeSettings
 *
 * The panel used to be written out twice, once per mode. Now the mode is a
 * parameter, which introduces exactly one new way to break: a write landing on
 * the wrong branch (`window` editing `crossing`, or vice versa). These tests
 * pin the write target for every control, plus the per-mode heading/i18n
 * prefix — the things the duplicated version got right by construction.
 */

const updateSettings = jest.fn();
let settings: {
  selection: Record<string, Record<string, unknown>>;
};

jest.mock('../../../../../../../systems/cursor', () => ({
  useCursorSettings: () => ({ settings, updateSettings }),
}));

// Translate to the key itself so assertions can prove which prefix was used.
jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The colour dialog and slider are separately-owned SSoT widgets; stub them
// down to a bare control that fires the callback under test.
jest.mock('../../../../../../color/EnterpriseColorDialog', () => ({
  ColorDialogTrigger: ({
    title,
    onChange,
  }: {
    title: string;
    onChange: (c: string) => void;
  }) => (
    <button data-testid={`color:${title}`} onClick={() => onChange('#ff0000')}>
      {title}
    </button>
  ),
}));

jest.mock('../../../../../shared/SliderInput', () => ({
  SliderInput: ({
    value,
    onChange,
  }: {
    value: number;
    onChange: (v: number) => void;
  }) => (
    <button data-testid={`slider:${value}`} onClick={() => onChange(0.75)}>
      slider
    </button>
  ),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { SelectionModeSettings } from '../SelectionModeSettings';

const WINDOW_BOX = {
  fillColor: '#0000ff',
  fillOpacity: 0.2,
  borderColor: '#0000ff',
  borderOpacity: 1,
  borderStyle: 'solid',
  borderWidth: 1,
};

const CROSSING_BOX = {
  fillColor: '#00ff00',
  fillOpacity: 0.3,
  borderColor: '#00ff00',
  borderOpacity: 1,
  borderStyle: 'dashed',
  borderWidth: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  settings = {
    selection: { window: { ...WINDOW_BOX }, crossing: { ...CROSSING_BOX } },
  };
});

describe('SelectionModeSettings — reads its own mode', () => {
  it('uses the window i18n prefix for window', () => {
    render(<SelectionModeSettings mode="window" />);

    expect(screen.getByText('selectionSettings.window.title')).toBeTruthy();
    expect(
      screen.getByText('selectionSettings.window.description'),
    ).toBeTruthy();
  });

  it('uses the crossing i18n prefix for crossing', () => {
    render(<SelectionModeSettings mode="crossing" />);

    expect(screen.getByText('selectionSettings.crossing.title')).toBeTruthy();
    expect(
      screen.getByText('selectionSettings.crossing.description'),
    ).toBeTruthy();
  });

  it('renders each mode its own stored values', () => {
    const { unmount } = render(<SelectionModeSettings mode="window" />);
    // window fillOpacity 0.2 / borderOpacity 1 / borderWidth 1
    expect(screen.getByTestId('slider:0.2')).toBeTruthy();
    unmount();

    render(<SelectionModeSettings mode="crossing" />);
    // crossing fillOpacity 0.3 — proves it did not read the window branch
    expect(screen.getByTestId('slider:0.3')).toBeTruthy();
  });

  it('shows the shared common labels, not a per-mode copy', () => {
    render(<SelectionModeSettings mode="crossing" />);
    expect(screen.getByText('selectionSettings.common.fillOpacity')).toBeTruthy();
    expect(screen.getByText('selectionSettings.common.borderStyle')).toBeTruthy();
  });
});

describe('SelectionModeSettings — writes to its own mode', () => {
  it('patches window and leaves crossing untouched', () => {
    render(<SelectionModeSettings mode="window" />);

    fireEvent.click(screen.getByTestId('color:selectionSettings.window.fillColor'));

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      selection: {
        window: { ...WINDOW_BOX, fillColor: '#ff0000' },
        crossing: CROSSING_BOX,
      },
    });
  });

  it('patches crossing and leaves window untouched', () => {
    render(<SelectionModeSettings mode="crossing" />);

    fireEvent.click(
      screen.getByTestId('color:selectionSettings.crossing.fillColor'),
    );

    expect(updateSettings).toHaveBeenCalledWith({
      selection: {
        window: WINDOW_BOX,
        crossing: { ...CROSSING_BOX, fillColor: '#ff0000' },
      },
    });
  });

  it('patches the border colour, not the fill colour', () => {
    render(<SelectionModeSettings mode="window" />);

    fireEvent.click(
      screen.getByTestId('color:selectionSettings.window.borderColor'),
    );

    expect(updateSettings).toHaveBeenCalledWith({
      selection: {
        window: { ...WINDOW_BOX, borderColor: '#ff0000' },
        crossing: CROSSING_BOX,
      },
    });
  });

  it('sends only the changed field — the rest of the box survives', () => {
    render(<SelectionModeSettings mode="crossing" />);

    // crossing borderWidth slider (value 2)
    fireEvent.click(screen.getByTestId('slider:2'));

    const patched = updateSettings.mock.calls[0][0].selection.crossing;
    expect(patched.borderWidth).toBe(0.75);
    expect(patched.borderStyle).toBe('dashed');
    expect(patched.fillColor).toBe('#00ff00');
  });

  it('writes the border style from the picker', () => {
    render(<SelectionModeSettings mode="window" />);

    fireEvent.click(screen.getByText('selectionSettings.borderStyles.dashDot'));

    expect(updateSettings).toHaveBeenCalledWith({
      selection: {
        window: { ...WINDOW_BOX, borderStyle: 'dash-dot' },
        crossing: CROSSING_BOX,
      },
    });
  });

  it('offers all four border styles', () => {
    render(<SelectionModeSettings mode="window" />);

    for (const key of ['solid', 'dashed', 'dotted', 'dashDot']) {
      expect(screen.getByText(`selectionSettings.borderStyles.${key}`)).toBeTruthy();
    }
  });
});
