'use client';

/**
 * @fileoverview **ΤΑ ΠΕΔΙΑ ΤΗΣ ΕΝΤΟΛΗΣ** — για ποιον, μέχρι πότε, και πώς το ξέρουμε.
 * @related ADR-777 §8.33 · lib/mandate/mandate-form-values.ts
 * @module components/mandate/BrokeredMandateFields
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΕΔΙΑ, ΚΑΙ ΤΟ ΤΡΙΤΟ ΕΙΝΑΙ ΟΛΟΚΛΗΡΗ Η ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο δρόμος της εντολής **δεν** είναι ρύθμιση — είναι η διαφορά ανάμεσα σε *«η αγγελία
 * περιμένει τον ιδιοκτήτη»* και *«η αγγελία είναι ήδη ζωντανή και ο ιδιοκτήτης έχει
 * δικαίωμα αντίρρησης»*. Γι' αυτό κάθε επιλογή γράφει **τι θα συμβεί**, δίπλα στο
 * κουμπί, πριν πατηθεί — όχι σε βοήθεια που κανείς δεν ανοίγει.
 *
 * ⚠️ **Ραδιοπλήκτρα, ΟΧΙ `Select`.** Δύο επιλογές με **διαφορετική συνέπεια** πρέπει
 * να είναι **και οι δύο ορατές ταυτόχρονα**· ένα κλειστό μενού κρύβει τη μία και
 * κάνει την προεπιλογή να μοιάζει με τη μόνη.
 *
 * ⚠️ Καμία συμβολοσειρά οθόνης εδώ (N.11).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { nowISO } from '@/lib/date-local';
import { Label } from '@/components/ui/label';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import {
  AGENCY_ATTESTATION,
  MANDATE_PROOF_VIAS,
  OWNER_CONSENT,
  type MandateProofVia,
} from '@/types/owner-property-mandate';
import type { MandateFormValues } from '@/lib/mandate/mandate-form-values';

const NS = 'property-market';
const K = `${NS}:mandate.office`;

/** Τα κλειδιά κάθε δρόμου — **παράγονται από το κλειστό σύνολο**, ποτέ χειρόγραφη λίστα. */
const VIA_KEY: Record<MandateProofVia, { label: string; hint: string }> = {
  [OWNER_CONSENT]: { label: 'viaOwnerConsent', hint: 'viaOwnerConsentHint' },
  [AGENCY_ATTESTATION]: {
    label: 'viaAgencyAttestation',
    hint: 'viaAgencyAttestationHint',
  },
};

export function BrokeredMandateFields({
  values,
  clients,
  onChange,
}: {
  values: MandateFormValues;
  clients: readonly ComboboxOption[];
  onChange: (next: MandateFormValues) => void;
}): React.ReactElement {
  const { t } = useTranslation([NS]);

  // ⚠️ Το ρολόι διαβάζεται **μία φορά** στη ζωή του component: ένα `nowISO()` μέσα στο
  // JSX θα ξαναϋπολογιζόταν σε κάθε πάτημα πλήκτρου, χωρίς κανέναν καταναλωτή.
  const [todayISODate] = React.useState(() => nowISO().slice(0, 10));

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-medium text-foreground">
        {t(`${K}.newTitle`)}
      </legend>

      <div className="flex flex-col gap-1.5">
        {/*
          ⚠️ **στοιχείο `span` και όχι `Label` με `htmlFor`**: το `SearchableCombobox` δεν δέχεται
          `id` (δες `searchable-combobox-types.ts`), οπότε ένα `htmlFor` θα έδειχνε σε
          στοιχείο που **δεν υπάρχει** — ετικέτα που ο αναγνώστης οθόνης ανακοινώνει
          και δεν συνδέει με τίποτα είναι χειρότερη από καμία. Το ίδιο κάνουν οι
          υπάρχοντες επιλογείς (`MinistryPicker` · `KadCodePicker`).
        */}
        <span className="text-sm font-medium text-foreground">{t(`${K}.clientLabel`)}</span>
        <SearchableCombobox
          options={[...clients]}
          value={values.clientContactId}
          onValueChange={(clientContactId) => onChange({ ...values, clientContactId })}
          placeholder={t(`${K}.clientPlaceholder`)}
        />
        <p className="text-xs text-muted-foreground">{t(`${K}.clientHint`)}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mandate-until">{t(`${K}.untilLabel`)}</Label>
        {/*
          🔴 **`min` = ΣΗΜΕΡΑ, και είναι ΖΩΝΗ ΚΑΙ ΤΙΡΑΝΤΕΣ, όχι διακόσμηση** (N.7.2 #4).
          Η ημερομηνία στο παρελθόν είναι **invariant του μοντέλου** (`mandate-expiry-past`)
          και ο διακομιστής την απορρίπτει — αλλά τότε ο μεσίτης το μαθαίνει **μετά** την
          υποβολή. Εδώ ο ίδιος ο επιλογέας του browser την κάνει **δύσκολο να διαλεχθεί**,
          χωρίς να αντικαταστήσει τον φρουρό: αν φτάσει ούτως ή άλλως (επικόλληση,
          παλιό πρόγραμμα περιήγησης), η πύλη γραφής **εξακολουθεί** να λέει όχι.
        */}
        <Input
          id="mandate-until"
          type="date"
          min={todayISODate}
          value={values.expiresOn}
          onChange={(event) => onChange({ ...values, expiresOn: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t(`${K}.untilHint`)}</p>
      </div>

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
    </fieldset>
  );
}
