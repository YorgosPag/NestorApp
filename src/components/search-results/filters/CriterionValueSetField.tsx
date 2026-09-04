'use client';

/**
 * **ΕΝΑΣ ΑΞΟΝΑΣ ΛΕΞΙΛΟΓΙΟΥ** — και **δίπλα σε κάθε επιλογή, οι δύο αριθμοί της**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΕΔΩ ΖΩΓΡΑΦΙΖΕΤΑΙ ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ ΕΙΜΑΣΤΕ ΜΟΝΟΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ```
 *   ☐ Φυσικό αέριο      3
 *   ☐ Πετρέλαιο         1
 *   ☐ Αντλία θερμότητας 0 · 4 χωρίς δήλωση     ← κανένα portal δεν το λέει
 * ```
 *
 * Το πλήθος ανά επιλογή είναι, μετρημένα, *«το μοναδικό υψηλότερης απόδοσης πράγμα σε
 * UI φίλτρων»* (Baymard) — και οι μεγάλοι το δίνουν **προσεγγιστικά**. Εμείς το δίνουμε
 * **ακριβές** *(ο κατάλογος είναι στη μνήμη)* και **με δεύτερο αριθμό**: το `0` χωρίς
 * τη σιωπή δίπλα του διαβάζεται *«δεν υπάρχει τέτοιο σπίτι»*, που είναι **ψευδές**.
 *
 * ⚠️ **Η σιωπή τυπώνεται ΜΟΝΟ όταν είναι μη μηδενική** — ίδιο ιδίωμα με το
 * `StayLedgerBar`: *«ένας κάδος στο μηδέν δεν είναι αριθμός που λείπει, δεν υπάρχει
 * τίποτα εκεί»*. Ο κανόνας *«το 0 τυπώνεται»* τηρείται στη **γραμμή λογιστικής**, που
 * απαντά για το σύνολο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ ΣΧΗΜΑ ΑΛΛΑΖΕΙ ΤΗ ΣΗΜΑΣΙΑ ΤΟΥ ΤΕΤΡΑΓΩΝΙΔΙΟΥ, ΚΑΙ ΔΕΝ ΚΡΥΒΕΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Σε `enum-any` / `set-any` κάθε τσεκάρισμα **ανοίγει** *(«ξύλο ή μάρμαρο»)*· σε
 * `set-all` **στενεύει** *(«με τζάκι ΚΑΙ τζακούζι»)*. Το χειριστήριο είναι το ίδιο
 * επειδή η **πράξη** είναι η ίδια — επιλέγω τιμές· η διαφορά ζει στον **κριτή**, όπου
 * και ανήκει. Δύο διαφορετικά χειριστήρια θα ζητούσαν από τον επισκέπτη να ξέρει τη
 * λογική μας.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Checkbox } from '@/components/ui/checkbox';
import type { CriterionOptionTally } from '@/lib/criteria/criterion-option-counts';
import type { ValueSetCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import {
  criterionLabel,
  criterionValueLabel,
} from '@/lib/criteria/listing-criterion-labels';
import { valuesOf } from '@/lib/criteria/listing-criteria';
import type { ListingCriteria } from '@/lib/criteria/listing-criteria';
import { cn } from '@/lib/utils';

import type { FilterCommit } from './use-filter-commit';

interface CriterionValueSetFieldProps {
  readonly criteria: ListingCriteria;
  readonly criterionKey: ValueSetCriterionKey;
  /** Οι επιλογές **με τα πλήθη τους**, στη σειρά του λεξιλογίου. */
  readonly tallies: readonly CriterionOptionTally[];
  readonly commit: FilterCommit;
  readonly className?: string;
}

export function CriterionValueSetField({
  criteria,
  criterionKey,
  tallies,
  commit,
  className,
}: CriterionValueSetFieldProps) {
  const { t } = useTranslation(['search-filters', 'search-results', 'listing-detail', 'properties-enums']);

  const chosen = valuesOf(criteria, criterionKey) ?? [];

  /**
   * ⚠️ **Η σειρά της νέας επιλογής ΔΕΝ είναι η σειρά του κλικ.** Το `withValues`
   * περνά από `keepKnownValues`, που κανονικοποιεί στη σειρά του **λεξιλογίου** — ώστε
   * `?amen=gym&amen=pool` και `?amen=pool&amen=gym` να είναι η **ίδια** διεύθυνση.
   */
  const toggle = (value: string, next: boolean): void => {
    const kept = next
      ? [...chosen, value]
      : chosen.filter((current) => current !== value);
    commit.setValues(criterionKey, kept);
  };

  return (
    <fieldset className={cn('flex flex-col gap-1', className)}>
      <legend className="text-sm font-medium text-foreground">
        {criterionLabel(t, criterionKey)}
      </legend>

      <ul className="flex flex-col gap-1">
        {tallies.map(({ value, count }) => {
          const id = `${criterionKey}-${value}`;
          return (
            <li key={value} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={chosen.includes(value)}
                onCheckedChange={(state) => toggle(value, state === true)}
              />
              {/*
                ⚠️ **`truncate` ΚΑΙ `min-w-0`, ΚΑΙ ΤΑ ΔΥΟ**: χωρίς το δεύτερο ένα
                flex παιδί αρνείται να συρρικνωθεί κάτω από το περιεχόμενό του (CSS
                Flexbox §4.5, `min-width:auto`) και η μακριά ετικέτα σπρώχνει τον
                αριθμό της **εκτός** του αναδυόμενου.
              */}
              <label
                htmlFor={id}
                className="min-w-0 flex-1 cursor-pointer truncate text-sm text-foreground"
              >
                {criterionValueLabel(t, criterionKey, value)}
              </label>

              {/*
                🔑 `tabular-nums`: οι αριθμοί στοιχίζονται κάθετα σε στήλη 14 γραμμών.
                Χωρίς αυτό, το «1» και το «8» έχουν άλλο πλάτος και η στήλη τρέμει.
              */}
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {count.matching}
              </span>

              {count.undeclared > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground/70">
                  {t('search-filters:filters.option.undeclared', {
                    count: count.undeclared,
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
