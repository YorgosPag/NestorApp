'use client';

/**
 * @fileoverview **Ζ4 ΔΟΜΗΜΕΝΗ ΣΤΗ ΦΟΡΜΑ** — «*η νότια πλευρά της Μεγάλου Αλεξάνδρου, μόνο αυτά τα 200 μέτρα*».
 * @related ADR-777 · SPEC-777B §12.2 · types/property-demand.ts (`DemandPlace.frontage`)
 * @module components/demand/form/DemandFrontageField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΦΑΣΙΚΗ ΧΕΙΡΟΝΟΜΙΑ ΠΑΝΩ ΣΤΟ **ΕΝΑ** `onPick` ΤΟΥ `PlaceMap`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο χάρτης έχει **ένα** χειριστήριο κλικ (§21.4: «ένα κλικ σε συντεταγμένες»). Το τι
 * σημαίνει το κλικ αλλάζει με τη **φάση**, όχι με νέο prop στο `PlaceMap`:
 *
 * 1. **`axis`** — κάθε κλικ προσθέτει κορυφή στον άξονα (`trace`, ανοιχτή γραμμή).
 * 2. **`preview`** — ο άξονας «κλείδωσε»· το επόμενο κλικ **κρίνει πλευρά**
 *    ({@link sideOfPolyline}) αντί να προσθέσει κορυφή, και η ζώνη ζωγραφίζεται ζωντανά
 *    με `outline` ({@link frontagePolylineOutline}). Η πλευρά έχει επίσης **ρητά
 *    κουμπιά** (αριστερά/δεξιά/και τα δύο) — το κλικ είναι **συντόμευση**, όχι η μόνη
 *    οδός, γιατί το `sideOfPolyline` απαντά μόνο `'left' | 'right'` ενώ το αίτημα
 *    επιτρέπει και `'both'`.
 *
 * 🔑 **Η φάση είναι ΤΟΠΙΚΗ κατάσταση οθόνης, όχι πεδίο του μοντέλου.** Το
 * `DemandPlace.frontage` δεν έχει «η πλευρά δεν επιλέχθηκε ακόμη» — το `side` είναι
 * πάντα μία από τις {@link FRONTAGE_SIDES} (προεπιλογή `'left'`, ίδιο ιδίωμα με το
 * `radiusKm` που κρατά προεπιλεγμένη τιμή ακόμη κι όταν ο άξονας δεν είναι ενεργός).
 * Δύο ξεχωριστές οθόνες θα ήταν ψεύτικο δίλημμα: η ζώνη προεπισκόπησης υπάρχει από τη
 * στιγμή που ο άξονας κλειδώνει, με ό,τι πλευρά/βάθος έχει ήδη η φόρμα.
 *
 * ⚠️ **Μηδέν νέα props στο `PlaceMap`** — μόνο τα υπάρχοντα `trace`/`outline`/`onPick`.
 * Το component αυτό δεν αγγίζει το `PlaceMap.tsx`.
 */

import React, { useCallback, useState } from 'react';
import { useFormContext, type UseFormRegister } from 'react-hook-form';
import { Eraser, Undo2 } from 'lucide-react';

import { PlaceMap } from '@/components/geo/PlaceMap';
import { Button } from '@/components/ui/button';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { vertexCentroid } from '@/lib/geo/geo-ring';
import { frontagePolylineOutline, isGeoPolyline, sideOfPolyline } from '@/lib/geo/geo-line';
import { DEFAULT_FRONTAGE_DEPTH_METRES, type DemandFormValues } from '@/lib/demand/demand-form-values';
import { FRONTAGE_SIDES, type FrontageSide } from '@/types/property-demand';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

import { DemandFieldset, DemandNumberField, DemandOptionsField } from './demand-field-primitives';

const NS = 'property-market';
/** Ο ίδιος χάρτης-επιφάνεια με το {@link DemandAreaOutline}, ίδια απόδοση OSM. */
const MAP_NS = 'search-results';
const K = `${NS}:demand.form.frontage`;

/**
 * Οι ετικέτες πλευράς — **πίνακας κυριολεξίας**, όχι `${K}.side${capitalize(kind)}`.
 *
 * ⚠️ Ο εξαγωγέας κλειδιών διαβάζει **τιμές σταθεράς module** (βλ. header του
 * `demand-form-labels.ts`): ένα μετασχηματισμένο template (κεφαλαιοποίηση πρώτου
 * γράμματος) θα ήταν «unresolved dynamic t()» ακριβώς όπως το `{...A, ...B}` που ήδη
 * καταγγέλθηκε εκεί. Εξάγεται ώστε το {@link DemandSummary} να μη γράψει δεύτερο
 * πίνακα για τις **ίδιες** τρεις ετικέτες.
 */
export const FRONTAGE_SIDE_LABEL_KEYS: Record<FrontageSide, string> = {
  left: `${K}.sideLeft`,
  right: `${K}.sideRight`,
  both: `${K}.sideBoth`,
};

/** Δύο φάσεις οθόνης· η τρίτη («προεπισκόπηση») συνυπάρχει με τη δεύτερη — βλ. πάνω. */
type FrontagePhase = 'axis' | 'preview';

export function DemandFrontageField(): React.ReactElement {
  const { t } = useTranslation([NS, MAP_NS]);
  const { watch, setValue, register } = useFormContext<DemandFormValues>();

  const axis = (watch('frontageAxis') ?? []) as readonly GeoPoint[];
  const side = watch('frontageSide') as FrontageSide;
  const depthMetres = watch('frontageDepthMetres');

  // ⚠️ Αρχική φάση **από τα δεδομένα**: επεξεργασία υπάρχουσας ζήτησης με ήδη
  // σχεδιασμένο άξονα ανοίγει κατευθείαν στην προεπισκόπηση — δεν ξαναρωτά τον
  // άνθρωπο να σχεδιάσει κάτι που έχει ήδη πει.
  const [phase, setPhase] = useState<FrontagePhase>(axis.length >= 2 ? 'preview' : 'axis');

  const handlePick = useCallback(
    (point: GeoPoint) => {
      if (phase === 'axis') {
        setValue('frontageAxis', [...axis, point], { shouldDirty: true });
        return;
      }
      const polyline = isGeoPolyline(axis) ? axis : null;
      if (polyline === null) return;
      const judged = sideOfPolyline(polyline, point);
      // `'on'` δεν κρίνει τίποτα — το σημείο πάτησε πάνω στον άξονα, όχι σε πλευρά.
      if (judged === 'left' || judged === 'right') {
        setValue('frontageSide', judged, { shouldDirty: true });
      }
    },
    [phase, axis, setValue],
  );

  const undoVertex = useCallback(
    () => setValue('frontageAxis', axis.slice(0, -1), { shouldDirty: true }),
    [axis, setValue],
  );

  const finishAxis = useCallback(() => setPhase('preview'), []);

  const resetAll = useCallback(() => {
    // Το όνομα οδού **δεν** σβήνει: είναι ανεξάρτητη ετικέτα, όχι μέρος του σχεδίου.
    setValue('frontageAxis', [], { shouldDirty: true });
    setValue('frontageSide', FRONTAGE_SIDES[0], { shouldDirty: true });
    setValue('frontageDepthMetres', DEFAULT_FRONTAGE_DEPTH_METRES, { shouldDirty: true });
    setPhase('axis');
  }, [setValue]);

  const polyline = isGeoPolyline(axis) ? axis : null;
  const previewOutline: GeoOutline | null =
    polyline !== null && depthMetres !== null && depthMetres > 0
      ? frontagePolylineOutline(polyline, side, depthMetres)
      : null;

  const center =
    axis.length > 0
      ? vertexCentroid(axis)
      : { lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE, lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE };

  return (
    <DemandFieldset legend={t(`${K}.legend`)} help={t(`${K}.help`)}>
      <p className="text-sm text-muted-foreground">
        {t(phase === 'axis' ? `${K}.gestureAxis` : `${K}.gestureSide`)}
      </p>

      <PlaceMap center={center} onPick={handlePick} trace={axis} outline={previewOutline} />
      <p className="text-xs text-muted-foreground">{t(`${MAP_NS}:place.attribution`)}</p>

      {phase === 'axis' ? (
        <FrontageAxisControls
          canUndo={axis.length > 0}
          canFinish={axis.length >= 2}
          onUndo={undoVertex}
          onFinish={finishAxis}
        />
      ) : (
        <FrontageSideAndDepthFields />
      )}

      <FrontageStreetNameField register={register} />

      <Button type="button" size="sm" variant="outline" onClick={resetAll}>
        <Eraser className="mr-2 size-4" aria-hidden />
        {t(`${K}.reset`)}
      </Button>
    </DemandFieldset>
  );
}

/** Φάση 1 — σχεδίαση άξονα: αναίρεση κορυφής + κλείδωμα άξονα. */
function FrontageAxisControls({
  canUndo,
  canFinish,
  onUndo,
  onFinish,
}: {
  canUndo: boolean;
  canFinish: boolean;
  onUndo: () => void;
  onFinish: () => void;
}): React.ReactElement {
  const { t } = useTranslation([NS]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onUndo} disabled={!canUndo}>
        <Undo2 className="mr-2 size-4" aria-hidden />
        {t(`${MAP_NS}:place.draw.undo`)}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onFinish} disabled={!canFinish}>
        {t(`${K}.gestureDone`)}
      </Button>
    </div>
  );
}

/** Φάση 2/3 — πλευρά (ρητά κουμπιά) + βάθος. Η ζώνη ζωγραφίζεται ήδη στον χάρτη. */
function FrontageSideAndDepthFields(): React.ReactElement {
  const { t } = useTranslation([NS]);

  return (
    <>
      <DemandFieldset legend={t(`${K}.sideLegend`)} help={t(`${K}.sideHelp`)}>
        <DemandOptionsField<FrontageSide>
          name="frontageSide"
          mode="single"
          options={FRONTAGE_SIDES}
          labelOf={(kind) => t(FRONTAGE_SIDE_LABEL_KEYS[kind])}
        />
      </DemandFieldset>

      <DemandNumberField name="frontageDepthMetres" label={t(`${K}.depthLabel`)} min={1} />
      <p className="text-sm text-muted-foreground">{t(`${K}.depthHelp`)}</p>
    </>
  );
}

/** Το όνομα της οδού — προαιρετικό, ποτέ αυθεντία (ο άξονας κρίνει). */
function FrontageStreetNameField({
  register,
}: {
  register: UseFormRegister<DemandFormValues>;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const inputId = React.useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm text-foreground">
        {t(`${K}.streetLabel`)}
      </label>
      <input
        id={inputId}
        type="text"
        placeholder={t(`${K}.streetPlaceholder`)}
        {...register('frontageStreetName')}
        className="rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}
