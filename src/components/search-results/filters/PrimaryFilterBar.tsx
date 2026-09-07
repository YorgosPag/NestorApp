'use client';

/**
 * **ΤΟ ΠΡΩΤΟ ΕΠΙΠΕΔΟ** — τέσσερα χειριστήρια, και **μία** πόρτα προς τα υπόλοιπα 27.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 📱 ΔΥΟ ΣΥΜΠΕΡΙΦΟΡΕΣ, **ΕΝΑ** ΚΑΤΩΦΛΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το Baymard μετρά δύο **διαφορετικές** σωστές συμπεριφορές:
 *
 * | | Ευρεία | Στενή |
 * |---|---|---|
 * | δοχείο | `Popover` δίπλα στο κουμπί | `Sheet` από κάτω, πλήρους πλάτους |
 * | ενημέρωση | **ζωντανή** — τα αποτελέσματα αλλάζουν πίσω από το πάνελ | **ρητή** — «Δείξε N αποτελέσματα» |
 *
 * 🔑 **Το κατώφλι είναι το ΙΔΙΟ `useViewportClass()` (768)** που χρησιμοποιεί ήδη το
 * `ResultsSheet`. Ένας δεύτερος αριθμός εδώ θα σήμαινε ότι σε κάποιο πλάτος η λίστα
 * θα ήταν «κινητό» και τα φίλτρα «οθόνη» — το ακριβές ελάττωμα που το
 * `SearchResultsContent` κατέγραψε όταν έδιωξε το `lg` (1024) δίπλα στο 768.
 *
 * ⚠️ **ΚΑΙ ΣΤΙΣ ΔΥΟ, Η ΓΡΑΨΙΜΟ ΕΙΝΑΙ ΑΜΕΣΟ.** Το «Δείξε N» **δεν** είναι «εφαρμογή» —
 * τα φίλτρα έχουν ήδη γραφτεί στη διεύθυνση. Είναι *«κλείσε και δες»*, με τον αριθμό
 * **μέσα** του ώστε ο άνθρωπος να ξέρει τι τον περιμένει πριν κλείσει. Ένα πραγματικό
 * «εφαρμογή» θα απαιτούσε **δεύτερο αντίγραφο** των φιλτρων σε μνήμη — ακριβώς το
 * `useState` που ολόκληρη η οθόνη αρνείται.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🖼️ Ο ΠΡΩΤΟΣ ΚΑΡΕΣ — `measuring` ΔΕΝ ΜΕΤΑΠΗΔΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `useViewportClass` απαντά ειλικρινά `'measuring'` πριν μετρήσει. Η **γραμμή** και
 * το **κουμπί** ζωγραφίζονται **ταυτόσημα** και στις τρεις καταστάσεις — μόνο το
 * **κλειστό** δοχείο διαφέρει, οπότε δεν υπάρχει τίποτα να μεταπηδήσει (Α19,
 * `CLS < 0,1`). Το `measuring` κρατά το αναδυόμενο επειδή είναι η **λιγότερο
 * παρεμβατική** εκδοχή αν κάποιος προλάβει να πατήσει.
 */

import React, { useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { ViewportClass } from '@/hooks/media/useViewportClass';
import { askedCriterionKeys } from '@/lib/criteria/listing-criteria';
import type { ListingFilters } from '@/lib/listings/listing-filters';
import type { ListingOrder } from '@/lib/listings/listing-results-order';
import type { PublicListing } from '@/types/public-listing';
import { cn } from '@/lib/utils';

import { PRIMARY_CRITERION_KEYS } from './criteria-filter-groups';
import { CriteriaFilterPanel } from './CriteriaFilterPanel';
import { CriterionField } from './CriterionField';
import { ResultsOrderSelect } from './ResultsOrderSelect';
import { useFilterCommit } from './use-filter-commit';

interface PrimaryFilterBarProps {
  readonly filters: ListingFilters;
  /** Η **δηλωμένη σειρά** των αποτελεσμάτων (ADR-777 §8.61) — έρχεται από τη διεύθυνση. */
  readonly order: ListingOrder;
  /** Ο κατάλογος **εντός εμβέλειας** (`withinScope`) — δες {@link CriterionField}. */
  readonly listings: readonly PublicListing[];
  /** Πόσα βλέπει **αυτή τη στιγμή** ο άνθρωπος — ο αριθμός μέσα στο «Δείξε N». */
  readonly visibleCount: number;
  readonly viewport: ViewportClass;
  readonly className?: string;
}

export function PrimaryFilterBar({
  filters,
  order,
  listings,
  visibleCount,
  viewport,
  className,
}: PrimaryFilterBarProps) {
  const { t } = useTranslation(['search-filters', 'search-results', 'listing-detail', 'properties-enums']);
  const commit = useFilterCommit(filters);

  /**
   * ⚠️ **Η ΜΟΝΗ `useState` ΤΗΣ ΟΘΟΝΗΣ ΦΙΛΤΡΩΝ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΤΙΜΗ ΦΙΛΤΡΟΥ.**
   * Το «είναι ανοιχτό το πάνελ;» είναι **εφήμερη κατάσταση χειρισμού**: δεν πρέπει να
   * ταξιδέψει σε κοινοποιημένο σύνδεσμο *(«άνοιξέ μου το συρτάρι» δεν είναι ερώτηση
   * για ακίνητα)* και δεν πρέπει να επιβιώνει του «πίσω». Ο κανόνας *«καμία `useState`»*
   * αφορά **τιμές φίλτρων**, και αυτή δεν είναι.
   */
  const [open, setOpen] = useState(false);

  const askedCount = askedCriterionKeys(filters.criteria).length;

  /**
   * 🔑 **Το κείμενο του κουμπιού λέει ΠΟΣΑ, όχι σκέτο «Περισσότερα»** — ρητή σύσταση
   * NN/g *(«the progression must have strong information scent»)*, και το ίδιο ιδίωμα
   * που εφαρμόζει ήδη η οθόνη 3 *(«1 δεν έχει δηλωθεί», όχι «Περισσότερα»)*.
   */
  const triggerLabel =
    askedCount > 0
      ? t('search-filters:filters.moreActive', { count: askedCount })
      : t('search-filters:filters.more');

  const trigger = (
    <button
      type="button"
      className="inline-flex shrink-0 items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground hover:bg-accent"
    >
      {triggerLabel}
      {askedCount > 0 && (
        <Badge variant="secondary" className="tabular-nums">
          {askedCount}
        </Badge>
      )}
    </button>
  );

  const panel = (
    <CriteriaFilterPanel
      filters={filters}
      listings={listings}
      commit={commit}
      className="min-h-0 flex-1"
    />
  );

  return (
    <section
      aria-label={t('search-filters:filters.heading')}
      className={cn('flex flex-wrap items-end gap-3', className)}
    >
      {/*
        📐 **ΣΤΑΘΕΡΟ ΠΛΑΤΟΣ ΑΝΑ ΧΕΙΡΙΣΤΗΡΙΟ, ΟΧΙ `flex-1`.** Το `flex-1` μοίραζε
        **ολόκληρο** το πλάτος της οθόνης στα τέσσερα, και μέσα σε δοχείο 900px η
        ετικέτα μιας επιλογής έσπρωχνε τον αριθμό της στην άλλη άκρη — μετρημένο.
        Εδώ κάθε χειριστήριο παίρνει **όσο χρειάζεται** και η γραμμή αναδιπλώνεται.
      */}
      {PRIMARY_CRITERION_KEYS.map((key) => (
        <div key={key} className="w-44 shrink-0">
          <CriterionField
            criterionKey={key}
            criteria={filters.criteria}
            listings={listings}
            commit={commit}
            space="bar"
          />
        </div>
      ))}

      {/*
        🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΧΕΙΡΙΣΤΗΡΙΟ ΠΡΩΤΟΥ ΕΠΙΠΕΔΟΥ, ΟΧΙ ΕΠΙΛΟΓΗ ΜΕΣΑ ΣΤΟ ΣΥΡΤΑΡΙ**
        (ADR-777 §8.61). Μέχρι σήμερα η κατάταξη ήταν **κρυφή παράμετρος** — κατά
        `documentId`, δηλαδή κατά τάξη συντάκτη. Μια θεραπεία κρυμμένη πίσω από ένα
        «Περισσότερα» θα άφηνε τον άνθρωπο να **μη μάθει ποτέ** ότι η σειρά είναι δική
        του απόφαση, και η υποχρέωση διαφάνειας (Καν. ΕΕ 2019/1150 · Οδηγία ΕΕ
        2019/2161) μιλά για ό,τι **βλέπει** ο καταναλωτής.

        ⚠️ **Ζει ΕΞΩ από τα κριτήρια, και το δείχνει ο «Καθαρισμός»**: εκείνος σβήνει
        **ερωτήσεις** για τα ακίνητα· η σειρά δεν είναι ερώτηση, είναι τρόπος θέασης, και
        δεν καθαρίζεται μαζί τους.
      */}
      <div className="w-52 shrink-0">
        <ResultsOrderSelect order={order} onChange={commit.setOrder} />
        {/*
          🔴 **Η ΣΙΩΠΗ ΤΗΣ ΒΥΘΙΣΗΣ ΘΑ ΗΤΑΝ ΤΟ ΙΔΙΟ ΑΜΑΡΤΗΜΑ, ΣΕ ΝΕΑ ΘΕΣΗ.** Στη διάταξη
          «νεότερες», οι αγγελίες χωρίς καταγεγραμμένη ημερομηνία πέφτουν στο τέλος. Αν
          έπεφταν **σιωπηλά**, θα είχαμε ξαναφτιάξει αδήλωτη κατάταξη — ακριβώς αυτό που
          αυτή η δουλειά διορθώνει.

          🔑 **Ο κανόνας δηλώνεται ΜΙΑ φορά, εδώ, αντί για μία γραμμή σε ΚΑΘΕ κάρτα** —
          και είναι η **σωστότερη** μορφή, όχι απλώς η φθηνότερη: η υποχρέωση (Καν. ΕΕ
          2019/1150 · Οδηγία ΕΕ 2019/2161) αφορά τα **κριτήρια κατάταξης**, δηλαδή τον
          κανόνα — όχι το κάθε αντικείμενο.

          ⚠️ **Και το μέτρησε η πύλη**: η `ListingCard` ζει **μέσα στο κέλυφος**, οπότε
          μια γραμμή εκεί ζητούσε νέο namespace σε ~150 διαδρομές (`generate:i18n-shell-slice`
          — *«η θεραπεία είναι να ΚΟΠΕΙ η εισαγωγή, όχι να δηλωθεί το namespace»*).

          ⚠️ **Εμφανίζεται μόνο όταν ΥΠΑΡΧΕΙ τέτοια αγγελία** — ίδιο ιδίωμα με τον
          «Καθαρισμό» παρακάτω: μονίμως ορατή σημείωση που δεν αφορά τίποτα διδάσκει τον
          επισκέπτη να την αγνοεί.
        */}
        {order === 'newest' && listings.some((l) => l.listedAt.kind === 'unknown') && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('search-filters:filters.sort.unknownLast')}
          </p>
        )}
      </div>

      {/*
        🔴 **Η ΕΞΟΔΟΣ, ΣΤΟ ΠΡΩΤΟ ΕΠΙΠΕΔΟ — ΚΑΙ ΤΟ ΕΛΑΤΤΩΜΑ ΗΤΑΝ ΜΕΤΡΗΜΕΝΟ.**

        Η πρώτη γραφή είχε τον «Καθαρισμό» **μόνο μέσα** στο πάνελ. Παρατηρήθηκε ζωντανά
        (2026-09-04): με `?bathmin=1&bathmax=1` η οθόνη έδειχνε 2 αγγελίες, **καμία στον
        χάρτη**, και ο άνθρωπος **δεν είχε τρόπο να βγει** χωρίς να ανοίξει ξανά το
        συρτάρι και να θυμηθεί τι είχε πατήσει.

        ⚠️ Είναι ακριβώς ο κανόνας που η έρευνα ονομάζει **αδιέξοδο**: *«κενό αποτέλεσμα
        — ή απόκλεισε την επιλογή, ή δώσε διαδρομή επιστροφής»*. Εμείς δεν αποκλείουμε
        επιλογές *(τα πλήθη τις δείχνουν όλες, με τον αριθμό τους)*, άρα **οφείλουμε** τη
        διαδρομή επιστροφής — και οφείλει να είναι **ορατή**, όχι κρυμμένη.

        🔑 **Εμφανίζεται μόνο όταν υπάρχει τι να καθαριστεί** — ίδιο ιδίωμα με το πάνελ:
        μονίμως ορατό κουμπί που δεν κάνει τίποτα διδάσκει τον επισκέπτη να το αγνοεί.
      */}
      {askedCount > 0 && (
        <button
          type="button"
          onClick={commit.clearAllCriteria}
          className="shrink-0 rounded-md px-2 py-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t('search-filters:filters.clearAll')}
        </button>
      )}

      {viewport === 'narrow' ? (
          <Sheet open={open} onOpenChange={setOpen}>
            {/*
              ⚠️ **ΤΟ ΙΔΙΟ `trigger`, ΟΧΙ ΔΕΥΤΕΡΟ ΓΡΑΜΜΕΝΟ.** Η πρώτη γραφή είχε το
              κουμπί **δύο φορές** — μια για κάθε δοχείο — δηλαδή δίδυμο κλώνο **μέσα
              στο ίδιο αρχείο**, που είναι ακριβώς η κλάση που πιάνει το `jscpd --diff`
              (N.18). Και το ελάττωμα δεν θα ήταν θεωρητικό: η ημέρα που αλλάζει το
              στυλ του κουμπιού είναι η ημέρα που αλλάζει **σε μία από τις δύο οθόνες**.
            */}
            <SheetTrigger asChild>{trigger}</SheetTrigger>
            {/*
              `side="bottom"`: το φύλλο φιλτρων έρχεται από **κάτω**, εκεί που φτάνει ο
              αντίχειρας — η ίδια σύμβαση με το `ResultsSheet` της ίδιας οθόνης, όχι
              δεύτερη γλώσσα χειρονομιών στην ίδια σελίδα.
            */}
            <SheetContent side="bottom" className="flex max-h-[85vh] flex-col">
              <SheetTitle>{t('search-filters:filters.heading')}</SheetTitle>
              {panel}
              {/*
                🔴 **ΡΗΤΟ ΚΛΕΙΣΙΜΟ ΜΕ ΤΟΝ ΑΡΙΘΜΟ ΜΕΣΑ** (Baymard, στενή οθόνη): ο άνθρωπος
                δεν βλέπει τα αποτελέσματα πίσω από το φύλλο, άρα χρειάζεται να **ξέρει**
                τι τον περιμένει πριν κλείσει. Το `=0` σκέλος λέει «Κανένα αποτέλεσμα»
                αντί «Δείξε 0» — αδιέξοδο που **ονομάζεται**, όχι κουμπί που ψεύδεται.
              */}
              <footer className="pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {t('search-filters:filters.apply', { count: visibleCount })}
                </button>
              </footer>
            </SheetContent>
          </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" className="flex max-h-[70vh] w-96 flex-col p-4">
            {panel}
          </PopoverContent>
        </Popover>
      )}
    </section>
  );
}

