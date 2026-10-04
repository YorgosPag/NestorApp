'use client';

/**
 * 🔍 **ΤΑ ΧΕΙΡΙΣΤΗΡΙΑ ΟΨΗΣ ΦΩΤΟΓΡΑΦΙΑΣ** — σμίκρυνση · [ποσοστό] · μεγέθυνση · περιστροφή · προσαρμογή (ADR-899 §9 θέμα 3).
 *
 * Ένα σύνολο για modal φωτογραφίας **και** πάνελ προεπισκόπησης: πριν το πάνελ είχε τρία κουμπιά χωρίς όνομα, με
 * `disabled` και χωρίς «Προσαρμογή», ενώ το modal είχε τα δικά του με καρφωμένα όρια. Τα όρια έρχονται από το
 * {@link PHOTO_VIEW_ZOOM} — το ίδιο που οδηγεί το `useZoomPan` — άρα το «ανενεργό» δεν μπορεί να αποκλίνει από το όριο.
 * Αποδίδεται **μέσα** στο `<nav role="toolbar">` του φιλοξενούντα (το modal έχει εκεί και πλοήγηση/λήψη/κλείσιμο).
 *
 * @module components/shared/media/viewer/ImageViewControls
 */

import '@/lib/design-system';
import { Maximize2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { UseZoomPanReturn } from '@/hooks/useZoomPan';

import { PHOTO_VIEW_ZOOM } from './photo-view-zoom';
import { ViewerToolbarButton } from './ViewerToolbarButton';

export interface ImageViewControlsProps {
  readonly view: Pick<UseZoomPanReturn, 'zoom' | 'zoomIn' | 'zoomOut' | 'rotateBy90' | 'resetAll'>;
  /** Ποσοστό ανάμεσα στα κουμπιά zoom (πάνελ)· το modal το δείχνει στο υποσέλιδο. */
  readonly showLevel?: boolean;
}

export function ImageViewControls({ view, showLevel = false }: ImageViewControlsProps) {
  const { t } = useTranslation(['common-photos']);
  const colors = useSemanticColors();
  return (
    <>
      <ViewerToolbarButton label={t('photoPreview.zoom.out')} icon={ZoomOut} onClick={view.zoomOut}
        disabled={view.zoom <= PHOTO_VIEW_ZOOM.minZoom} />
      {showLevel && (
        <span className={cn('text-xs w-12 text-center tabular-nums', colors.text.muted)}>
          {Math.round(view.zoom * 100)}%
        </span>
      )}
      <ViewerToolbarButton label={t('photoPreview.zoom.in')} icon={ZoomIn} onClick={view.zoomIn}
        disabled={view.zoom >= PHOTO_VIEW_ZOOM.maxZoom} />
      <ViewerToolbarButton label={t('photoPreview.actions.rotate')} icon={RotateCw} onClick={view.rotateBy90} />
      <ViewerToolbarButton label={t('photoPreview.zoom.fit')} icon={Maximize2} onClick={view.resetAll} />
    </>
  );
}
