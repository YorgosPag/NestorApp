'use client';

/**
 * @fileoverview Η **φόρμα** της «Συμπλήρωσης στοιχείων» (ADR-915 §33) — έκδοση · τυπωμένη λήξη · κατηγορία.
 * @related RegistryFactsDeclaration.tsx (ο καλών, `next/dynamic`) · lib/document-validity/facts-declaration.ts (ο κριτής) ·
 *   hooks/document-registry/useFactsDeclaration.ts · components/sales/conveyance/ConveyanceIssuedOnField.tsx +
 *   ConveyanceValidUntilField.tsx (τα ΙΔΙΑ πεδία με τον έλεγχο μεταβίβασης)
 * @module components/document-registry/RegistryFactsDeclarationForm
 *
 * 🔑 **Φορτώνεται μόνο όταν ανοίξει ο διάλογος** (ιδίωμα `RegistryIssuanceDialogs`): όριο της κλειστότητας του route
 *    slice (ADR-744 · CHECK 3.34) — οι λέξεις και τα πεδία της δεν βαραίνουν το πρώτο καρέ της σελίδας.
 * 🔑 **Τα ίδια πεδία με τον έλεγχο μεταβίβασης** — ζωντανό νόμιμο εύρος και ασυμφωνία για την έκδοση **και την κατηγορία**
 *    που δηλώνονται (`documentExpiry`, ο ίδιος υπολογισμός που θα κρίνει μετά). Καμία δεύτερη φόρμα ημερομηνιών.
 * 🔑 **Ο ΙΔΙΟΣ κριτής με τον διακομιστή** (`judgeFactsDeclaration`): η άρνηση λέγεται **πριν** την αποστολή.
 * 🔑 **Κατηγορία = radio** σε `<fieldset>/<legend>` (δόγμα §26 Ζ10): όλες ορατές, μαζί με «Δεν τη γράφει». Η προεπιλογή
 *    από τον τύπο ακινήτου **λέγεται** ως πρόταση — την κατηγορία την ορίζει ο συντάκτης της ΥΔΕ (Παράρτημα ΙΙ παρ. 1).
 */

import React, { useState } from 'react';

import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ConveyanceIssuedOnField } from '@/components/sales/conveyance/ConveyanceIssuedOnField';
import { ConveyanceValidUntilField } from '@/components/sales/conveyance/ConveyanceValidUntilField';
import {
  classificationHintOf,
  classificationsOf,
  documentKindSpec,
  isClassificationOf,
  type DocumentClassification,
} from '@/config/document-validity/document-validity';
import type { PropertyClass } from '@/constants/property-types';
import { useFactsDeclaration } from '@/hooks/document-registry/useFactsDeclaration';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { dateKeyOfPicker, pickerDateOfKey } from '@/lib/calendar/date-key';
import type { RegistryDocument } from '@/lib/document-validity/document-registry';
import {
  acceptsPrintedValidity,
  judgeFactsDeclaration,
  type FactsDeclarationInput,
} from '@/lib/document-validity/facts-declaration';
import {
  CLASSIFICATION_LABEL_KEYS,
  FACTS_DECLARATION_ERROR_KEYS,
  FACTS_DECLARATION_KEYS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';

/** Η τιμή του «Δεν τη γράφει» — καμία κατηγορία δεν μοιάζει με αυτήν (λατινικοί κωδικοί). */
const UNKNOWN = 'unknown';

/**
 * Το πεδίο έκδοσης δεν κλειδώνει εδώ: η ενέργεια προσφέρεται **μόνο** όταν κανείς αναγνώστης δεν μίλησε
 * (`factsDeclarationOf`) — οι τιμές μπαίνουν ως αρχικές του προσχεδίου, όχι ως «γνωστές».
 */
const NOTHING_KNOWN = { issuedOn: null, printedValidUntil: null, origin: null, discrepancy: null } as const;

interface ClassificationFieldProps {
  readonly kind: RegistryDocument['kind'];
  readonly value: DocumentClassification | null;
  readonly suggested: boolean;
  readonly onChange: (value: DocumentClassification | null) => void;
}

function ClassificationField({ kind, value, suggested, onChange }: ClassificationFieldProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const legendId = React.useId();
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-labelledby={legendId}>
      <legend id={legendId} className="mb-1 text-sm font-medium text-foreground">{t(FACTS_DECLARATION_KEYS.classificationLegend)}</legend>
      <RadioGroup value={value ?? UNKNOWN} onValueChange={(next) => onChange(isClassificationOf(kind, next) ? next : null)}>
        {classificationsOf(kind).map((code) => (
          <Label key={code} className="flex items-center gap-2 text-sm font-normal">
            <RadioGroupItem value={code} />
            <span>{t(CLASSIFICATION_LABEL_KEYS[code])}</span>
          </Label>
        ))}
        <Label className="flex items-center gap-2 text-sm font-normal">
          <RadioGroupItem value={UNKNOWN} />
          <span>{t(FACTS_DECLARATION_KEYS.classificationUnknown)}</span>
        </Label>
      </RadioGroup>
      {suggested ? <p className="m-0 text-xs text-muted-foreground">{t(FACTS_DECLARATION_KEYS.classificationSuggested)}</p> : null}
    </fieldset>
  );
}

export interface FactsDeclarationFormProps {
  readonly document: RegistryDocument;
  readonly fileId: string;
  readonly storagePath: string;
  readonly propertyClass: PropertyClass | null;
  readonly revalidate: () => Promise<void>;
  readonly onClose: () => void;
}

/** Το προσχέδιο του διαλόγου: τρεις τιμές, η είσοδος του κριτή και η ετυμηγορία του — σε κάθε απόδοση, ζωντανά. */
function useDeclarationDraft(document: RegistryDocument, propertyClass: PropertyClass | null) {
  const { kind } = document;
  const hint = classificationHintOf(kind, propertyClass);
  const [issuedOn, setIssuedOn] = useState(pickerDateOfKey(document.issuedOn));
  const [validUntil, setValidUntil] = useState(pickerDateOfKey(document.printedValidUntil));
  const [classification, setClassification] = useState<DocumentClassification | null>(document.classification ?? hint);
  const printed = acceptsPrintedValidity(kind);
  const input: FactsDeclarationInput = {
    kind,
    issuedOn: dateKeyOfPicker(issuedOn),
    printedValidUntil: printed ? dateKeyOfPicker(validUntil) : null,
    classification,
  };
  const fields = { issuedOn, setIssuedOn, validUntil, setValidUntil, classification, setClassification };
  return { ...fields, printed, input, judgement: judgeFactsDeclaration(input), suggested: hint !== null && document.classification === null };
}

export function FactsDeclarationForm({ document, fileId, storagePath, propertyClass, revalidate, onClose }: FactsDeclarationFormProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const { kind } = document;
  const draft = useDeclarationDraft(document, propertyClass);
  const { input, judgement } = draft;
  const { submit, busy, error } = useFactsDeclaration(revalidate);
  // `empty` δεν είναι λάθος του ανθρώπου πριν γράψει κάτι — απλώς το κουμπί μένει ανενεργό.
  const liveRefusal = !judgement.ok && judgement.refusal !== 'empty' ? judgement.refusal : null;
  const save = async () => {
    if (await submit({ ...input, fileId, storagePath })) onClose();
  };
  return (
    <>
      <ConveyanceIssuedOnField value={draft.issuedOn} onChange={draft.setIssuedOn} known={NOTHING_KNOWN} />
      {draft.printed ? (
        <ConveyanceValidUntilField
          rule={documentKindSpec(kind).rule} issuedOn={draft.issuedOn} value={draft.validUntil} onChange={draft.setValidUntil}
          locked={false} classification={draft.classification}
        />
      ) : null}
      {classificationsOf(kind).length > 0 ? (
        <ClassificationField kind={kind} value={draft.classification} suggested={draft.suggested} onChange={draft.setClassification} />
      ) : null}
      {liveRefusal !== null ? <p role="note" className="m-0 text-xs text-foreground">{t(FACTS_DECLARATION_ERROR_KEYS[liveRefusal])}</p> : null}
      {error !== null ? <p role="alert" className="m-0 text-sm text-destructive">{t(FACTS_DECLARATION_ERROR_KEYS[error])}</p> : null}
      <DialogActionFooter
        cancelLabel={t(FACTS_DECLARATION_KEYS.cancel)}
        confirmLabel={t(FACTS_DECLARATION_KEYS.save)}
        busyLabel={t(FACTS_DECLARATION_KEYS.saving)}
        onCancel={onClose}
        onConfirm={() => void save()}
        isSubmitting={busy}
        canSubmit={judgement.ok && !busy}
      />
    </>
  );
}
