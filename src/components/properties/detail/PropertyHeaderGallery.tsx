'use client';

/**
 * @fileoverview 📷 **Η ΓΚΑΛΕΡΙ ΤΗΣ ΚΕΦΑΛΙΔΑΣ ΑΚΙΝΗΤΟΥ** — όλες οι φωτογραφίες στο κουτί 12rem, κλικ ⇒ lightbox με το
 * πάνελ «πού τραβήχτηκε» (ADR-899 §9 · ADR-897 · ADR-777 §8.30).
 * @module components/properties/detail/PropertyHeaderGallery
 * @related shared/gallery/SnapGallery (το κέλυφος) · shared/media/PhotoLightbox · hooks/usePropertyThumbnail (`usePropertyPhotos`) ·
 *          hooks/usePropertyFloorplanSpots · lib/files/file-display-url (`preview` = παράγωγα κατ' απαίτηση)
 *
 * 🔑 **Λεπτό περιτύλιγμα** — δεύτερος καλών του κελύφους μετά το `ListingCardGallery`· κανένα τρίτο carousel.
 * 🔑 **Παράγωγα, όχι πρωτότυπα**: κάθε `<img>` ζητά από την κλίμακα 320…2560 όσο χρειάζεται το κουτί (`sizes`). Πριν,
 *   η κεφαλίδα κατέβαζε ολόκληρο το πρωτότυπο (2–3 MB) για ένα κουτί 192×128.
 * 🔑 **Σταθερό κουτί** (`h-32 w-full sm:w-48`) σε κάθε κατάσταση — φόρτωση, αποτυχία, κενό, γκαλερί ⇒ CLS 0.
 * ♿ Δεν είναι πια διακοσμητική: ο άνθρωπος **πλοηγείται** σε αυτή ⇒ κάθε εικόνα έχει `alt` («τίτλος — Φωτογραφία N
 *   από M») και κάθε slide είναι **κουμπί** που λέει τι κάνει. Μία μόνο εικόνα `fetchpriority="high"` (ADR-841 Α2.4).
 * 🔴 **Η αποτυχία φαίνεται**: πριν, σφάλμα ανάγνωσης και «καμία φωτογραφία» έβγαζαν το ίδιο σπιτάκι.
 */

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ImageOff, MapPinned } from 'lucide-react';

import { SnapGallery } from '@/components/shared/gallery/SnapGallery';
import type { LightboxPhoto } from '@/components/shared/media/PhotoLightbox';
import { Skeleton } from '@/components/ui/skeleton';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { usePropertyFloorplanSpots } from '@/features/property-grid/hooks/usePropertyFloorplanSpots';
import { usePropertyPhotos } from '@/features/property-grid/hooks/usePropertyThumbnail';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PropertyPhoto } from '@/lib/properties/property-photos';
import type { Property } from '@/types/property-viewer';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

const PhotoLightbox = dynamic(() => import('@/components/shared/media/PhotoLightbox').then((m) => m.PhotoLightbox), { ssr: false });

const PropertyIcon = NAVIGATION_ENTITIES.property.icon;

/** Το κουτί είναι 12rem από `sm` και πάνω, όλο το πλάτος στο κινητό. */
const HEADER_PHOTO_SIZES = '(min-width: 640px) 12rem, 100vw';
const NO_PHOTOS: readonly PropertyPhoto[] = [];
/** Πάνω σε φωτογραφία το φόντο είναι άγνωστο ⇒ σταθερό σκούρο + λευκό, όπως τα βελάκια του κελύφους. */
const ON_PHOTO_CHIP = 'pointer-events-none absolute z-20 rounded bg-black/55 text-white';

type Translate = ReturnType<typeof useTranslation>['t'];

function photoAlt(t: Translate, photo: PropertyPhoto, index: number, total: number): string {
  return t('common-photos:photoPreview.alt.gallery', { title: photo.title, current: index + 1, total });
}

interface SlideProps {
  readonly photo: PropertyPhoto;
  readonly index: number;
  readonly total: number;
  readonly onOpen: (index: number) => void;
}

function HeaderPhotoSlide({ photo, index, total, onOpen }: SlideProps) {
  const { t } = useTranslation(['properties-detail', 'common-photos', 'listing-detail']);
  const first = index === 0;
  return (
    <button type="button" onClick={() => onOpen(index)} className="relative block h-32 w-full cursor-zoom-in"
      aria-label={t('listing-detail:media.photosPage.openLabel', { index: index + 1, total })}>
      {/* eslint-disable-next-line @next/next/no-img-element -- proxy παραγώγων κατ' απαίτηση, εκτός optimizer (ADR-899) */}
      <img src={photo.preview?.src ?? photo.url} srcSet={photo.preview?.srcSet} sizes={HEADER_PHOTO_SIZES}
        alt={photoAlt(t, photo, index, total)} loading={first ? 'eager' : 'lazy'} fetchPriority={first ? 'high' : 'auto'}
        decoding="async" draggable={false} className="h-32 w-full object-cover" />
      {photo.hasCaptureSpot && (
        <span className={`${ON_PHOTO_CHIP} left-1.5 top-1.5 p-0.5`}>
          <MapPinned aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{t('properties-detail:detailPage.photos.captureSpot')}</span>
        </span>
      )}
    </button>
  );
}

function PhotoCounter({ index, total }: { readonly index: number; readonly total: number }) {
  const { t } = useTranslation(['listing-detail']);
  if (total < 2) return null;
  return (
    <output aria-live="polite" className={`${ON_PHOTO_CHIP} right-1.5 top-1.5 px-1.5 text-xs tabular-nums`}>
      {t('listing-detail:media.capture.counter', { index: index + 1, total })}
    </output>
  );
}

function useLightboxPhotos(photos: readonly PropertyPhoto[]): readonly LightboxPhoto[] {
  const { t } = useTranslation(['common-photos']);
  return useMemo(() => photos.map((photo, index) => ({
    key: photo.fileId,
    src: photo.preview?.src ?? photo.url,
    srcSet: photo.preview?.srcSet,
    alt: photoAlt(t, photo, index, photos.length),
  })), [photos, t]);
}

function GalleryState({ state, onOpen }: { readonly state: ReturnType<typeof usePropertyPhotos>; readonly onOpen: (index: number) => void }) {
  const { t } = useTranslation(['properties-detail']);
  const colors = useSemanticColors();
  if (state.kind === 'loading') return <Skeleton className="h-full w-full" />;
  if (state.kind === 'failed') {
    return (
      <span role="status" className={`flex h-full w-full flex-col items-center justify-center gap-1 text-xs ${colors.text.muted}`}>
        <ImageOff className="h-8 w-8" aria-hidden="true" />
        {t('properties-detail:detailPage.photos.loadFailed')}
      </span>
    );
  }
  const { photos } = state;
  if (photos.length === 0) {
    return (
      <span className="flex h-full w-full items-center justify-center">
        <PropertyIcon className={`h-10 w-10 ${colors.text.muted}`} aria-hidden="true" />
      </span>
    );
  }
  return (
    <SnapGallery count={photos.length} slideKey={(index) => photos[index].fileId} keyboard
      renderSlide={(index) => <HeaderPhotoSlide photo={photos[index]} index={index} total={photos.length} onOpen={onOpen} />}
      renderOverlay={(index, total) => <PhotoCounter index={index} total={total} />} />
  );
}

export function PropertyHeaderGallery({ property }: { readonly property: Property }) {
  const colors = useSemanticColors();
  const { radius } = useBorderTokens();
  const state = usePropertyPhotos(property);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const photos = state.kind === 'ready' ? state.photos : NO_PHOTOS;
  const wantsFloorplans = openIndex !== null && photos.some((photo) => photo.hasCaptureSpot);
  const floorplans = usePropertyFloorplanSpots(property, photos, wantsFloorplans);
  const lightboxPhotos = useLightboxPhotos(photos);

  return (
    <figure className={`m-0 shrink-0 overflow-hidden ${radius.lg} ${colors.bg.muted} h-32 w-full sm:w-48`}>
      <GalleryState state={state} onOpen={setOpenIndex} />
      {openIndex !== null && (
        <PhotoLightbox photos={lightboxPhotos} floorplans={floorplans} openIndex={openIndex} onNavigate={setOpenIndex} />
      )}
    </figure>
  );
}
