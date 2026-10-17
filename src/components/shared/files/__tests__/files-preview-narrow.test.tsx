/**
 * **Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΚΑΙ Η ΠΡΟΒΟΛΗ ΣΤΟ ΚΙΝΗΤΟ** (ADR-912 §12.15).
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 (390px)**: δέντρο (επιλεγμένο σε υπολογιστή) **και** προεπισκόπηση
 *   δίπλα-δίπλα — λίστα ~140px με «Ε.», PDF ~175px. Drive / Dropbox: στο κινητό ο θεατής είναι πλήρους οθόνης και το
 *   δέντρο δεν προσφέρεται.
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ αποδεικνύεται **πού** αποδίδεται ο θεατής και **πόσοι** είναι, όχι πώς φαίνεται.
 */

/* global describe, it, expect, jest */

import { render, renderHook, screen } from '@testing-library/react';

import { mockViewport } from '@/test-utils/viewport';
import type { FileRecord } from '@/types/file-record';
import { FilesPreviewSplit } from '../FilesPreviewSplit';
import { useShownViewMode } from '../FilesViewModeControl';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useFileDisplayName', () => ({
  useFileDisplayName: () => (file: FileRecord) => file.displayName,
}));
jest.mock('@/components/file-manager/FilePreviewPanel', () => ({
  FilePreviewPanel: ({ titledByHost }: { titledByHost?: boolean }) => (
    <section data-testid="viewer" data-titled-by-host={String(titledByHost)} />
  ),
}));

const noop = () => undefined;

const FILE = { id: 'file_1', displayName: 'Συμβόλαιο.pdf' } as unknown as FileRecord;

function renderSplit(selectedFile: FileRecord | null) {
  return render(
    <FilesPreviewSplit list={<ul data-testid="list" />} selectedFile={selectedFile} onClose={noop} />,
  );
}

describe('FilesPreviewSplit — ένας θεατής, στη θέση που χωρά', () => {
  it('στενό: ο θεατής ανοίγει σε φύλλο πλήρους οθόνης, με το όνομα του αρχείου, και η λίστα μένει προσαρτημένη', () => {
    mockViewport(true);
    renderSplit(FILE);
    expect(screen.getAllByTestId('viewer')).toHaveLength(1);
    expect(screen.getByTestId('viewer')).toHaveAttribute('data-titled-by-host', 'true');
    expect(screen.getByRole('heading', { name: 'Συμβόλαιο.pdf' })).toBeInTheDocument();
    expect(screen.getByTestId('list')).toBeInTheDocument();
  });

  it('φαρδύ: ο θεατής είναι δεύτερη στήλη με δικό του τίτλο — κανένα φύλλο', () => {
    mockViewport(false);
    renderSplit(FILE);
    expect(screen.getAllByTestId('viewer')).toHaveLength(1);
    expect(screen.getByTestId('viewer')).toHaveAttribute('data-titled-by-host', 'false');
    expect(screen.queryByRole('heading', { name: 'Συμβόλαιο.pdf' })).not.toBeInTheDocument();
  });

  it('χωρίς επιλογή: κανένας θεατής, σε κανένα πλάτος', () => {
    mockViewport(true);
    renderSplit(null);
    expect(screen.queryByTestId('viewer')).not.toBeInTheDocument();
  });
});

describe('useShownViewMode — δείχνεται ≠ προτιμάται', () => {
  it('στενό: το δέντρο δείχνεται ως λίστα· πλέγμα και λίστα μένουν ως έχουν', () => {
    mockViewport(true);
    expect(renderHook(() => useShownViewMode('tree')).result.current).toBe('list');
    expect(renderHook(() => useShownViewMode('gallery')).result.current).toBe('gallery');
  });

  it('φαρδύ: το δέντρο μένει δέντρο', () => {
    mockViewport(false);
    expect(renderHook(() => useShownViewMode('tree')).result.current).toBe('tree');
  });
});
