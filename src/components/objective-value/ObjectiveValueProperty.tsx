'use client';

/**
 * **Βήμα 2 — το ακίνητο** (ADR-898 Φ2): είδος (έντυπο 1 / 4 / 5), επίπεδα με όροφο και επιφάνεια (κατοικία, και
 * μεζονέτα), ή επιφάνεια και θέση (αποθήκη / θέση στάθμευσης). Αυτά ζητούνται **πάντα** — χωρίς αυτά η μηχανή δεν
 * ξέρει ούτε ποιες άλλες ερωτήσεις μετρούν.
 */

import React, { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LevelDraft, ObjectiveValueDraft, UpdateDraft } from '@/lib/objective-value/objective-value-draft';
import { OBJECTIVE_VALUE_FORMS, PARKING_POSITIONS, STORAGE_POSITIONS } from '@/lib/objective-value/objective-value-types';

import { CalculatorStep, ChoiceSelect, LabelledNumber } from './objective-value-inputs';

const NS = 'objective-value';

/** Όροφος → γραμμή του πίνακα του άρθ. 3 §4 (`< 0` υπόγειο · `0` ισόγειο · … · ΣΤ' και πάνω ίδια στήλη). */
const FLOORS = {
  '-1': 'basement',
  '0': 'ground',
  '1': 'first',
  '2': 'second',
  '3': 'third',
  '4': 'fourth',
  '5': 'fifth',
  '6': 'sixthPlus',
} as const;
type FloorValue = keyof typeof FLOORS;
const FLOOR_VALUES = Object.keys(FLOORS) as FloorValue[];


function floorValueOf(floor: number | null): FloorValue | null {
  if (floor === null) return null;
  return String(Math.max(-1, Math.min(6, floor))) as FloorValue;
}

interface LevelProps {
  readonly level: LevelDraft;
  readonly index: number;
  readonly multi: boolean;
  readonly onChange: (level: LevelDraft) => void;
  readonly onRemove: () => void;
}

function LevelFields({ level, index, multi, onChange, onRemove }: LevelProps) {
  const { t } = useTranslation([NS]);
  const floorId = useId();
  const number = index + 1;
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      {multi && <legend className="text-sm font-medium text-foreground">{t(`${NS}:property.levelLegend`, { number })}</legend>}
      <Label htmlFor={floorId}>{t(`${NS}:property.floorLabel`)}</Label>
      <ChoiceSelect
        id={floorId}
        value={floorValueOf(level.floor)}
        values={FLOOR_VALUES}
        getLabel={(value) => t(`${NS}:property.floor.${FLOORS[value]}`)}
        placeholder={t(`${NS}:property.floorPlaceholder`)}
        onChange={(value) => onChange({ ...level, floor: Number(value) })}
      />
      <LabelledNumber
        label={t(`${NS}:property.areaLabel`)}
        help={t(`${NS}:property.areaHelp`)}
        value={level.area}
        step={0.01}
        onChange={(area) => onChange({ ...level, area })}
      />
      {multi && index > 0 && (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onRemove}>
          {t(`${NS}:property.removeLevel`, { number })}
        </Button>
      )}
    </fieldset>
  );
}

function ResidenceLevels({ draft, update }: { readonly draft: ObjectiveValueDraft; readonly update: UpdateDraft }) {
  const { t } = useTranslation([NS]);
  const { levels } = draft;
  const replace = (index: number, level: LevelDraft) => update({ levels: levels.map((item, i) => (i === index ? level : item)) });
  return (
    <>
      {levels.map((level, index) => (
        <LevelFields
          key={index}
          level={level}
          index={index}
          multi={levels.length > 1}
          onChange={(next) => replace(index, next)}
          onRemove={() => update({ levels: levels.filter((_, i) => i !== index) })}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => update({ levels: [...levels, { floor: null, area: null }] })}
      >
        {t(`${NS}:property.addLevel`)}
      </Button>
    </>
  );
}

function AncillaryFields({ draft, update }: { readonly draft: ObjectiveValueDraft; readonly update: UpdateDraft }) {
  const { t } = useTranslation([NS]);
  const positionId = useId();
  const parking = draft.form === 'parking';
  const placeholder = t(`${NS}:property.positionPlaceholder`);
  return (
    <>
      <LabelledNumber
        label={t(`${NS}:property.areaLabel`)}
        help={parking ? t(`${NS}:property.parkingAreaHelp`) : t(`${NS}:property.areaHelp`)}
        value={draft.area}
        step={0.01}
        onChange={(area) => update({ area })}
      />
      <Label htmlFor={positionId}>{t(`${NS}:property.positionLabel`)}</Label>
      {parking ? (
        <ChoiceSelect
          id={positionId}
          value={draft.parkingPosition}
          values={PARKING_POSITIONS}
          getLabel={(value) => t(`${NS}:property.parkingPosition.${value}`)}
          placeholder={placeholder}
          onChange={(parkingPosition) => update({ parkingPosition })}
        />
      ) : (
        <ChoiceSelect
          id={positionId}
          value={draft.storagePosition}
          values={STORAGE_POSITIONS}
          getLabel={(value) => t(`${NS}:property.storagePosition.${value}`)}
          placeholder={placeholder}
          onChange={(storagePosition) => update({ storagePosition })}
        />
      )}
    </>
  );
}

export function ObjectiveValueProperty({ draft, update }: { readonly draft: ObjectiveValueDraft; readonly update: UpdateDraft }) {
  const { t } = useTranslation([NS]);
  return (
    <CalculatorStep title={t(`${NS}:property.title`)}>
      <SegmentedControl value={draft.form} onValueChange={(form) => update({ form })} aria-label={t(`${NS}:property.formLabel`)}>
        {OBJECTIVE_VALUE_FORMS.map((form) => (
          <SegmentedControlItem key={form} value={form}>{t(`${NS}:property.form.${form}`)}</SegmentedControlItem>
        ))}
      </SegmentedControl>
      {draft.form === 'residence' ? <ResidenceLevels draft={draft} update={update} /> : <AncillaryFields draft={draft} update={update} />}
    </CalculatorStep>
  );
}
