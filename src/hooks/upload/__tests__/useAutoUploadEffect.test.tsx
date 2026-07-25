/**
 * Β1 — το auto-upload guard πρέπει να ΕΠΙΒΙΩΝΕΙ του remount.
 *
 * ΡΙΖΑ ΤΟΥ BUG: τα guards ζούσαν σε `useRef`, άρα κάθε remount του slot τα
 * μηδένιζε. Όταν το `photo.file` ήταν ακόμη παρόν (π.χ. μετά από αλλαγή React
 * key), το φρέσκο instance το έβλεπε ως ολοκαίνουργιο αρχείο και ξανανέβαζε →
 * δεύτερο Storage object + δεύτερο `files` doc + δεύτερο URL.
 *
 * Ταυτόχρονα, μια ΑΠΟΤΥΧΙΑ δεν επιτρέπεται να κλειδώσει το αρχείο για πάντα:
 * μετά από σφάλμα δικτύου ο χρήστης πρέπει να μπορεί να ξαναδοκιμάσει.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useAutoUploadEffect } from '../useAutoUploadEffect';

function makeFile(name: string): File {
  return new File(['x'.repeat(64)], name, { type: 'image/jpeg' });
}

function makeUpload(uploadFile: jest.Mock) {
  return { isUploading: false, success: false, uploadFile } as unknown as Parameters<
    typeof useAutoUploadEffect
  >[0]['upload'];
}

const handler = jest.fn();

function renderAutoUpload(file: File, upload: ReturnType<typeof makeUpload>) {
  return renderHook(() =>
    useAutoUploadEffect({
      file,
      upload,
      uploadHandler: handler as never,
      purpose: 'photo',
    }),
  );
}

describe('useAutoUploadEffect — remount-durable guard', () => {
  it('δεν ξανανεβάζει το ΙΔΙΟ File μετά από remount (το ακριβές bug)', async () => {
    const file = makeFile('remount-case.jpg');
    const uploadFile = jest.fn().mockResolvedValue({ success: true, url: 'https://x/1.jpg' });
    const upload = makeUpload(uploadFile);

    const first = renderAutoUpload(file, upload);
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
    first.unmount();

    // Remount με το ίδιο File — παλιά αυτό παρήγαγε δεύτερο upload.
    renderAutoUpload(file, upload);
    await new Promise((r) => setTimeout(r, 20));

    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  it('ανεβάζει κανονικά ένα ΔΙΑΦΟΡΕΤΙΚΟ αρχείο (καμία υπερ-φραγή)', async () => {
    const uploadFile = jest.fn().mockResolvedValue({ success: true, url: 'https://x/2.jpg' });
    const upload = makeUpload(uploadFile);

    renderAutoUpload(makeFile('distinct-a.jpg'), upload);
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));

    renderAutoUpload(makeFile('distinct-b.jpg'), upload);
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(2));
  });

  it('μετά από ΑΠΟΤΥΧΙΑ, το remount επιτρέπει retry', async () => {
    const file = makeFile('retry-case.jpg');
    const uploadFile = jest.fn().mockRejectedValue(new Error('network down'));
    const upload = makeUpload(uploadFile);

    const first = renderAutoUpload(file, upload);
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
    first.unmount();

    renderAutoUpload(file, upload);
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(2));
  });
});
