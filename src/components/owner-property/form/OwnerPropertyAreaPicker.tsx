'use client';

/**
 * @fileoverview **«ΣΕ ΠΟΙΑ ΠΕΡΙΟΧΗ ΕΙΝΑΙ;»** — όταν η διεύθυνση εντοπίστηκε μόνο ως τον δήμο (ADR-890 §21).
 * @related `hooks/geo/useDeclarableAreas.ts` · `app/api/places/declarable-areas/route.ts` · `OwnerPropertyPlaceField.tsx`
 * @module components/owner-property/form/OwnerPropertyAreaPicker
 *
 * 🔑 **Εμφανίζεται ΜΟΝΟ όταν χρειάζεται**: θέση που ήδη φτάνει ως την κοινότητα (πινέζα, ακριβής διεύθυνση) δεν έχει
 * τι να δηλώσει — η ερώτηση θα ήταν θόρυβος. Ο κανόνας «φτάνει;» είναι ο ΕΝΑΣ (`deepestAdminLevelFor`), όχι δεύτερος.
 *
 * 🔑 **Η πρόταση της μηχανής ΔΕΝ γίνεται δήλωση μόνη της** (ADR-842 Α7, Google Address Validation `inferred`): τη
 * δείχνουμε με το όνομά της και ο άνθρωπος την **επιβεβαιώνει** με ένα πάτημα — ή διαλέγει άλλη.
 *
 * ⚠️ **Οι επιλογές είναι ό,τι ο server θα δεχόταν** (ίδιος κριτής): η φόρμα δεν μπορεί να προσφέρει δήλωση που η
 * αποθήκευση θα απορρίψει. Και η θέση στον χάρτη **δεν αλλάζει** — δηλώνεται περιοχή, όχι σημείο.
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useDeclarableAreas, type DeclarableAreasState } from '@/hooks/geo/useDeclarableAreas';
import { ADMIN_LEVEL } from '@/lib/geo/admin-area-index-file';
import { deepestAdminLevelFor } from '@/lib/geo/admin-area-of-point';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';
import { ClearableSelect } from '@/components/ui/clearable-select';
import { SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select';
import type { DeclarableAreaOption } from '@/app/api/places/declarable-areas/route';
import type { ListingPosition } from '@/types/public-listing';

const K = 'property-market:offer.form.area';

/** Οι ομάδες, από το στενότερο: ο άνθρωπος ξέρει πρώτα το χωριό του. */
const GROUP_LEVELS = [ADMIN_LEVEL.settlement, ADMIN_LEVEL.community, ADMIN_LEVEL.municipalUnit] as const;

interface OwnerPropertyAreaPickerProps {
  /** Η θέση όπως θα την κρίνει ο server — `null` όσο δεν έχει λυθεί. */
  readonly position: ListingPosition | null;
  /** Η τοποθεσία που αναγνώρισε ο geocoder, για την πρόταση — `null` όταν δεν υπάρχει φρέσκια απάντηση. */
  readonly locality: string | null;
}

/** Χρειάζεται δήλωση; — μόνο όταν η θέση δεν δικαιολογεί βάθος ως την κοινότητα. */
function needsDeclaration(position: ListingPosition | null): position is Extract<ListingPosition, { kind: 'known' }> {
  if (position === null || position.kind === 'unknown') return false;
  const deepest = deepestAdminLevelFor(position);
  return deepest !== null && deepest < ADMIN_LEVEL.community;
}

function AreaOptions({ options }: { readonly options: readonly DeclarableAreaOption[] }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <>
      {GROUP_LEVELS.map((level) => {
        const group = options.filter((option) => option.level === level);
        if (group.length === 0) return null;
        return (
          <SelectGroup key={level}>
            <SelectLabel>{t(`${K}.groups.${level}`)}</SelectLabel>
            {group.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectGroup>
        );
      })}
    </>
  );
}

/** Η πρόταση της μηχανής — γίνεται δήλωση **μόνο** με το πάτημα του ανθρώπου (ADR-842 Α7). */
function AreaSuggestion({
  suggestion,
  onConfirm,
}: {
  readonly suggestion: DeclarableAreaOption;
  readonly onConfirm: () => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
      <span>{t(`${K}.suggestion`, { name: suggestion.name })}</span>
      <button
        type="button"
        onClick={onConfirm}
        className="rounded-md border border-border bg-card px-3 py-1 font-medium text-foreground"
      >
        {t(`${K}.confirm`)}
      </button>
    </p>
  );
}

interface AreaDeclaration {
  readonly needed: boolean;
  readonly state: DeclarableAreasState;
  readonly areaId: string | null;
  readonly setArea: (next: string | null) => void;
}

/** Η κατάσταση της δήλωσης: χρειάζεται; ποιες επιλογές; ποια δήλωση; — με τον καθαρισμό της μπαγιάτικης. */
function useAreaDeclaration(position: ListingPosition | null, locality: string | null): AreaDeclaration {
  const form = useFormContext<OwnerPropertyFormValues>();
  const areaId = form.watch('placeAreaId');
  const needed = needsDeclaration(position);
  const state = useDeclarableAreas(
    needed ? { point: position.point, accuracy: position.provenance === 'geocoded' ? position.accuracy : null, locality } : null,
  );
  const setArea = React.useCallback(
    (next: string | null) => form.setValue('placeAreaId', next, { shouldDirty: true }),
    [form],
  );

  // 🔑 Μια δήλωση που δεν ανήκει πια στις επιλογές της ΤΡΕΧΟΥΣΑΣ θέσης σβήνεται — αλλιώς θα ταξίδευε στον server
  //    και θα απορριπτόταν, ή χειρότερα θα έμενε ως «δηλωμένη» για σημείο που ο άνθρωπος άλλαξε.
  const options = state.kind === 'ready' ? state.options : null;
  React.useEffect(() => {
    if (areaId !== null && options !== null && !options.some((option) => option.id === areaId)) setArea(null);
  }, [areaId, options, setArea]);

  return { needed, state, areaId, setArea };
}

export function OwnerPropertyAreaPicker({ position, locality }: OwnerPropertyAreaPickerProps): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  const selectId = React.useId();
  const { needed, state, areaId, setArea } = useAreaDeclaration(position, locality);
  if (!needed) return null;

  const options = state.kind === 'ready' ? state.options : [];
  const suggestion = state.kind === 'ready' ? options.find((option) => option.id === state.suggestedId) : undefined;

  return (
    <fieldset className="space-y-2 border-t border-border pt-3">
      <legend className="text-sm font-medium text-foreground">{t(`${K}.legend`)}</legend>
      <p className="text-sm text-muted-foreground">{t(`${K}.help`)}</p>
      {state.kind === 'loading' && <p className="text-sm text-muted-foreground">{t(`${K}.loading`)}</p>}
      {state.kind === 'unavailable' && <p className="text-sm text-foreground">{t(`${K}.unavailable`)}</p>}
      {suggestion !== undefined && areaId === null && (
        <AreaSuggestion suggestion={suggestion} onConfirm={() => setArea(suggestion.id)} />
      )}
      {options.length > 0 && (
        <>
          <label htmlFor={selectId} className="sr-only">{t(`${K}.legend`)}</label>
          <ClearableSelect
            id={selectId}
            value={areaId ?? ''}
            onValueChange={(next) => setArea(next === '' ? null : next)}
            placeholder={t(`${K}.placeholder`)}
            clearLabel={t(`${K}.none`)}
          >
            <AreaOptions options={options} />
          </ClearableSelect>
        </>
      )}
    </fieldset>
  );
}
