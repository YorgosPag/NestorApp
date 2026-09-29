'use client';

/**
 * @fileoverview **ΤΑ ΣΤΟΙΧΕΙΑ ΕΝΟΣ ΧΩΡΟΥ** — όνομα (Δ8.5), μετρημένο εμβαδόν «≈», δηλωμένο με υποχρεωτική πηγή (Δ8.4 · Δ8.6) και ο
 * φύλακας 15% (Δ9.4) — κοινά για πρόταση και εγκεκριμένο χώρο (ADR-884 Φ2στ-γ Γ3γ-2β).
 * @related `../TourRoomFields.tsx` (τα πεδία ονόματος — ΙΔΙΑ με του σημείου) · `lib/spatial-tour/space-edit/declared-area-input.ts`
 *   · `lib/spatial-tour/viewer/tour-space-view.ts` (`declaredAreaDeviates`)
 * @module components/spatial-tour/editor/spaces/TourSpaceDetails
 *
 * 🔑 **Όνομα σημείου υπερισχύει** (Δ8.5): αν μέσα στον χώρο υπάρχει σημείο με δηλωμένο χώρο, το όνομα έρχεται από εκεί — τα πεδία
 *   εμφανίζονται μόνο για χώρο χωρίς τέτοιο σημείο (η αποθήκη).
 * 🔑 **Φύλακας = προειδοποίηση, όχι φραγή** (Revit warnings): «Δηλώσατε 20, η κάτοψη δείχνει ≈ 12 — σωστός χώρος;».
 */

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TOUR_DECLARED_AREA_SOURCES, type TourDeclaredAreaSource } from '@/constants/spatial-tour-vocabulary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { polygonArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { formatNumber } from '@/lib/intl-formatting';
import { readDeclaredArea, type DeclaredAreaInput } from '@/lib/spatial-tour/space-edit/declared-area-input';
import type { SpaceDraftDetails } from '@/lib/spatial-tour/space-edit/tour-space-proposals';
import { declaredAreaDeviates } from '@/lib/spatial-tour/viewer/tour-space-view';
import type { TourRoom } from '@/types/spatial-tour';

import { LabeledSelect } from '../../LabeledSelect';
import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import { TOUR_DECLARED_SOURCE_KEY } from '../../viewer/tour-viewer-labels';
import { TourRoomFields, useRoomDraft, type RoomDraftState } from '../TourRoomFields';
import { TOUR_SPACE_EDITOR_KEYS } from './tour-space-editor-labels';

export interface SavedSpaceDetails {
  readonly room: TourRoom | null;
  readonly declaredArea: { readonly areaM2: number; readonly source: TourDeclaredAreaSource } | null;
}

export interface SpaceDetailsState {
  readonly room: RoomDraftState;
  readonly declaredText: string;
  readonly setDeclaredText: (text: string) => void;
  readonly declaredSource: TourDeclaredAreaSource | null;
  readonly setDeclaredSource: (source: TourDeclaredAreaSource) => void;
  readonly declared: DeclaredAreaInput;
}

const areaText = (areaM2: number, decimals: number) =>
  formatNumber(areaM2, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** ⚠️ Ο κάτοχος δίνει `key` ανά σχήμα: άλλος χώρος ⇒ νέο πρόχειρο από τα αποθηκευμένα. */
export function useSpaceDetails(saved: SavedSpaceDetails): SpaceDetailsState {
  const room = useRoomDraft(saved.room);
  const [declaredText, setDeclaredText] = useState(() => (saved.declaredArea === null ? '' : areaText(saved.declaredArea.areaM2, 2)));
  const [declaredSource, setDeclaredSource] = useState<TourDeclaredAreaSource | null>(saved.declaredArea?.source ?? null);
  return { room, declaredText, setDeclaredText, declaredSource, setDeclaredSource, declared: readDeclaredArea(declaredText, declaredSource) };
}

/**
 * Τα στοιχεία προς αποστολή — `null` όσο η δήλωση δεν στέκει (άκυρη/χωρίς πηγή). `usePointName` ⇒ το όνομα **δεν** στέλνεται από
 * εδώ (έρχεται από το σημείο — Δ8.5), κρατιέται ό,τι ήταν αποθηκευμένο.
 */
export function detailsOf(state: SpaceDetailsState, saved: SavedSpaceDetails, usePointName: boolean): SpaceDraftDetails | null {
  if (state.declared.kind === 'invalid' || state.declared.kind === 'source-missing') return null;
  const draft = usePointName ? saved.room : state.room.draft;
  return {
    room: draft === null ? null : { types: draft.types, label: draft.label },
    declaredArea: state.declared.kind === 'ok' ? state.declared.value : null,
  };
}

function DeclaredFields({ idBase, state, measuredM2 }: { readonly idBase: string; readonly state: SpaceDetailsState; readonly measuredM2: number }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { declared } = state;
  const options = TOUR_DECLARED_AREA_SOURCES.map((value) => ({ value, label: t(TOUR_DECLARED_SOURCE_KEY[value]) }));
  const ids = { input: `${idBase}-declared`, hint: `${idBase}-declared-hint`, error: `${idBase}-declared-error` };
  const error = declared.kind === 'invalid' ? TOUR_SPACE_EDITOR_KEYS.declaredInvalid
    : declared.kind === 'source-missing' ? TOUR_SPACE_EDITOR_KEYS.declaredSourceRequired : null;
  const warn = declared.kind === 'ok' && declaredAreaDeviates(declared.value.areaM2, measuredM2);
  return (
    <fieldset className="m-0 space-y-2 border-0 p-0">
      <p className="m-0 space-y-1">
        <Label htmlFor={ids.input}>{t(TOUR_SPACE_EDITOR_KEYS.declared)}</Label>
        <Input id={ids.input} inputMode="decimal" value={state.declaredText} aria-invalid={declared.kind === 'invalid'}
          aria-describedby={error === null ? ids.hint : `${ids.hint} ${ids.error}`} onChange={(e) => state.setDeclaredText(e.target.value)} />
        <span id={ids.hint} className="block text-xs text-muted-foreground">{t(TOUR_SPACE_EDITOR_KEYS.declaredHint)}</span>
      </p>
      {declared.kind !== 'none' && (
        <LabeledSelect id={`${idBase}-declared-source`} label={t(TOUR_SPACE_EDITOR_KEYS.declaredSource)} value={state.declaredSource}
          placeholder={t(TOUR_SPACE_EDITOR_KEYS.declaredSourcePlaceholder)} options={options} onChange={state.setDeclaredSource} />
      )}
      {error !== null && <p id={ids.error} role="alert" className="m-0 text-xs text-destructive">{t(error)}</p>}
      {warn && (
        <p role="status" className="m-0 rounded-md border border-border bg-muted p-2 text-xs">
          {t(TOUR_SPACE_EDITOR_KEYS.declaredWarn, { declared: areaText(declared.value.areaM2, 2), measured: areaText(measuredM2, 0) })}
        </p>
      )}
    </fieldset>
  );
}

export interface TourSpaceDetailsProps {
  readonly idBase: string;
  readonly state: SpaceDetailsState;
  readonly points: readonly PlanarPoint[];
  /** Το όνομα του σημείου μέσα στον χώρο που το δίνει (Δ8.5) — `null` ⇒ ο χώρος ονομάζεται εδώ. */
  readonly pointName: string | null;
}

export function TourSpaceDetails({ idBase, state, points, pointName }: TourSpaceDetailsProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const measuredM2 = polygonArea(points);
  return (
    <>
      {pointName === null ? (
        <fieldset className="m-0 space-y-2 border-0 p-0">
          <legend className="text-sm font-medium">{t(TOUR_SPACE_EDITOR_KEYS.nameOwn)}</legend>
          <TourRoomFields idBase={`${idBase}-room`} room={state.room} />
        </fieldset>
      ) : (
        <p className="m-0 text-sm">{t(TOUR_SPACE_EDITOR_KEYS.nameFromPoint, { name: pointName })}</p>
      )}
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 text-sm">
        <dt className="text-muted-foreground">{t(TOUR_SPACE_EDITOR_KEYS.measured)}</dt>
        <dd className="m-0">{t(TOUR_SPACE_EDITOR_KEYS.measuredValue, { area: areaText(measuredM2, 0) })}</dd>
      </dl>
      <DeclaredFields idBase={idBase} state={state} measuredM2={measuredM2} />
    </>
  );
}
