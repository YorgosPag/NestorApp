'use client';

/**
 * **ΕΝΑΣ ΑΞΟΝΑΣ, ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΠΟΥ ΤΟΥ ΑΝΑΛΟΓΕΙ** — ο **ένας** διανομέας.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΕΞΑΝΤΛΗΤΙΚΟΤΗΤΑ ΕΙΝΑΙ ΤΟΥ ΜΕΤΑΓΛΩΤΤΙΣΤΗ, ΟΧΙ ΤΗΣ ΠΡΟΣΟΧΗΣ ΜΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `switch` τρέχει πάνω στο {@link CriterionShape} — το **ίδιο** κλειστό λεξιλόγιο
 * που κρίνει ο `judgeCriterion`. Ένα **έκτο** σχήμα δεν μεταγλωττίζεται μέχρι να πει
 * **με τι ζωγραφίζεται**, με τον ίδιο φρουρό που το εμπόδισε να κριθεί σιωπηλά.
 *
 * ⚠️ Χωρίς αυτόν τον διανομέα, κάθε ομάδα του πάνελ θα έγραφε δικό της `if` πάνω στο
 * σχήμα — **έξι** αντίγραφα της ίδιας απόφασης, δηλαδή ο κλώνος που το `jscpd:diff`
 * (N.18) πιάνει **μέσα σε ένα diff**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΑ ΠΛΗΘΗ ΥΠΟΛΟΓΙΖΟΝΤΑΙ **ΕΔΩ**, ΑΝΑ ΟΡΑΤΟ ΑΞΟΝΑ — ΟΧΙ ΓΙΑ ΤΟΥΣ 31
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γονιός θα μπορούσε να τα μετρήσει όλα μαζί και να τα μοιράσει. **Απορρίφθηκε**:
 * ένας άξονας κλειστός μέσα σε `accordion` δεν ζωγραφίζει τίποτα, άρα δεν έχει τι να
 * μετρήσει — και με 2.000 αγγελίες η διαφορά είναι **31 περάσματα ή 3**. Το `useMemo`
 * ζει στο πιο κοντινό σημείο στην κατανάλωση, όπου ξέρει **ακριβώς** τι χρειάζεται.
 */

import React, { useMemo } from 'react';

import { criterionOptionTallies } from '@/lib/criteria/criterion-option-counts';
import { LISTING_CRITERION_ASKING } from '@/lib/criteria/listing-criterion-asking';
import type {
  CriterionKey,
  FlagCriterionKey,
  RangeCriterionKey,
  ValueSetCriterionKey,
} from '@/lib/criteria/listing-criterion-asking';
import type { ListingCriteria } from '@/lib/criteria/listing-criteria';
import type { PublicListing } from '@/types/public-listing';

import { CriterionFlagField } from './CriterionFlagField';
import { CriterionRangeField } from './CriterionRangeField';
import { CriterionValueSetField } from './CriterionValueSetField';
import { CriterionValueSetPopover } from './CriterionValueSetPopover';
import type { FilterCommit } from './use-filter-commit';

interface CriterionFieldProps {
  readonly criterionKey: CriterionKey;
  readonly criteria: ListingCriteria;
  /**
   * Ο κατάλογος **αφού** απαντηθούν οι άξονες εκτός του χάρτη κριτηρίων *(γεωγραφία ·
   * παράθυρο · άτομα)* και **πριν** κριθούν τα κριτήρια — το `withinScope` της οθόνης.
   *
   * ⚠️ **ΟΧΙ το φιλτραρισμένο `visible`, και ΟΧΙ ο ωμός κατάλογος.** Με το πρώτο, κάθε
   * ανεπίλεκτη τιμή θα μετρούσε **μηδέν**· με το δεύτερο, τα πλήθη θα υπόσχονταν
   * ακίνητα **έξω από την περιοχή** που διάλεξε ο άνθρωπος. Ο ίδιος ο άξονας
   * αφαιρείται μέσα στο {@link criterionOptionTallies}.
   */
  readonly listings: readonly PublicListing[];
  readonly commit: FilterCommit;
  /**
   * **Πόσο χώρο έχει αυτό το χειριστήριο** (ADR-777 §8.51).
   *
   * - `'panel'` *(προεπιλογή)* — κατακόρυφος χώρος, ένα ερώτημα τη φορά: η λίστα
   *   επιλογών ξεδιπλώνεται ολόκληρη.
   * - `'bar'` — **οριζόντιος** χώρος, τέσσερα ερωτήματα δίπλα-δίπλα, πάνω από χάρτη:
   *   η λίστα μπαίνει σε αναδυόμενο ({@link CriterionValueSetPopover}).
   *
   * ⚠️ **Δεν είναι διακόπτης ύφους — είναι ΣΥΜΒΟΛΑΙΟ ΧΩΡΟΥ.** Μετρήθηκε στην οθόνη:
   * με `'panel'` στη γραμμή, το «Είδος» ξεδίπλωνε **14** τετραγωνίδια και η γραμμή
   * γινόταν ψηλότερη από τον χάρτη.
   *
   * 🔑 Τα **αριθμητικά** και τα **ναι/όχι** δεν το χρειάζονται: ένα εύρος είναι δύο
   * πεδία και μια σημαία ένα τετραγωνίδιο — χωρούν και στα δύο επίπεδα **αυτούσια**.
   */
  readonly space?: 'panel' | 'bar';
}

export function CriterionField({
  criterionKey,
  criteria,
  listings,
  commit,
  space = 'panel',
}: CriterionFieldProps) {
  const shape = LISTING_CRITERION_ASKING[criterionKey];

  const tallies = useMemo(
    () =>
      shape === 'range' || shape === 'flag'
        ? []
        : criterionOptionTallies(listings, criteria, criterionKey as ValueSetCriterionKey),
    [shape, listings, criteria, criterionKey]
  );

  switch (shape) {
    case 'range':
      return (
        <CriterionRangeField
          criteria={criteria}
          criterionKey={criterionKey as RangeCriterionKey}
          commit={commit}
        />
      );
    case 'flag':
      return (
        <CriterionFlagField
          criteria={criteria}
          criterionKey={criterionKey as FlagCriterionKey}
          commit={commit}
        />
      );
    case 'enum-any':
    case 'set-any':
    case 'set-all': {
      // 🔑 **ΙΔΙΑ props, ΔΥΟ δοχεία** — το περιεχόμενο δεν ξαναγράφεται· το αναδυόμενο
      //    αποδίδει το **αυτούσιο** `CriterionValueSetField` μέσα του.
      const Container = space === 'bar' ? CriterionValueSetPopover : CriterionValueSetField;
      return (
        <Container
          criteria={criteria}
          criterionKey={criterionKey as ValueSetCriterionKey}
          tallies={tallies}
          commit={commit}
        />
      );
    }
  }
}
