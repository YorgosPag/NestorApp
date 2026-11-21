/**
 * ⚓ ADR-054 · ADR-920 §13.10 — «άδειο» = 0 bytes, όχι «κάτω από 1 KB».
 *
 * 🔴 Ζωντανά 2026-11-20 (παραγωγή `7d2b099`): το `topo-test-ridge.txt` (728 bytes, 117 έγκυρα σημεία) δεν έφτασε ποτέ στον
 * αναγνώστη — η ζώνη το απέρριπτε ως «πολύ μικρό» (πήχης 1024) με toast που χάνεται. Εδώ τρέχει η ΑΛΗΘΙΝΗ ζώνη.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `MIN_FILE_SIZE: 1024` στο `file-upload-config` | Ζ1 ⇒ 🔴 |
 * | αφαίρεση `minSize={0}` στο `SurveyFilePicker` | Ζ3 ⇒ 🔴 |
 * | `errors.forEach(showError)` αντί για `setRefusals(errors)` στο `FileUploadZone` | Ζ2 + Ζ4 ⇒ 🔴 |
 *
 * Οι αρνήσεις είναι **inline** (`FileUploadRefusals`, πρότυπο GOV.UK / Carbon), όχι toast που χάνεται.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

const showError = jest.fn();
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: jest.fn(), error: showError, warning: jest.fn() }),
}));
jest.mock('@/subapps/geo-canvas/floor-plan-system/parsers/raster/ImageParser', () => ({
  smartCompressContactPhoto: jest.fn(),
}));

import { FileUploadZone } from '../FileUploadZone';
import { SurveyFilePicker } from '@/components/terrain/survey-import/SurveyFilePicker';

/** A text file of exactly `bytes` bytes. */
function textFile(name: string, bytes: number): File {
  return new File(['x'.repeat(bytes)], name, { type: 'text/plain' });
}

async function choose(file: File): Promise<void> {
  const input = screen.getByLabelText('uploadZone.fileInput');
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
}

beforeEach(() => showError.mockClear());

describe('ADR-920 §13.10 — η ζώνη αρνείται μόνο το ΑΔΕΙΟ αρχείο', () => {
  it('Ζ1 — 728 bytes (το μικρό τοπογραφικό) φτάνει στο onUpload', async () => {
    const onUpload = jest.fn(async () => undefined);
    render(<FileUploadZone onUpload={onUpload} accept=".txt" enableCompression={false} />);
    await choose(textFile('topo-test-ridge.txt', 728));
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(showError).not.toHaveBeenCalled();
  });

  it('Ζ2 — 0 bytes ⇒ άρνηση «κενό» INLINE (όχι toast), δεμένη στο πεδίο, τίποτα στο onUpload', async () => {
    const onUpload = jest.fn(async () => undefined);
    render(<FileUploadZone onUpload={onUpload} accept=".txt" enableCompression={false} />);
    await choose(textFile('empty.txt', 0));
    expect(onUpload).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('validation.fileEmpty');
    expect(showError).not.toHaveBeenCalled();
    const input = screen.getByLabelText('uploadZone.fileInput');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('Ζ4 — πολύ μεγάλο ⇒ inline· η επόμενη έγκυρη επιλογή σβήνει την άρνηση', async () => {
    const onUpload = jest.fn(async () => undefined);
    render(<FileUploadZone onUpload={onUpload} accept=".txt" enableCompression={false} />);
    const huge = textFile('huge.txt', 10);
    Object.defineProperty(huge, 'size', { value: 1024 * 1024 * 1024 });
    await choose(huge);
    expect(screen.getByRole('alert').textContent).toContain('uploadZone.errors.fileTooLarge');
    expect(onUpload).not.toHaveBeenCalled();
    await choose(textFile('ok.txt', 728));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('Ζ3 — στο τοπογραφικό και το κενό φτάνει στον αναγνώστη (κρίνει το περιεχόμενο, inline)', async () => {
    const loadFile = jest.fn(async () => undefined);
    const survey = { fileName: null, reading: false, read: null, loadFile, reset: jest.fn() };
    render(<SurveyFilePicker survey={survey} />);
    await choose(textFile('empty.txt', 0));
    expect(loadFile).toHaveBeenCalledTimes(1);
    expect(showError).not.toHaveBeenCalled();
  });
});
