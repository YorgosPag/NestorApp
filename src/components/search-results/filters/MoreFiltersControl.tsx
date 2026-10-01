'use client';

/**
 * **«ΠΕΡΙΣΣΟΤΕΡΑ ΦΙΛΤΡΑ»** — η μία πόρτα προς όλους τους άξονες, καρφωμένη έξω από τη λωρίδα.
 * @related ADR-896 §7Α.7 · ADR-777 §8.51 · §8.80 · PrimaryFilterBar · CriteriaFilterPanel
 * @module components/search-results/filters/MoreFiltersControl
 *
 * Εξήχθη από την `PrimaryFilterBar` (SRP · N.7.1): κουμπί + δοχείο + πάνελ + «Δείξε N» + η εφήμερη
 * `open` είναι **μία** ευθύνη. Η μπάρα μένει σύνθεση.
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
 * 🖼️ **`measuring` ΔΕΝ ΜΕΤΑΠΗΔΑ**: το κουμπί ζωγραφίζεται ταυτόσημα και στις τρεις καταστάσεις·
 * διαφέρει μόνο το **κλειστό** δοχείο. Το `measuring` κρατά το αναδυόμενο, την **λιγότερο
 * παρεμβατική** εκδοχή αν κάποιος προλάβει να πατήσει.
 *
 * 📐 **Γιατί ιδιωτικό και όχι `ui/responsive-*`** (SSoT audit 2026-10-01): «φύλλο στο στενό /
 * αναδυόμενο στο ευρύ με ΕΝΑ κουμπί» υπάρχει **μόνο εδώ**. Η δεύτερη κατανάλωση προάγει το
 * κέλυφος σε `ui/` — όχι νωρίτερα (μία κατανάλωση = εικασία για το σχήμα της γενίκευσης).
 */

import React, { forwardRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import type { ViewportClass } from '@/hooks/media/useViewportClass';
import { useIconSizes } from '@/hooks/useIconSizes';
import { askedCriterionKeys, type ListingCriteria } from '@/lib/criteria/listing-criteria';
import type { ListingSearch } from '@/lib/listings/listing-filters';
import type { PublicListing } from '@/types/public-listing';
import { cn } from '@/lib/utils';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

import { PRIMARY_CRITERION_KEYS } from './criteria-filter-groups';
import { CriteriaFilterPanel } from './CriteriaFilterPanel';
import type { FilterCommit } from './use-filter-commit';

/**
 * 🔴 **§8.80: μετρά ΜΟΝΟ ό,τι δεν φαίνεται ήδη στη γραμμή** (πρότυπο Zillow «More»). Το
 * στιγμιότυπο έδειχνε «Περισσότερα φίλτρα · 1 ενεργό **1**» με μόνη ερώτηση τη «Πώληση» —
 * που κάθεται **ήδη** ως τσιπ δύο θέσεις αριστερά. Ο άνθρωπος άνοιγε το συρτάρι ψάχνοντας
 * ένα φίλτρο που δεν ήταν εκεί. Ο «Καθαρισμός» εξακολουθεί να μετρά **όλα**.
 */
export function countHiddenAsked(criteria: ListingCriteria): number {
  return askedCriterionKeys(criteria).filter(
    (key) => !(PRIMARY_CRITERION_KEYS as readonly string[]).includes(key),
  ).length;
}

type MoreFiltersButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly hiddenCount: number;
};

/**
 * 🔑 **Το κουμπί λέει ΠΟΣΑ, όχι σκέτο «Περισσότερα»** — ρητή σύσταση NN/g *(«the
 * progression must have strong information scent»)*: αριθμός ορατός, και πλήρης φράση ως
 * προσβάσιμο όνομα.
 *
 * `forwardRef` + `...props`: το `asChild` των `SheetTrigger`/`PopoverTrigger` περνά ref,
 * `onClick`, `aria-expanded` και `data-state` στο **ίδιο** element.
 */
const MoreFiltersButton = forwardRef<HTMLButtonElement, MoreFiltersButtonProps>(
  function MoreFiltersButton({ hiddenCount, ...props }, ref) {
    const { t } = useTranslation(['search-filters']);
    const iconSizes = useIconSizes();
    return (
      <button
        ref={ref}
        type="button"
        {...props}
        aria-label={
          hiddenCount > 0
            ? t('search-filters:filters.moreActive', { count: hiddenCount })
            : t('search-filters:filters.more')
        }
        // `self-stretch`: στο στενό μένει μόνο το εικονίδιο (16px αντί για γραμμή κειμένου 20px) και το
        // κουμπί έβγαινε 30px δίπλα σε τσιπ 34px — μετρημένο. Παίρνει το ύψος της γραμμής, όχι δικό του αριθμό.
        className="inline-flex shrink-0 items-center gap-2 self-stretch rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground hover:bg-accent"
      >
        {/*
          📱 Στενό: μόνο εικονίδιο + αριθμός (Airbnb/Zillow κινητού) — αλλιώς το καρφωμένο κουμπί θα
          έτρωγε το μισό πλάτος και η λωρίδα θα χωρούσε ένα τσιπ. Το κείμενο μένει για τον αναγνώστη
          οθόνης (`sr-only`), και το `aria-label` το ονομάζει ήδη. Στο `md:` του CSS (ADR-777 §8.84).
        */}
        <SlidersHorizontal className={cn(iconSizes.sm, 'shrink-0')} aria-hidden="true" />
        <span className="max-md:sr-only">{t('search-filters:filters.more')}</span>
        {hiddenCount > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {hiddenCount}
          </Badge>
        )}
      </button>
    );
  },
);

interface MoreFiltersSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly trigger: React.ReactElement;
  readonly panel: React.ReactNode;
  readonly visibleCount: number;
}

/** 📱 Στενό: φύλλο από κάτω, με ρητό «Δείξε N αποτελέσματα». */
function MoreFiltersSheet({ open, onOpenChange, trigger, panel, visibleCount }: MoreFiltersSheetProps) {
  const { t } = useTranslation(['search-filters']);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      {/*
        `side="bottom"`: το φύλλο φιλτρων έρχεται από **κάτω**, εκεί που φτάνει ο
        αντίχειρας — η ίδια σύμβαση με το `ResultsSheet` της ίδιας οθόνης, όχι
        δεύτερη γλώσσα χειρονομιών στην ίδια σελίδα.
      */}
      {/*
        🔑 ΕΝΑΣ τίτλος (ADR-896 §7Α.8): το όνομα του διαλόγου είναι η **ορατή** κεφαλίδα του πάνελ
        (`container="sheet"` ⇒ `SheetTitle`). Δεν υπάρχει περιγραφή, και το `aria-describedby={undefined}`
        το λέει ρητά στο Radix (τεκμηριωμένος τρόπος) αντί για ψεύτικο κείμενο.
      */}
      <SheetContent side="bottom" aria-describedby={undefined} className="flex max-h-[85vh] flex-col">
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
            onClick={() => onOpenChange(false)}
            /*
              🎯 Η ΚΥΡΙΑ ενέργεια του φύλλου ⇒ `COLOR_BRIDGE.action.primary` (ADR-770 §18). Ήταν `bg-primary`,
              και στο σκοτεινό `--primary` ≡ `--card`: το κουμπί έσβηνε μέσα στο φύλλο (ADR-896 §7Α.8).
            */
            className={cn('w-full rounded-md px-4 py-2 text-sm font-medium', COLOR_BRIDGE.action.primary)}
          >
            {t('search-filters:filters.apply', { count: visibleCount })}
          </button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

export interface MoreFiltersControlProps {
  readonly filters: ListingSearch;
  /** Ο κατάλογος **εντός εμβέλειας** (`withinScope`) — τα πλήθη του πάνελ. */
  readonly listings: readonly PublicListing[];
  /** Ο **ίδιος** γραφέας με τη μπάρα — ένα `useFilterCommit` ανά μπάρα, όχι δεύτερο. */
  readonly commit: FilterCommit;
  /** Πόσα βλέπει **αυτή τη στιγμή** ο άνθρωπος — ο αριθμός μέσα στο «Δείξε N». */
  readonly visibleCount: number;
  readonly viewport: ViewportClass;
}

export function MoreFiltersControl({ filters, listings, commit, visibleCount, viewport }: MoreFiltersControlProps) {
  /**
   * ⚠️ **Η ΜΟΝΗ `useState` ΤΗΣ ΟΘΟΝΗΣ ΦΙΛΤΡΩΝ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΤΙΜΗ ΦΙΛΤΡΟΥ.**
   * Το «είναι ανοιχτό το πάνελ;» είναι **εφήμερη κατάσταση χειρισμού**: δεν πρέπει να
   * ταξιδέψει σε κοινοποιημένο σύνδεσμο και δεν πρέπει να επιβιώνει του «πίσω». Ο κανόνας
   * *«καμία `useState`»* αφορά **τιμές φίλτρων**, και αυτή δεν είναι.
   */
  const [open, setOpen] = useState(false);

  /**
   * ⚠️ **ΤΟ ΙΔΙΟ `trigger`, ΟΧΙ ΔΕΥΤΕΡΟ ΓΡΑΜΜΕΝΟ.** Η πρώτη γραφή είχε το κουμπί **δύο φορές** —
   * μια για κάθε δοχείο — δηλαδή δίδυμο κλώνο που πιάνει το `jscpd --diff` (N.18). Η ημέρα που
   * αλλάζει το στυλ του θα ήταν η ημέρα που αλλάζει **σε μία από τις δύο οθόνες**.
   */
  const trigger = <MoreFiltersButton hiddenCount={countHiddenAsked(filters.criteria)} />;
  const renderPanel = (container: 'sheet' | 'popover') => (
    <CriteriaFilterPanel filters={filters} listings={listings} commit={commit} container={container} className="min-h-0 flex-1" />
  );

  if (viewport === 'narrow') {
    return <MoreFiltersSheet open={open} onOpenChange={setOpen} trigger={trigger} panel={renderPanel('sheet')} visibleCount={visibleCount} />;
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="flex max-h-[70vh] w-96 flex-col p-4">
        {renderPanel('popover')}
      </PopoverContent>
    </Popover>
  );
}
