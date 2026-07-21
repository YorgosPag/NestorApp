/**
 * DimStyleList — regression tests.
 *
 * Πρωταρχικός σκοπός (regression): ΚΑΝΕΝΑ <button> δεν επιτρέπεται να είναι
 * απόγονος άλλου <button> — φωλιασμένα buttons = άκυρο HTML → Next.js hydration
 * error. Το bug ήταν: η γραμμή-επιλογής ήταν <button> και τα action buttons
 * (Check/Copy/Pencil/Trash) render μέσα της. Fix: το <li role="option"> έγινε
 * container, με select-button + action buttons ως ΑΔΕΡΦΙΑ.
 *
 * Δευτερεύον: τα action buttons εξακολουθούν να καλούν τον σωστό handler αφού
 * βγήκαν έξω από το select-button.
 *
 * Run: `npx jest DimStyleList.test`
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DimStyle } from '../../../../types/dimension';
import { BUILTIN_DIM_STYLES } from '../../../../systems/dimensions/dim-style-templates';

// ── Mocks (mirror DimensionsTab.test.tsx) ────────────────────────────────────

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    text: { muted: '', primary: '', onSuccess: '', onError: '' },
    bg: { accent: '', hover: '', success: '', neutralSubtle: '', danger: '' },
    border: {},
  }),
}));

// Passthrough tooltip: preserves the real inner <button> so the DOM nesting is
// determined purely by DimStyleList's own structure (asChild → single button).
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

import { DimStyleList } from '../DimStyleList';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const builtIn: DimStyle = BUILTIN_DIM_STYLES[0];
const custom: DimStyle = { ...BUILTIN_DIM_STYLES[0], id: 'dimstyle_custom', name: 'Custom', isBuiltIn: false };

function renderList(overrides: Partial<React.ComponentProps<typeof DimStyleList>> = {}) {
  const handlers = {
    onSelect: jest.fn(),
    onSetActive: jest.fn(),
    onDuplicate: jest.fn(),
    onDelete: jest.fn(),
    onEdit: jest.fn(),
  };
  const utils = render(
    <DimStyleList
      styles={[builtIn, custom]}
      activeStyleId={builtIn.id}
      selectedId={null}
      {...handlers}
      {...overrides}
    />,
  );
  return { ...utils, handlers };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DimStyleList — nested-button hydration regression', () => {
  it('renders NO <button> as a descendant of another <button>', () => {
    const { container } = renderList();
    // Το ίδιο invariant που παραβίαζε το hydration error.
    expect(container.querySelectorAll('button button')).toHaveLength(0);
  });

  it('renders one option per style', () => {
    renderList();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('select-button fires onSelect with the style id', () => {
    const { handlers } = renderList();
    fireEvent.click(screen.getByText(custom.name));
    expect(handlers.onSelect).toHaveBeenCalledWith(custom.id);
  });

  it('duplicate action fires onDuplicate WITHOUT triggering onSelect', () => {
    const { handlers } = renderList();
    fireEvent.click(screen.getAllByLabelText('panels.dimensions.duplicate')[0]);
    expect(handlers.onDuplicate).toHaveBeenCalledWith(builtIn.id);
    expect(handlers.onSelect).not.toHaveBeenCalled();
  });

  it('setAsDefault action renders only for the non-active style and fires onSetActive', () => {
    const { handlers } = renderList();
    // built-in είναι active → μόνο το custom έχει το κουμπί «default».
    const buttons = screen.getAllByLabelText('panels.dimensions.setAsDefault');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(handlers.onSetActive).toHaveBeenCalledWith(custom.id);
  });

  it('edit/delete actions render only for non-built-in styles and fire their handlers', () => {
    const { handlers } = renderList();
    fireEvent.click(screen.getByLabelText('panels.dimensions.edit'));
    fireEvent.click(screen.getByLabelText('panels.dimensions.delete'));
    expect(handlers.onEdit).toHaveBeenCalledWith(custom.id);
    expect(handlers.onDelete).toHaveBeenCalledWith(custom.id);
  });
});
