'use client';

/**
 * **Η ενότητα «Αντικειμενική αξία»** της οθόνης «Βελτίωσε την αγγελία σου» (ADR-898 Φ3β-2 · ADR-842 Φ4) — και της
 * καρτέλας ακινήτου του γραφείου (Φ3β-3): ΙΔΙΟ component, ο κάτοχος δίνει το `subject` (ταυτότητα · αλήθεια · γραφή).
 * @related `useObjectiveValueImprove.ts` (κατάσταση) · `improve-sections.ts` (ο καταχωρητής που την κρεμά)
 *
 * 🔑 **Κάθε απάντηση αποθηκεύεται αμέσως** (σειριακή ουρά, αισιόδοξη επικάλυψη)· ο listener μένει η πηγή αλήθειας.
 * 🔑 **Έλεγχος και στον browser, με τον ΙΔΙΟ κανόνα** (`objectiveValuePatchViolations`) — ο server κρίνει ξανά
 *   (ζώνη και τιράντες): μια μελλοντική ημερομηνία δεν φεύγει καν.
 */

import React, { useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  objectiveValuePatchViolations,
  type ObjectiveValueDeclarationsPatch,
  type ObjectiveValuePatchViolation,
} from '@/lib/objective-value/objective-value-declarations';
import type { ObjectiveValueImproveSubject } from '@/lib/objective-value/objective-value-improve-subject';

import { ImproveSaveStatus } from './ImproveSaveStatus';
import { ObjectiveValueBeforeAfter } from './ObjectiveValueBeforeAfter';
import { ObjectiveValueImproveQuestions } from './ObjectiveValueImproveQuestions';
import { ObjectiveValueVisibility } from './ObjectiveValueVisibility';
import { useObjectiveValueImprove, type ImproveZone, type ObjectiveValueImproveState } from './useObjectiveValueImprove';

const NS = 'objective-value';
const I = `${NS}:improve`;

type Answered = Extract<ImproveZone, { readonly kind: 'answered' }>;

/** Ό,τι δεν είναι ερωτήσεις: αναμονή ζώνης · αποτυχία · καμία ζώνη · είδος εκτός εμβέλειας. */
function ZoneMessage({ zone }: { readonly zone: ImproveZone }) {
  const { t } = useTranslation([NS]);
  if (zone.kind === 'idle' || zone.kind === 'loading') return <p className="m-0 text-sm text-muted-foreground">{t(`${I}.zone.loading`)}</p>;
  if (zone.kind === 'failed') return <p className="m-0 text-sm text-foreground">{t(`${I}.zone.failed`)}</p>;
  const { improvement } = zone;
  if (improvement.kind === 'unsupported') {
    return <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:listing.unsupported.${improvement.reason}`)}</p>;
  }
  return <p className="m-0 text-sm text-muted-foreground">{t(`${I}.zone.none`)}</p>;
}

function Body({ state, zone, onAnswer }: {
  readonly state: ObjectiveValueImproveState;
  readonly zone: Answered;
  readonly onAnswer: (patch: ObjectiveValueDeclarationsPatch) => void;
}) {
  const { improvement } = zone;
  if (improvement.kind !== 'ready') return <ZoneMessage zone={zone} />;
  return (
    <>
      <ObjectiveValueBeforeAfter bounds={improvement.bounds} />
      <ObjectiveValueImproveQuestions
        questions={improvement.questions}
        declarations={state.declarations}
        verdict={zone.verdict}
        today={state.today}
        onAnswer={onAnswer}
      />
    </>
  );
}

export function ObjectiveValueImproveSection({ subject }: { readonly subject: ObjectiveValueImproveSubject }) {
  const { t } = useTranslation([NS]);
  const state = useObjectiveValueImprove(subject);
  const [localRejection, setLocalRejection] = useState<readonly ObjectiveValuePatchViolation[]>([]);
  const { zone, save, declarations, today } = state;
  const onAnswer = (patch: ObjectiveValueDeclarationsPatch) => {
    const violations = objectiveValuePatchViolations(patch, today);
    setLocalRejection(violations);
    if (violations.length === 0) save.enqueue(patch);
  };
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm text-muted-foreground">{t(`${I}.sections.objectiveValue.lead`)}</p>
        <ImproveSaveStatus save={save} />
      </header>
      {localRejection.map((violation) => (
        <p key={violation} role="alert" className="m-0 text-sm text-destructive">{t(`${I}.rejected.${violation}`)}</p>
      ))}
      {zone.kind === 'answered' ? <Body state={state} zone={zone} onAnswer={onAnswer} /> : <ZoneMessage zone={zone} />}
      {zone.kind === 'answered' && zone.buyerView.kind !== 'no-zone' && (
        <ObjectiveValueVisibility display={declarations.display} buyerView={zone.buyerView} onAnswer={onAnswer} />
      )}
    </>
  );
}
