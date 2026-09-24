'use client';

/**
 * **Ο ΙΔΙΟΣ ΑΞΟΝΑΣ, ΣΕ ΜΙΑ ΓΡΑΜΜΗ** — το συμπαγές πρόσωπο του {@link CriterionValueSetField}.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ, ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΟΘΟΝΗ (2026-09-04)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πρώτη γραφή έβαζε **το ίδιο** χειριστήριο και στα δύο επίπεδα. Στο πάνελ ήταν
 * σωστό· στη **γραμμή** ήταν καταστροφή: το «Είδος» ξεδίπλωνε **δεκατέσσερα**
 * τετραγωνίδια σε κατακόρυφη στήλη, η γραμμή έγινε ψηλότερη από τον χάρτη, και οι
 * αριθμοί έφευγαν στην **άλλη άκρη της οθόνης** επειδή η ετικέτα κρατούσε `flex-1`
 * μέσα σε δοχείο πλάτους 900px.
 *
 * ⚠️ **Το πρόβλημα ΔΕΝ ήταν το στυλ — ήταν ότι το πρώτο επίπεδο έχει άλλο συμβόλαιο.**
 * Το πάνελ έχει **κατακόρυφο** χώρο και ένα ερώτημα ανά φορά· η γραμμή έχει
 * **οριζόντιο** χώρο και τέσσερα ερωτήματα δίπλα-δίπλα, πάνω από χάρτη όπου κάθε σειρά
 * που καταλαμβάνει είναι **χαμένη επιφάνεια χάρτη**.
 *
 * 🔑 **Ίδιο περιεχόμενο, άλλο δοχείο** — και το περιεχόμενο **δεν ξαναγράφεται**: μέσα
 * στο αναδυόμενο ζει το **αυτούσιο** {@link CriterionValueSetField}. Δύο αντίγραφα της
 * λίστας επιλογών θα ήταν ο δίδυμος κλώνος που πιάνει το `jscpd --diff` (N.18), και θα
 * απέκλιναν την πρώτη μέρα που αλλάξει η εμφάνιση των πληθών.
 *
 * ⚠️ **Η σύνοψη στο κουμπί λέει ΤΙ ΔΙΑΛΕΞΕ, όχι «Φίλτρο»**: ο άνθρωπος που έκλεισε το
 * αναδυόμενο πρέπει να βλέπει την επιλογή του **χωρίς να το ξανανοίξει** — αλλιώς το
 * πρώτο επίπεδο κρύβει ό,τι υποτίθεται ότι αναδεικνύει.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CriterionOptionTally } from '@/lib/criteria/criterion-option-counts';
import type { ValueSetCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import {
  criterionLabel,
  criterionValueLabel,
} from '@/lib/criteria/listing-criterion-labels';
import { valuesOf } from '@/lib/criteria/listing-criteria';
import type { ListingCriteria } from '@/lib/criteria/listing-criteria';
import { formatList } from '@/lib/intl-formatting';

import { CriterionBarPopover } from './CriterionBarPopover';
import { CriterionValueSetField } from './CriterionValueSetField';
import type { FilterCommit } from './use-filter-commit';

interface CriterionValueSetPopoverProps {
  readonly criteria: ListingCriteria;
  readonly criterionKey: ValueSetCriterionKey;
  readonly tallies: readonly CriterionOptionTally[];
  readonly commit: FilterCommit;
  readonly className?: string;
}

export function CriterionValueSetPopover({
  criteria,
  criterionKey,
  tallies,
  commit,
  className,
}: CriterionValueSetPopoverProps) {
  const { t } = useTranslation(['search-filters', 'search-results', 'listing-detail', 'properties-enums']);

  const chosen = valuesOf(criteria, criterionKey) ?? [];
  const axis = criterionLabel(t, criterionKey);

  /**
   * ⚠️ **Το «όλα» ΔΕΝ γράφεται εδώ ως λέξη-φίλτρο**: όταν κανείς δεν διάλεξε τίποτα, ο
   * άξονας **δεν ρωτά**, και το κουμπί δείχνει σκέτο το όνομά του. Ένα «Είδος: όλα» θα
   * διαβαζόταν ως **ενεργό** φίλτρο που δεν είναι.
   */
  const summary =
    chosen.length === 0
      ? axis
      : formatList(chosen.map((value) => criterionValueLabel(t, criterionKey, value)), 'disjunction');

  return (
    <CriterionBarPopover
      axis={axis}
      summary={summary}
      active={chosen.length > 0}
      count={chosen.length}
      className={className}
    >
      <CriterionValueSetField
        criteria={criteria}
        criterionKey={criterionKey}
        tallies={tallies}
        commit={commit}
      />
    </CriterionBarPopover>
  );
}
