/**
 * **‹ 3 / 48 › στον θεατή αρχείων** (ADR-912 §12.16).
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 23:08**: για να δει το επόμενο έγγραφο ο άνθρωπος έκλεινε τον θεατή,
 *   έβρισκε τη γραμμή και ξανάνοιγε. Google Drive / Dropbox: βέλη στην κεφαλίδα, ← / →, με τη σειρά της λίστας.
 *
 * ⚠️ Το `FilePreviewPanel` αντικαθίσταται από στέλεχος που αποδίδει το ΑΛΗΘΙΝΟ `FileSequenceNav` με ό,τι του δίνεται:
 *   εδώ ελέγχεται η σειρά, η πλοήγηση και τα ονόματα — όχι η απόδοση του αρχείου.
 */

/* global describe, it, expect, jest, beforeEach */

import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FileSequenceNav } from '@/components/file-manager/FileSequenceNav';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { FileSequence } from '@/components/file-manager/hooks/useFileSequence';
import { fileSequenceItem } from '@/lib/files/file-sequence';
import { mockViewport } from '@/test-utils/viewport';
import type { FileRecord } from '@/types/file-record';
import { FilesPreviewSplit } from '../FilesPreviewSplit';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => (values ? `${key} ${values.index}/${values.total}` : key),
  }),
}));
jest.mock('@/hooks/useFileDisplayName', () => ({
  useFileDisplayName: () => (file: FileRecord) => file.displayName,
}));
jest.mock('@/components/file-manager/file-preview-preload', () => ({ preloadFilePreview: jest.fn() }));
jest.mock('@/components/file-manager/FilePreviewPanel', () => ({
  FilePreviewPanel: ({ file, sequence }: { file: FileRecord; sequence: FileSequence | null }) => (
    <section data-testid="viewer" data-file={file.id}>
      {sequence && <FileSequenceNav sequence={sequence} />}
    </section>
  ),
}));

const fileOf = (id: string) => ({ id, displayName: `${id}.pdf` }) as unknown as FileRecord;
// Η σειρά του πίνακα ΔΕΝ είναι η σειρά της οθόνης: η «ομαδοποιημένη» λίστα δείχνει γ, α, β.
const FILES = [fileOf('a'), fileOf('b'), fileOf('c')];
const SHOWN = ['c', 'a', 'b'];

function GroupedList({ onOpen }: { onOpen: (file: FileRecord) => void }) {
  return (
    <ul>
      {SHOWN.map((id) => (
        <li key={id}>
          <button type="button" {...fileSequenceItem(id)} onClick={() => onOpen(fileOf(id))}>
            {id}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Page({ initial }: { initial: string }) {
  const [selected, setSelected] = useState<FileRecord | null>(fileOf(initial));
  return (
    <TooltipProvider>
      <input aria-label="αναζήτηση" />
      <FilesPreviewSplit
        list={<GroupedList onOpen={setSelected} />}
        files={FILES}
        selectedFile={selected}
        onSelect={setSelected}
        onClose={() => setSelected(null)}
      />
    </TooltipProvider>
  );
}

const shownFile = () => screen.getByTestId('viewer').getAttribute('data-file');

describe('Π — πλοήγηση αρχείων στον θεατή', () => {
  beforeEach(() => mockViewport(false));

  it('🔴 Π1 — η σειρά είναι αυτή της ΑΠΟΔΟΣΜΕΝΗΣ λίστας, όχι του πίνακα αρχείων', async () => {
    render(<Page initial="a" />);
    expect(screen.getByText('viewer.sequencePosition 2/3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'viewer.nextFile' }));
    expect(shownFile()).toBe('b');
    await userEvent.click(screen.getByRole('button', { name: 'viewer.previousFile' }));
    await userEvent.click(screen.getByRole('button', { name: 'viewer.previousFile' }));
    expect(shownFile()).toBe('c');
  });

  it('🔴 Π2 — στα άκρα το βέλος είναι `aria-disabled` (εστιάσιμο) και δεν κάνει τίποτα', async () => {
    render(<Page initial="c" />);
    const previous = screen.getByRole('button', { name: 'viewer.previousFile' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(previous);
    expect(shownFile()).toBe('c');
    expect(screen.getByRole('button', { name: 'viewer.nextFile' })).not.toHaveAttribute('aria-disabled');
  });

  it('🔴 Π3 — ← / → αλλάζουν αρχείο και δηλώνουν ότι κατανάλωσαν το πλήκτρο (οι σελίδες του PDF δεν κινούνται)', () => {
    render(<Page initial="a" />);
    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    fireEvent(document.body, right);
    expect(shownFile()).toBe('b');
    expect(right.defaultPrevented).toBe(true);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(shownFile()).toBe('a');
  });

  it('✅ Π4 — σε πεδίο κειμένου τα βέλη ανήκουν στο πεδίο', () => {
    render(<Page initial="a" />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'αναζήτηση' }), { key: 'ArrowRight' });
    expect(shownFile()).toBe('a');
  });

  it('✅ Π5 — «Προηγούμενο αρχείο» ≠ «Προηγούμενη σελίδα»: τα ονόματα δεν συγχέονται με τη σελιδοποίηση του PDF', () => {
    render(<Page initial="a" />);
    expect(screen.getByRole('navigation', { name: 'viewer.sequenceNav' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'pdf.previousPage' })).toBeNull();
  });

  it('✅ Π6 — στενή οθόνη: τα ίδια βέλη στον θεατή πλήρους οθόνης', async () => {
    mockViewport(true);
    render(<Page initial="a" />);
    await userEvent.click(screen.getByRole('button', { name: 'viewer.nextFile' }));
    expect(shownFile()).toBe('b');
  });
});
