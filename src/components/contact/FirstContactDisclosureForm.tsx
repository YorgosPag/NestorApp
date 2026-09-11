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
import type { FirstContactChannel } from '@/lib/contact/first-contact-channel';

import {
  ACT_KEYS,
  CHANNEL_EMAIL_HINT_KEYS,
  CHANNEL_NOTICE_KEYS,
  FIRST_CONTACT_NS,
  FORM_BLOCKER_KEYS,
} from './first-contact-labels';

type FieldName = keyof FirstContactFormValues;

const FIELD_ORDER: readonly FieldName[] = ['name', 'email', 'phone'];

export interface FirstContactDisclosureFormProps {
  readonly values: FirstContactFormValues;
  readonly onValuesChange: (values: FirstContactFormValues) => void;
  /**
   * **Από ποιο κανάλι θα φύγει η δήλωση** — η **ΙΔΙΑ** τιμή με την οποία ο διάλογος
   * διαλέγει δρόμο (ADR-844 §12). ⛔ Η φόρμα **δεν** την υπολογίζει μόνη της: δεύτερος
   * υπολογισμός θα ήταν δεύτερη απάντηση, και το κείμενο θα μπορούσε ξανά να πει άλλο
   * από αυτό που γίνεται.
   */
  readonly channel: FirstContactChannel;
  /** Το email είναι **δεμένο** στον λογαριασμό — `readOnly`, πρότυπο Airbnb/LinkedIn. */
  readonly emailLocked: boolean;
  readonly sending: boolean;
  /** Καλείται **μόνο** όταν δεν υπάρχει εμπόδιο — η φόρμα δεν στέλνει ό,τι δεν στέκει. */
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

export function FirstContactDisclosureForm({
  values,
  onValuesChange,
  channel,
  emailLocked,
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
        channel={channel}
        emailLocked={emailLocked}
        sending={sending}
        errorFor={errorFor}
        onTouched={markTouched}
      />

      {/*
        🔴 **ΤΙ ΘΑ ΣΥΜΒΕΙ — ΠΡΙΝ ΤΟ ΚΟΥΜΠΙ, ΚΑΙ ΑΝΑ ΚΑΝΑΛΙ** (ADR-844 #1 · §12).

        Ως τις 2026-09-11 εδώ ζούσε **μία** γραμμή *(«σας στέλνουμε σύνδεσμο»)* για
        **τέσσερις** συνέπειες — ψέμα για τον συνδεδεμένο με επιβεβαιωμένο email, για τον
        οποίο η πράξη φεύγει αμέσως. Τώρα η γραμμή είναι του **καναλιού** που θα
        χρησιμοποιηθεί, με την ίδια τιμή που διαλέγει τον δρόμο.

        ⚖️ Για τον **ανώνυμο** είναι η γραμμή του EDPB *(Recommendations 2/2025)*: ρητή
        ενημέρωση για το **γιατί** γεννιέται λογαριασμός, **πριν** την πράξη.

        ⚠️ **`<p>` μέσα στη φόρμα, ΟΧΙ tooltip / «μάθετε περισσότερα»**: ό,τι κρύβεται
        πίσω από κλικ δεν μετρά ως ενημέρωση *(Baymard: 20-30% πτώση όταν ο άνθρωπος
        δεν κατάλαβε γιατί του ζητήθηκε λογαριασμός)*.

        ⚠️ **ΔΕΝ είναι `role="alert"` ούτε `aria-live`**: τίποτα δεν συνέβη ακόμη, και το
        κανάλι **δεν αλλάζει** όσο ο άνθρωπος πληκτρολογεί *(το email του συνδεδεμένου
        είναι δεμένο)* — στατικό κείμενο, όπως ζητά το GOV.UK για υποδείξεις.
      */}
      <p id={`${fieldId}-notice`} className="m-0 text-xs text-muted-foreground">
        {t(CHANNEL_NOTICE_KEYS[channel])}
      </p>

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

          🔑 **`aria-describedby` → η σημείωση του καναλιού**: ο αναγνώστης οθόνης ακούει
          τη συνέπεια **τη στιγμή της απόφασης** — όταν εστιάζει το κουμπί — και όχι μόνο
          αν τύχει να διαβάσει την παράγραφο από πάνω.
        */}
        <Button type="submit" disabled={sending} aria-describedby={`${fieldId}-notice`}>
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
  readonly channel: FirstContactChannel;
  readonly emailLocked: boolean;
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
 * ⚠️ **ΚΑΘΕ ΠΕΔΙΟ ΕΧΕΙ ΠΛΕΟΝ ΤΗ ΔΙΚΗ ΤΟΥ ΥΠΟΔΕΙΞΗ** (ADR-844). Ως τις 2026-09-05 η
 * **μία** υπόδειξη ζούσε στο **τελευταίο** πεδίο, επειδή το *«αφήστε έναν τρόπο»*
 * αφορούσε **και τα δύο** και είχε νόημα μόνο διαβασμένο μετά και τα δύο.
 *
 * Με το email **απαιτούμενο** και το τηλέφωνο **προαιρετικό πρόσθετο**, οι δύο υποδείξεις
 * απαντούν πια σε **διαφορετική** ερώτηση — *«πού πάει ο σύνδεσμος;»* και *«τι κερδίζω
 * αν το αφήσω;»* — και μια κοινή υπόδειξη θα ήταν αναληθής και για τα δύο.
 */
function DisclosureFields({
  values,
  onValuesChange,
  fieldId,
  channel,
  emailLocked,
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
      {/*
        🔴 **ΑΠΑΙΤΟΥΜΕΝΟ ΑΠΟ 2026-09-05 (ADR-844 #3/#5).** Ήταν `optionalSuffix`, και
        ήταν **σωστό** όσο η απαίτηση ήταν *«άφησε έναν τρόπο»*. Έπαψε να είναι όταν
        αποφασίστηκε ότι **κανένα ανεπαλήθευτο κανάλι** δεν φτάνει στον ιδιοκτήτη: το
        email είναι το κανάλι που **μπορούμε να αποδείξουμε**, και η απόδειξή του είναι
        η προϋπόθεση της πράξης.

        🔴 **ΔΕΜΕΝΟ ΓΙΑ ΤΟΝ ΣΥΝΔΕΔΕΜΕΝΟ ΑΠΟ 2026-09-11 (ADR-844 §12, πρότυπο Airbnb/LinkedIn).**
        Όσο ήταν ελεύθερο, μια αλλαγή του έγραφε την επαφή σε **άλλον** λογαριασμό και
        **άλλαζε τη συνεδρία** μετά την επιβεβαίωση — χωρίς λέξη στην οθόνη.
        ⚠️ `readOnly`, **ΟΧΙ** `disabled`: μένει εστιάσιμο, αντιγράψιμο, και ο αναγνώστης
        οθόνης το διαβάζει μαζί με την υπόδειξη που λέει **γιατί** δεν αλλάζει. Χωρίς
        επίθεμα «(απαιτείται)»: ό,τι δεν συμπληρώνεις δεν σου ζητιέται.
      */}
      <HintedField
        id={`${fieldId}-email`}
        label={t(ACT_KEYS.emailLabel)}
        labelSuffix={emailLocked ? undefined : t(ACT_KEYS.requiredSuffix)}
        hint={t(CHANNEL_EMAIL_HINT_KEYS[channel])}
        type="email"
        autoComplete="email"
        value={values.email}
        readOnly={emailLocked}
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
