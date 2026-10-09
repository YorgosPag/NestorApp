'use client';

/**
 * @fileoverview **Η ΣΚΗΝΗ ΤΟΥ ΒΙΝΤΕΟ** — ένα εγγενές `<video>` που δεν κατεβάζει τίποτα πριν το ζητήσει ο άνθρωπος.
 * @related ADR-907 §10.3 (απόφαση 4) · §10.6 · types/public-listing (`PublishedVideoFile`) · ListingModelStage (αδελφή σκηνή)
 * @module components/listing-detail/media/ListingVideoStage
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΕΣΣΕΡΙΣ ΚΑΝΟΝΕΣ, ΚΑΙ ΚΑΝΕΝΑΣ ΤΟΥΣ ΔΕΝ ΕΙΝΑΙ ΥΦΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **1. ΠΟΤΕ ΑΥΤΟΜΑΤΗ ΑΝΑΠΑΡΑΓΩΓΗ, ΚΑΙ ΚΑΝΕΝΑ BYTE ΠΡΙΝ ΤΟ ΠΑΤΗΜΑ.** `preload="none"` + καμία ιδιότητα `autoPlay`. Το
 * `play()` καλείται **μέσα στη χειρονομία** του ανθρώπου — ο μόνος τρόπος που το Safari iOS το δέχεται με ήχο.
 *
 * **2. ΤΟ ΚΟΥΤΙ ΚΡΑΤΙΕΤΑΙ ΑΠΟ ΤΟ ΣΧΗΜΑ, ΟΧΙ ΑΠΟ ΤΟ ΑΡΧΕΙΟ.** Με `preload="none"` ο περιηγητής δεν ξέρει ούτε διαστάσεις
 * ούτε διάρκεια· και τα δύο είναι **μετρημένα** στο δημοσιευμένο έγγραφο. `width`/`height` δίνουν την αναλογία (CLS,
 * ADR-777 Α19) — κατακόρυφο βίντεο κινητού μένει κατακόρυφο, με ταβάνι `70vh`.
 *
 * **3. Η ΔΙΑΡΚΕΙΑ ΛΕΓΕΤΑΙ ΠΡΙΝ ΤΟ ΠΑΤΗΜΑ.** Τα εγγενή χειριστήρια με `preload="none"` γράφουν `0:00` — ο επισκέπτης με
 * δεδομένα κινητής δεν θα ήξερε αν ζητά 10″ ή 2′. Γι' αυτό τα χειριστήρια εμφανίζονται **μετά** το πάτημα, και πριν
 * από αυτό μιλά το δικό μας κουμπί, με τον αριθμό του εγγράφου.
 *
 * **4. ΤΟ ΕΞΩΦΥΛΛΟ ΕΙΝΑΙ `<img srcset>`, ΟΧΙ `poster`.** Η ιδιότητα `poster` δέχεται **μία** διεύθυνση — θα έστελνε το
 * μεγαλύτερο παράγωγο σε κάθε κινητό. Το εξώφυλλο είναι raster του ίδιου ραφιού με παράγωγα ανά πλάτος, άρα ζωγραφίζεται
 * όπως κάθε φωτογραφία της αγγελίας. `null` ⇒ ουδέτερο πλαίσιο που **λέει** τι είναι· ποτέ ξένη φωτογραφία στη θέση του.
 *
 * ⚠️ **Χωρίς `next/dynamic`, επίτηδες**: πίσω από αυτό το φύλλο δεν υπάρχει βιβλιοθήκη (το μοντέλο κρύβει 1 MB· εδώ
 * είναι ένα στοιχείο HTML). Ένα όριο θα αγόραζε μηδέν bytes και θα κόστιζε ένα καρέ «φορτώνει». Η σκηνή αποδίδεται
 * ούτως ή άλλως **μόνο** όταν ανοίξει η καρτέλα της.
 */

import React from 'react';
import { Play } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import { formatMediaClock } from '@/lib/media/media-clock';
import { cn } from '@/lib/utils';
import type { ListingImage, PublishedVideoFile } from '@/types/public-listing';

import { LEAD_SIZES } from '../ListingGallery';
import { LISTING_STAGE_NOTICE_BOX, ListingStageFailure } from '../ListingStageFailure';

/**
 * - `idle` — τίποτα δεν ζητήθηκε· μιλά το δικό μας κουμπί.
 * - `loading` — ο άνθρωπος πάτησε· το πρώτο καρέ δεν έφτασε ακόμη.
 * - `revealed` — τα εγγενή χειριστήρια έχουν τον έλεγχο (παίζει, ή ο περιηγητής αρνήθηκε το `play()` και το πατά ο ίδιος).
 * - `failed` — το αρχείο δεν φόρτωσε· ονομασμένο, με επανάληψη.
 */
type StageState = 'idle' | 'loading' | 'revealed' | 'failed';

/** Το ταβάνι ύψους της σκηνής — ίδιο με της κορυφαίας φωτογραφίας (`LEAD_FRAME`), ώστε τίτλος και τιμή να μένουν στην πρώτη οθόνη. */
const VIDEO_FRAME = 'block h-auto max-h-[70vh] w-full';

/** Το κουτί της αποτυχίας: η σκηνή δεν υπάρχει πια για να δώσει αναλογία, άρα παίρνει την ουδέτερη του μέσου. */
const FAILURE_BOX = `${LISTING_STAGE_NOTICE_BOX} aspect-video`;

/** Ο περιηγητής αρνήθηκε να παίξει χωρίς δική του χειρονομία — δεν είναι αποτυχία του αρχείου. */
function isPlaybackRefusal(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === 'NotAllowedError';
}

/** Η μηχανή καταστάσεων της σκηνής — χωριστά από τη ζωγραφική, ώστε να διαβάζεται ολόκληρη σε μία οθόνη. */
function useVideoStage() {
  const element = React.useRef<HTMLVideoElement>(null);
  const [state, setState] = React.useState<StageState>('idle');
  // Νέο στοιχείο σε κάθε επανάληψη: ένα `<video>` που απέτυχε κρατά το σφάλμα του ως να του ζητηθεί ρητά νέα φόρτωση.
  const [attempt, setAttempt] = React.useState(0);

  const onPlay = React.useCallback(() => {
    setState('loading');
    // ⚠️ Συγχρονισμένα μέσα στη χειρονομία. Το `?.` καλύπτει και περιηγητές όπου το `play()` δεν επιστρέφει υπόσχεση.
    element.current?.play()?.catch((reason: unknown) => {
      if (isPlaybackRefusal(reason)) setState('revealed');
    });
  }, []);
  const onPlaying = React.useCallback(() => setState('revealed'), []);
  const onFailed = React.useCallback(() => setState('failed'), []);
  const onRetry = React.useCallback(() => {
    setAttempt((count) => count + 1);
    setState('idle');
  }, []);

  return { element, state, attempt, onPlay, onPlaying, onFailed, onRetry };
}

export interface ListingVideoStageProps {
  readonly video: PublishedVideoFile;
  /** Η πρόταση «τι είναι και τίνος» — ήδη μεταφρασμένη από το φύλλο που κρατά το `altKey`. */
  readonly alt: string;
}

export function ListingVideoStage({ video, alt }: ListingVideoStageProps) {
  const { t } = useTranslation(['listing-detail']);
  const { element, state, attempt, onPlay, onPlaying, onFailed, onRetry } = useVideoStage();

  if (state === 'failed') {
    return (
      <ListingStageFailure
        boxClassName={FAILURE_BOX}
        message={t('listing-detail:video.failed')}
        retryLabel={t('listing-detail:video.retry')}
        onRetry={onRetry}
      />
    );
  }

  return (
    <figure className="relative overflow-hidden rounded-lg border border-border bg-muted">
      <video
        key={attempt}
        ref={element}
        src={video.url}
        width={video.width}
        height={video.height}
        controls={state === 'revealed'}
        playsInline
        preload="none"
        aria-label={alt}
        onPlaying={onPlaying}
        onError={onFailed}
        className={VIDEO_FRAME}
      />

      {state !== 'revealed' && video.poster !== null && <StagePoster poster={video.poster} />}
      {state === 'idle' && <StageInvitation video={video} alt={alt} onPlay={onPlay} />}
      {state === 'loading' && (
        <p aria-live="polite" className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <StageChip>{t('listing-detail:video.loading')}</StageChip>
        </p>
      )}
    </figure>
  );
}

/**
 * Το κουμπί πριν το πάτημα — **αληθινό περιεχόμενο στο πρώτο καρέ** (ADR-777 Α19 κανόνας 30): λέει τι υπάρχει, πόσο
 * διαρκεί και τι θα γίνει αν το πατήσεις. Χωρίς εξώφυλλο, η πρόταση `alt` γίνεται **ορατό** κείμενο.
 */
function StageInvitation({ video, alt, onPlay }: ListingVideoStageProps & { readonly onPlay: () => void }) {
  const { t } = useTranslation(['listing-detail']);
  const clock = formatMediaClock(video.durationSec);

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={t('listing-detail:video.playLabel', { duration: clock })}
      className="group absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center focus-visible:outline-none sm:p-4"
    >
      {video.poster === null && <span className="text-sm text-muted-foreground">{alt}</span>}
      <StageChip className="group-hover:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
        {/* Μετρημένο στα 320px με πλατύ κλιπ (κουτί 262×120): χωρίς αυτό η ετικέτα έσπαγε σε δύο γραμμές μέσα στο χάπι. */}
        <span className="whitespace-nowrap">{t('listing-detail:video.play')}</span>
        <span className="tabular-nums text-muted-foreground">{clock}</span>
      </StageChip>
    </button>
  );
}

/**
 * Το εξώφυλλο — διακοσμητικό **εδώ** (`alt=""`): το όνομα της σκηνής το λέει ήδη το κουμπί από πάνω του και το
 * `aria-label` του `<video>`. Δεύτερη ανάγνωση της ίδιας πρότασης θα ήταν θόρυβος σε αναγνώστη οθόνης.
 */
function StagePoster({ poster }: { readonly poster: ListingImage }) {
  return (
    /*
      eslint-disable-next-line @next/next/no-img-element -- η πηγή είναι το δημόσιο ράφι (content-addressed, εκτός
      optimizer)· βλ. ADR-777 §8.11 και ADR-841 Α12.
    */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={poster.url}
      srcSet={listingImageSrcSet(poster)}
      sizes={LEAD_SIZES}
      width={poster.width}
      height={poster.height}
      alt=""
      loading="lazy"
      decoding="async"
      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
    />
  );
}

/** Η ετικέτα πάνω στη σκηνή: αδιαφανής επιφάνεια του θέματος, ώστε να διαβάζεται πάνω σε **οποιοδήποτε** εξώφυλλο. */
function StageChip({ className, children }: { readonly className?: string; readonly children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </span>
  );
}
