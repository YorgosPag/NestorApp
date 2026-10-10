'use client';

/**
 * @fileoverview 🏢 **Η ΣΚΗΝΗ ΤΗΣ ΚΑΤΟΨΗΣ ΟΡΟΦΟΥ** — το σχέδιο του ορόφου με κάθε μονάδα του, υπόμνημα και λίστα (ADR-907 §11.9).
 * @module components/listing-detail/media/ListingFloorPlateStage
 * @related ./ListingZoomStage (το κοινό πλαίσιο) · ./FloorPlateUnitLayer (το στρώμα) · shared/media/FloorplanFigure (η εικόνα) ·
 *   ListingFloorPlates (ο κάτοχος — τη φορτώνει πίσω από όριο `next/dynamic`) · lib/listings/floor-plate/floor-plate-view
 *
 * 🔑 **Τρεις μορφές του ίδιου περιεχομένου, ένας αριθμός που τις δένει**: το σχέδιο (για το μάτι), το υπόμνημα (τι σημαίνει
 *   κάθε απόχρωση και μοτίβο) και η **λίστα μονάδων** (για αναγνώστη οθόνης, πληκτρολόγιο και όποιον δεν ξεχωρίζει χρώματα).
 *   Ο αριθμός πάνω στο σχήμα είναι ο αριθμός της γραμμής· ό,τι τονίζεται στο ένα τονίζεται και στο άλλο.
 * 🔴 **Για τον γείτονα φαίνεται ΜΟΝΟ η διαθεσιμότητά του** — ποτέ τιμή, όνομα ή ταυτότητα· το έγγραφο δεν τα κουβαλά, και
 *   η σημείωση κάτω από τη λίστα το λέει ρητά στον επισκέπτη.
 * 🔗 **Γείτονας με δική του αγγελία = σύνδεσμος** (`listingDetailHref`) — και στο σχήμα και στη γραμμή του.
 */

import { useMemo, useState } from 'react';

import { FloorplanFigure } from '@/components/shared/media/FloorplanFigure';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FLOOR_PLATE_SELF_STATE, type FloorPlateState } from '@/lib/listings/floor-plate/floor-plate-state';
import { floorPlateLegendStates, floorPlateShapes, type FloorPlateShape } from '@/lib/listings/floor-plate/floor-plate-view';
import { listingImageFigureSource } from '@/lib/listings/listing-capture-spots';
import { LISTING_FLOORPLAN_PROVENANCE_KEYS } from '@/lib/listings/listing-material';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import type { ListingFloorPlate } from '@/types/public-listing';

import { FloorPlateSwatch, FloorPlateUnitLayer } from './FloorPlateUnitLayer';
import { ListingZoomStage, ZOOM_STAGE_IMAGE } from './ListingZoomStage';

/**
 * Η λέξη κάθε κατάστασης — το **τρίτο** κανάλι, δίπλα σε χρώμα και μοτίβο. `Record` πάνω στο λεξιλόγιο: πέμπτη
 * κατάσταση δεν μεταγλωττίζεται χωρίς λέξη.
 */
const STATE_LABEL_KEYS: Readonly<Record<FloorPlateState, string>> = {
  self: 'listing-detail:floorPlate.state.self',
  available: 'listing-detail:floorPlate.state.available',
  reserved: 'listing-detail:floorPlate.state.reserved',
  unavailable: 'listing-detail:floorPlate.state.unavailable',
};

function useStateLabel(): (state: FloorPlateState) => string {
  const { t } = useTranslation(['listing-detail']);
  return (state) => t(STATE_LABEL_KEYS[state]);
}

function Legend({ states }: { readonly states: readonly FloorPlateState[] }) {
  const { t } = useTranslation(['listing-detail']);
  const labelOf = useStateLabel();
  return (
    <ul aria-label={t('listing-detail:floorPlate.legend')} data-floor-plate-legend=""
      className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
      {states.map((state) => (
        <li key={state} className="flex items-center gap-2 text-xs text-foreground">
          <FloorPlateSwatch state={state} />
          {labelOf(state)}
        </li>
      ))}
    </ul>
  );
}

interface UnitRowProps {
  readonly shape: FloorPlateShape;
  readonly emphasised: boolean;
  readonly onActive: (unitNumber: number | null) => void;
}

/** Μία μονάδα ως κείμενο: αριθμός (ίδιος με το σχέδιο), κατάσταση με τη λέξη της, και σύνδεσμος όταν έχει αγγελία. */
function UnitRow({ shape, emphasised, onActive }: UnitRowProps) {
  const { t } = useTranslation(['listing-detail']);
  const labelOf = useStateLabel();
  const self = shape.state === FLOOR_PLATE_SELF_STATE;
  const state = labelOf(shape.state);
  const highlight = { onPointerEnter: () => onActive(shape.number), onPointerLeave: () => onActive(null) };

  return (
    <li {...highlight} onFocus={highlight.onPointerEnter} onBlur={highlight.onPointerLeave}
      aria-current={self ? 'true' : undefined} data-floor-plate-row={shape.number}
      className={cn('flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-2 py-1 text-sm', emphasised && 'bg-muted')}>
      <FloorPlateSwatch state={shape.state} />
      <span className={cn('text-foreground', self && 'font-semibold')}>
        {t('listing-detail:floorPlate.unit', { number: shape.number })}
      </span>
      <span className="text-muted-foreground">{state}</span>
      {shape.listingId !== null && (
        <Link href={listingDetailHref(shape.listingId)} className="underline underline-offset-2"
          aria-label={t('listing-detail:floorPlate.openListingLabel', { number: shape.number, state })}>
          {t('listing-detail:floorPlate.openListing')}
        </Link>
      )}
    </li>
  );
}

export interface ListingFloorPlateStageProps {
  /** Η κάτοψη που **παρουσιάζεται** — την έκρινε ήδη ο κάτοχος (`presentableFloorPlate`). */
  readonly plate: ListingFloorPlate;
}

export function ListingFloorPlateStage({ plate }: ListingFloorPlateStageProps) {
  // `search-results`: εκεί ζουν οι προτάσεις προέλευσης της κάτοψης (παγωμένα κλειδιά, ADR-845 Ο-7).
  const { t } = useTranslation(['listing-detail', 'search-results']);
  const [active, setActive] = useState<number | null>(null);
  const { image, units } = plate.value;
  const shapes = useMemo(
    () => floorPlateShapes(units, { width: image.width, height: image.height }),
    [units, image.width, image.height],
  );

  return (
    <>
      <ListingZoomStage contentKey={image.url}>
        {(sizes) => (
          <FloorplanFigure source={listingImageFigureSource(image, t(image.altKey))} sizes={sizes}
            imageClassName={ZOOM_STAGE_IMAGE}>
            {(size) => <FloorPlateUnitLayer size={size} shapes={shapes} active={active} onActive={setActive} />}
          </FloorplanFigure>
        )}
      </ListingZoomStage>

      <Legend states={floorPlateLegendStates(shapes)} />

      <ol aria-label={t('listing-detail:floorPlate.units')} data-floor-plate-units=""
        className="m-0 grid list-none grid-cols-1 gap-x-4 p-0 sm:grid-cols-2">
        {shapes.map((shape) => (
          <UnitRow key={shape.number} shape={shape} emphasised={shape.number === active} onActive={setActive} />
        ))}
      </ol>

      <p className="m-0 text-xs text-muted-foreground">{t('listing-detail:floorPlate.neighboursNote')}</p>
      {/* 🏆 Η προέλευση του σχεδίου — ο ίδιος πίνακας με την κάτοψη της μονάδας, όχι δεύτερη χαρτογράφηση. */}
      <p className="m-0 text-xs text-muted-foreground">{t(LISTING_FLOORPLAN_PROVENANCE_KEYS[plate.provenance])}</p>
    </>
  );
}
