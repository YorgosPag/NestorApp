'use client';

/**
 * **«Έτσι θα φαίνεται»** — κάθε πλαίσιο αποδοσμένο με την **ίδια** συνάρτηση που χρησιμοποιεί η κάρτα (ADR-880).
 *
 * 🔑 **WYSIWYG εκ κατασκευής, όχι εκ προσοχής**: η μικρογραφία παίρνει κλάση από το `photoPositionClass` —
 * την ίδια που καλεί το `listingPhotoPositionClass` της δημόσιας κάρτας. Δεν υπάρχει δεύτερος υπολογισμός
 * που να μπορεί να διαφωνήσει.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';
import {
  LISTING_PHOTO_FRAMES,
  photoPositionClass,
  type ListingPhotoFrame,
} from '@/components/search-results/listing-photo-position-class';
import type { FocalPointSuggestionState } from './use-focal-point-suggestion';
import type { ImageSize } from './FocalPointSurface';

const NS = 'property-market';
const K = `${NS}:photoFocalPoint`;

/** Η λεζάντα κάθε πλαισίου — κυριολεκτικά κλειδιά, ώστε ο έλεγχος i18n να τα βλέπει (CHECK 3.8). */
const FRAME_LABEL_KEYS: Readonly<Record<ListingPhotoFrame['id'], string>> = {
  card: `${K}.frameCard`,
};

interface FocalPointPreviewsProps {
  readonly src: string;
  readonly size: ImageSize | null;
  readonly point: PhotoFocalPoint;
  readonly suggestion: FocalPointSuggestionState;
  readonly onAxis: (axis: 'x' | 'y', percent: number) => void;
}

type SuggestionStatus = 'loading' | 'unavailable' | 'none' | 'ready';

/**
 * Κλειστός πίνακας, όπως το `FRAME_LABEL_KEYS`: η `t()` δέχεται **μέλος πίνακα**, ποτέ αποτέλεσμα
 * συνάρτησης — αλλιώς ο γεννήτορας του slice (ADR-744) δεν ξέρει ποια κλειδιά ζητά η οθόνη και αρνείται.
 */
const SUGGESTION_KEYS: Readonly<Record<SuggestionStatus, string>> = {
  loading: `${K}.suggestionLoading`,
  unavailable: `${K}.suggestionUnavailable`,
  none: `${K}.suggestionNone`,
  ready: `${K}.suggestionReady`,
};

function suggestionStatus(suggestion: FocalPointSuggestionState): SuggestionStatus {
  if (suggestion.kind !== 'ready') return suggestion.kind;
  return suggestion.point === null ? 'none' : 'ready';
}

function AxisField({ axis, value, label, onAxis }: {
  readonly axis: 'x' | 'y';
  readonly value: number;
  readonly label: string;
  readonly onAxis: FocalPointPreviewsProps['onAxis'];
}) {
  const id = React.useId();
  return (
    <p className="m-0 flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(event) => onAxis(axis, event.currentTarget.valueAsNumber)}
      />
    </p>
  );
}

export function FocalPointPreviews({ src, size, point, suggestion, onAxis }: FocalPointPreviewsProps) {
  const { t } = useTranslation([NS]);

  return (
    <aside className="flex flex-col gap-3">
      <h3 className="m-0 text-sm font-semibold text-foreground">{t(`${K}.previewTitle`)}</h3>
      {size !== null && LISTING_PHOTO_FRAMES.map((frame) => (
        <figure key={frame.id} className="m-0 flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- ίδιο πρωτότυπο με την επιφάνεια */}
          <img
            src={src}
            alt=""
            className={`${frame.aspectClass} w-full rounded-md border border-border object-cover ${photoPositionClass(size, frame.aspect, point)}`}
          />
          <figcaption className="text-xs text-muted-foreground">{t(FRAME_LABEL_KEYS[frame.id])}</figcaption>
        </figure>
      ))}
      <fieldset className="m-0 grid grid-cols-2 gap-2 border-0 p-0">
        <AxisField axis="x" value={point.x} label={t(`${K}.xLabel`)} onAxis={onAxis} />
        <AxisField axis="y" value={point.y} label={t(`${K}.yLabel`)} onAxis={onAxis} />
      </fieldset>
      <p aria-live="polite" className="m-0 text-xs text-muted-foreground">{t(SUGGESTION_KEYS[suggestionStatus(suggestion)])}</p>
    </aside>
  );
}
