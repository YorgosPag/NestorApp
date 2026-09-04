'use client';

/**
 * @fileoverview **Η ΔΗΛΩΣΗ ΤΟΥ ΖΗΤΟΥΝΤΟΣ** — τρία πεδία, και κανένα σφάλμα που να μη λέει πού.
 * @related lib/contact/first-contact-form-values.ts (ο κριτής) · ADR-843 §10.13
 * @module components/contact/FirstContactDisclosureForm
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ Η ΠΡΩΤΗ ΓΡΑΦΗ ΕΚΑΝΕ ΛΑΘΟΣ, ΚΑΙ ΓΙΑΤΙ ΜΕΤΡΑΝΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | ❌ Ήταν | 🔴 Τι έσπαγε | ✅ Τώρα |
 * |---|---|---|
 * | `id="first-contact-name"` **σταθερό** | δύο κουμπιά στην ίδια σελίδα ⇒ **διπλά `id`**: άκυρη HTML, και το `<label>` εστιάζει **λάθος πεδίο** | `useId()` — μοναδικό ανά στιγμιότυπο, σταθερό σε SSR |
 * | `required` στο `<input>` | ο **φυλλομετρητής** λέει *«Please fill out this field»* — **αγγλικά πάνω σε ελληνική οθόνη**, εκτός i18n | `noValidate` + δικός μας κριτής |
 * | καμία επικύρωση πριν την αποστολή | κάθε κενό πεδίο κόστιζε **γύρο δικτύου** και γύριζε 422 μακριά από το πεδίο | εμπόδια **πριν** φύγει το αίτημα |
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΟΤΕ ΕΜΦΑΝΙΖΕΤΑΙ ΤΟ ΣΦΑΛΜΑ — ΚΑΝΟΝΑΣ BAYMARD, ΟΧΙ ΓΟΥΣΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Μετά** το πεδίο (`blur`), **ποτέ ενώ πληκτρολογεί**: ένα «άκυρο email» που
 * εμφανίζεται στο τρίτο γράμμα κατηγορεί τον άνθρωπο για κάτι που **δεν έχει τελειώσει**.
 * Και **φεύγει μόλις διορθωθεί** — τα εμπόδια υπολογίζονται σε κάθε απόδοση από τις
 * τιμές, άρα η εξαφάνιση είναι **δομική**, όχι δεύτερος χειρισμός που μπορεί να ξεχαστεί.
 *
 * ⚠️ **Στην υποβολή γίνονται ΟΛΑ ορατά μαζί**: ο άνθρωπος που διορθώνει ένα τη φορά
 * κάνει τρεις γύρους για τρία λάθη (πρότυπο GOV.UK — σύνοψη **και** μήνυμα στο πεδίο).
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { HintedField } from '@/components/ui/hinted-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  BLOCKER_FIELD,
  firstContactFormBlockers,
  type FirstContactFormBlocker,
  type FirstContactFormValues,
} from '@/lib/contact/first-contact-form-values';

import { ACT_KEYS, FIRST_CONTACT_NS, FORM_BLOCKER_KEYS } from './first-contact-labels';

type FieldName = keyof FirstContactFormValues;

const FIELD_ORDER: readonly FieldName[] = ['name', 'email', 'phone'];

export interface FirstContactDisclosureFormProps {
  readonly values: FirstContactFormValues;
  readonly onValuesChange: (values: FirstContactFormValues) => void;
  readonly sending: boolean;
  /** Καλείται **μόνο** όταν δεν υπάρχει εμπόδιο — η φόρμα δεν στέλνει ό,τι δεν στέκει. */
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

export function FirstContactDisclosureForm({
  values,
  onValuesChange,
  sending,
  onSubmit,
  onCancel,
}: FirstContactDisclosureFormProps): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  // 🔑 **ΕΝΑ `useId`, τρία παράγωγα** — το συνιστώμενο σχήμα: μία κλήση ανά component,
  //    τα υπόλοιπα με επιθέματα. Σταθερό σε server και client ⇒ καμία ασυμφωνία ενυδάτωσης.
  const fieldId = React.useId();
  const summaryRef = React.useRef<HTMLDivElement>(null);

  const [touched, setTouched] = React.useState<ReadonlySet<FieldName>>(new Set());
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  const blockers = firstContactFormBlockers(values);
  const summaryVisible = submitAttempted && blockers.length > 0;

  function markTouched(field: FieldName): void {
    setTouched((previous) => new Set(previous).add(field));
  }

  function errorFor(field: FieldName): string | undefined {
    // ⚠️ Το «άγγιξε το πεδίο» **ή** «πάτησε αποστολή» — η υποβολή αποκαλύπτει τα πάντα.
    if (!submitAttempted && !touched.has(field)) return undefined;

    const blocker = blockers.find((code) => BLOCKER_FIELD[code] === field);
    return blocker === undefined ? undefined : t(FORM_BLOCKER_KEYS[blocker]);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSubmitAttempted(true);

    if (blockers.length > 0) {
      // 🔴 **Η ΕΣΤΙΑΣΗ ΣΤΗ ΣΥΝΟΨΗ ΕΙΝΑΙ ΤΟ ΜΙΣΟ ΠΡΟΤΥΠΟ.** Χωρίς αυτήν, ο χρήστης
      //    αναγνώστη οθόνης πατά «στείλε» και **δεν ακούει τίποτα** — η σύνοψη
      //    εμφανίστηκε κάπου πάνω, εκτός της θέσης του δρομέα.
      window.requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    onSubmit();
  }

  return (
    // ⚠️ `noValidate`: ο κριτής είναι δικός μας, στη γλώσσα του ανθρώπου.
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {summaryVisible && (
        <FormErrorSummary
          ref={summaryRef}
          blockers={blockers}
          fieldId={fieldId}
          title={t(ACT_KEYS.errorSummaryTitle)}
          labelOf={(code) => t(FORM_BLOCKER_KEYS[code])}
        />
      )}

      <DisclosureFields
        values={values}
        onValuesChange={onValuesChange}
        fieldId={fieldId}
        sending={sending}
        errorFor={errorFor}
        onTouched={markTouched}
      />

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={sending}>
          {t(ACT_KEYS.cancel)}
        </Button>
        {/*
          🔑 **ΤΟ ΚΟΥΜΠΙ ΔΕΝ ΑΠΕΝΕΡΓΟΠΟΙΕΙΤΑΙ ΟΤΑΝ ΥΠΑΡΧΟΥΝ ΕΜΠΟΔΙΑ** — και είναι
          απόφαση: το ανενεργό κουμπί **δεν λέει γιατί**, ο άνθρωπος σαρώνει τη φόρμα
          πάνω-κάτω ψάχνοντας τι το κρατά, και συχνά **δεν είναι καν εστιάσιμο** από
          πληκτρολόγιο. Το πάτημα με σφάλματα δείχνει **σύνοψη που εξηγεί**.
          ⚠️ Το `disabled` εδώ αφορά **μόνο** την ώρα που ταξιδεύει η δήλωση.
        */}
        <Button type="submit" disabled={sending}>
          {t(sending ? ACT_KEYS.submitting : ACT_KEYS.submit)}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface DisclosureFieldsProps {
  readonly values: FirstContactFormValues;
  readonly onValuesChange: (values: FirstContactFormValues) => void;
  readonly fieldId: string;
  readonly sending: boolean;
  readonly errorFor: (field: FieldName) => string | undefined;
  readonly onTouched: (field: FieldName) => void;
}

/**
 * **Τα τρία πεδία** — χωριστά από τον κριτή, γιατί απαντούν **άλλη ερώτηση**.
 *
 * 🔑 Ο γονιός απαντά *«μπορεί να σταλεί;»*· αυτό απαντά *«πώς μοιάζει;»*. Η τομή είναι
 * στην **ερώτηση**, όχι στο όριο γραμμών — αν ήταν στο μέγεθος, θα έκοβε στη μέση των
 * πεδίων και το επόμενο πεδίο δεν θα ήξερε πού ανήκει.
 *
 * ⚠️ **Η υπόδειξη του καναλιού ζει στο ΤΕΛΕΥΤΑΙΟ πεδίο, επίτηδες**: *«αφήστε έναν
 * τρόπο»* αφορά **και τα δύο** email/τηλέφωνο, και διαβασμένη **μετά** και τα δύο έχει
 * νόημα· διαβασμένη πριν, θα φαινόταν απαίτηση του email.
 */
function DisclosureFields({
  values,
  onValuesChange,
  fieldId,
  sending,
  errorFor,
  onTouched,
}: DisclosureFieldsProps): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  return (
    <>
      <HintedField
        id={`${fieldId}-name`}
        label={t(ACT_KEYS.nameLabel)}
        labelSuffix={t(ACT_KEYS.requiredSuffix)}
        hint=""
        autoComplete="name"
        value={values.name}
        disabled={sending}
        error={errorFor('name')}
        onBlur={() => onTouched('name')}
        onChange={(name) => onValuesChange({ ...values, name })}
      />
      <HintedField
        id={`${fieldId}-email`}
        label={t(ACT_KEYS.emailLabel)}
        labelSuffix={t(ACT_KEYS.optionalSuffix)}
        hint=""
        type="email"
        autoComplete="email"
        value={values.email}
        disabled={sending}
        error={errorFor('email')}
        onBlur={() => onTouched('email')}
        onChange={(email) => onValuesChange({ ...values, email })}
      />
      <HintedField
        id={`${fieldId}-phone`}
        label={t(ACT_KEYS.phoneLabel)}
        labelSuffix={t(ACT_KEYS.optionalSuffix)}
        hint={t(ACT_KEYS.channelHint)}
        type="tel"
        autoComplete="tel"
        value={values.phone}
        disabled={sending}
        error={errorFor('phone')}
        onBlur={() => onTouched('phone')}
        onChange={(phone) => onValuesChange({ ...values, phone })}
      />
    </>
  );
}

interface FormErrorSummaryProps {
  readonly blockers: readonly FirstContactFormBlocker[];
  readonly fieldId: string;
  readonly title: string;
  readonly labelOf: (code: FirstContactFormBlocker) => string;
}

/**
 * **Η σύνοψη σφαλμάτων** — πρότυπο GOV.UK: ανακοινώνει, απαριθμεί, και **πηγαίνει**.
 *
 * 🔑 **Κουμπιά, όχι σύνδεσμοι `#hash`**: μέσα σε διάλογο ένα anchor θα άλλαζε τη
 * διεύθυνση της **από κάτω** σελίδας — και η επιστροφή θα έβγαζε τον άνθρωπο έξω.
 */
const FormErrorSummary = React.forwardRef<HTMLDivElement, FormErrorSummaryProps>(
  function FormErrorSummary({ blockers, fieldId, title, labelOf }, ref) {
    return (
      <section
        ref={ref}
        tabIndex={-1}
        role="alert"
        className="flex flex-col gap-2 rounded-md border-2 border-destructive p-3"
      >
        <p className="m-0 font-medium text-destructive">{title}</p>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
          {blockers.map((code) => (
            <li key={code}>
              <button
                type="button"
                className="text-left underline underline-offset-4"
                onClick={() => focusField(fieldId, BLOCKER_FIELD[code])}
              >
                {labelOf(code)}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  },
);

function focusField(fieldId: string, field: FieldName): void {
  document.getElementById(`${fieldId}-${field}`)?.focus();
}

/** Εξάγεται ώστε η άγκυρα να ελέγχει ότι **κάθε** πεδίο έχει θέση στη σειρά. */
export const DISCLOSURE_FIELD_ORDER = FIELD_ORDER;
