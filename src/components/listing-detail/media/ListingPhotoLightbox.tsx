'use client';

/**
 * @fileoverview **Το lightbox της συλλογής** — φωτογραφία, προηγ./επόμ., και το πάνελ «πού τραβήχτηκε» (ADR-897 Φ4).
 * @related ListingPhotosPageContent.tsx (ο κάτοχος) · PhotoFloorplanPanel.tsx · hooks/listings/useListingPhotoParam
 * @module components/listing-detail/media/ListingPhotoLightbox
 *
 * 🔑 **Εξήχθη από το `ListingPhotosPageContent`** τη μέρα που απέκτησε πλοήγηση και πάνελ — ένα αρχείο, μία ευθύνη (N.7.1).
 * ⌨️ ← / → πλοηγούν (WCAG 2.1.1)· στην αφή, **σάρωση** οριζόντια (κατώφλι {@link SWIPE_THRESHOLD_PX}, ώστε ένα άγγιγμα να
 *   μη γίνεται αλλαγή φωτογραφίας). Τα κουμπιά υπάρχουν **πάντα** — η σάρωση είναι συντόμευση, όχι ο μόνος δρόμος (2.5.7).
 * 📐 Πλάτος ≥ lg: φωτογραφία ‖ πάνελ 22rem (Zillow). Στενή οθόνη: το πάνελ **κάτω** από τη φωτογραφία, κυλιόμενο.
 * ⚠️ Χωρίς κανένα σημείο λήψης ⇒ **κανένα** πάνελ, η φωτογραφία πιάνει όλο το πλάτος — ίδια με πριν.
 */

import { type KeyboardEvent, type PointerEvent, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingFloorplanSpots } from '@/lib/listings/listing-capture-spots';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import { cn } from '@/lib/utils';
import type { ListingImage } from '@/types/public-listing';

import { PhotoFloorplanPanel } from './PhotoFloorplanPanel';

/** Οριζόντια μετατόπιση (css px) πάνω από την οποία το άγγιγμα είναι σάρωση. */
const SWIPE_THRESHOLD_PX = 48;

export interface ListingPhotoLightboxProps {
  readonly images: readonly ListingImage[];
  readonly floorplans: readonly ListingFloorplanSpots[];
  readonly openIndex: number | null;
  readonly onNavigate: (index: number | null) => void;
}

/** Σάρωση: θυμάται πού ξεκίνησε το άγγιγμα, κρίνει στο σήκωμα. Ποντίκι ⇒ τίποτα (έχει κουμπιά και πλήκτρα). */
function useSwipe(onStep: (step: -1 | 1) => void) {
  const start = useRef<number | null>(null);
  return {
    onPointerDown: (event: PointerEvent) => { start.current = event.pointerType === 'mouse' ? null : event.clientX; },
    onPointerUp: (event: PointerEvent) => {
      if (start.current === null) return;
      const dx = event.clientX - start.current;
      start.current = null;
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) onStep(dx < 0 ? 1 : -1);
    },
  };
}

interface StageProps {
  readonly image: ListingImage;
  readonly index: number;
  readonly total: number;
  readonly onStep: (step: -1 | 1) => void;
}

function PhotoStage({ image, index, total, onStep }: StageProps) {
  const { t } = useTranslation(['listing-detail']);
  const swipe = useSwipe(onStep);
  return (
    <section className="relative flex min-h-0 flex-1 items-center justify-center p-2 touch-pan-y" {...swipe}>
      {/* eslint-disable-next-line @next/next/no-img-element -- δημόσιο ράφι, εκτός optimizer (ADR-841 Α12) */}
      <img src={image.url} srcSet={listingImageSrcSet(image)} sizes="(min-width: 1024px) 70vw, 95vw"
        width={image.width} height={image.height} alt={t(image.altKey, { index: index + 1, total })}
        className="max-h-full max-w-full select-none object-contain" draggable={false} />
      <Button type="button" variant="secondary" size="icon" className="absolute left-3 top-1/2 -translate-y-1/2"
        disabled={index === 0} onClick={() => onStep(-1)} aria-label={t('listing-detail:media.capture.previous')}>
        <ChevronLeft aria-hidden />
      </Button>
      <Button type="button" variant="secondary" size="icon" className="absolute right-3 top-1/2 -translate-y-1/2"
        disabled={index === total - 1} onClick={() => onStep(1)} aria-label={t('listing-detail:media.capture.next')}>
        <ChevronRight aria-hidden />
      </Button>
      <output aria-live="polite" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-background/80 px-2 py-0.5 text-xs tabular-nums">
        {t('listing-detail:media.capture.counter', { index: index + 1, total })}
      </output>
    </section>
  );
}

export function ListingPhotoLightbox({ images, floorplans, openIndex, onNavigate }: ListingPhotoLightboxProps) {
  const { t } = useTranslation(['listing-detail']);
  const image = openIndex !== null ? images[openIndex] : undefined;
  const total = images.length;
  const step = (delta: -1 | 1) => {
    if (openIndex === null) return;
    const next = openIndex + delta;
    if (next >= 0 && next < total) onNavigate(next);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
  };
  const withPanel = floorplans.length > 0;

  return (
    <Dialog open={image !== undefined} onOpenChange={(open) => { if (!open) onNavigate(null); }}>
      <DialogContent size="fullscreen" onKeyDown={onKeyDown}
        className={cn('flex flex-col overflow-hidden bg-background/95 p-0', withPanel && 'lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]')}>
        <DialogTitle className="sr-only">
          {t('listing-detail:media.photosPage.imageTitle', { index: (openIndex ?? 0) + 1, total })}
        </DialogTitle>
        {/* ♿ Η περιγραφή λέει ό,τι δεν φαίνεται: τα βέλη αλλάζουν φωτογραφία (ADR-897 §6 — η Radix ζητούσε περιγραφή). */}
        <DialogDescription className="sr-only">{t('listing-detail:media.photosPage.keyboardHint')}</DialogDescription>
        {image !== undefined && openIndex !== null && (
          <>
            <PhotoStage image={image} index={openIndex} total={total} onStep={step} />
            {withPanel && (
              <PhotoFloorplanPanel floorplans={floorplans} total={total} currentIndex={openIndex} onGo={onNavigate} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
