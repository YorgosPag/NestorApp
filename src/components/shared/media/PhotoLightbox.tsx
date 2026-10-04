'use client';

/**
 * @fileoverview **Το lightbox της συλλογής** — φωτογραφία, προηγ./επόμ., και το πάνελ «πού τραβήχτηκε» (ADR-897 Φ4).
 * @related PhotoFloorplanPanel.tsx · lib/media/photo-floorplan-spots · καλούντες: listing-detail/media/ListingPhotoLightbox
 *   (δημόσια αγγελία) · properties/detail/PropertyHeaderGallery (ιδιωτικό ακίνητο)
 * @module components/shared/media/PhotoLightbox
 *
 * 🔑 **Στενός τύπος εικόνας** (ADR-899 §4): διαβάζει μόνο ό,τι πράγματι δείχνει (`src`, `srcSet`, `alt`, διαστάσεις αν
 *   υπάρχουν).
 * 📐 **`sizes` = ό,τι ΖΩΓΡΑΦΙΖΕΤΑΙ, όχι το κουτί** (ADR-899 §3.7, Π1): με **μετρημένες** διαστάσεις και μετρημένο κουτί, το
 *   πλάτος είναι το `object-contain` (`containedWidth`) — μια κάθετη λήψη σε οριζόντιο κουτί περιορίζεται από το ύψος, άρα
 *   ο browser παίρνει τη βαθμίδα που χρειάζεται και όχι μία παραπάνω. Χωρίς διαστάσεις ή πριν τη μέτρηση ⇒ το
 *   {@link VIEWPORT_SIZES} (ποτέ επινοημένη αναλογία).
 *
 * 🔑 **Εξήχθη από το `ListingPhotosPageContent`** τη μέρα που απέκτησε πλοήγηση και πάνελ — ένα αρχείο, μία ευθύνη (N.7.1).
 * ⌨️ ← / → πλοηγούν (WCAG 2.1.1)· στην αφή, **σάρωση** οριζόντια (κατώφλι {@link SWIPE_THRESHOLD_PX}, ώστε ένα άγγιγμα να
 *   μη γίνεται αλλαγή φωτογραφίας). Τα κουμπιά υπάρχουν **πάντα** — η σάρωση είναι συντόμευση, όχι ο μόνος δρόμος (2.5.7).
 * 📐 Πλάτος ≥ lg: φωτογραφία ‖ πάνελ 22rem (Zillow). Στενή οθόνη: το πάνελ **κάτω** από τη φωτογραφία, κυλιόμενο.
 * ⚠️ Χωρίς κανένα σημείο λήψης ⇒ **κανένα** πάνελ, η φωτογραφία πιάνει όλο το πλάτος — ίδια με πριν.
 */

import { type KeyboardEvent, type PointerEvent, type RefObject, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { steppedUpperBound, useElementSize } from '@/hooks/media/useElementSize';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { indexWithin } from '@/lib/array-utils';
import { containedWidth } from '@/lib/images/image-dimensions';
import type { FloorplanSpotsEntry } from '@/lib/media/photo-floorplan-spots';
import { cn } from '@/lib/utils';

import { PhotoFloorplanPanel } from './PhotoFloorplanPanel';

/** Οριζόντια μετατόπιση (css px) πάνω από την οποία το άγγιγμα είναι σάρωση. */
const SWIPE_THRESHOLD_PX = 48;

/** Το `sizes` όταν δεν ξέρουμε τι ζωγραφίζεται — το κουτί της φωτογραφίας ως ποσοστό της οθόνης. */
export const VIEWPORT_SIZES = '(min-width: 1024px) 70vw, 95vw';

/** Σκαλοπάτι μέτρησης του κουτιού (css px): νέο `sizes` μόνο σε ουσιαστική αλλαγή, όχι σε κάθε pixel αλλαγής μεγέθους. */
const STAGE_SIZE_STEP_PX = 16;

/**
 * **Το `sizes` μιας φωτογραφίας στο κουτί της** — καθαρή συνάρτηση. Το κουτί έρχεται στρογγυλεμένο σε σκαλοπάτι ⇒
 * μετριέται ως το **άνω φράγμα** του (+½ σκαλοπατιού): υπερεκτίμηση λίγων pixel, ποτέ θόλωμα από στρογγύλευση προς τα κάτω.
 */
export function lightboxSizesOf(stage: { readonly width: number; readonly height: number }, photo: LightboxPhoto): string {
  if (!photo.width || !photo.height || stage.width === 0 || stage.height === 0) return VIEWPORT_SIZES;
  const painted = containedWidth(steppedUpperBound(stage, STAGE_SIZE_STEP_PX), { width: photo.width, height: photo.height });
  return `${Math.ceil(painted)}px`;
}

/** Το μετρημένο κουτί της φωτογραφίας ⇒ `sizes`. */
function useLightboxSizes(stageRef: RefObject<HTMLElement | null>, photo: LightboxPhoto): string {
  return lightboxSizesOf(useElementSize(stageRef, STAGE_SIZE_STEP_PX), photo);
}

/** Ό,τι χρειάζεται το lightbox για **μία** φωτογραφία — τίποτα περισσότερο. */
export interface LightboxPhoto {
  /** Σταθερό κλειδί (URL ή ταυτότητα αρχείου). */
  readonly key: string;
  readonly src: string;
  readonly srcSet?: string;
  /** Ήδη μεταφρασμένο/συντεθειμένο από τον καλούντα. */
  readonly alt: string;
  /** Εγγενείς διαστάσεις, αν είναι γνωστές (κράτηση χώρου)· αλλιώς `undefined`. */
  readonly width?: number;
  readonly height?: number;
}

export interface PhotoLightboxProps {
  readonly photos: readonly LightboxPhoto[];
  readonly floorplans: readonly FloorplanSpotsEntry[];
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
  readonly photo: LightboxPhoto;
  readonly index: number;
  readonly total: number;
  readonly onStep: (step: -1 | 1) => void;
}

/**
 * ♿ **Η σκηνή ΔΕΝ ξαναστήνεται ανά φωτογραφία — μόνο η εικόνα** (ADR-899 §9). Με `key` στη σκηνή, κάθε βήμα
 * ξανάστηνε και τα κουμπιά (η εστίαση έπεφτε σε `DIV` — μετρημένο: Enter ×3 κόλλησε στο 2/4) και το
 * `<output aria-live>` (μια live region που γεννιέται με το κείμενό της συνήθως δεν ανακοινώνεται).
 * Τα κουμπιά στο άκρο: `aria-disabled`, ώστε να ΜΕΝΟΥΝ εστιάσιμα (WAI-ARIA APG).
 */
function PhotoStage({ photo, index, total, onStep }: StageProps) {
  const { t } = useTranslation(['listing-detail']);
  const swipe = useSwipe(onStep);
  const stageRef = useRef<HTMLElement>(null);
  const sizes = useLightboxSizes(stageRef, photo);
  return (
    <section ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center p-2 touch-pan-y" {...swipe}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ράφι ή proxy παραγώγων, εκτός optimizer (ADR-841 Α12 · ADR-899) */}
      <img key={photo.key} src={photo.src} srcSet={photo.srcSet} sizes={sizes}
        width={photo.width} height={photo.height} alt={photo.alt}
        className="max-h-full max-w-full select-none object-contain" draggable={false} />
      <Button type="button" variant="secondary" size="icon" className="absolute left-3 top-1/2 -translate-y-1/2"
        aria-disabled={index === 0 || undefined} onClick={() => onStep(-1)} aria-label={t('listing-detail:media.capture.previous')}>
        <ChevronLeft aria-hidden />
      </Button>
      <Button type="button" variant="secondary" size="icon" className="absolute right-3 top-1/2 -translate-y-1/2"
        aria-disabled={index === total - 1 || undefined} onClick={() => onStep(1)} aria-label={t('listing-detail:media.capture.next')}>
        <ChevronRight aria-hidden />
      </Button>
      <output aria-live="polite" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-background/80 px-2 py-0.5 text-xs tabular-nums">
        {t('listing-detail:media.capture.counter', { index: index + 1, total })}
      </output>
    </section>
  );
}

export function PhotoLightbox({ photos, floorplans, openIndex, onNavigate }: PhotoLightboxProps) {
  const { t } = useTranslation(['listing-detail']);
  const photo = openIndex !== null ? photos[openIndex] : undefined;
  const total = photos.length;
  const step = (delta: -1 | 1) => {
    if (openIndex === null) return;
    const next = indexWithin(openIndex + delta, total, 'clamp');
    if (next !== openIndex) onNavigate(next);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
  };
  const withPanel = floorplans.length > 0;

  return (
    <Dialog open={photo !== undefined} onOpenChange={(open) => { if (!open) onNavigate(null); }}>
      <DialogContent size="fullscreen" onKeyDown={onKeyDown}
        className={cn('flex flex-col overflow-hidden bg-background/95 p-0', withPanel && 'lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]')}>
        <DialogTitle className="sr-only">
          {t('listing-detail:media.photosPage.imageTitle', { index: (openIndex ?? 0) + 1, total })}
        </DialogTitle>
        {/* ♿ Η περιγραφή λέει ό,τι δεν φαίνεται: τα βέλη αλλάζουν φωτογραφία (ADR-897 §6 — η Radix ζητούσε περιγραφή). */}
        <DialogDescription className="sr-only">{t('listing-detail:media.photosPage.keyboardHint')}</DialogDescription>
        {photo !== undefined && openIndex !== null && (
          <>
            <PhotoStage photo={photo} index={openIndex} total={total} onStep={step} />
            {withPanel && (
              <PhotoFloorplanPanel floorplans={floorplans} total={total} currentIndex={openIndex} onGo={onNavigate} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
