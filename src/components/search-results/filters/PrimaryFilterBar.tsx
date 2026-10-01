'use client';

/**
 * **ΤΟ ΠΡΩΤΟ ΕΠΙΠΕΔΟ** — τέσσερα χειριστήρια, και **μία** πόρτα προς τα υπόλοιπα 27.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🖼️ §8.80 — ΜΙΑ ΣΕΙΡΑ ΤΣΙΠ, ΟΠΩΣ Η ZILLOW
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κάθε ερώτηση είναι **τσιπ με τη σύνοψή της** (`CriterionBarPopover`)· τα πεδία ανοίγουν από κάτω.
 * Η **σειρά** μετακόμισε στην κεφαλίδα της λίστας (`ResultsOrderControl`), η **διαμονή** έγινε τσιπ
 * που εμφανίζεται μόνο όπου έχει νόημα (`StayFilterChip`), και το «διάλεξε πρώτα διάθεση» ζει
 * **μέσα** στο τσιπ «Τιμή» αντί για ολόκληρη γραμμή. Σε **κάθε** πλάτος τα κριτήρια ζουν σε **μία**
 * λωρίδα που κυλά (`ui/scroll-rail`, ADR-896 §7Α.6) — ποτέ δεύτερη γραμμή πάνω από τον χάρτη
 * (SPEC-777D §26.3 κανόνας 7). Ο «Καθαρισμός» και τα «Περισσότερα φίλτρα» μένουν **καρφωμένα έξω**
 * από την κύλιση (Airbnb): η έξοδος και η πόρτα προς όλους τους άξονες δεν κρύβονται ποτέ.
 *
 * 🧩 **ΣΥΝΘΕΣΗ, ΟΧΙ ΜΟΝΟΛΙΘΟΣ** (ADR-896 §7Α.7 · N.7.1): λωρίδα (`FilterRail`) + έξοδος
 * (`ClearAllButton`) + πόρτα (`MoreFiltersControl`: δύο συμπεριφορές, ένα κατώφλι, εκεί
 * τεκμηριωμένες) + ειδοποίηση παλιού συνδέσμου.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🖼️ Ο ΠΡΩΤΟΣ ΚΑΡΕΣ — `measuring` ΔΕΝ ΜΕΤΑΠΗΔΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `useViewportClass` απαντά ειλικρινά `'measuring'` πριν μετρήσει. Η **γραμμή** και
 * το **κουμπί** ζωγραφίζονται **ταυτόσημα** και στις τρεις καταστάσεις — μόνο το
 * **κλειστό** δοχείο διαφέρει, οπότε δεν υπάρχει τίποτα να μεταπηδήσει (Α19, `CLS < 0,1`).
 *
 * 🔴 **ΚΑΜΙΑ ΑΝΑΓΝΩΣΗ `window` ΣΤΗΝ ΑΠΟΔΟΣΗ** (ADR-896 §7Α.7): η μπάρα είναι καθαρή
 * συνάρτηση των props της. Το αποσυρμένο `pmin/pmax` διαβαζόταν από το `window.location` —
 * ο server ζωγράφιζε το τσιπ «Τιμή», ο client όχι ⇒ `Hydration failed` και **όλο** το δέντρο
 * ξαναχτιζόταν στον client (μετρημένο με `?pmin=100000`). Τώρα έρχεται από το **ίδιο**
 * `useSearchParams()` που δίνει τα `filters` (`SearchResultsContent`).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ScrollRail } from '@/components/ui/scroll-rail';
import type { ViewportClass } from '@/hooks/media/useViewportClass';
import { askedCriterionKeys } from '@/lib/criteria/listing-criteria';
import type { CriterionRange } from '@/lib/criteria/criterion-vocabulary';
import type { ListingSearch } from '@/lib/listings/listing-filters';
import type { PublicListing } from '@/types/public-listing';
import { cn } from '@/lib/utils';

import { isPriceCriterionKey, PRIMARY_CRITERION_KEYS } from './criteria-filter-groups';
import { visiblePriceAxes } from './visible-price-axes';
import { RetiredPriceParamNotice } from './RetiredPriceParamNotice';
import { CriterionField } from './CriterionField';
import { CriterionBarPopover } from './CriterionBarPopover';
import { MoreFiltersControl } from './MoreFiltersControl';
import { StayFilterChip } from './StayFilterChip';
import { staySearchRelevant } from './stay-search-relevance';
import { useFilterCommit, type FilterCommit } from './use-filter-commit';

interface PrimaryFilterBarProps {
  readonly filters: ListingSearch;
  /** Ο κατάλογος **εντός εμβέλειας** (`withinScope`) — δες {@link CriterionField}. */
  readonly listings: readonly PublicListing[];
  /** Πόσα βλέπει **αυτή τη στιγμή** ο άνθρωπος — ο αριθμός μέσα στο «Δείξε N». */
  readonly visibleCount: number;
  readonly viewport: ViewportClass;
  /**
   * Το εύρος ενός **παλιού** συνδέσμου (`pmin`/`pmax`), που ζητούσε τιμή χωρίς μονάδα — ή `null`.
   * 🔑 Από τη **διεύθυνση**, όχι από τα φίλτρα: δεν είναι ερώτηση που αναγνωρίζει ο κριτής, είναι
   * ερώτηση που **ζητά μονάδα** πριν γίνει ερώτηση. Το διαβάζει ο γονέας από το **ίδιο**
   * `useSearchParams()` με τα `filters`, ώστε server και client να ζωγραφίζουν το ίδιο.
   */
  readonly retiredPrice: CriterionRange | null;
  readonly className?: string;
}

interface FilterRailProps {
  readonly filters: ListingSearch;
  readonly listings: readonly PublicListing[];
  readonly commit: FilterCommit;
  readonly retiredPrice: CriterionRange | null;
}

/**
 * 📐 **ΣΤΑΘΕΡΟ ΠΛΑΤΟΣ ΑΝΑ ΧΕΙΡΙΣΤΗΡΙΟ, ΟΧΙ `flex-1`.** Το `flex-1` μοίραζε **ολόκληρο** το
 * πλάτος της οθόνης στα τέσσερα, και μέσα σε δοχείο 900px η ετικέτα μιας επιλογής έσπρωχνε τον
 * αριθμό της στην άλλη άκρη — μετρημένο. Εδώ κάθε χειριστήριο παίρνει **όσο χρειάζεται** και ό,τι
 * δεν χωρά **κυλά**: ◀ ▶ με ποντίκι, σύρσιμο με αφή, Tab φέρνει το εστιασμένο σε θέα. Ό,τι μένει
 * εκτός κάδρου είναι ούτως ή άλλως και μέσα στα «Περισσότερα φίλτρα» (το πάνελ έχει ΟΛΟΥΣ τους άξονες).
 *
 * 🔴 **ΟΙ ΤΡΕΙΣ ΑΞΟΝΕΣ ΤΙΜΗΣ ΔΕΝ ΖΩΓΡΑΦΙΖΟΝΤΑΙ ΟΛΟΙ** (ADR-777 §8.60.14 Φάση 2): η **μονάδα**
 * έρχεται από τη «Διάθεση», και χωρίς αυτήν το «έως 1.000 €» δέχεται 900 €/μήνα **και** 50 €/νύχτα.
 * Ο κανόνας ζει ολόκληρος στο `visible-price-axes.ts`· εδώ μένει μόνο η κλήση.
 */
function FilterRail({ filters, listings, commit, retiredPrice }: FilterRailProps) {
  const { t } = useTranslation(['search-filters']);
  const shownPriceAxes = visiblePriceAxes(filters.criteria);
  return (
    <ScrollRail
      as="div"
      frameClassName="min-w-0 flex-1"
      className="items-center gap-2"
      prevLabel={t('search-filters:filters.railPrev')}
      nextLabel={t('search-filters:filters.railNext')}
    >
      {PRIMARY_CRITERION_KEYS.filter((key) => !isPriceCriterionKey(key) || shownPriceAxes.includes(key)).map((key) => (
        <CriterionField key={key} criterionKey={key} criteria={filters.criteria} listings={listings} commit={commit} space="bar" />
      ))}
      {/*
        🔑 §8.80 — Το «Τιμή» **υπάρχει πάντα** στη γραμμή, όπως στη Zillow· χωρίς διάθεση ανοίγει
        και **λέει γιατί** δεν ρωτά ακόμη, αντί για ολόκληρη γραμμή κειμένου πάνω από τον χάρτη.
      */}
      {shownPriceAxes.length === 0 && retiredPrice === null && (
        <CriterionBarPopover axis={t('search-filters:filters.price.label')} summary={t('search-filters:filters.price.label')} active={false}>
          <p className="m-0 text-sm text-muted-foreground">{t('search-filters:filters.price.needOffer')}</p>
        </CriterionBarPopover>
      )}
      {staySearchRelevant(filters) && <StayFilterChip filters={filters} />}
    </ScrollRail>
  );
}

/**
 * 🔴 **Η ΕΞΟΔΟΣ, ΣΤΟ ΠΡΩΤΟ ΕΠΙΠΕΔΟ — ΚΑΙ ΤΟ ΕΛΑΤΤΩΜΑ ΗΤΑΝ ΜΕΤΡΗΜΕΝΟ.** Η πρώτη γραφή είχε τον
 * «Καθαρισμό» **μόνο μέσα** στο πάνελ. Ζωντανά (2026-09-04): με `?bathmin=1&bathmax=1` η οθόνη έδειχνε
 * 2 αγγελίες, **καμία στον χάρτη**, και ο άνθρωπος **δεν είχε τρόπο να βγει** χωρίς να ανοίξει ξανά
 * το συρτάρι και να θυμηθεί τι είχε πατήσει.
 *
 * ⚠️ Ο κανόνας που η έρευνα ονομάζει **αδιέξοδο**: *«κενό αποτέλεσμα — ή απόκλεισε την επιλογή, ή
 * δώσε διαδρομή επιστροφής»*. Εμείς δεν αποκλείουμε επιλογές *(τα πλήθη τις δείχνουν όλες)*, άρα
 * **οφείλουμε** τη διαδρομή επιστροφής — **ορατή**, όχι κρυμμένη.
 *
 * 🔑 **Μόνο όταν υπάρχει τι να καθαριστεί** — μονίμως ορατό κουμπί που δεν κάνει τίποτα διδάσκει
 * τον επισκέπτη να το αγνοεί.
 */
function ClearAllButton({ filters, commit }: { readonly filters: ListingSearch; readonly commit: FilterCommit }) {
  const { t } = useTranslation(['search-filters']);
  if (askedCriterionKeys(filters.criteria).length === 0) return null;
  return (
    <button
      type="button"
      onClick={commit.clearAllCriteria}
      className="shrink-0 rounded-md px-2 py-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      {t('search-filters:filters.clearAll')}
    </button>
  );
}

export function PrimaryFilterBar({ filters, listings, visibleCount, viewport, retiredPrice, className }: PrimaryFilterBarProps) {
  const { t } = useTranslation(['search-filters', 'search-results', 'listing-detail', 'properties-enums', 'short-stay']);
  const commit = useFilterCommit(filters);

  return (
    <section
      aria-label={t('search-filters:filters.heading')}
      // 🔴 ΜΙΑ γραμμή σε ΚΑΘΕ πλάτος (ADR-896 §7Α.6): η λωρίδα παίρνει το υπόλοιπο (`flex-1` με
      // βάση 0 + `min-w-0`), άρα ΠΟΤΕ δεν σπρώχνει τα καρφωμένα κουμπιά κάτω. Το `flex-wrap` υπάρχει
      // ΜΟΝΟ για την ειδοποίηση παλιού συνδέσμου (`w-full` ⇒ δική της σειρά). Καμία κλάση `md:` και
      // κανένα `viewport` εδώ (ADR-777 §8.84): το παλιό `viewport === 'narrow'` αναδίπλωνε όσο
      // «μετρούσε» και ο χάρτης πηδούσε 31px (CLS 0,0326 σε 728px).
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      <FilterRail filters={filters} listings={listings} commit={commit} retiredPrice={retiredPrice} />
      <ClearAllButton filters={filters} commit={commit} />
      <MoreFiltersControl filters={filters} listings={listings} commit={commit} visibleCount={visibleCount} viewport={viewport} />
      {/*
        ⚠️ **Η ΑΠΟΥΣΙΑ ΤΩΝ ΠΕΔΙΩΝ ΤΙΜΗΣ ΔΕΝ ΕΙΝΑΙ ΣΙΩΠΗΛΗ.** Το #1 φίλτρο (62% χρήση, Baymard) δεν
        επιτρέπεται να **λείπει χωρίς λόγο**. 📐 **ΕΞΩ από τη λωρίδα** (ADR-896 §7Α.6): είναι
        ειδοποίηση (`role="status"`, `w-full`), όχι χειριστήριο — μέσα σε λωρίδα που κυλά θα έπιανε
        όλο το κάδρο. ADR-777 §8.60.14 Φάση 2 — ο παλιός σύνδεσμος ρωτιέται, ποτέ δεν πετιέται.
      */}
      <RetiredPriceParamNotice range={retiredPrice} onChoose={commit.setRange} />
    </section>
  );
}
