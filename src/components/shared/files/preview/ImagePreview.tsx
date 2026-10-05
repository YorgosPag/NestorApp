'use client';

/**
 * 🖼️ **Προεπισκόπηση εικόνας του πάνελ αρχείων** — zoom/pan/στροφή από το ΕΝΑ `useZoomPan`, χειριστήρια από το ΕΝΑ
 * `ImageViewControls` (ADR-899 §9 θέμα 3), ανάλυση που ακολουθεί το zoom από το `useZoomResolution` (§4.1).
 *
 * 🔴 **Γιατί βγήκε από το `FilePreviewRenderer`**: ήταν ~130 γραμμές με **χειρόγραφο** τροχό (βήμα ×1,15), σύρση, όρια
 * 0,1–10 και κουμπιά **χωρίς όνομα** — το τρίτο αντίγραφο του ίδιου μηχανισμού (modal φωτογραφίας · DXF preview).
 *
 * @module components/shared/files/preview/ImagePreview
 */

import '@/lib/design-system';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useZoomPan } from '@/hooks/useZoomPan';
import { ImageViewControls } from '@/components/shared/media/viewer/ImageViewControls';
import { PHOTO_VIEW_ZOOM } from '@/components/shared/media/viewer/photo-view-zoom';
import type { ProxyImagePreview } from '@/lib/storage/storage-object-url';

import { useZoomResolution } from './use-zoom-resolution';

export interface ImagePreviewProps {
  readonly url: string;
  readonly preview?: ProxyImagePreview | null;
  readonly title: string;
}

/** Image/SVG preview: wheel zoom around the cursor, confined drag-to-pan, rotation, named toolbar. */
export function ImagePreview({ url, preview, title }: ImagePreviewProps) {
  const { t } = useTranslation(['common-photos']);
  // `contentKey: url` — η όψη ανήκει στο αρχείο: το επόμενο ανοίγει ουδέτερο, δεν κληρονομεί zoom/στροφή (§9 θέμα 7).
  const zp = useZoomPan({ ...PHOTO_VIEW_ZOOM, contentKey: url, contentDimensions: preview?.dimensions ?? null });
  // `scale` = zoom × fit (§9 θέμα 5β): η στραμμένη που ζωγραφίζεται μεγαλύτερη ζητά μεγαλύτερη βαθμίδα· η γωνία δεν ρωτιέται.
  const source = useZoomResolution(url, preview, zp.containerBox, zp.scale);

  return (
    <figure className="flex-1 flex flex-col overflow-hidden">
      <nav role="toolbar" aria-label={t('photoPreview.toolbar.ariaLabel')}
        className="flex items-center justify-center gap-1 py-2 border-b bg-muted/30">
        <ImageViewControls view={zp} showLevel />
      </nav>
      <div ref={zp.containerRef} {...zp.handlers}
        className={cn('flex-1 overflow-hidden flex items-center justify-center p-4 bg-muted/20 touch-none', zp.cursorClass)}>
        <img
          ref={zp.contentRef}
          src={source.src}
          srcSet={source.srcSet}
          sizes={source.sizes}
          alt={title}
          className="max-w-full max-h-full object-contain origin-center select-none"
          draggable={false}
          loading="lazy"
        />
      </div>
    </figure>
  );
}
