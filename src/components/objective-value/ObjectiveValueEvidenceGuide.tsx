'use client';

/**
 * **«Ποιο έγγραφο, από πού»** (ADR-949 Α-1) — για ό,τι λείπει από τον υπολογιστή: ποιο επίσημο έγγραφο το γράφει, πού
 * μέσα του, και από ποια επίσημη υπηρεσία βγαίνει. Η σειρά είναι της καθαρής `objectiveValueEvidencePlan`.
 *
 * 🔑 **Υποδοχή του `ObjectiveValueResult`, όχι εισαγωγή του**: η αγγελία και ο πίνακας κτιρίου εισάγουν το αποτέλεσμα —
 * μια στατική εισαγωγή εδώ θα έσερνε τα κείμενα του οδηγού στο i18n slice τους (CHECK 3.34 · ADR-744 §18).
 * 🔑 **Το κουμπί της υπηρεσίας είναι το ΕΝΑ** (`RegistryAuthorityLink`, ADR-915 §43) — ίδια ετικέτα, ίδια νέα καρτέλα,
 * ίδια δήλωση για αναγνώστες οθόνης με τη σελίδα λήξεων.
 * ⚠️ ADR-947 Δ1: τα έγγραφα βοηθούν να **δηλώσετε** σωστά — καμία «βεβαίωση», καμία «επίσημη τιμή».
 */

import React from 'react';

import {
  REGISTRY_NS,
  SELF_SERVICE_PATH_KEYS,
} from '@/components/document-registry/document-registry-labels';
import { RegistryAuthorityLink } from '@/components/document-registry/RegistryAuthorityLink';
import {
  OBJECTIVE_VALUE_NO_EVIDENCE_REASONS,
  type ObjectiveValueNoEvidenceReason,
} from '@/config/objective-value/objective-value-evidence';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  objectiveValueEvidencePlan,
  type ObjectiveValueEvidenceStep,
} from '@/lib/objective-value/objective-value-evidence-plan';
import type { ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';
import type { ObjectiveValueReadingApplication } from '@/lib/objective-value/objective-value-declared-reading';
import { deviceReaderOf } from '@/lib/objective-value/objective-value-document-reading';
import type { ObjectiveValueMissing } from '@/lib/objective-value/objective-value-types';

import { ObjectiveValueDocumentReader } from './ObjectiveValueDocumentReader';

const NS = 'objective-value';
const E = `${NS}:evidence`;

/** ADR-949 Α-2 — ό,τι χρειάζεται η ανάγνωση στη συσκευή: το πρόχειρο (για «τώρα → από το έγγραφο») και η αποδοχή. */
interface ObjectiveValueEvidenceReading {
  readonly draft: ObjectiveValueDraft;
  readonly onApply: (application: ObjectiveValueReadingApplication) => void;
}

interface EvidenceStepProps {
  readonly step: ObjectiveValueEvidenceStep;
  readonly reading: ObjectiveValueEvidenceReading | null;
}

function EvidenceStep({ step, reading }: EvidenceStepProps) {
  const { t } = useTranslation([NS, REGISTRY_NS]);
  const fields = step.covers.map(({ field }) => t(`${NS}:result.missing.${field}`)).join(', ');
  return (
    <li className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{t(`${E}.documents.${step.document}`)}</span>
      <span className="text-sm text-muted-foreground">{t(`${E}.covers`, { fields })}</span>
      {step.covers.some(({ whereKey }) => whereKey !== null) && (
        <ul className="m-0 list-disc pl-5 text-xs text-muted-foreground">
          {step.covers.map(({ field, whereKey }) => whereKey !== null && <li key={field}>{t(whereKey)}</li>)}
        </ul>
      )}
      {step.obtain.kind === 'authority' ? (
        <>
          <span className="text-xs text-muted-foreground">{t(SELF_SERVICE_PATH_KEYS[step.obtain.service])}</span>
          <RegistryAuthorityLink service={step.obtain.service} />
        </>
      ) : (
        <span className="text-xs text-muted-foreground">{t(`${E}.held`)}</span>
      )}
      {reading !== null && deviceReaderOf(step.document) !== null && (
        <ObjectiveValueDocumentReader document={step.document} draft={reading.draft} onApply={reading.onApply} />
      )}
    </li>
  );
}

interface EvidenceGuideProps {
  readonly missing: readonly ObjectiveValueMissing[];
  /** Απόν ⇒ ο οδηγός μόνο δείχνει (π.χ. όπου δεν υπάρχει πρόχειρο να γεμίσει). */
  readonly reading?: ObjectiveValueEvidenceReading;
}

export function ObjectiveValueEvidenceGuide({ missing, reading }: EvidenceGuideProps) {
  const { t } = useTranslation([NS]);
  const headingId = React.useId();
  const plan = React.useMemo(() => objectiveValueEvidencePlan(missing), [missing]);
  if (plan.steps.length === 0 && plan.selfAnswered.length === 0) return null;
  const fieldsFor = (reason: ObjectiveValueNoEvidenceReason) => plan.selfAnswered
    .filter((entry) => entry.reason === reason)
    .map(({ field }) => t(`${NS}:result.missing.${field}`))
    .join(', ');
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${E}.title`)}</h3>
      {plan.steps.length > 0 && (
        <ol className="m-0 flex list-decimal flex-col gap-3 pl-5">
          {plan.steps.map((step) => <EvidenceStep key={step.document} step={step} reading={reading ?? null} />)}
        </ol>
      )}
      {OBJECTIVE_VALUE_NO_EVIDENCE_REASONS.map((reason) => {
        const fields = fieldsFor(reason);
        return fields === '' ? null : (
          <p key={reason} className="m-0 text-sm text-muted-foreground">{t(`${E}.noDocument.${reason}`, { fields })}</p>
        );
      })}
      <p className="m-0 text-xs text-muted-foreground">{t(`${E}.note`)}</p>
    </section>
  );
}
