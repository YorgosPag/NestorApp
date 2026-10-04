'use client';
/**
 * **Η εικόνα του `PhotoPreviewModal`** — παράγωγο στο άνοιγμα, μεγαλύτερο **μόνο** όταν το zoom το ζητήσει (ADR-899 Ε2).
 *
 * 🔴 **Γιατί**: η γκαλερί αρχείων (`MediaGallery`) άνοιγε το modal με το **πρωτότυπο** — μετρημένο 3000×4000 / 3,27 MB σε
 * κουτί 696×928. Τώρα η πηγή έρχεται από τον **ένα** μηχανισμό του πάνελ προεπισκόπησης (`useZoomResolution`): μικρότερη
 * επαρκής βαθμίδα για `κουτί × zoom × DPR`, πρωτότυπο μόνο πάνω από τα pixel της κλίμακας, αλλαγή **μετά** το `decode()`.
 *
 * ⚠️ **Δικό της `<figure>` με δικό της ref**: το `useZoomResolution` μετρά το κουτί σε `useLayoutEffect` κατά την
 * τοποθέτηση. Το `<main>` του modal δένει το ref του **μετά** τα παιδιά του (σειρά commit του React) ⇒ ένα παιδί που το
 * ρωτούσε θα έβλεπε `null` και δεν θα μετρούσε ποτέ (⇒ `sizes` απόν ⇒ ο browser υποθέτει `100vw`). Το `<figure>` έχει το
 * ίδιο κουτί (`w-full h-full`) και ανήκει στο ίδιο component με το hook.
 *
 * @module core/modals/PhotoPreviewImage
 * @see components/shared/files/preview/use-zoom-resolution
 */
import React, { useRef } from 'react';

import { useZoomResolution } from '@/components/shared/files/preview/use-zoom-resolution';
import type { ProxyImagePreview } from '@/lib/storage/storage-object-url';

export interface PhotoPreviewImageProps {
  /** Το αρχείο (λήψη/κοινή χρήση) — και η πηγή όταν δεν υπάρχει `preview`. */
  readonly url: string | null;
  readonly preview: ProxyImagePreview | null;
  readonly zoom: number;
  readonly alt: string;
  readonly className: string;
  /** Το `contentRef` του `useZoomPan` — εκεί εφαρμόζεται ο μετασχηματισμός (οι χειρονομίες ζουν στο κουτί, ADR-899 §9 θέμα 3). */
  readonly imageRef: (node: HTMLElement | null) => void;
  readonly onLoad: React.ReactEventHandler<HTMLImageElement>;
  readonly onError: React.ReactEventHandler<HTMLImageElement>;
}

export function PhotoPreviewImage({ url, preview, zoom, imageRef, ...img }: PhotoPreviewImageProps) {
  const boxRef = useRef<HTMLElement | null>(null);
  const source = useZoomResolution(url ?? '', url ? preview : null, boxRef, zoom);

  return (
    <figure ref={boxRef} className="relative w-full h-full flex items-center justify-center select-none">
      <img
        src={url ? source.src : undefined}
        srcSet={url ? source.srcSet : undefined}
        sizes={url ? source.sizes : undefined}
        ref={imageRef}
        draggable={false}
        {...img}
      />
    </figure>
  );
}
