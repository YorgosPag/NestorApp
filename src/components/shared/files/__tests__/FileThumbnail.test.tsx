/**
 * ADR-899 §4.1 — **η μικρογραφία αρχείου ρωτά τον ΕΝΑ αναγνώστη εμφάνισης** και ζητά παράγωγο στο μέγεθος του κουτιού.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Μ1: εγγραφή **χωρίς** `downloadUrl` αλλά με `storagePath` ⇒ πάλι εικονίδιο (το σφάλμα που έκρυβε φωτογραφίες).
 * - Μ2: το `sizes` αποσυνδέεται από το κουτί (π.χ. σταθερό `100vw`) ⇒ ο browser κατεβάζει 2560 για κουτί 40 px.
 * - Μ3: το `_thumb` του client προηγείται του παραγώγου του server.
 * - Μ4: το `onError` δεν προχωρά ⇒ σπασμένη εικόνα αντί για εφεδρεία.
 * - Μ5: τα px του πίνακα αποκλίνουν από την κλάση Tailwind του κουτιού.
 * - Μ6: εικόνα που δεν προεπισκοπείται (svg) χάνει το πρωτότυπο ως πηγή.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { buildProxyPreview, buildProxyUrl } from '@/lib/storage/storage-object-url';

import { FileThumbnail } from '../FileThumbnail';
import { THUMBNAIL_SIZE_CONFIG, thumbnailCandidatesOf, type ThumbnailSize } from '../file-thumbnail-sources';

jest.mock('../hooks/usePdfThumbnail', () => ({
  usePdfThumbnail: (url: string | undefined, enabled: boolean) => ({
    thumbnailUrl: enabled && url ? `pdf-page-1:${url}` : null,
    loading: false,
  }),
}));

const PATH = 'companies/c1/entities/property/p1/domains/sales/categories/photos/files/file_1.jpg';
const PHOTO = { storagePath: PATH, contentType: 'image/jpeg', ext: 'jpg' } as const;

function img(): HTMLImageElement {
  return screen.getByRole('img') as HTMLImageElement;
}

describe('FileThumbnail — παράγωγο του server, μέγεθος του κουτιού', () => {
  it('🔴 Μ1 χωρίς `downloadUrl`, με `storagePath` ⇒ ΕΙΚΟΝΑ από την κλίμακα, όχι εικονίδιο', () => {
    render(<FileThumbnail file={PHOTO} displayName="φωτο" size="sm" />);
    expect(img().getAttribute('srcset')).toBe(buildProxyPreview(PATH).srcSet);
    expect(img().getAttribute('src')).toBe(buildProxyPreview(PATH).src);
  });

  it.each(Object.keys(THUMBNAIL_SIZE_CONFIG) as ThumbnailSize[])('🔴 Μ2 `sizes` = τα px του κουτιού «%s»', (size) => {
    render(<FileThumbnail file={PHOTO} displayName="φωτο" size={size} />);
    expect(img().getAttribute('sizes')).toBe(`${THUMBNAIL_SIZE_CONFIG[size].px}px`);
  });

  it('🔴 Μ3+Μ4 σειρά: παράγωγο → `_thumb` → εικονίδιο, ένα βήμα ανά `onError`', () => {
    const { container } = render(
      <FileThumbnail file={{ ...PHOTO, downloadUrl: 'https://x.test/orig.jpg', thumbnailUrl: 'https://x.test/t.webp' }} displayName="φωτο" />,
    );
    expect(img().getAttribute('srcset')).toBe(buildProxyPreview(PATH).srcSet);
    fireEvent.error(img());
    expect(img().getAttribute('src')).toBe('https://x.test/t.webp');
    expect(img().getAttribute('srcset')).toBeNull();
    fireEvent.error(img());
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('🔴 Μ5 τα px του πίνακα = πλάτος της κλάσης Tailwind (1 μονάδα = 4 px)', () => {
    for (const { container, px } of Object.values(THUMBNAIL_SIZE_CONFIG)) {
      expect(Number(/\bw-(\d+)\b/.exec(container)?.[1]) * 4).toBe(px);
    }
  });

  it('🔴 Μ6 svg (δεν προεπισκοπείται) ⇒ το πρωτότυπο ως πηγή · PDF ⇒ σελίδα 1 από το URL του αναγνώστη', () => {
    const svg = { storagePath: 'a/b.svg', contentType: 'image/svg+xml', ext: 'svg' };
    expect(thumbnailCandidatesOf(svg, { isImage: true }, 40)).toEqual([{ src: buildProxyUrl('a/b.svg') }]);
    render(<FileThumbnail file={{ storagePath: 'a/b.pdf', contentType: 'application/pdf', ext: 'pdf' }} displayName="κάτοψη" />);
    expect(img().getAttribute('src')).toBe(`pdf-page-1:${buildProxyUrl('a/b.pdf')}`);
  });
});
