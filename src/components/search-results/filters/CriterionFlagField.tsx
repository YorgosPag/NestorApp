'use client';

/**
 * **ΕΝΑΣ ΑΞΟΝΑΣ ΝΑΙ/ΟΧΙ** — και το τετραγωνίδιο έχει **δύο** καταστάσεις, όχι τρεις.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΑΞΟΝΑΣ ΕΧΕΙ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ· ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΕΚΘΕΤΕΙ ΔΥΟ. ΕΙΝΑΙ ΑΠΟΦΑΣΗ.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `readFlag` της διεύθυνσης διαβάζει **τρεις**: απουσία *(«δεν με νοιάζει»)*, `1`
 * και `0` — και ο λόγος είναι γραμμένος εκεί: χωρίς το `0`, το *«μόνο ΧΩΡΙΣ
 * φωτογραφίες»* θα ήταν **ανέκφραστο**.
 *
 * ⚠️ **Το τετραγωνίδιο εκθέτει μόνο τις δύο χρήσιμες**: τσεκαρισμένο ⇒ `true`,
 * ξετσεκαρισμένο ⇒ **ο άξονας φεύγει** *(`undefined`)*. Κανείς επισκέπτης δεν ψάχνει
 * ακίνητα **χωρίς** φωτογραφίες· ένα τρίτο σκαλί *(«όχι»)* θα ήταν χειριστήριο για
 * ερώτηση που κανείς δεν κάνει — και θα έκανε το ξετσεκάρισμα **διφορούμενο**.
 *
 * 🔑 **Η τρίτη κατάσταση δεν χάνεται, μένει εκφράσιμη από τη διεύθυνση** (`?photos=0`).
 * Είναι το ίδιο ιδίωμα με τα άτομα του `StayFilterFields`: το χειριστήριο προσφέρει
 * τις συνήθεις τιμές, η διεύθυνση κρατά όλες.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Checkbox } from '@/components/ui/checkbox';
import type { FlagCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';
import { flagOf } from '@/lib/criteria/listing-criteria';
import type { ListingCriteria } from '@/lib/criteria/listing-criteria';
import { cn } from '@/lib/utils';

import type { FilterCommit } from './use-filter-commit';

interface CriterionFlagFieldProps {
  readonly criteria: ListingCriteria;
  readonly criterionKey: FlagCriterionKey;
  readonly commit: FilterCommit;
  readonly className?: string;
}

export function CriterionFlagField({
  criteria,
  criterionKey,
  commit,
  className,
}: CriterionFlagFieldProps) {
  const { t } = useTranslation(['search-filters', 'listing-detail']);
  const id = `criterion-${criterionKey}`;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Checkbox
        id={id}
        checked={flagOf(criteria, criterionKey) === true}
        // ⚠️ `undefined`, ΟΧΙ `false` — δες την κεφαλίδα.
        onCheckedChange={(state) =>
          commit.setFlag(criterionKey, state === true ? true : undefined)
        }
      />
      <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
        {criterionLabel(t, criterionKey)}
      </label>
    </div>
  );
}
