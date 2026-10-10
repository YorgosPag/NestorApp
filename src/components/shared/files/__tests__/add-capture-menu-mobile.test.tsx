/**
 * AddCaptureMenu — το κλαδί κινητού ΑΝΟΙΓΕΙ (ADR-912 Changelog 2026-10-10).
 *
 * Το φύλλο κινητού απέδιδε `DropdownMenuItem` χωρίς `DropdownMenu` γύρω τους ⇒ το Radix πετούσε
 * «`MenuItem` must be used within `Menu`» στο πρώτο πάτημα και έριχνε όλη τη σελίδα. Κανένα test δεν
 * εκτελούσε αυτό το κλαδί. Ο παρονομαστής (desktop) τρέχει δίπλα του: οι ίδιες επιλογές, άλλο κέλυφος.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let mockIsMobile = true;
jest.mock('@/hooks/useMobile', () => ({ useIsMobile: () => mockIsMobile }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../CameraCaptureDialog', () => ({ CameraCaptureDialog: () => null }));
jest.mock('@/config/upload-entry-points', () => ({
  getCaptureSourcesForCategory: () => ['upload', 'camera', 'video', 'microphone', 'text'],
}));

import { AddCaptureMenu } from '../AddCaptureMenu';

const OPTION_LABELS = ['capture.upload', 'capture.photo', 'capture.video', 'capture.audio', 'capture.text'];

function renderMenu(onUploadClick = jest.fn()) {
  render(<AddCaptureMenu category="documents" onUploadClick={onUploadClick} onCapture={jest.fn()} />);
  return onUploadClick;
}

describe('AddCaptureMenu — κέλυφος ανά πλάτος', () => {
  it('Κ1 κινητό: το φύλλο ανοίγει και δείχνει ΚΑΘΕ επιλογή ως `menuitem` — χωρίς να πετάξει', async () => {
    mockIsMobile = true;
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'manager.addFiles' }));

    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(OPTION_LABELS.length);
    for (const label of OPTION_LABELS) expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('Κ2 κινητό: η επιλογή «μεταφόρτωση» καλεί τον χειριστή της', async () => {
    mockIsMobile = true;
    const onUploadClick = renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'manager.addFiles' }));
    await userEvent.click(await screen.findByText('capture.upload'));

    expect(onUploadClick).toHaveBeenCalledTimes(1);
  });

  it('Κ3 ΠΑΡΟΝΟΜΑΣΤΗΣ desktop: οι ΙΔΙΕΣ επιλογές, μέσα στο μενού', async () => {
    mockIsMobile = false;
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'manager.addFiles' }));

    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(OPTION_LABELS.length);
  });
});
