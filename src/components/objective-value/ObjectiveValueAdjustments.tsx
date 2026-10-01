'use client';

/**
 * **Ειδικές περιπτώσεις — προαιρετικά** (ADR-898 §4.4, Φ2): στάδιο κατασκευής, τρόπος κατασκευής, στέγη, τοίχοι,
 * μικτή επιφάνεια, συνιδιοκτησία, διατηρητέο/απαλλοτριωτέο, ποσοστό, ζημιές.
 *
 * 🔑 **Κλειστά από προεπιλογή, με την ΚΑΝΟΝΙΚΗ περίπτωση**, όπως στα ΦΥΑΑ της ΑΑΔΕ: μειώνουν την αξία και
 * αποδεικνύονται με έγγραφο — δεν τεκμαίρονται. Όποιος δεν τα ανοίξει παίρνει τον σωστό υπολογισμό για το συνηθισμένο
 * ακίνητο.
 */

import React, { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';
import type {
  AncillaryCompletion,
  ConstructionKind,
  LegalEncumbrance,
  ResidenceCompletion,
} from '@/lib/objective-value/objective-value-types';

import { ChoiceSelect, LabelledNumber } from './objective-value-inputs';
import type { UpdateDraft } from './ObjectiveValueProperty';

const NS = 'objective-value';
const A = `${NS}:adjustments`;

const RESIDENCE_STAGES: readonly ResidenceCompletion[] = ['complete', 'foundation', 'frame', 'masonry', 'plaster', 'flooring'];
const ANCILLARY_STAGES: readonly AncillaryCompletion[] = ['complete', 'frame', 'masonry', 'plaster'];
const CONSTRUCTIONS: readonly ConstructionKind[] = ['frame', 'masonry', 'makeshift'];
const ENCUMBRANCES: readonly LegalEncumbrance[] = ['none', 'listed', 'expropriated'];

type Flag = 'lightRoof' | 'thickWalls' | 'areaIncludesCommon' | 'coOwned';

interface Props {
  readonly draft: ObjectiveValueDraft;
  readonly update: UpdateDraft;
}

function FlagField({ draft, update, flag }: Props & { readonly flag: Flag }) {
  const { t } = useTranslation([NS]);
  const id = useId();
  return (
    <Label htmlFor={id} className="flex items-center gap-2 font-normal">
      <Checkbox id={id} checked={draft[flag]} onCheckedChange={(checked) => update(flagPatch(flag, checked === true))} />
      {t(`${A}.${flag}`)}
    </Label>
  );
}

function flagPatch(flag: Flag, value: boolean): Partial<ObjectiveValueDraft> {
  switch (flag) {
    case 'lightRoof':
      return { lightRoof: value };
    case 'thickWalls':
      return { thickWalls: value };
    case 'areaIncludesCommon':
      return { areaIncludesCommon: value };
    case 'coOwned':
      return { coOwned: value };
  }
}

function StageField({ draft, update }: Props) {
  const { t } = useTranslation([NS]);
  const id = useId();
  const label = t(`${A}.completionLabel`);
  const getLabel = (value: string) => t(`${A}.completion.${value}`);
  return (
    <>
      <Label htmlFor={id}>{label}</Label>
      {draft.form === 'residence' ? (
        <ChoiceSelect id={id} value={draft.residenceCompletion} values={RESIDENCE_STAGES} getLabel={getLabel} placeholder={label}
          onChange={(residenceCompletion) => update({ residenceCompletion })} />
      ) : (
        <ChoiceSelect id={id} value={draft.ancillaryCompletion} values={ANCILLARY_STAGES} getLabel={getLabel} placeholder={label}
          onChange={(ancillaryCompletion) => update({ ancillaryCompletion })} />
      )}
    </>
  );
}

function ChoiceFields({ draft, update }: Props) {
  const { t } = useTranslation([NS]);
  const constructionId = useId();
  const encumbranceId = useId();
  return (
    <>
      <Label htmlFor={constructionId}>{t(`${A}.constructionLabel`)}</Label>
      <ChoiceSelect id={constructionId} value={draft.construction} values={CONSTRUCTIONS} placeholder={t(`${A}.constructionLabel`)}
        getLabel={(value) => t(`${A}.construction.${value}`)} onChange={(construction) => update({ construction })} />
      <Label htmlFor={encumbranceId}>{t(`${A}.encumbranceLabel`)}</Label>
      <ChoiceSelect id={encumbranceId} value={draft.encumbrance} values={ENCUMBRANCES} placeholder={t(`${A}.encumbranceLabel`)}
        getLabel={(value) => t(`${A}.encumbrance.${value}`)} onChange={(encumbrance) => update({ encumbrance })} />
    </>
  );
}

function AmountFields({ draft, update }: Props) {
  const { t } = useTranslation([NS]);
  return (
    <>
      <LabelledNumber
        label={t(`${A}.ownershipPct`)}
        help={t(`${A}.ownershipPctHelp`)}
        value={draft.ownershipPct}
        onChange={(ownershipPct) => update({ ownershipPct })}
      />
      <LabelledNumber
        label={t(`${A}.damage`)}
        value={draft.damageRestorationCost}
        onChange={(damageRestorationCost) => update({ damageRestorationCost })}
      />
    </>
  );
}

/** Οι σημαίες που ορίζει το έντυπο: τοίχοι όχι στη στάθμευση (άρθ. 7), μικτή επιφάνεια μόνο στην κατοικία (άρθ. 2 §17). */
function flagsOf(form: ObjectiveValueDraft['form']): readonly Flag[] {
  if (form === 'residence') return ['lightRoof', 'thickWalls', 'areaIncludesCommon', 'coOwned'];
  return form === 'storage' ? ['lightRoof', 'thickWalls', 'coOwned'] : ['lightRoof', 'coOwned'];
}

export function ObjectiveValueAdjustments({ draft, update }: Props) {
  const { t } = useTranslation([NS]);
  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">{t(`${A}.title`)}</summary>
      <div className="mt-3 flex flex-col gap-2">
        <p className="m-0 text-xs text-muted-foreground">{t(`${A}.help`)}</p>
        <StageField draft={draft} update={update} />
        <ChoiceFields draft={draft} update={update} />
        {flagsOf(draft.form).map((flag) => (
          <FlagField key={flag} flag={flag} draft={draft} update={update} />
        ))}
        <AmountFields draft={draft} update={update} />
      </div>
    </details>
  );
}
