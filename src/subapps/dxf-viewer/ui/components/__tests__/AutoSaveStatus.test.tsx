/**
 * ADR-914 §8.19 — η ένδειξη αποθήκευσης του ΣΧΕΔΙΟΥ: μία καθαρή κατάσταση, χωρίς νεκρό κουμπί.
 *
 * Το περιστατικό (παραγωγή, 2026-10-12): καρφωτά αγγλικά («Auto-save», «Saved», «Last saved: Just
 * now») σε ελληνική οθόνη, και κουμπί «Save» με κενό `onClick` — υπόσχεση που δεν εκτελούσε τίποτα.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AutoSaveStatus } from '../AutoSaveStatus';
import type { AutoSaveStatusSnapshot } from '../../../stores/AutoSaveStatusStore';
import elShell from '@/i18n/locales/el/dxf-viewer-shell.json';
import enShell from '@/i18n/locales/en/dxf-viewer-shell.json';

let snapshot: AutoSaveStatusSnapshot;
jest.mock('../../../stores/AutoSaveStatusStore', () => ({
  useAutoSaveStatus: () => snapshot,
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const indicatorSpy = jest.fn();
jest.mock('@/components/shared/AutoSaveStatusIndicator', () => ({
  AutoSaveStatusIndicator: (props: Record<string, unknown>) => {
    indicatorSpy(props);
    return <output data-testid="save-state" />;
  },
}));

const HARDCODED_ENGLISH = /Auto-save|Saving\.\.\.|Saved|Last saved|Just now|Never|\bSave\b|Error/;

beforeEach(() => {
  indicatorSpy.mockReset();
  snapshot = { currentFileName: 'plan.dxf', lastSaveTime: new Date('2026-10-12T10:00:00Z'), saveStatus: 'success' };
});

describe('AutoSaveStatus', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: κανένα κουμπί — το «Save» με το κενό onClick έφυγε', () => {
    render(<AutoSaveStatus />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['idle', 'saving', 'success', 'error'] as const)('κανένα καρφωτό αγγλικό στην κατάσταση «%s»', (saveStatus) => {
    snapshot = { ...snapshot, saveStatus };
    const { container } = render(<AutoSaveStatus />);

    expect(container.textContent).not.toMatch(HARDCODED_ENGLISH);
  });

  it('λέει ΤΙ αποθηκεύεται: τίτλος «σχέδιο» + το όνομα του αρχείου', () => {
    render(<AutoSaveStatus />);

    expect(screen.getByText('autoSave.drawingLabel')).toBeTruthy();
    expect(screen.getByText('plan.dxf')).toBeTruthy();
  });

  it('η κατάσταση αποδίδεται από τον ΕΝΑ δείκτη αποθήκευσης (ADR-248), με το ζωντανό στιγμιότυπο', () => {
    render(<AutoSaveStatus />);

    expect(indicatorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', lastSaved: snapshot.lastSaveTime }),
    );
  });

  it('χωρίς ανοιχτό αρχείο δεν δείχνει τίποτα', () => {
    snapshot = { currentFileName: null, lastSaveTime: null, saveStatus: 'idle' };
    const { container } = render(<AutoSaveStatus />);

    expect(container.firstChild).toBeNull();
  });
});

describe('locales — οι δύο ενδείξεις ξεχωρίζουν με τίτλο, σε el και en', () => {
  it.each([['el', elShell], ['en', enShell]] as const)('%s: «σχέδιο» και «ρυθμίσεις» υπάρχουν και διαφέρουν', (_lang, shell) => {
    const autoSave = shell.autoSave as Record<string, string>;

    expect(autoSave.drawingLabel).toBeTruthy();
    expect(autoSave.settingsLabel).toBeTruthy();
    expect(autoSave.drawingLabel).not.toBe(autoSave.settingsLabel);
  });
});
