'use client';

/**
 * @fileoverview Ο επιλογέας υποψηφίου — **εκεί που ο άνθρωπος αποφασίζει** (ADR-745 Φ3β, Δ2).
 *
 * 🔴 **Γιατί υπάρχει.** Ο Λ2 παράγει το καρτεσιανό γινόμενο επαφών × ρόλων επίτηδες, γιατί το
 * ADR §6.4 ζητά *«να δει ο άνθρωπος τις πραγματικές επιλογές»*. Η γραμμή όμως έπαιρνε
 * `candidates[0]` και το κουμπί έγκρισης ήταν **ενεργό**: σε διφορούμενη ειδικότητα (η λέξη
 * «Μηχανικός» ανήκει σε **5 από τους 7** ρόλους) η βάση έγραφε **αυθαίρετο ρόλο** με το όνομα
 * ενός ανθρώπου από κάτω. Ο Λ2 έκανε τη δουλειά του· το UI δεν την παρελάμβανε.
 *
 * 🔑 **Ο ΡΟΛΟΣ πρέπει να φαίνεται, αλλιώς ο επιλογέας είναι διακοσμητικός.** Οι υποψήφιοι μιας
 * διφορούμενης ειδικότητας έχουν **ταυτόσημο** `label` και **ταυτόσημη** μαρτυρία — διαφέρουν
 * **μόνο** στον ρόλο. Λίστα με πέντε φορές «Μαυρομιχάλης Κωνσταντίνος» δεν είναι επιλογή, είναι
 * λαχείο.
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockCandidatePicker
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROJECT_ROLE_LABEL } from '@/config/project-role-labels';
import { targetRef } from '@/lib/title-block-binding-id';
import type { BindingCandidate } from '@/types/title-block-binding';

interface Props {
  readonly candidates: readonly BindingCandidate[];
  /** `null` = **καμία προεπιλογή**. Το κουμπί έγκρισης μένει κλειστό μέχρι να διαλέξει άνθρωπος. */
  readonly chosen: BindingCandidate | null;
  readonly onChoose: (candidate: BindingCandidate) => void;
  readonly disabled: boolean;
  /** Για μοναδικό `htmlFor`/`id` — μία πινακίδα δίνει πολλές γραμμές. */
  readonly fieldId: string;
}

export const TitleBlockCandidatePicker: React.FC<Props> = ({
  candidates,
  chosen,
  onChoose,
  disabled,
  fieldId,
}) => {
  // Το λεξιλόγιο ρόλων ζει στο `building-address` (SSoT — δες `config/project-role-labels`).
  // Χωρίς δηλωμένο namespace το i18next επιστρέφει το ίδιο το κλειδί.
  const { t } = useTranslation(['dxf-viewer-shell', 'building-address']);

  // 🔑 Το `targetRef` είναι η **ταυτότητα** του στόχου, όχι το `label`: το Radix Select απαιτεί
  // μοναδικό `value`, και σε διφορούμενη ειδικότητα τα labels είναι **όλα ίδια**.
  const optionValue = (candidate: BindingCandidate): string => targetRef(candidate.target);

  const optionLabel = (candidate: BindingCandidate): string =>
    candidate.target.kind === 'contact'
      ? `${candidate.label} — ${t(PROJECT_ROLE_LABEL[candidate.target.role])}`
      : candidate.label;

  return (
    <div className="mt-2">
      <label className="text-[11px] text-muted-foreground" htmlFor={fieldId}>
        {t('titleBlockBinding.chooseCandidate')}
      </label>
      <Select
        // `undefined` (όχι κενή συμβολοσειρά) ⇒ το Radix δείχνει το placeholder. Κενή τιμή θα
        // ήταν **επιλεγμένο τίποτα**, που μοιάζει με επιλογή που έγινε.
        value={chosen ? optionValue(chosen) : undefined}
        onValueChange={(value) => {
          const picked = candidates.find((c) => optionValue(c) === value);
          if (picked) onChoose(picked);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={fieldId} className="mt-1 h-8 text-sm">
          <SelectValue placeholder={t('titleBlockBinding.chooseCandidate')} />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((candidate) => (
            <SelectItem key={optionValue(candidate)} value={optionValue(candidate)}>
              {optionLabel(candidate)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
