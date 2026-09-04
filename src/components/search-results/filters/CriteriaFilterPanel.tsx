'use client';

/**
 * **ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΤΟΥ ΔΕΥΤΕΡΟΥ ΕΠΙΠΕΔΟΥ** — και οι 31 άξονες, σε έξι ομάδες.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΔΩ ΖΕΙ ΤΟ «ΤΙ», ΟΧΙ ΤΟ «ΠΟΥ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **δοχείο** *(φύλλο σε κινητό ⇄ αναδυόμενο σε ευρεία)* το αποφασίζει ο γονιός
 * {@link PrimaryFilterBar}, γιατί είναι ερώτημα **οθόνης**. Εδώ ζει μόνο *«ποια
 * χειριστήρια, με ποια σειρά, κάτω από ποια κεφαλίδα»* — ερώτημα **τομέα**.
 *
 * ⚠️ Δύο συστατικά αντί για ένα **δεν είναι τελετουργία**: ένα αρχείο που ήξερε και τα
 * δύο θα ήταν το σημείο όπου η προσθήκη ενός άξονα θα σε ανάγκαζε να διαβάσεις τη
 * λογική του `Sheet` — και το αντίστροφο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 📐 ΓΙΑΤΙ `Accordion` ΜΕ ΠΟΛΛΑΠΛΑ ΑΝΟΙΧΤΑ, ΚΑΙ ΓΙΑΤΙ Η ΠΡΩΤΗ ΟΜΑΔΑ ΑΝΟΙΧΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `type="multiple"`: ο άνθρωπος που ψάχνει *«τζάκι ΚΑΙ φυσικό αέριο»* κοιτά **δύο**
 * ομάδες ταυτόχρονα. Ένα `single` θα έκλεινε τη μία κάθε φορά που ανοίγει η άλλη,
 * δηλαδή θα του έκρυβε ό,τι μόλις διάλεξε.
 *
 * ⚠️ **Η πρώτη ομάδα ανοίγει προεπιλεγμένα, και ΔΕΝ είναι τρίτο επίπεδο**: το πάνελ που
 * ανοίγει με **έξι κλειστές γραμμές** δεν έχει *«strong information scent»* (NN/g) —
 * ο άνθρωπος βλέπει έξι λέξεις και κανένα χειριστήριο, και δεν ξέρει τι υπάρχει μέσα.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { askedCriterionKeys } from '@/lib/criteria/listing-criteria';
import { criteriaGroupLabel } from '@/lib/criteria/listing-criterion-labels';
import type { ListingFilters } from '@/lib/listings/listing-filters';
import type { PublicListing } from '@/types/public-listing';
import { cn } from '@/lib/utils';

import { CRITERIA_FILTER_GROUPS } from './criteria-filter-groups';
import { CriterionField } from './CriterionField';
import type { FilterCommit } from './use-filter-commit';

interface CriteriaFilterPanelProps {
  readonly filters: ListingFilters;
  /** Ο κατάλογος **εντός εμβέλειας** (`withinScope`) — δες {@link CriterionField}. */
  readonly listings: readonly PublicListing[];
  readonly commit: FilterCommit;
  readonly className?: string;
}

export function CriteriaFilterPanel({
  filters,
  listings,
  commit,
  className,
}: CriteriaFilterPanelProps) {
  const { t } = useTranslation(['search-filters', 'search-results', 'listing-detail', 'properties-enums']);

  const asked = askedCriterionKeys(filters.criteria);
  const firstGroup = CRITERIA_FILTER_GROUPS[0]?.group;

  return (
    <section
      aria-label={t('search-filters:filters.heading')}
      className={cn('flex min-h-0 flex-col', className)}
    >
      <header className="flex items-center justify-between gap-2 pb-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t('search-filters:filters.heading')}
        </h2>

        {/*
          ⚠️ **Το «Καθαρισμός όλων» τυπώνεται ΜΟΝΟ όταν υπάρχει τι να καθαριστεί.**
          Ένα μονίμως ορατό κουμπί που δεν κάνει τίποτα διδάσκει τον επισκέπτη να μην
          το εμπιστεύεται — και η κατάσταση «κανένα φίλτρο» λέγεται με **λέξη**, όχι με
          απενεργοποιημένο χειριστήριο.
        */}
        {asked.length > 0 ? (
          <button
            type="button"
            onClick={commit.clearAllCriteria}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t('search-filters:filters.clearAll')}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t('search-filters:filters.empty')}
          </span>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Accordion
          type="multiple"
          defaultValue={firstGroup === undefined ? [] : [firstGroup]}
          className="w-full"
        >
          {CRITERIA_FILTER_GROUPS.map(({ group, keys }) => (
            <AccordionItem key={group} value={group}>
              <AccordionTrigger className="text-sm">
                {criteriaGroupLabel(t, group)}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-4 pb-2">
                  {keys.map((key) => (
                    <CriterionField
                      key={key}
                      criterionKey={key}
                      criteria={filters.criteria}
                      listings={listings}
                      commit={commit}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
