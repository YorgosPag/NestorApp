'use client';

/**
 * **Βήμα 2 — το ακίνητο** (ADR-898 Φ2): είδος (έντυπο 1 / 4 / 5), επίπεδα με όροφο και επιφάνεια (κατοικία, και
 * μεζονέτα), ή επιφάνεια και θέση (αποθήκη / θέση στάθμευσης). Αυτά ζητούνται **πάντα** — χωρίς αυτά η μηχανή δεν
 * ξέρει ούτε ποιες άλλες ερωτήσεις μετρούν.
 *
 * 🔑 **Σήμα προέλευσης** (ADR-947 Φ1β) σε είδος, όροφο και επιφάνεια: «από το ακίνητο» ή «αλλάξατε την τιμή», με την
 * αρχική **στο λεξιλόγιο του πεδίου** (ο όροφος ως «2ος», όχι ως «2»).
 */

import React, { useId } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isLevelStackEnd, levelStackNeighbours, shiftLevelStack, type LevelStackNeighbours } from '@/lib/floor/level-stack';
import type { LevelDraft, ObjectiveValueDraft, UpdateDraft } from '@/lib/objective-value/objective-value-draft';
import { MAX_LEVELS, OBJECTIVE_VALUE_FLOOR_BOUNDS } from '@/lib/objective-value/objective-value-prefill';
import { FLOOR_VALUES, floorValueOf } from '@/lib/objective-value/objective-value-floor-bucket';
import { OBJECTIVE_VALUE_FORMS, PARKING_POSITIONS, STORAGE_POSITIONS } from '@/lib/objective-value/objective-value-types';

import { useBucketLabel, useFloorValueLabel } from './objective-value-floor-label';
import { CalculatorStep, ChoiceSelect, LabelledNumber } from './objective-value-inputs';
import { ObjectiveValueProvenanceBadge } from './ObjectiveValueProvenanceBadge';

const NS = 'objective-value';

/** Η αρχική τιμή ορόφου στο λεξιλόγιο του πεδίου — ίδια ετικέτα με την επιλογή. */
function useFloorOriginal(): (value: string | number | boolean) => string {
  const valueLabel = useFloorValueLabel();
  return (value) => {
    const floor = typeof value === 'number' ? floorValueOf(value) : null;
    return floor === null ? String(value) : valueLabel(floor);
  };
}

/** Η αρχική τιμή είδους — ίδια ετικέτα με το κουμπί του είδους. */
function useFormOriginal(): (value: string | number | boolean) => string {
  const { t } = useTranslation([NS]);
  return (value) => {
    const form = OBJECTIVE_VALUE_FORMS.find((candidate) => candidate === value);
    return form === undefined ? String(value) : t(`${NS}:property.form.${form}`);
  };
}

const STACK_SIDES = [
  { side: 'below', Icon: ChevronDown, ariaKey: 'levelBelow' },
  { side: 'above', Icon: ChevronUp, ariaKey: 'levelAbove' },
] as const;

/** «↓ Ισόγειο» · «↑ Γ' όροφος» — οι **μόνοι** όροφοι όπου χωρά επόμενο επίπεδο (`lib/floor/level-stack`). */
function StackNeighbourButtons({ neighbours, onPick }: { readonly neighbours: LevelStackNeighbours; readonly onPick: (floor: number) => void }) {
  const { t } = useTranslation([NS]);
  const label = useBucketLabel();
  return (
    <span className="flex flex-wrap gap-2">
      {STACK_SIDES.map(({ side, Icon, ariaKey }) => {
        const floor = neighbours[side];
        if (floor === null) return null;
        return (
          <Button key={side} type="button" variant="outline" size="sm" className="gap-1" aria-label={t(`${NS}:property.${ariaKey}`, { floor: label(floor) })} onClick={() => onPick(floor)}>
            <Icon aria-hidden className="h-4 w-4" />
            {label(floor)}
          </Button>
        );
      })}
    </span>
  );
}

interface LevelFloorProps {
  readonly level: LevelDraft;
  readonly index: number;
  readonly neighbours: LevelStackNeighbours | null;
  readonly onFloor: (floor: number) => void;
}

/**
 * Ο όροφος ενός επιπέδου (Revit Base Constraint): **μόνο** το επίπεδο 1 έχει επιλογέα — η αλλαγή του μετακινεί όλη τη
 * στοίβα. Τα υπόλοιπα **παράγονται**· επίπεδο χωρίς όροφο (αγγελία με πλήθος, όχι ορόφους) τοποθετείται στα όμορα.
 */
function LevelFloorField({ level, index, neighbours, onFloor }: LevelFloorProps) {
  const { t } = useTranslation([NS]);
  const floorId = useId();
  const label = useBucketLabel();
  const valueLabel = useFloorValueLabel();
  if (index === 0) {
    return (
      <>
        <Label htmlFor={floorId}>{t(`${NS}:property.floorLabel`)}</Label>
        <ChoiceSelect
          id={floorId}
          value={floorValueOf(level.floor)}
          values={FLOOR_VALUES}
          getLabel={valueLabel}
          placeholder={t(`${NS}:property.floorPlaceholder`)}
          onChange={(value) => onFloor(Number(value))}
        />
      </>
    );
  }
  if (level.floor !== null) return <p className="m-0 text-sm text-foreground">{t(`${NS}:property.derivedFloor`, { floor: label(level.floor) })}</p>;
  if (neighbours === null) return <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:property.levelFloorPending`)}</p>;
  return <StackNeighbourButtons neighbours={neighbours} onPick={onFloor} />;
}

interface LevelProps {
  readonly level: LevelDraft;
  readonly index: number;
  readonly multi: boolean;
  readonly removable: boolean;
  readonly floorField: React.ReactNode;
  readonly onAreaChange: (area: number | null) => void;
  readonly onRemove: () => void;
}

function LevelFields({ level, index, multi, removable, floorField, onAreaChange, onRemove }: LevelProps) {
  const { t } = useTranslation([NS]);
  const floorOriginal = useFloorOriginal();
  const number = index + 1;
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      {multi && <legend className="text-sm font-medium text-foreground">{t(`${NS}:property.levelLegend`, { number })}</legend>}
      {floorField}
      <ObjectiveValueProvenanceBadge input="levelFloor" level={index} formatOriginal={floorOriginal} />
      <LabelledNumber label={t(`${NS}:property.areaLabel`)} help={t(`${NS}:property.areaHelp`)} value={level.area} step={0.01} onChange={onAreaChange} />
      <ObjectiveValueProvenanceBadge input="levelArea" level={index} />
      {removable && (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onRemove}>
          {t(`${NS}:property.removeLevel`, { number })}
        </Button>
      )}
    </fieldset>
  );
}

/** Τα επίπεδα = **στοίβα** συνεχόμενων ορόφων (Revit/ArchiCAD): κενό στη μέση δομικά αδύνατο (ADR-898 · ADR-236). */
function ResidenceLevels({ draft, update }: { readonly draft: ObjectiveValueDraft; readonly update: UpdateDraft }) {
  const { t } = useTranslation([NS]);
  const { levels } = draft;
  const floors = levels.map((level) => level.floor);
  const neighbours = levelStackNeighbours(floors, OBJECTIVE_VALUE_FLOOR_BOUNDS);
  const setFloor = (index: number, floor: number) => {
    const next = shiftLevelStack(floors, index, floor);
    update({ levels: levels.map((level, i) => ({ ...level, floor: next[i] ?? null })) });
  };
  const setArea = (index: number, area: number | null) => update({ levels: levels.map((level, i) => (i === index ? { ...level, area } : level)) });
  return (
    <>
      {levels.map((level, index) => (
        <LevelFields
          key={index}
          level={level}
          index={index}
          multi={levels.length > 1}
          removable={index > 0 && isLevelStackEnd(floors, index)}
          floorField={<LevelFloorField level={level} index={index} neighbours={neighbours} onFloor={(floor) => setFloor(index, floor)} />}
          onAreaChange={(area) => setArea(index, area)}
          onRemove={() => update({ levels: levels.filter((_, i) => i !== index) })}
        />
      ))}
      {neighbours !== null && levels.length < MAX_LEVELS && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="text-sm font-medium text-foreground">{t(`${NS}:property.addLevel`)}</legend>
          <StackNeighbourButtons neighbours={neighbours} onPick={(floor) => update({ levels: [...levels, { floor, area: null }] })} />
        </fieldset>
      )}
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
      <ObjectiveValueProvenanceBadge input="area" />
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
  const formOriginal = useFormOriginal();
  return (
    <CalculatorStep title={t(`${NS}:property.title`)}>
      <SegmentedControl value={draft.form} onValueChange={(form) => update({ form })} aria-label={t(`${NS}:property.formLabel`)}>
        {OBJECTIVE_VALUE_FORMS.map((form) => (
          <SegmentedControlItem key={form} value={form}>{t(`${NS}:property.form.${form}`)}</SegmentedControlItem>
        ))}
      </SegmentedControl>
      <ObjectiveValueProvenanceBadge input="form" formatOriginal={formOriginal} />
      {draft.form === 'residence' ? <ResidenceLevels draft={draft} update={update} /> : <AncillaryFields draft={draft} update={update} />}
    </CalculatorStep>
  );
}
