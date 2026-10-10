'use client';

/**
 * @fileoverview **Η ΣΚΗΝΗ ΠΟΥ ΜΕΓΕΘΥΝΕΤΑΙ ΜΕΣΑ ΣΕ ΚΑΡΤΕΛΑ** — το κοινό πλαίσιο κάθε σχεδίου της αγγελίας: γραμμή
 * εργαλείων, μεγέθυνση/μετακίνηση, και η σελίδα που συνεχίζει να κυλά (ADR-907 Φ2β-3 · §11.9).
 * @module components/listing-detail/media/ListingZoomStage
 * @related hooks/useZoomPan (`yieldScrollAtRest`) · shared/media/viewer/ImageViewControls ·
 *   ListingFloorplanStage (κάτοψη μονάδας) · ListingFloorPlateStage (κάτοψη ορόφου) — οι δύο καταναλωτές
 *
 * 🔑 **Εξήχθη όταν τη χρειάστηκε ο δεύτερος** (N.18): ζούσε ιδιωτική στο `ListingFloorplanStage`. Η κάτοψη ορόφου θέλει
 *   το **ίδιο** πλαίσιο με άλλο περιεχόμενο — δίδυμο θα σήμαινε δύο τόπους για το `yieldScrollAtRest` και τον φρουρό
 *   σύρσης, δηλαδή δύο σκηνές που κάποτε θα συμπεριφέρονταν αλλιώς στον ίδιο τροχό.
 * 🔑 **Κανένα νέο zoom**: ο μηχανισμός είναι το `useZoomPan`, τα κουμπιά το `ImageViewControls`, τα όρια το
 *   `PHOTO_VIEW_ZOOM`. Ο μετασχηματισμός μπαίνει στο περίβλημα **εικόνας + ό,τι σχεδιάζεται πάνω της**.
 * 🔑 **Η σελίδα κυλά κανονικά πάνω από το σχέδιο** (`yieldScrollAtRest`): σκέτος τροχός και κάθετη αφή ανήκουν στη
 *   σελίδα· μεγέθυνση με τα κουμπιά, διπλό κλικ, pinch ή Ctrl/⌘ + τροχό — όπως η ενσωματωμένη Google Maps.
 */

import React, { useRef } from 'react';

import { ImageViewControls } from '@/components/shared/media/viewer/ImageViewControls';
import { PHOTO_VIEW_ZOOM } from '@/components/shared/media/viewer/photo-view-zoom';
import { DRAG_THRESHOLD_PX } from '@/components/spatial-tour/viewer/usePointerDragRelease';
import { useZoomPan } from '@/hooks/useZoomPan';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

/** Η σκηνή σε ηρεμία: η κύρια στήλη της σελίδας, ή τα 3/5 της όταν δίπλα στέκεται κάτι άλλο. */
const STAGE_SIZES = '(min-width: 1280px) 880px, (min-width: 1024px) calc(100vw - 28rem), 100vw';

/** Μεγεθυμένη: ο περιηγητής ξαναδιαλέγει **μεγαλύτερη** πηγή από το ίδιο `srcSet` — το σχέδιο δεν θολώνει. */
const STAGE_SIZES_ZOOMED = '300vw';

/** Το σχέδιο χωρά **ολόκληρο** στην οθόνη — και ένα κατακόρυφο· το πλαίσιο το δίνει η σκηνή, όχι η εικόνα. */
export const ZOOM_STAGE_IMAGE = 'max-h-[70vh] rounded-none border-0';

/**
 * Κλικ μετά από **σύρσιμο** δεν είναι κλικ: χωρίς αυτό, μετακίνηση του σχεδίου που τελειώνει πάνω σε σημείο ή σε
 * σύνδεσμο θα τον ενεργοποιούσε. Ίδιο κατώφλι με τον θεατή της περιήγησης (`DRAG_THRESHOLD_PX`).
 */
function useSwallowClickAfterDrag() {
  const start = useRef<{ readonly x: number; readonly y: number } | null>(null);
  return {
    // Γεγονός **ποντικιού**, όπως και η σύρση του `useZoomPan` — και στη φάση σύλληψης, πριν το σημείο σταματήσει τη διάδοση.
    onMouseDownCapture: (event: React.MouseEvent) => {
      start.current = { x: event.clientX, y: event.clientY };
    },
    onClickCapture: (event: React.MouseEvent) => {
      const from = start.current;
      if (from === null || Math.hypot(event.clientX - from.x, event.clientY - from.y) < DRAG_THRESHOLD_PX) return;
      event.stopPropagation();
      event.preventDefault();
    },
  };
}

export interface ListingZoomStageProps {
  /** Η ταυτότητα του περιεχομένου: η όψη ανήκει σε **αυτό** το σχέδιο — το επόμενο ανοίγει ουδέτερο (ADR-899 §9 θέμα 7). */
  readonly contentKey: string;
  /** Το σχέδιο, με τα `sizes` που αντιστοιχούν στη μεγέθυνση της στιγμής. */
  readonly children: (sizes: string) => React.ReactNode;
}

export function ListingZoomStage({ contentKey, children }: ListingZoomStageProps) {
  const { t } = useTranslation(['listing-detail']);
  const zp = useZoomPan({ ...PHOTO_VIEW_ZOOM, contentKey, yieldScrollAtRest: true });
  const guard = useSwallowClickAfterDrag();
  const sizes = zp.zoom > PHOTO_VIEW_ZOOM.defaultZoom ? STAGE_SIZES_ZOOMED : STAGE_SIZES;

  return (
    <figure className="m-0 flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Η ετικέτα ονομάζει ΤΙ χειρίζεται η γραμμή (WAI-ARIA APG, toolbar): κάτοψη, όχι φωτογραφία (ADR-907 §8.3). */}
      <nav role="toolbar" aria-label={t('listing-detail:media.capture.viewTools')}
        className="flex items-center justify-center gap-1 border-b border-border bg-muted/30 py-1">
        <ImageViewControls view={zp} showLevel />
      </nav>
      <div ref={zp.containerRef} {...zp.handlers} {...guard} data-floorplan-stage=""
        className={cn('overflow-hidden', zp.cursorClass, zp.touchClass)}>
        <div ref={zp.contentRef} className="origin-center">
          {children(sizes)}
        </div>
      </div>
    </figure>
  );
}
