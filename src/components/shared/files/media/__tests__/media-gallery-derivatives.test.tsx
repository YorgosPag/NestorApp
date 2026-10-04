/**
 * ADR-899 Ε2 — **η κάρτα της γκαλερί αρχείων και το modal της ζητούν παράγωγα, όχι το πρωτότυπο.**
 *
 * Μετρημένο στην παραγωγή (2026-10-03): η καρτέλα «Φωτογραφίες» του ακινήτου κατέβαζε 3,27 MB για κάρτα 160 px και το
 * modal έδειχνε το πρωτότυπο 3000×4000 σε κουτί 696×928.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Ε1: η κάρτα γυρίζει στο `fileDisplayUrl` (πρωτότυπο, χωρίς `srcset`).
 * - Ε2: το `sizes` της κάρτας αγνοεί το `object-cover` (πανοραμική σε 4:3 κουτί ⇒ θολή) ή ξεπερνά τα pixel της εικόνας.
 * - Ε3: το `onError` δεν προχωρά στην εφεδρεία / δεν δείχνει σφάλμα όταν εξαντληθούν οι πηγές.
 * - Ε4: το modal αγνοεί το `preview` (πάλι πρωτότυπο) — ή χάνει το URL του αρχείου όταν δεν υπάρχει `preview`.
 * - Ε5: το `coveredWidth` γίνεται `containedWidth` (υποεκτίμηση) ή χάνει το φράγμα των pixel.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { coveredWidth } from '@/lib/images/image-dimensions';
import { buildProxyPreview } from '@/lib/storage/storage-object-url';
import type { FileRecord } from '@/types/file-record';

import { thumbnailSizesOf } from '../../file-thumbnail-sources';
import { MediaCard } from '../MediaCard';
import { PhotoPreviewImage } from '@/core/modals/PhotoPreviewImage';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

const PATH = 'companies/c1/entities/property/p1/domains/sales/categories/photos/files/file_1.jpg';

function photo(extra: Partial<FileRecord> = {}): FileRecord {
  return {
    id: 'file_1',
    displayName: 'Εσωτερικό',
    storagePath: PATH,
    contentType: 'image/jpeg',
    ext: 'jpg',
    downloadUrl: 'https://x.test/orig.jpg',
    createdAt: new Date('2026-09-02'),
    ...extra,
  } as unknown as FileRecord;
}

function renderCard(file: FileRecord) {
  return render(<MediaCard file={file} isSelected={false} onSelect={jest.fn()} onClick={jest.fn()} />);
}

describe('ADR-899 Ε2 — MediaCard: μικρογραφία από την κλίμακα', () => {
  it('🔴 Ε1 κάρτα ⇒ παράγωγο με `srcset`, ΟΧΙ το πρωτότυπο', () => {
    renderCard(photo());
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.getAttribute('srcset')).toBe(buildProxyPreview(PATH).srcSet);
    expect(img.getAttribute('src')).toBe(buildProxyPreview(PATH).src);
    expect(img.getAttribute('src')).not.toBe('https://x.test/orig.jpg');
  });

  it('🔴 Ε2 χωρίς μέτρηση (jsdom) ⇒ `sizes` = άνω φράγμα της στήλης (320 px), ποτέ κενό', () => {
    renderCard(photo());
    expect(screen.getByRole('img').getAttribute('sizes')).toBe('320px');
  });

  it('🔴 Ε3 σφάλμα ⇒ `_thumb` ⇒ ορατό σφάλμα, ένα βήμα ανά `onError`', () => {
    renderCard(photo({ thumbnailUrl: 'https://x.test/t.webp' } as Partial<FileRecord>));
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img').getAttribute('src')).toBe('https://x.test/t.webp');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByLabelText('media.loadError')).toBeTruthy();
  });

  it('βίντεο ⇒ καμία εικόνα (το placeholder του βίντεο μένει)', () => {
    renderCard(photo({ contentType: 'video/mp4', ext: 'mp4' }));
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('ADR-899 Ε2 — `sizes` για `object-cover`', () => {
  it('🔴 Ε5 coveredWidth: πανοραμική σε 4:3 ⇒ πλατύτερη από το κουτί · κάθετη ⇒ το πλάτος του κουτιού · φράγμα στα pixel', () => {
    expect(coveredWidth({ width: 320, height: 240 }, { width: 1600, height: 739 })).toBeCloseTo(519.6, 1);
    expect(coveredWidth({ width: 320, height: 240 }, { width: 3000, height: 4000 })).toBe(320);
    expect(coveredWidth({ width: 320, height: 240 }, { width: 200, height: 100 })).toBe(200);
    expect(coveredWidth({ width: 0, height: 240 }, { width: 10, height: 10 })).toBe(0);
  });

  it('🔴 Ε2 thumbnailSizesOf: αριθμός = τετράγωνο · χωρίς διαστάσεις = πλάτος κουτιού · στρογγύλευση προς τα πάνω', () => {
    expect(thumbnailSizesOf(40, null)).toBe('40px');
    expect(thumbnailSizesOf(40, { width: 2000, height: 1000 })).toBe('80px');
    expect(thumbnailSizesOf({ width: 320, height: 240 }, { width: 1600, height: 739 })).toBe('520px');
    expect(thumbnailSizesOf({ width: 328, height: 248 }, null)).toBe('328px');
  });
});

describe('ADR-899 Ε2 — PhotoPreviewImage: η εικόνα του modal', () => {
  const handlers = {
    onLoad: jest.fn(), onError: jest.fn(),
  };

  it('🔴 Ε4 με `preview` ⇒ το παράγωγο (`srcset`), όχι το πρωτότυπο', () => {
    const preview = buildProxyPreview(PATH);
    render(<PhotoPreviewImage url="https://x.test/orig.jpg" preview={preview} zoom={1} alt="φ" className="c" imageRef={jest.fn()} {...handlers} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe(preview.src);
    expect(img.getAttribute('srcset')).toBe(preview.srcSet);
  });

  it('🔴 Ε4 χωρίς `preview` (επαφές, λογότυπα) ⇒ το URL αυτούσιο — η συμπεριφορά πριν', () => {
    render(<PhotoPreviewImage url="https://x.test/avatar.png" preview={null} zoom={1} alt="φ" className="c" imageRef={jest.fn()} {...handlers} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://x.test/avatar.png');
    expect(img.getAttribute('srcset')).toBeNull();
  });
});
