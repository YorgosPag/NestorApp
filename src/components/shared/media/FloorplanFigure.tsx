'use client';

/**
 * @fileoverview **Η κάτοψη ως εικόνα** — `<img>` + βέλος βορρά + ό,τι σχεδιάζεται πάνω της, με τις **πραγματικές**
 * διαστάσεις της (ADR-897 · ADR-899 §4).
 * @module components/shared/media/FloorplanFigure
 * @related lib/media/photo-floorplan-spots (η πηγή) · FloorplanSpotsFigure (σημεία πάνω της) ·
 *          components/listing-detail/ListingFloorplanFigure (προσαρμογέας δημόσιας αγγελίας)
 *
 * ⛔ **Καμία επινοημένη διάσταση.** Αν η πηγή δεν ξέρει `width/height` (ιδιωτικό `FileRecord`), τις **μετρά** η ίδια η
 * εικόνα στη φόρτωση (`naturalWidth/Height`, όπως ο επεξεργαστής `CaptureSpotEditSurface`) — και ό,τι σχεδιάζεται από
 * πάνω (`children`) αποδίδεται **μόνο** όταν υπάρχουν. Μια μαντεμένη αναλογία θα έστρεφε κάθε κώνο θέασης λάθος.
 *
 * ⚠️ **ΠΟΤΕ `priority`** *(μεταφέρθηκε από το παλιό `ListingFloorplanImage`)*: το στοιχείο **LCP** της σελίδας είναι η
 * κορυφαία φωτογραφία (ADR-841 Α2.4), και **μόνο μία** εικόνα επιτρέπεται να πάρει `fetchpriority="high"` — πολλές
 * «υψηλής» ακυρώνουν η μία την άλλη. Μια κάτοψη που θα το διεκδικούσε θα χειροτέρευε μετρήσιμα τη σελίδα για να
 * εμφανιστεί νωρίτερα κάτι που ο επισκέπτης κοιτάζει **δεύτερο**.
 *
 * ⚠️ **`object-contain` και όχι `object-cover`**: μια φωτογραφία αντέχει κόψιμο, ένα **σχέδιο όχι** — κομμένη κάτοψη
 * χάνει δωμάτια, δηλαδή λέει ψέματα για το ακίνητο.
 *
 * 🔑 Τα `sizes` είναι το **μόνο** που αποφασίζει ο καταναλωτής (πλέγμα ⟂ στήλη πλήρους πλάτους ⟂ πάνελ)· ό,τι άλλο
 * ζει εδώ, μία φορά (το jscpd το είχε πιάσει ως δίδυμο σε δύο καταναλωτές — N.18).
 *
 * ⚠️ **Εικόνα από cache**: το `load` μπορεί να έχει ήδη συμβεί πριν προσαρτηθεί ο ακροατής (hydration). Γι' αυτό η
 * μέτρηση τρέχει **και** στην προσάρτηση όταν `img.complete` — αλλιώς τα σημεία δεν θα εμφανίζονταν ποτέ.
 */

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { FloorplanNorthArrow } from '@/components/listings/capture-spots/FloorplanNorthArrow';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { radToDeg } from '@/lib/geometry/angle';
import type { FloorplanFigureSource } from '@/lib/media/photo-floorplan-spots';
import { cn } from '@/lib/utils';

export interface IntrinsicSize {
  readonly width: number;
  readonly height: number;
}

export interface FloorplanFigureProps {
  readonly source: FloorplanFigureSource;
  readonly sizes: string;
  readonly className?: string;
  /** Ό,τι σχεδιάζεται **πάνω** στην κάτοψη — καλείται μόνο με γνωστές διαστάσεις. */
  readonly children?: (size: IntrinsicSize) => ReactNode;
}

/** Οι διαστάσεις της πηγής, ή —αν λείπουν— όσες μετρήθηκαν **για αυτό το `src`**. */
function useIntrinsicSize(source: FloorplanFigureSource) {
  const ref = useRef<HTMLImageElement>(null);
  const [measured, setMeasured] = useState<{ readonly src: string; readonly size: IntrinsicSize } | null>(null);
  const known = source.width !== null && source.height !== null ? { width: source.width, height: source.height } : null;
  const mustMeasure = known === null;

  const measure = useCallback(() => {
    const image = ref.current;
    if (image === null || image.naturalWidth === 0) return;
    setMeasured({ src: source.src, size: { width: image.naturalWidth, height: image.naturalHeight } });
  }, [source.src]);

  useEffect(() => {
    if (mustMeasure && ref.current?.complete === true) measure();
  }, [mustMeasure, measure]);

  const size = known ?? (measured !== null && measured.src === source.src ? measured.size : null);
  return { ref, size, onLoad: mustMeasure ? measure : undefined };
}

export function FloorplanFigure({ source, sizes, className, children }: FloorplanFigureProps) {
  const { t } = useTranslation(['listing-detail']);
  const { ref, size, onLoad } = useIntrinsicSize(source);
  const north = source.northRad;

  return (
    <figure className={cn('relative m-0', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ράφι ή proxy παραγώγων, εκτός optimizer (ADR-841 Α12 · ADR-899) */}
      <img
        ref={ref}
        src={source.src}
        srcSet={source.srcSet}
        sizes={sizes}
        width={source.width ?? undefined}
        height={source.height ?? undefined}
        alt={source.alt}
        loading="lazy"
        decoding="async"
        onLoad={onLoad}
        className="w-full rounded-lg border border-border bg-card object-contain"
      />
      {size !== null && children?.(size)}
      {north !== null && (
        <FloorplanNorthArrow northRad={north} glyph={t('listing-detail:media.capture.northGlyph')}
          label={t('listing-detail:media.capture.northLabel', { degrees: Math.round(radToDeg(north)) % 360 })}
          className="absolute right-2 top-2" />
      )}
    </figure>
  );
}
