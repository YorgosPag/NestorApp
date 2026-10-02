'use client';

/**
 * @fileoverview **«Γεγονότα κτιρίου»** (ADR-898 Φ4β) — στάδιο (με την πηγή του), άδεια, ΣΑΟ, ανελκυστήρας, θέρμανση: γραμμένα **μία
 * φορά** για όλες τις μονάδες, με την ίδια ουρά αποθήκευσης και την ίδια ένδειξη με τη σελίδα βελτίωσης αγγελίας.
 * @module components/building-management/tabs/ObjectiveValueTab/BuildingObjectiveValueFacts
 *
 * 🔑 **Ίδια χειριστήρια με τον υπολογιστή** για άδεια/ΣΑΟ/ανελκυστήρα (`ObjectiveValueQuestion`) — ίδια διατύπωση παντού.
 * 🔑 **Το στάδιο από το χρονοδιάγραμμα δεν επεξεργάζεται εδώ**: δείχνεται με την πηγή του και σύνδεσμο στο Gantt —
 *   αλλιώς η δήλωση θα γινόταν δεύτερη αλήθεια δίπλα στο χρονοδιάγραμμα (ADR-034 · ADR-898 Φ4α).
 * 🔑 Δίπλα σε κάθε πεδίο: **πόσες μονάδες περιμένουν** αυτή την απάντηση (από τη μηχανή) — «απάντησε μία φορά».
 */

import React, { useId } from 'react';

import { ObjectiveValueQuestion, questionClearsItself } from '@/components/objective-value/ObjectiveValueQuestions';
import { ObjectiveValueSaveStatus } from '@/components/objective-value/ObjectiveValueSaveStatus';
import { ChoiceSelect } from '@/components/objective-value/objective-value-inputs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BuildingStage } from '@/lib/objective-value/building-objective-value';
import type { BuildingObjectiveValueFacts, BuildingObjectiveValuePatch } from '@/lib/objective-value/building-objective-value-facts';
import {
  BUILDING_ENGINE_FACTS,
  BUILDING_ENGINE_QUESTION_OF,
  buildingPatchOfDraft,
  clearedBuildingFactPatch,
  draftOfBuildingFacts,
  type BuildingEngineFact,
  type BuildingFactQuestion,
  type BuildingQuestion,
} from '@/lib/objective-value/building-objective-value-questions';
import { LEGAL_STAGES, type BuildingStageReached } from '@/lib/objective-value/objective-value-stages';

import type { BuildingFactsSave } from './useBuildingObjectiveValueTab';

const NS = 'objective-value';
const F = `${NS}:building.facts`;
const DECLARABLE_STAGES: readonly BuildingStageReached[] = ['none', ...LEGAL_STAGES];

/** Το `id` του πεδίου ενός γεγονότος — ο σύνδεσμος «μετάβαση στο πεδίο» της σύνοψης δείχνει εδώ. */
function buildingFactFieldId(fact: BuildingFactQuestion): string {
  return `building-objective-value-fact-${fact}`;
}

const itemIdOf = (fact: BuildingFactQuestion) => `${buildingFactFieldId(fact)}-item`;

/** «Μετάβαση στο πεδίο»: κύλιση στο γεγονός και εστίαση στο πρώτο του χειριστήριο (πληκτρολόγιο/αναγνώστης οθόνης). */
export function focusBuildingFact(fact: BuildingFactQuestion): void {
  const item = document.getElementById(itemIdOf(fact));
  if (item === null) return;
  item.scrollIntoView({ block: 'center', behavior: 'smooth' });
  item.querySelector<HTMLElement>('input, button, [role="combobox"], [role="radio"]')?.focus({ preventScroll: true });
}

interface FactsProps {
  readonly stage: BuildingStage;
  readonly facts: BuildingObjectiveValueFacts;
  readonly questions: readonly BuildingQuestion[];
  readonly save: BuildingFactsSave;
  readonly today: string;
  readonly onOpenSchedule?: () => void;
}

function Waiting({ fact, questions }: { readonly fact: BuildingFactQuestion; readonly questions: readonly BuildingQuestion[] }) {
  const { t } = useTranslation([NS]);
  const units = questions.find((question) => question.fact === fact)?.units ?? 0;
  if (units === 0) return null;
  return <Badge variant="secondary" className="self-start">{t(`${F}.waiting`, { count: units })}</Badge>;
}

function ClearButton({ visible, onClear }: { readonly visible: boolean; readonly onClear: () => void }) {
  const { t } = useTranslation([NS]);
  if (!visible) return null;
  return (
    <Button type="button" variant="link" size="sm" className="h-auto self-start p-0" onClick={onClear}>
      {t(`${F}.clear`)}
    </Button>
  );
}

function ScheduleStage({ stage, onOpenSchedule }: { readonly stage: BuildingStageReached; readonly onOpenSchedule?: () => void }) {
  const { t } = useTranslation([NS]);
  return (
    <>
      <span className="text-sm font-medium text-foreground">{t(`${F}.stage`)}</span>
      <span className="text-sm text-foreground">{t(`${F}.stageFromSchedule`, { stage: t(`${NS}:stages.${stage}`) })}</span>
      <span className="text-xs text-muted-foreground">{t(`${F}.stageScheduleHelp`)}</span>
      {onOpenSchedule && (
        <Button type="button" variant="link" size="sm" className="h-auto self-start p-0" onClick={onOpenSchedule}>
          {t(`${F}.openSchedule`)}
        </Button>
      )}
    </>
  );
}

function DeclaredStage({ facts, onAnswer }: { readonly facts: BuildingObjectiveValueFacts; readonly onAnswer: (patch: BuildingObjectiveValuePatch) => void }) {
  const { t } = useTranslation([NS]);
  return (
    <>
      <Label htmlFor={buildingFactFieldId('declaredStage')}>{t(`${F}.stage`)}</Label>
      <ChoiceSelect
        id={buildingFactFieldId('declaredStage')}
        value={facts.declaredStage}
        values={DECLARABLE_STAGES}
        getLabel={(stage) => t(`${NS}:stages.${stage}`)}
        placeholder={t(`${F}.stagePlaceholder`)}
        onChange={(declaredStage) => onAnswer({ declaredStage })}
      />
      <span className="text-xs text-muted-foreground">{t(`${F}.stageDeclaredHelp`)}</span>
      <ClearButton visible={facts.declaredStage !== null} onClear={() => onAnswer(clearedBuildingFactPatch('declaredStage'))} />
    </>
  );
}

function EngineFact({ fact, facts, today, onAnswer }: {
  readonly fact: BuildingEngineFact;
  readonly facts: BuildingObjectiveValueFacts;
  readonly today: string;
  readonly onAnswer: (patch: BuildingObjectiveValuePatch) => void;
}) {
  const question = BUILDING_ENGINE_QUESTION_OF[fact];
  return (
    <>
      <ObjectiveValueQuestion
        question={question}
        draft={draftOfBuildingFacts(facts)}
        today={today}
        unsetVoice="undeclared"
        update={(change) => {
          const patch = buildingPatchOfDraft(change);
          if (patch !== null) onAnswer(patch);
        }}
      />
      <ClearButton visible={facts[fact] !== null && !questionClearsItself(question)} onClear={() => onAnswer(clearedBuildingFactPatch(fact))} />
    </>
  );
}

export function BuildingObjectiveValueFacts({ stage, facts, questions, save, today, onOpenSchedule }: FactsProps) {
  const { t } = useTranslation([NS]);
  const headingId = useId();
  const onAnswer = (patch: BuildingObjectiveValuePatch) => save.enqueue(patch);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-md border border-border p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="m-0 text-base font-semibold text-foreground">{t(`${F}.title`)}</h3>
        <ObjectiveValueSaveStatus save={save} />
      </header>
      <p className="m-0 text-sm text-muted-foreground">{t(`${F}.help`)}</p>
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
        <li id={itemIdOf('declaredStage')} className="flex flex-col gap-1">
          {stage.source === 'schedule' ? (
            <ScheduleStage stage={stage.stage} onOpenSchedule={onOpenSchedule} />
          ) : (
            <DeclaredStage facts={facts} onAnswer={onAnswer} />
          )}
          <Waiting fact="declaredStage" questions={questions} />
        </li>
        {BUILDING_ENGINE_FACTS.map((fact) => (
          <li key={fact} id={itemIdOf(fact)} className="flex flex-col gap-1">
            <EngineFact fact={fact} facts={facts} today={today} onAnswer={onAnswer} />
            <Waiting fact={fact} questions={questions} />
          </li>
        ))}
      </ul>
    </section>
  );
}
