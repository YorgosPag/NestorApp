/**
 * @jest-environment jsdom
 *
 * ADR-642 Edit-in-place — LinePatternEditorDialog edit mode.
 *
 * The dialog, given `editName`, must (1) pre-load the existing user-created def's
 * layers and (2) on Save `upsertUserLinetype` the SAME name WITHOUT flattening a
 * compound / symbol / text type. This is the whole point of in-place editing: every
 * line referencing the named type keeps its rich (multi-element) def.
 *
 * The heavy layer/segment editor is mocked (it is exercised by its own tests); this
 * test drives only the dialog's pre-load → save → registry wiring against the REAL
 * registry, so a regression that drops `complex` on save is caught.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { LinePatternEditorDialog } from '../LinePatternEditorDialog';
import {
  registerUserLinetype,
  resolveLinetype,
  __resetLinetypeRegistryForTesting,
} from '../../../../stores/LinetypeRegistry';
import { segmentsToComplex } from '../../../../config/line-pattern-segments';

// i18n → key pass-through (no provider needed). Both the barrel (dialog uses it) and the
// deep hook path (`@/components/ui/dialog` imports it directly) are stubbed.
jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// The layer/segment editor is out of scope here — render nothing, keep the seeded state.
jest.mock('../LinePatternLayersEditor', () => ({
  LinePatternLayersEditor: () => null,
  buildLinePatternLayersLabels: () => ({}),
}));

beforeEach(() => {
  __resetLinetypeRegistryForTesting();
  localStorage.clear();
});

describe('LinePatternEditorDialog — edit in place', () => {
  it('pre-loads a compound/symbol type and re-saves it WITHOUT flattening', () => {
    const complex = segmentsToComplex(
      'GAS',
      [
        { kind: 'dash', lengthMm: 5 },
        { kind: 'gap', lengthMm: 2 },
        {
          kind: 'symbol',
          glyphId: 'cross',
          role: 'side',
          scale: 1,
          rotationDeg: 0,
          offsetXMm: 0,
          offsetYMm: 0,
        },
      ],
      '▬ ✳',
    );
    registerUserLinetype('GAS', [5, -2], '▬ ✳', complex);

    render(
      <LinePatternEditorDialog open onOpenChange={() => {}} editName="GAS" />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'panels.dimensions.linePatternEditor.save',
      }),
    );

    const saved = resolveLinetype('GAS');
    expect(saved?.complex).toBeDefined();
    expect(saved?.complex?.layers[0].elements.some((el) => el.kind === 'symbol')).toBe(true);
  });

  it('pre-loads a SIMPLE user-created type and re-saves it in place (no complex)', () => {
    registerUserLinetype('MyDash', [5, -2], '▬ ▬');

    render(
      <LinePatternEditorDialog open onOpenChange={() => {}} editName="MyDash" />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'panels.dimensions.linePatternEditor.save',
      }),
    );

    const saved = resolveLinetype('MyDash');
    expect(saved?.pattern).toEqual([5, -2]);
    expect(saved?.complex).toBeUndefined();
  });

  it('duplicates a read-only ISO type into a NEW named user type and assigns it', () => {
    // `Dashed` is a built-in ISO type (read-only); duplicate seeds from it under a suggested free name.
    const onCreated = jest.fn();
    render(
      <LinePatternEditorDialog open onOpenChange={() => {}} duplicateFrom="Dashed" onCreated={onCreated} />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'panels.dimensions.linePatternEditor.save',
      }),
    );

    // A new user-created copy exists (suggested name = «Dashed 2»); the ISO original is untouched.
    const copy = resolveLinetype('Dashed 2');
    expect(copy?.origin).toBe('user-created');
    expect(onCreated).toHaveBeenCalledWith('Dashed 2');
  });
});
