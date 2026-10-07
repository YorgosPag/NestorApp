'use client';

/**
 * @fileoverview **Η ΣΚΗΝΗ ΤΗΣ ΚΑΤΟΨΗΣ ΜΕΣΑ ΣΤΗΝ ΚΑΡΤΕΛΑ** — μεγέθυνση/μετακίνηση, και η φωτογραφία κάθε σημείου λήψης
 * **δίπλα** της, χωρίς αλλαγή σελίδας (ADR-907 Φ2β-3 · Φ2β-4).
 * @module components/listing-detail/media/ListingFloorplanStage
 * @related hooks/useZoomPan (`yieldScrollAtRest`) · shared/media/viewer/ImageViewControls · ListingFloorplanSpotsFigure ·
 *   hooks/listings/useListingPhotoParam · ListingFloorplans (ο κάτοχος — τη φορτώνει πίσω από όριο `next/dynamic`)
 *
 * 🔑 **Κανένα νέο zoom**: ο μηχανισμός είναι το `useZoomPan`, τα κουμπιά το `ImageViewControls`, τα όρια το
 *   `PHOTO_VIEW_ZOOM`. Ο μετασχηματισμός μπαίνει στο περίβλημα **εικόνας + σημείων**, άρα τα σημεία μένουν στη θέση τους.
 * 🔑 **Η σελίδα κυλά κανονικά πάνω από την κάτοψη** (`yieldScrollAtRest`): σκέτος τροχός και κάθετη αφή ανήκουν στη
 *   σελίδα· μεγέθυνση με τα κουμπιά, διπλό κλικ, pinch ή Ctrl/⌘ + τροχό — όπως η ενσωματωμένη Google Maps.
 * 🔑 **Σελίδα, ποτέ φύλλο** (ADR-777 §26.3): η φωτογραφία του σημείου ανοίγει **μέσα** στην καρτέλα· το πλήρες παράθυρο
 *   μένει σύνδεσμος προς το `/photos?photo=N`. Η επιλογή ζει στο `?photo=` (ίδιος αναγνώστης με το lightbox), άρα μοιράζεται.
 * 🔑 **Μία κάτοψη τη φορά** (με επιλογέα όταν είναι πολλές): μια σκηνή που μεγεθύνεται θέλει όλο το πλάτος της.
 */

import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { ImageViewControls } from '@/components/shared/media/viewer/ImageViewControls';
import { PHOTO_VIEW_ZOOM } from '@/components/shared/media/viewer/photo-view-zoom';
import { DRAG_THRESHOLD_PX } from '@/components/spatial-tour/viewer/usePointerDragRelease';
import { Button } from '@/components/ui/button';
import { useListingPhotoParam } from '@/hooks/listings/useListingPhotoParam';
import { useZoomPan } from '@/hooks/useZoomPan';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { floorplanSpotsByUrl, listingFloorplanSpots, type ListingFloorplanSpots } from '@/lib/listings/listing-capture-spots';
import { listingGalleryImages } from '@/lib/listings/listing-images';
import { listingPhotosHref } from '@/lib/listings/listing-routes';
import { floorplanEntryOf } from '@/lib/media/photo-floorplan-spots';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import type { ListingFloorplan, ListingImage, PublicListing } from '@/types/public-listing';

import { ListingFloorplanFigure } from '../ListingFloorplanFigure';
import { GalleryImage } from '../ListingGallery';
import { ListingFloorplanSpotsFigure } from './ListingFloorplanSpotsFigure';

/** Η σκηνή σε ηρεμία: η κύρια στήλη της σελίδας, ή τα 3/5 της όταν δίπλα στέκεται η φωτογραφία του σημείου. */
const STAGE_SIZES = '(min-width: 1280px) 880px, (min-width: 1024px) calc(100vw - 28rem), 100vw';

/** Μεγεθυμένη: ο περιηγητής ξαναδιαλέγει **μεγαλύτερη** πηγή από το ίδιο `srcSet` — το σχέδιο δεν θολώνει. */
const STAGE_SIZES_ZOOMED = '300vw';

const PHOTO_SIZES = '(min-width: 1280px) 350px, (min-width: 1024px) 30vw, 100vw';

/** Η κάτοψη χωρά **ολόκληρη** στην οθόνη — και μια κατακόρυφη· το πλαίσιο το δίνει η σκηνή, όχι η εικόνα. */
const STAGE_IMAGE = 'max-h-[70vh] rounded-none border-0';

export interface ListingFloorplanStageProps {
  readonly listing: PublicListing;
  /** Οι κατόψεις που **παρουσιάζονται** (`isPubliclyPresentable`) — τουλάχιστον μία. */
  readonly shown: readonly ListingFloorplan[];
  /**
   * Η λεζάντα της κάτοψης που φαίνεται **τώρα** (προέλευση). Την αποδίδει ο κάτοχος: τα κλειδιά της είναι δηλωμένα εκεί
   * για το route slice (CHECK 3.34) — δεύτερη δήλωση εδώ θα ήταν δεύτερη χαρτογράφηση προέλευσης → πρότασης.
   */
  readonly caption: (floorplan: ListingFloorplan) => React.ReactNode;
}

/**
 * Κλικ μετά από **σύρσιμο** δεν είναι κλικ: χωρίς αυτό, μετακίνηση της κάτοψης που τελειώνει πάνω σε σημείο θα άνοιγε
 * τη φωτογραφία του. Ίδιο κατώφλι με τον θεατή της περιήγησης (`DRAG_THRESHOLD_PX`).
 */
function useSwallowClickAfterDrag() {
  const start = useRef<{ readonly x: number; readonly y: number } | null>(null);
  return {
    onPointerDownCapture: (event: React.PointerEvent) => {
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

interface ZoomStageProps {
  readonly floorplan: ListingFloorplan;
  readonly spots: ListingFloorplanSpots | null;
  readonly total: number;
  readonly current: number | null;
  readonly onActivate: (imageIndex: number) => void;
}

function ZoomStage({ floorplan, spots, total, current, onActivate }: ZoomStageProps) {
  const { t } = useTranslation(['common-photos']);
  // `contentKey`: η όψη ανήκει στην κάτοψη — η επόμενη ανοίγει ουδέτερη (ADR-899 §9 θέμα 7).
  const zp = useZoomPan({ ...PHOTO_VIEW_ZOOM, contentKey: floorplan.value.url, yieldScrollAtRest: true });
  const guard = useSwallowClickAfterDrag();
  const sizes = zp.zoom > PHOTO_VIEW_ZOOM.defaultZoom ? STAGE_SIZES_ZOOMED : STAGE_SIZES;

  return (
    <figure className="m-0 flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <nav role="toolbar" aria-label={t('common-photos:photoPreview.toolbar.ariaLabel')}
        className="flex items-center justify-center gap-1 border-b border-border bg-muted/30 py-1">
        <ImageViewControls view={zp} showLevel />
      </nav>
      <div ref={zp.containerRef} {...zp.handlers} {...guard} data-floorplan-stage=""
        className={cn('overflow-hidden', zp.cursorClass, zp.touchClass)}>
        <div ref={zp.contentRef} className="origin-center">
          {spots === null ? (
            <ListingFloorplanFigure floorplan={floorplan} sizes={sizes} imageClassName={STAGE_IMAGE} />
          ) : (
            <ListingFloorplanSpotsFigure entry={spots} total={total} currentImageIndex={current} onActivate={onActivate}
              sizes={sizes} imageClassName={STAGE_IMAGE} />
          )}
        </div>
      </div>
    </figure>
  );
}

interface SpotPhotoProps {
  readonly listingId: string;
  readonly images: readonly ListingImage[];
  readonly spots: ListingFloorplanSpots;
  readonly current: number;
  readonly onGo: (imageIndex: number) => void;
}

/** Η φωτογραφία του τρέχοντος σημείου, με βήμα **ανάμεσα στα σημεία αυτής της κάτοψης** και έξοδο στο πλήρες παράθυρο. */
function SpotPhoto({ listingId, images, spots, current, onGo }: SpotPhotoProps) {
  const { t } = useTranslation(['listing-detail']);
  const order = spots.photos.map((photo) => photo.imageIndex);
  const position = order.indexOf(current);
  const step = (delta: number): void => onGo(order[(position + delta + order.length) % order.length]);
  const label = { index: current + 1, total: images.length };

  return (
    <aside aria-label={t('listing-detail:media.capture.panelTitle')} className="flex min-w-0 flex-col gap-2">
      <GalleryImage image={images[current]} index={label.index} total={label.total} sizes={PHOTO_SIZES} frame="aspect-[4/3]" />
      <nav className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="icon-sm" disabled={order.length < 2} onClick={() => step(-1)}
          aria-label={t('listing-detail:media.capture.previous')}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <p role="status" className="m-0 text-xs tabular-nums text-muted-foreground">
          {t('listing-detail:media.capture.counter', label)}
        </p>
        <Button type="button" variant="outline" size="icon-sm" disabled={order.length < 2} onClick={() => step(1)}
          aria-label={t('listing-detail:media.capture.next')}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </nav>
      <p className="m-0 text-xs text-muted-foreground">{t('listing-detail:media.capture.panelHint')}</p>
      <Link href={listingPhotosHref(listingId, current)} className="text-sm underline underline-offset-2">
        {t('listing-detail:media.photosPage.openLabel', label)}
      </Link>
    </aside>
  );
}

interface PlanPickerProps {
  readonly count: number;
  readonly active: number;
  readonly onPick: (index: number) => void;
}

/** «Κάτοψη 1 · Κάτοψη 2» — μόνο όταν είναι πάνω από μία. Ο αριθμός είναι ο ίδιος με κάρτα, σελίδα κατόψεων και lightbox. */
function PlanPicker({ count, active, onPick }: PlanPickerProps) {
  const { t } = useTranslation(['listing-detail']);
  return (
    <ul aria-label={t('listing-detail:media.capture.floorplansLabel')} className="m-0 flex list-none flex-wrap gap-2 p-0">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <Button type="button" size="sm" variant={index === active ? 'default' : 'outline'} aria-pressed={index === active}
            onClick={() => onPick(index)}>
            {t('listing-detail:media.capture.floorplanTab', { index: index + 1 })}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function ListingFloorplanStage({ listing, shown, caption }: ListingFloorplanStageProps) {
  const images = listingGalleryImages(listing);
  const allSpots = listingFloorplanSpots(listing, images);
  const [picked, setPicked] = useState(0);
  const [photoParam, setPhotoParam] = useListingPhotoParam(images.length);

  // 🔑 Μία αλήθεια για το «ποια κάτοψη»: η φωτογραφία της διεύθυνσης **φέρνει** την κάτοψή της· χωρίς φωτογραφία, ο επιλογέας.
  const planOfPhoto = photoParam === null ? null : floorplanEntryOf(allSpots, photoParam);
  const planIndex = planOfPhoto === null ? Math.min(picked, shown.length - 1) : Math.max(0, shown.indexOf(planOfPhoto.floorplan));
  const floorplan = shown[planIndex];
  const spots = floorplanSpotsByUrl(allSpots).get(floorplan.value.url) ?? null;
  // Χωρίς επιλογή, η πρώτη φωτογραφία της κάτοψης: το πάνελ δεν μένει άδειο και η σκηνή δεν αλλάζει πλάτος στο πρώτο πάτημα.
  const current = spots === null ? null : planOfPhoto !== null && photoParam !== null ? photoParam : spots.photos[0].imageIndex;

  const pickPlan = (index: number): void => {
    setPhotoParam(null);
    setPicked(index);
  };

  return (
    <>
      {shown.length > 1 && <PlanPicker count={shown.length} active={planIndex} onPick={pickPlan} />}
      <div className={cn('grid grid-cols-1 gap-3', spots !== null && 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
        <ZoomStage floorplan={floorplan} spots={spots} total={images.length} current={current} onActivate={setPhotoParam} />
        {spots !== null && current !== null && (
          <SpotPhoto listingId={listing.id} images={images} spots={spots} current={current} onGo={setPhotoParam} />
        )}
      </div>
      {caption(floorplan)}
    </>
  );
}
