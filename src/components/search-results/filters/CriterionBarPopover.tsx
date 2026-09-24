'use client';

/**
 * **ΤΟ ΚΕΛΥΦΟΣ ΚΑΘΕ ΤΣΙΠ ΤΗΣ ΓΡΑΜΜΗΣ** — κουμπί με τη σύνοψη της επιλογής, αναδυόμενο με το χειριστήριο.
 *
 * @related ADR-777 §8.80 · §8.51 · CriterionValueSetPopover · CriterionRangePopover · StayFilterChip
 * @module components/search-results/filters/CriterionBarPopover
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ ΣΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΤΟΥ GIORGIO (2026-09-24)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κεφαλίδα της οθόνης 2 έπιανε **~425px** πριν από τον χάρτη (της Zillow **~220px**): τα εύρη
 * ήταν **ανοιχτά** πεδία «Από/Έως» στη γραμμή, και οι ημερομηνίες διαμονής μια **δεύτερη** γραμμή
 * με δύο βοηθητικές παραγράφους — ακόμη και σε «Πώληση». Zillow · Redfin · Airbnb λύνουν το ίδιο
 * πρόβλημα με **ένα** ιδίωμα: τσιπ που λέει **τι διάλεξες** και ανοίγει το χειριστήριο από κάτω.
 *
 * 🔑 **Ένα κέλυφος, τρία περιεχόμενα** (N.18): λίστα τιμών, εύρος, διαμονή. Το περιεχόμενο **δεν
 * ξαναγράφεται** — μπαίνει αυτούσιο. Τρία αντίγραφα του κουμπιού θα απέκλιναν την πρώτη μέρα που
 * αλλάζει η όψη του «ενεργού».
 *
 * ⚠️ **Το ΟΡΑΤΟ κείμενο είναι η σύνοψη, το ΠΡΟΣΒΑΣΙΜΟ όνομα είναι ο άξονας** (μετρημένο στο δέντρο
 * προσβασιμότητας, §8.51): μετά την επιλογή το κουμπί γράφει «Πώληση», και χωρίς `aria-label` ο
 * αναγνώστης οθόνης θα άκουγε μια τιμή χωρίς να μάθει **ποια ερώτηση** απαντά.
 *
 * ⚠️ **Ενεργό ⇔ ΔΥΟ κανάλια, όχι μόνο χρώμα** (CHECK 3.41 · WCAG 1.4.1): χρώμα κειμένου **και**
 * περίγραμμα **και**, όπου υπάρχει πλήθος, αριθμός.
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';

interface CriterionBarPopoverProps {
  /** Το **όνομα της ερώτησης** — γίνεται το προσβάσιμο όνομα του κουμπιού. */
  readonly axis: string;
  /** Τι βλέπει ο άνθρωπος στο κουμπί: η επιλογή του, ή το όνομα του άξονα αν δεν ρώτησε. */
  readonly summary: string;
  readonly active: boolean;
  /**
   * Πλήθος επιλογών (λίστα τιμών) — `undefined` όταν ο άξονας δεν μετριέται σε κομμάτια.
   * ⚠️ Ο αριθμός φαίνεται **από 2 και πάνω**: με μία επιλογή η σύνοψη την ονομάζει ήδη, και το
   * «Πώληση 1» του πρώτου ζωντανού ελέγχου (§8.80) ήταν θόρυβος. Με δύο+ η σύνοψη κόβεται
   * (`truncate`), και ο αριθμός λέει πόσες κρύβει.
   */
  readonly count?: number;
  /** Πλάτος/ύψος του αναδυόμενου — το ορίζει το περιεχόμενο. */
  readonly contentClassName?: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function CriterionBarPopover({
  axis,
  summary,
  active,
  count,
  contentClassName,
  className,
  children,
}: CriterionBarPopoverProps) {
  // Εφήμερη κατάσταση χειρισμού — όχι τιμή φίλτρου (ίδιος κανόνας με το «Περισσότερα φίλτρα»).
  const [open, setOpen] = useState(false);
  const iconSizes = useIconSizes();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={axis}
          className={cn(
            'inline-flex max-w-56 shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-left text-sm hover:bg-accent',
            active ? 'border-ring font-medium text-foreground' : 'border-input text-muted-foreground',
            className,
          )}
        >
          {/* `truncate`: μια μακριά σύνοψη δεν επιτρέπεται να σπρώξει τους γείτονες εκτός γραμμής. */}
          <span className="truncate">{summary}</span>
          {count !== undefined && count > 1 && (
            <span className="shrink-0 rounded bg-secondary px-1.5 text-xs tabular-nums text-secondary-foreground">
              {count}
            </span>
          )}
          <ChevronDown className={cn(iconSizes.sm, 'shrink-0 opacity-60')} aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className={cn('max-h-[70vh] w-72 overflow-y-auto p-3', contentClassName)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
