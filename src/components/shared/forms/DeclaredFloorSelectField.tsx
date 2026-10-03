'use client';

/**
 * **Επιλογέας δηλωμένης στάθμης** — ΕΝΑ dropdown όπως idealista «Planta» / Spitogatos «Όροφος»
 * (ADR-900 §8 #2, 2β.2).
 *
 * Τιμή του πεδίου = το κλειδί `αριθμός:είδος` (`floorRefKey`, ADR-903) ή `''` (δεν απαντήθηκε). Ετικέτες από
 * τη **μία** ετικέτα ορόφου (`useFloorLabel`) — «Πυλωτή», «Ημιώροφος», «2ος Όροφος».
 *
 * ⚠️ Για ακίνητα **χωρίς** ορόφους-οντότητες (δήλωση ιδιοκτήτη). Εταιρικό κτίριο ⇒ `FloorSelectField`
 * (τιμή `floorId`).
 * ⚠️ **CHECK 3.48**: το Radix `Select` δεσμεύει το `''` ⇒ το «κενό» είναι `undefined` στο `value` και η
 * επιλογή «χωρίς όροφο» έχει δική της τιμή-φρουρό.
 */

import React from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { declaredFloorOptions, type DeclaredFloorOption } from '@/lib/floor/declared-floor-options';
import { floorRangeOptions, levelBoundOfSelect, type LevelEdge } from '@/lib/floor/floor-level-range';
import { parseFloorRefKey } from '@/lib/floor/floor-ref';

/** Τιμή-φρουρός για «χωρίς όροφο» — ποτέ `''` (CHECK 3.48). */
const NONE_VALUE = '__none__';

interface DeclaredFloorSelectFieldProps<TValues extends FieldValues> {
  readonly control: Control<TValues>;
  readonly name: FieldPath<TValues>;
  readonly label: string;
  readonly placeholder: string;
  /**
   * ADR-903 §9 (2β.3) — **άκρο εύρους** («από» / «έως» της ζήτησης): μία επιλογή ανά βαθμίδα της διάταξης
   * (`floorRangeOptions` — η πυλωτή συμπίπτει με το ισόγειο). Απόν ⇒ δηλωμένη στάθμη ακινήτου.
   */
  readonly edge?: LevelEdge;
}

/** Οι επιλογές για την τρέχουσα τιμή — δηλωμένη στάθμη ή άκρο εύρους, από το ένα `lib/floor`. */
function optionsFor(value: string, edge: LevelEdge | undefined): readonly DeclaredFloorOption[] {
  if (edge !== undefined) return floorRangeOptions(value === '' ? null : levelBoundOfSelect(value), edge);
  return declaredFloorOptions(value === '' ? null : parseFloorRefKey(value));
}

export function DeclaredFloorSelectField<TValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  edge,
}: DeclaredFloorSelectFieldProps<TValues>): React.ReactElement {
  const floorLabel = useFloorLabel();
  const labelId = React.useId();

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-sm text-foreground">
        {label}
      </span>
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const value = typeof field.value === 'string' ? field.value : '';
          const options = optionsFor(value, edge);
          return (
            <Select
              value={value === '' ? undefined : value}
              onValueChange={(next) => field.onChange(next === NONE_VALUE ? '' : next)}
            >
              <SelectTrigger ref={field.ref} aria-labelledby={labelId} onBlur={field.onBlur}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>—</SelectItem>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {floorLabel(option.ref)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }}
      />
    </div>
  );
}
