/**
 * **Η προεπισκόπηση βίντεο της γκαλερί αρχείων είναι διάλογος ΜΕ ΟΝΟΜΑ** (ADR-907 §10.11).
 *
 * Μετρημένο στον browser (2026-10-09): ο διάλογος άνοιγε με σκέτο `<h2>` για τίτλο ⇒ το Radix κατήγγειλε
 * «`DialogContent` requires a `DialogTitle`» και ο αναγνώστης οθόνης άκουγε διάλογο χωρίς όνομα.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Γ1: ο τίτλος ξαναγίνεται σκέτο `<h2>` (ο διάλογος χάνει το προσβάσιμο όνομά του).
 * - Γ2: το πάτημα σε κάρτα **φωτογραφίας** ανοίγει τον διάλογο του βίντεο.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { FileRecord } from '@/types/file-record';

import { MediaGallery } from '../MediaGallery';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/core/modals/PhotoPreviewModal', () => ({ PhotoPreviewModal: () => null }));
jest.mock('@/core/modals/usePhotoPreviewModal', () => ({
  usePhotoPreviewModal: () => ({ modalProps: {}, openModal: jest.fn(), openGalleryModal: jest.fn() }),
}));
jest.mock('../VideoPlayer', () => ({ VideoPlayer: () => <div data-testid="player" /> }));
jest.mock('../MediaCard', () => ({
  MediaCard: ({ file, onClick }: { file: FileRecord; onClick: () => void }) => (
    <button type="button" onClick={onClick}>{`card:${file.id}`}</button>
  ),
}));

function file(id: string, contentType: string, displayName: string): FileRecord {
  return { id, displayName, contentType, createdAt: new Date('2026-10-09'), sizeBytes: 1 } as unknown as FileRecord;
}

const CLIP = file('file_v', 'video/mp4', 'Περιήγηση - Διαμέρισμα 80 τ.μ.');
const PHOTO = file('file_p', 'image/jpeg', 'Σαλόνι');

describe('MediaGallery — προεπισκόπηση βίντεο', () => {
  it('🔴 Γ1 ο διάλογος του βίντεο έχει προσβάσιμο όνομα: το όνομα του αρχείου', () => {
    render(<MediaGallery files={[CLIP]} showToolbar={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByText('card:file_v'));

    expect(screen.getByRole('dialog', { name: 'Περιήγηση - Διαμέρισμα 80 τ.μ.' })).toBeTruthy();
    expect(screen.getByTestId('player')).toBeTruthy();
  });

  it('🔴 Γ2 κάρτα φωτογραφίας δεν ανοίγει τον διάλογο του βίντεο', () => {
    render(<MediaGallery files={[PHOTO]} showToolbar={false} />);
    fireEvent.click(screen.getByText('card:file_p'));
    expect(screen.queryByTestId('player')).toBeNull();
  });
});
