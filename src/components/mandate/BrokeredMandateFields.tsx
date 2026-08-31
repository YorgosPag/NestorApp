'use client';

/**
 * @fileoverview **ΤΑ ΠΕΔΙΑ ΤΗΣ ΕΝΤΟΛΗΣ** — για ποιον, τι είδους, μέχρι πότε, με τι αμοιβή, και πώς το ξέρουμε.
 * @related ADR-827 §8.9 · ADR-777 §8.33 · lib/mandate/mandate-form-values.ts
 * @module components/mandate/BrokeredMandateFields
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΗΤΑΝ ΤΡΙΑ ΠΕΔΙΑ ΚΑΙ ΕΠΡΕΠΕ ΝΑ ΕΙΝΑΙ ΠΕΝΤΕ — **Η ΡΟΗ ΗΤΑΝ ΣΠΑΣΜΕΝΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Φάση Α του ADR-827 έκανε το **είδος εντολής** και την **αμοιβή** υποχρεωτικά στον
 * τύπο, στο zod σχήμα και στη διαδρομή — αλλά **η φόρμα δεν απέκτησε ποτέ πεδία**.
 * Κάθε καταχώρηση εντολής από τη διεπαφή έπεφτε στο `z.enum` ως `undefined`
 * *(ADR-827 §8.9, εντοπίστηκε 2026-08-29)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΙ ΤΟ ΕΙΔΟΣ **ΔΕΝ** ΕΙΝΑΙ ΑΛΛΟ ΕΝΑ ΠΕΔΙΟ — ΚΑΘΟΡΙΖΕΙ ΤΟ ΟΡΙΟ ΤΟΥ ΔΙΠΛΑΝΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **άρθρο 200 Ν.4072/2012** δίνει **8** μήνες στην αποκλειστική (§4) και **12** στην
 * απλή (§3). Άρα η επιλογή του είδους **μετακινεί το ταβάνι της ημερομηνίας** —
 * γι' αυτό τα δύο πεδία ζουν στο **ίδιο** υπο-component και το `max` του επιλογέα
 * υπολογίζεται από το τρέχον είδος.
 *
 * ⚠️ **Ραδιοπλήκτρα, ΟΧΙ `Select`.** Επιλογές με **διαφορετική νομική συνέπεια** πρέπει
 * να είναι **όλες ορατές ταυτόχρονα**· ένα κλειστό μενού κρύβει τις υπόλοιπες και
 * κάνει την προεπιλογή να μοιάζει με τη μόνη. Ισχύει και για τους δύο δρόμους
 * απόδειξης και για τα τέσσερα είδη εντολής.
 *
 * ⚠️ **Το αρχείο σπάστηκε σε υπο-components στις 2026-08-29** (N.7.1): το ενιαίο
 * `BrokeredMandateFields` ήταν ήδη **75 γραμμές** πριν τα δύο νέα πεδία. Κάθε πεδίο
 * είναι πλέον δική του συνάρτηση, και το κέλυφος διαβάζεται με μια ματιά.
 *
 * ⚠️ Καμία συμβολοσειρά οθόνης εδώ (N.11).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { nowISO } from '@/lib/date-local';
import type { MandateFormValues } from '@/lib/mandate/mandate-form-values';
import {
  LISTING_AGREEMENTS,
  statutoryTermLimitFor,
} from '@/types/listing-agreement';
import {
  AGENCY_ATTESTATION,
  defaultExpiryFor,
  MANDATE_PROOF_VIAS,
  OWNER_CONSENT,
  type MandateProofVia,
} from '@/types/owner-property-mandate';

const NS = 'property-market';
const K = `${NS}:mandate.office`;

/**
 * **ΤΡΕΙΣ ΚΟΣΜΟΙ, ΟΧΙ ΕΝΑΣ ΚΕΝΟΣ ΠΙΝΑΚΑΣ** (ADR-834 §6.5.στ).
 *
 * 🔴 Ο επιλογέας έπαιρνε `readonly ComboboxOption[]`, οπότε **«φορτώνει»**,
 * **«απέτυχε»** και **«δεν έχεις επαφές»** έφταναν στην οθόνη ως το **ίδιο** κενό —
 * και η οθόνη διάλεγε το τρίτο. Μετρημένο ζωντανά 2026-08-31: ο μεσίτης έβλεπε πεδίο
 * που δεν άνοιγε τίποτα, χωρίς **καμία** ένδειξη γιατί, ενώ οι επαφές του υπήρχαν
 * (9 στη βάση). Το `.catch()` της σελίδας **έγραφε** την αποτυχία — στα logs, όπου
 * κανένας μεσίτης δεν κοιτάζει.
 *
 * 🔑 **Ίδιο δόγμα με το {@link MandateClientName} (§6.5.δ) και το `notifyOutcome`**:
 * όταν δύο κόσμοι θέλουν **διαφορετική** ενέργεια από τον άνθρωπο — *ανανέωσε τη
 * σελίδα* ⇄ *πρόσθεσε τον πελάτη στις Επαφές* — δεν επιτρέπεται να μοιράζονται
 * αναπαράσταση.
 *
 * ⛔ **ΜΗΝ το ξανακάνεις σκέτο πίνακα με `isLoading` δίπλα**: δύο ανεξάρτητα πεδία
 * επιτρέπουν τον **αδύνατο** συνδυασμό «φορτώνει **και** απέτυχε», και κάποιος θα τον
 * γράψει. Η ένωση τον κάνει **μη εκφράσιμο**.
 */
export type ClientsLoad =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly options: readonly ComboboxOption[] }
  | { readonly kind: 'failed' };

/** Τα κλειδιά κάθε δρόμου — **παράγονται από το κλειστό σύνολο**, ποτέ χειρόγραφη λίστα. */
const VIA_KEY: Record<MandateProofVia, { label: string; hint: string }> = {
  [OWNER_CONSENT]: { label: 'viaOwnerConsent', hint: 'viaOwnerConsentHint' },
  [AGENCY_ATTESTATION]: {
    label: 'viaAgencyAttestation',
    hint: 'viaAgencyAttestationHint',
  },
};

interface FieldProps {
  readonly values: MandateFormValues;
  readonly onChange: (next: MandateFormValues) => void;
}

// =============================================================================
// 1. Ο ΠΕΛΑΤΗΣ
// =============================================================================

function ClientField({
  values,
  clients,
  onChange,
}: FieldProps & { readonly clients: ClientsLoad }): React.ReactElement {
  const { t } = useTranslation([NS]);

  // ⚠️ **Μεμονωμένος πίνακας ανά κατάσταση, όχι ανά απόδοση.** Το
  // `options={[...clients]}` γεννούσε **νέα ταυτότητα πίνακα σε κάθε render**, και το
  // `SearchableCombobox` έχει το `options` στις εξαρτήσεις του effect συγχρονισμού —
  // δηλαδή δουλειά χωρίς καταναλωτή σε κάθε πληκτρολόγηση της φόρμας. Ίδιο σχήμα με το
  // `selector ?? []` που έχει ήδη κοστίσει βρόχο σε αυτό το δέντρο.
  const options = React.useMemo(
    () => (clients.kind === 'ready' ? [...clients.options] : []),
    [clients],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/*
        ⚠️ **στοιχείο `span` και όχι `Label` με `htmlFor`**: το `SearchableCombobox` δεν δέχεται
        `id` (δες `searchable-combobox-types.ts`), οπότε ένα `htmlFor` θα έδειχνε σε
        στοιχείο που **δεν υπάρχει** — ετικέτα που ο αναγνώστης οθόνης ανακοινώνει
        και δεν συνδέει με τίποτα είναι χειρότερη από καμία.
      */}
      <span className="text-sm font-medium text-foreground">{t(`${K}.clientLabel`)}</span>
      <SearchableCombobox
        options={options}
        value={values.clientContactId}
        onValueChange={(clientContactId) => onChange({ ...values, clientContactId })}
        placeholder={t(`${K}.clientPlaceholder`)}
        isLoading={clients.kind === 'loading'}
        emptyMessage={t(`${K}.clientsEmpty`)}
      />
      <p className="text-xs text-muted-foreground">{t(`${K}.clientHint`)}</p>

      {/*
        🔴 **Η ΑΠΟΤΥΧΙΑ ΦΤΑΝΕΙ ΣΤΟΝ ΑΝΘΡΩΠΟ, ΟΧΙ ΜΟΝΟ ΣΤΑ LOGS.** Και το κείμενο λέει
        ρητά *«δεν σημαίνει ότι δεν έχετε»*: αυτό ακριβώς ήταν το ελάττωμα — ο μεσίτης
        συμπέραινε ότι έφταιγαν τα δεδομένα του.
      */}
      {clients.kind === 'failed' && (
        <p role="alert" className="text-xs text-destructive">{t(`${K}.clientsFailed`)}</p>
      )}

      {/* Ο **τρίτος** κόσμος: ρωτήσαμε, απάντησε, και όντως δεν υπάρχει καμία επαφή. */}
      {clients.kind === 'ready' && clients.options.length === 0 && (
        <p className="text-xs text-muted-foreground">{t(`${K}.clientsNone`)}</p>
      )}
    </div>
  );
}

// =============================================================================
// 2. ΕΙΔΟΣ ΚΑΙ ΔΙΑΡΚΕΙΑ — **μαζί**, γιατί το πρώτο ορίζει το ταβάνι του δεύτερου
// =============================================================================

function AgreementField({ values, onChange }: FieldProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">
        {t(`${K}.agreementLabel`)}
      </span>
      {LISTING_AGREEMENTS.map((agreement) => (
        <label key={agreement} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="mandate-agreement"
            className="mt-1"
            checked={values.agreement === agreement}
            onChange={() => onChange({ ...values, agreement })}
          />
          <span className="flex flex-col">
            <span className="font-medium text-foreground">
              {t(`${K}.agreementOptions.${agreement}`)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(`${K}.agreementHints.${agreement}`)}
            </span>
          </span>
        </label>
      ))}
      <p className="text-xs text-muted-foreground">{t(`${K}.agreementHint`)}</p>
    </div>
  );
}

function ExpiryField({
  values,
  onChange,
  todayISO,
}: FieldProps & { readonly todayISO: string }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const limit = statutoryTermLimitFor(values.agreement);

  // 🔴 **`min` ΚΑΙ `max` = ΖΩΝΗ ΚΑΙ ΤΙΡΑΝΤΕΣ, όχι διακόσμηση** (N.7.2 #4). Και τα δύο
  //    είναι invariants του μοντέλου (`mandate-expiry-past` · `mandate-term-exceeds-statute`)
  //    που ο διακομιστής επιβάλλει ούτως ή άλλως — αλλά τότε ο μεσίτης το μαθαίνει
  //    **μετά** την υποβολή. Εδώ ο επιλογέας του browser τα κάνει δύσκολο να
  //    διαλεχθούν, **χωρίς** να αντικαταστήσει τον φρουρό.
  //
  // ⚠️ Το `max` **μετακινείται όταν αλλάξει το είδος** — και αν η ήδη επιλεγμένη
  //    ημερομηνία βρεθεί εκτός, ο κριτής της φόρμας (`mandate-term-illegal`) το λέει
  //    με λέξεις. Δεν «διορθώνουμε» σιωπηλά την επιλογή του ανθρώπου.
  const latest = defaultExpiryFor(values.agreement, todayISO);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="mandate-until">{t(`${K}.untilLabel`)}</Label>
      <Input
        id="mandate-until"
        type="date"
        min={todayISO.slice(0, 10)}
        max={latest?.slice(0, 10)}
        value={values.expiresOn}
        onChange={(event) => onChange({ ...values, expiresOn: event.target.value })}
      />
      {/*
        🏆 **Ο ΑΡΙΘΜΟΣ ΚΑΙ Η ΔΙΑΤΑΞΗ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΟ ΙΔΙΟ ΔΕΔΟΜΕΝΟ ΠΟΥ ΕΠΙΒΑΛΛΕΙ ΤΟ ΟΡΙΟ.**
        Τα MLS λένε «Invalid expiration date» και ο άνθρωπος δεν μαθαίνει ποτέ ποιος
        τον περιορίζει. Εδώ δεν μπορούν να αποκλίνουν: είναι το ίδιο `StatutoryTermLimit`.
      */}
      <p className="text-xs text-muted-foreground">
        {t(`${K}.untilHint`, {
          months: limit.maxMonths,
          authority: limit.authority,
        })}
      </p>
    </div>
  );
}

// =============================================================================
// 3. Η ΑΜΟΙΒΗ — ιδιωτική, ποτέ στη δημόσια αγγελία (ADR-827 Α5)
// =============================================================================

function CompensationField({ values, onChange }: FieldProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { compensation } = values;

  // ⚠️ Η οθόνη συντάσσει **μόνο** το ποσοστό: το σκέλος `fixed` υπάρχει στον τύπο και
  //    δεν έχει ακόμη πεδία. Δηλωμένη απουσία — ο μεσίτης που θέλει σταθερό ποσό δεν
  //    βλέπει μισό μηχανισμό που δεν αποθηκεύει.
  if (compensation.type !== 'percentage') return <></>;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="mandate-commission">{t(`${K}.commissionPercentage`)}</Label>
      <Input
        id="mandate-commission"
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={compensation.percentage}
        onChange={(event) =>
          onChange({
            ...values,
            compensation: {
              ...compensation,
              percentage: Number(event.target.value),
            },
          })
        }
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={compensation.vatIncluded}
          onChange={(event) =>
            onChange({
              ...values,
              compensation: { ...compensation, vatIncluded: event.target.checked },
            })
          }
        />
        <span className="text-foreground">{t(`${K}.commissionVatIncluded`)}</span>
      </label>
      <p className="text-xs text-muted-foreground">{t(`${K}.commissionHint`)}</p>
    </div>
  );
}

// =============================================================================
// 4. Ο ΔΡΟΜΟΣ ΤΗΣ ΑΠΟΔΕΙΞΗΣ — ολόκληρη η απόφαση
// =============================================================================

/**
 * Ο δρόμος της εντολής **δεν** είναι ρύθμιση — είναι η διαφορά ανάμεσα σε *«η αγγελία
 * περιμένει τον ιδιοκτήτη»* και *«η αγγελία είναι ήδη ζωντανή και ο ιδιοκτήτης έχει
 * δικαίωμα αντίρρησης»*. Γι' αυτό κάθε επιλογή γράφει **τι θα συμβεί**, δίπλα στο
 * κουμπί, πριν πατηθεί — όχι σε βοήθεια που κανείς δεν ανοίγει.
 */
function ViaField({ values, onChange }: FieldProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{t(`${K}.viaLabel`)}</span>
      {MANDATE_PROOF_VIAS.map((via) => (
        <label key={via} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="mandate-via"
            className="mt-1"
            checked={values.via === via}
            onChange={() => onChange({ ...values, via })}
          />
          <span className="flex flex-col">
            <span className="font-medium text-foreground">
              {t(`${K}.${VIA_KEY[via].label}`)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(`${K}.${VIA_KEY[via].hint}`)}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

// =============================================================================
// 5. ΤΟ ΚΕΛΥΦΟΣ
// =============================================================================

export function BrokeredMandateFields({
  values,
  clients,
  onChange,
}: {
  values: MandateFormValues;
  clients: ClientsLoad;
  onChange: (next: MandateFormValues) => void;
}): React.ReactElement {
  const { t } = useTranslation([NS]);

  // ⚠️ Το ρολόι διαβάζεται **μία φορά** στη ζωή του component: ένα `nowISO()` μέσα στο
  // JSX θα ξαναϋπολογιζόταν σε κάθε πάτημα πλήκτρου, χωρίς κανέναν καταναλωτή.
  const [todayISO] = React.useState(() => nowISO());

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-medium text-foreground">
        {t(`${K}.newTitle`)}
      </legend>

      <ClientField values={values} clients={clients} onChange={onChange} />
      <AgreementField values={values} onChange={onChange} />
      <ExpiryField values={values} onChange={onChange} todayISO={todayISO} />
      <CompensationField values={values} onChange={onChange} />
      <ViaField values={values} onChange={onChange} />
    </fieldset>
  );
}
