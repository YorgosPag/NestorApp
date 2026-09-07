'use client';

/**
 * **Η ΟΘΟΝΗ 2** — χάρτης ΚΑΙ λίστα, ταυτόχρονα ζωντανά (ADR-777 Α3).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΜΙΑ ΚΑΤΑΣΤΑΣΗ, ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τα φίλτρα ζουν στη **διεύθυνση** και το φιλτραρισμένο σύνολο υπολογίζεται **εδώ,
 * μία φορά**. Ο χάρτης και η λίστα το **διαβάζουν** — δεν φιλτράρουν ο καθένας μόνος
 * του. Το **75%** των αποτυχιών της σημερινής μας κατάστασης ήταν ακριβώς αυτό: δύο
 * πλαίσια που δεν συμφωνούσαν τι δείχνουν.
 *
 * Ο δεσμός είναι **και προς τις δύο κατευθύνσεις**: hover στη λίστα → δακτύλιος στον
 * χάρτη· κλικ στον χάρτη → επιλογή στη λίστα.
 *
 * 🔑 **Η λογιστική είναι πάνω από ΚΑΙ ΤΑ ΔΥΟ**, όχι μέσα σε ένα από αυτά — γιατί
 * απαντά για το **σύνολο**, όχι για ό,τι τυχαίνει να χωρά σε ένα πλαίσιο.
 */

import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePublicListings } from '@/services/realtime/hooks/usePublicListings';
import {
  applyListingFilters,
  listingCriteriaMatch,
  parseListingFilters,
  serializeListingFilters,
} from '@/lib/listings/listing-filters';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';
import type { PublicListing } from '@/types/public-listing';
import { listingMapShape, isMappedShape } from '@/lib/listings/listing-map-shape';
import { useViewportClass } from '@/hooks/media/useViewportClass';
import { useListingFocus } from '@/hooks/listings/useListingFocus';
import { useMapAreaSearch } from '@/hooks/listings/useMapAreaSearch';
import { useResultsLedgers } from '@/hooks/listings/useResultsLedgers';
import { useFilterCommit } from './filters/use-filter-commit';
import { isBoundingBox } from '@/lib/geo/geo-area';
import { CriteriaLedgerBar } from './CriteriaLedgerBar';
import { ListingLedgerBar } from './ListingLedgerBar';
import { AreaLedgerBar } from './AreaLedgerBar';
import { MapAreaControl } from './MapAreaControl';
import {
  orderResultsListings,
  parseListingOrder,
} from '@/lib/listings/listing-results-order';

import { PrimaryFilterBar } from './filters/PrimaryFilterBar';
import { StayFilterFields } from './StayFilterFields';
import { StayLedgerBar } from './StayLedgerBar';
import { ResultsList } from './ResultsList';
import { ResultsMap } from './ResultsMap';
import { ResultsSheet } from './ResultsSheet';

export function SearchResultsContent() {
  const { t } = useTranslation(['search-results', 'search-filters', 'listing-detail']);
  const searchParams = useSearchParams();

  /**
   * **Η ΜΙΑ ΕΡΩΤΗΣΗ ΤΗΣ ΟΘΟΝΗΣ.** Ρωτιέται εδώ, μία φορά, και ταξιδεύει προς τα κάτω.
   *
   * ⚠️ Οδηγεί **συμπεριφορά**, ποτέ σχήμα: στάσεις, πίσω κουμπί, κλείδωμα εσωτερικής
   * κύλισης. Το σχήμα το απαντά το CSS στο πρώτο βάψιμο — αλλιώς το ειλικρινές `measuring`
   * θα κόστιζε πλήρη αναδιάταξη στη μία από τις δύο μερίδες κοινού (Α19: `CLS < 0,1`).
   * Ο λόγος γράφεται ολόκληρος στο `ResultsSheet`.
   */
  const viewport = useViewportClass();

  /**
   * 🔴 **ΤΑ ΦΙΛΤΡΑ ΔΙΑΒΑΖΟΝΤΑΙ ΠΡΙΝ ΤΗΝ ΑΝΑΓΝΩΣΗ, ΚΑΙ ΑΠΟ §8.65 ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟ.**
   * Μέχρι τότε η σειρά ήταν αδιάφορη: το ερώτημα ήταν *«φέρε τα πάντα»* και τα φίλτρα
   * έτρεχαν μετά, στη μνήμη. Τώρα η **περιοχή είναι μέρος του ερωτήματος** — άρα
   * πρέπει να είναι γνωστή τη στιγμή που ρωτάμε.
   */
  const filters = useMemo(
    () => parseListingFilters(new URLSearchParams(searchParams?.toString() ?? '')),
    [searchParams]
  );

  /**
   * ⚠️ **Το `near` ταξιδεύει ΣΤΟ ΕΡΩΤΗΜΑ, όχι μόνο στο φίλτρο μνήμης** (§8.65). Το ίδιο
   * `near` εξακολουθεί να κρίνεται και στη μνήμη από τον `listingAreaVerdict`, και οι
   * δύο **δεν** είναι διπλότυπο: το ερώτημα είναι **φθηνό ορθογώνιο** *(διευρυμένο,
   * ώστε να μη χαθεί η «τρίτη κατηγορία»)*, ο κριτής είναι **ακριβής**.
   */
  const { listings, loading, error, coverage } = usePublicListings(filters.near);

  /**
   * 🔴 **ΔΥΟ ΕΡΩΤΗΣΕΙΣ, ΟΧΙ ΜΙΑ** *(2026-09-06)*.
   *
   * Εδώ ζούσε `const [highlightedId, setHighlightedId] = useState<string | null>(null)`
   * — **μία** μεταβλητή που την έγραφαν **δύο** ασύμβατες αιτίες: το ακούσιο πέρασμα
   * του δείκτη (`hover`) και η σκόπιμη επιλογή (`click`). Η συνέπεια ήταν ορατή: το
   * ακίνητο που μόλις **διάλεγε** ο άνθρωπος **έσβηνε** μόλις το ποντίκι ακουμπούσε
   * οποιοδήποτε άλλο σχήμα.
   *
   * Είναι ακριβώς το σχήμα που φυλάει η **CHECK 3.41**: *«δύο ερωτήματα, δύο
   * μηχανισμοί — ποτέ ένας με ή»*. Το λεξιλόγιο ζει στο `lib/listings/listing-focus.ts`,
   * οι μεταβάσεις στο `hooks/listings/useListingFocus.ts`.
   *
   * 🔑 **Και οι δύο καταναλωτές διαβάζουν το ΙΔΙΟ αντικείμενο** — ο χάρτης το βάφει σε
   * δύο επίπεδα, η λίστα σε δύο βαθμίδες κάρτας. Καμία διαδρομή όπου το ένα πλαίσιο
   * ξέρει κάτι που το άλλο αγνοεί.
   */
  const { focus, peek, select, clear } = useListingFocus();

  const visible = useMemo(() => applyListingFilters(listings, filters), [listings, filters]);

  /**
   * **ΟΙ ΤΕΣΣΕΡΙΣ ΛΟΓΙΣΤΙΚΕΣ** — *«πού;»* · *«πότε;»* · *«ταιριάζει;»* · *«είναι στην
   * περιοχή που κοιτάω;»*, μαζί με τα ενδιάμεσα σύνολα που τις στηρίζουν.
   *
   * 🔑 Ολόκληρη η αριθμητική ζει στο `useResultsLedgers`· εδώ μένει **μόνο** η σύνδεση.
   * Το **ποια** σύνολα μετρώνται — και γιατί **ούτε** το `visible` **ούτε** ο ωμός
   * `listings` — είναι απόφαση γραμμένη ολόκληρη εκεί. Γραμμένη εδώ, θα πρόσθετε
   * δεύτερη ευθύνη σε ένα συστατικό που κρατά **τη διάταξη**.
   */
  const {
    withinScope,
    ledger,
    stayLedger,
    stayQuery,
    criteriaLedger,
    criteriaAsked,
    areaLedger,
  } = useResultsLedgers(listings, filters, visible);

  /**
   * **Ο ΧΑΡΤΗΣ ΩΣ ΕΡΩΤΗΜΑ** — ο διακόπτης, το εκκρεμές κάδρο και η εφαρμογή τους.
   *
   * 🔑 Ολόκληρη η πολιτική ζει στο `useMapAreaSearch`· εδώ μένει **μόνο** η σύνδεση.
   * Γραμμένη μέσα σε αυτό το αρχείο, θα πρόσθετε τρίτη ευθύνη σε ένα συστατικό που
   * ήδη κρατά τη διάταξη και τις τέσσερις λογιστικές.
   */
  const { commit } = useFilterCommit(filters);
  const { followMap, setFollowMap, pendingArea, onAreaChange, applyPendingArea } =
    useMapAreaSearch(filters, commit);

  /**
   * **Ποιους άξονες σιωπά μια συγκεκριμένη αγγελία** — η ερώτηση που κατεβαίνει στη λίστα.
   *
   * ⚠️ **`useCallback` με εξάρτηση τα `filters`, ΟΧΙ πίνακας**: η κρίση μιας αγγελίας
   * κοστίζει όσο οι **ρωτημένοι** άξονες *(συνήθως 2-3)*, και τρέχει **μόνο** για τις
   * κάρτες που πράγματι ζωγραφίζονται. Ένας προϋπολογισμένος χάρτης θα έκρινε και τις
   * 2.000 για να διαβαστούν οι 20.
   */
  const undeclaredLabelsFor = useCallback(
    (listing: PublicListing) =>
      listingCriteriaMatch(listing, filters).undeclaredOn.map((key) => criterionLabel(t, key)),
    [filters, t]
  );

  /**
   * Τα φίλτρα **ξανα-σειριοποιημένα**, όχι η ωμή διεύθυνση.
   *
   * 🔑 Η διαφορά είναι πραγματική: το `parse → serialize` **κανονικοποιεί** (πετά
   * άγνωστες παραμέτρους, μισά γεωγραφικά ζεύγη, ακτίνες ≤ 0). Αν περνούσαμε τη
   * διεύθυνση αυτούσια, ένας κοινοποιημένος σύνδεσμος με σκουπίδια θα τα κουβαλούσε
   * σε **κάθε** επόμενη σελίδα — και θα ήταν **δύο** αλήθειες για το τι ζητήθηκε.
   */
  const filterQuery = useMemo(() => serializeListingFilters(filters).toString(), [filters]);

  // ⚠️ Η διαίρεση γίνεται ΜΙΑ φορά και τα δύο μέρη προκύπτουν από την ΙΔΙΑ κρίση —
  // αλλιώς μια αγγελία θα μπορούσε να λείπει και από τα δύο, ή να είναι και στα δύο.
  const { mapped, unmapped } = useMemo(() => {
    const withShape: typeof visible = [];
    const without: typeof visible = [];
    for (const listing of visible) {
      (isMappedShape(listingMapShape(listing.position)) ? withShape : without).push(listing);
    }
    return { mapped: withShape, unmapped: without };
  }, [visible]);

  /**
   * 🔴 **Η ΣΕΙΡΑ — ΔΗΛΩΜΕΝΗ, ΕΠΙΛΕΞΙΜΗ, ΚΑΙ ΜΟΝΟ ΓΙΑ ΤΗ ΛΙΣΤΑ** (ADR-777 §8.61).
   *
   * Ως σήμερα δεν υπήρχε καμία: το ερώτημα δεν έχει `orderBy`, οπότε το Firestore
   * επέστρεφε κατά `documentId` — δηλαδή, επειδή τα IDs είναι `ownp_…`/`prop_…`, **κατά
   * τάξη συντάκτη**. Το «γιατί» και οι μετρήσεις ζουν στο `listing-results-order.ts`.
   */
  const order = useMemo(
    () => parseListingOrder(new URLSearchParams(searchParams?.toString() ?? '')),
    [searchParams]
  );

  /**
   * 🔴 **ΞΕΧΩΡΙΣΤΗ ΤΑΥΤΟΤΗΤΑ ΠΙΝΑΚΑ ΓΙΑ ΤΗ ΛΙΣΤΑ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΟΛΟ ΘΕΜΑ.**
   *
   * Ο `ResultsMap` εξακολουθεί να παίρνει το **αρχικό** `mapped`. Νέα ταυτότητα πίνακα
   * εκεί σημαίνει **επανα-αρχικοποίηση του MapLibre** — το `InteractiveMapContainer` το
   * γράφει ήδη ρητά (*«new function every render caused Map re-init»*), και το τίμημα
   * είναι **μαύρη οθόνη** σε κάθε αλλαγή σειράς. Η σειρά είναι ερώτηση **της λίστας**·
   * ο χάρτης δεν έχει σειρά, έχει θέσεις.
   *
   * ⚠️ **Και τα δύο σύνολα ταξινομούνται**: το `unmapped` είναι κι αυτό λίστα που
   * διαβάζει άνθρωπος. Αν έμενε αταξινόμητο, η ίδια οθόνη θα είχε **δύο** σειρές — μία
   * δηλωμένη και μία τυχαία — και η δεύτερη θα ήταν πάλι κατά τάξη συντάκτη.
   */
  const orderedMapped = useMemo(() => orderResultsListings(mapped, order), [mapped, order]);
  const orderedUnmapped = useMemo(() => orderResultsListings(unmapped, order), [unmapped, order]);

  /**
   * 🔴 **ΕΝΑ ΑΝΤΙΚΕΙΜΕΝΟ, ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ — ΚΑΙ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ ΤΟΥ §8.62.**
   *
   * Ό,τι μπαίνει εδώ **πηγαίνει στη λίστα** και **μετριέται από τον μετρητή**. Δεν
   * υπάρχει διαδρομή όπου η μία πλευρά αλλάζει και η άλλη δεν το μαθαίνει: για να
   * κοπεί η λίστα, το κόψιμο πρέπει να συμβεί **μέσα σε αυτό το `useMemo`** — και τότε
   * το `renderedCount` πέφτει μαζί του **στην ίδια αναπνοή**.
   *
   * ⚠️ **Γι' αυτό είναι αντικείμενο και όχι δύο ξεχωριστές μεταβλητές.** Με δύο
   * μεταβλητές, ένα μελλοντικό `orderedMapped.slice(0, 40)` γραμμένο κατευθείαν στο
   * JSX θα παρέκαμπτε τον μετρητή **χωρίς να πειράξει τίποτα εδώ** — δηλαδή θα ήταν
   * ακριβώς η σιωπηλή απόκλιση που αυτό το βήμα υπάρχει για να κλείσει.
   *
   * 🔑 Ο χάρτης **δεν** διαβάζει από εδώ: εξακολουθεί να παίρνει το αρχικό `mapped`,
   * για τον λόγο που γράφεται από πάνω (ταυτότητα πίνακα → re-init MapLibre) **και**
   * επειδή το §8.60 έχει ήδη αποφασίσει γραπτά ότι η λίστα δεν διατάζει τον χάρτη.
   */
  const listView = useMemo(
    () => ({ mapped: orderedMapped, unmapped: orderedUnmapped }),
    [orderedMapped, orderedUnmapped]
  );
  const renderedCount = listView.mapped.length + listView.unmapped.length;

  return (
    // 🔴 `flex-1 min-h-0`, ΟΧΙ `h-screen`: η οθόνη ζει τώρα **κάτω από κεφαλίδα**, και
    // ένα σταθερό ύψος παραθύρου θα έσπρωχνε το κάτω μέρος του χάρτη εκτός οθόνης. Το
    // `min-h-0` είναι υποχρεωτικό — χωρίς αυτό το flex item αρνείται να συρρικνωθεί
    // κάτω από το περιεχόμενό του και η **εσωτερική** κύλιση της λίστας δεν λειτουργεί.
    <main
      /*
        🖼️ ΕΠΙΦΑΝΕΙΑ-ΚΑΜΒΑΣ — ΜΗΔΕΝ ΔΙΑΔΡΟΜΟΣ (ADR-797 ΦΑΣΗ Β).
        Χάρτης + λίστα σε **πλήρες παράθυρο**: ο διάδρομος εδώ δεν είναι αισθητική
        επιλογή, είναι **χαμένη επιφάνεια χάρτη**, και θα άφηνε το φύλλο των
        αποτελεσμάτων να αιωρείται μακριά από την άκρη. Η δήλωση είναι ρητή και
        καταγράφεται με λόγο στο `.shell-surface.json` — δεν λύνεται με `-mx-*`.
      */
      data-shell-surface="bleed"
      /*
        📐 ΤΟ ΥΨΟΣ ΤΟΥ ΚΑΔΡΟΥ — Ο ΤΕΤΑΡΤΟΣ ΑΞΟΝΑΣ (ADR-797 ΦΑΣΗ Γ).
        ΔΕΥΤΕΡΗ, ΑΝΕΞΑΡΤΗΤΗ δήλωση από το `bleed`: εκείνο λέει «μηδέν οριζόντιο
        κενό», αυτό λέει «κλείδωσε το κάδρο στο παράθυρο». Δύο ερωτήματα, δύο
        μηχανισμοί — ποτέ ένας με «ή» (μάθημα CHECK 3.41).

        Χωρίς αυτό η γειτονιά δίνει **δάπεδο** (`min-block-size`), όχι ύψος: το
        `flex-1` παρακάτω δεν έχει τι να μοιράσει (CSS 2.2 §10.5), ο χάρτης παίρνει
        **φυσικό** ύψος και σπρώχνει τη σελίδα εκτός οθόνης — μετρημένο **161px**
        στις 2026-08-25, με την 7η πινέζα αόρατη ενώ η λογιστική έγραφε «7 στον χάρτη».

        ⚠️ **ΠΡΕΠΕΙ να είναι ΑΜΕΣΟ ΠΑΙΔΙ του διαδρόμου.** Ο επιλογέας του
        `shell-surface.css` §5 είναι **δεσμευμένου βάθους**
        (`:has(> [data-shell-surface] > [data-shell-viewport])`) επίτηδες, ώστε η
        ακύρωση του `:has()` να μην αφορά όλο το υποδέντρο (οδηγία MDN). Τύλιξέ το σε
        έναν `<div>` και το κλείδωμα **σταματά σιωπηλά** — γι' αυτό το φυλάει ο
        κανόνας **Υ5** του CHECK 3.63.

        ⚠️ Η δήλωση καταγράφεται με **μετρημένο λόγο ΚΑΙ λόγο εξαίρεσης WCAG 1.4.10**
        στο `.shell-surface.json` → `viewportLocked`. Κλειδωμένη επιφάνεια δεν κυλά
        στο 400% zoom· η εξαίρεση υπάρχει για επιφάνειες χειρισμού, όχι για κείμενο.
      */
      data-shell-viewport
      className="flex min-h-0 flex-1 flex-col bg-background"
    >
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">{t('search-results:page.title')}</h1>
        {/* Η λογιστική τυπώνεται ΠΑΝΤΑ — ακόμη και στο μηδέν, ακόμη και στη φόρτωση. */}
        <ListingLedgerBar ledger={ledger} rendered={renderedCount} className="mt-1" />
        {/*
          🔴 **ΔΥΟ ΓΡΑΜΜΕΣ, ΔΥΟ ΔΙΑΜΕΡΙΣΕΙΣ ΤΟΥ ΙΔΙΟΥ ΣΥΝΟΛΟΥ** (ADR-835 §4.6).
          «Πού;» και «πότε;» δεν είναι κάδοι της ίδιας μέτρησης: ένα ακίνητο είναι
          **ταυτόχρονα** στον χάρτη **και** κρατημένο. Η δεύτερη γραμμή ελέγχει ότι
          κλείνουν **και οι δύο στο ίδιο σύνολο**, και φωνάζει αν όχι.
        */}
        <StayLedgerBar
          stay={stayLedger}
          position={ledger}
          asked={stayQuery !== null}
          className="mt-1"
        />
        {/*
          🔴 **Η ΤΡΙΤΗ ΔΙΑΜΕΡΙΣΗ** (ADR-777 §8.51): *«πού;»* · *«πότε;»* · **«ταιριάζει;»**.
          Τυπώνεται μόνο όταν κάποιος ρώτησε κάτι — δες την κεφαλίδα του συστατικού για
          το γιατί αυτό ΔΕΝ αναιρεί τον κανόνα 27.
        */}
        <CriteriaLedgerBar ledger={criteriaLedger} asked={criteriaAsked} className="mt-1" />

        {/*
          🔴 **Η ΤΕΤΑΡΤΗ ΔΙΑΜΕΡΙΣΗ** (ADR-777 §8.63): *«πού;»* · *«πότε;»* ·
          *«ταιριάζει;»* · **«είναι στην περιοχή που κοιτάω;»**.

          🔑 Είναι η **μόνη** από τις τέσσερις που περιγράφει κάτι το οποίο η οθόνη
          **πράγματι έκοψε** — και γι' αυτό η ύπαρξή της δεν είναι διακοσμητική: χωρίς
          αυτήν, το φιλτράρισμα από τον χάρτη θα ήταν μια σιωπηλή εξαφάνιση, δηλαδή
          ακριβώς το ελάττωμα που τα καταγεγραμμένα παράπονα για την Airbnb
          περιγράφουν και που κανένας από τους μεγάλους δεν ανακοινώνει.
        */}
        <AreaLedgerBar
          ledger={areaLedger}
          asked={filters.near !== null}
          visibleCount={visible.length}
          coverage={coverage}
          className="mt-1"
        />

        {/*
          ⚠️ **Τα ΦΙΛΤΡΑ κάτω από τις ΛΟΓΙΣΤΙΚΕΣ, όχι από πάνω.** Ο άνθρωπος διαβάζει
          πρώτα *τι υπάρχει* και μετά *τι μπορεί να ζητήσει* — και όταν πατήσει κάτι, η
          απάντηση είναι **ήδη μπροστά στα μάτια του**, όχι κάτω από τα χειριστήρια.

          🔑 **Παίρνει το `withinScope`, ΟΧΙ τον ωμό κατάλογο**: τα πλήθη ανά επιλογή
          οφείλουν να σέβονται την **περιοχή** και τις **ημερομηνίες** που έχει ήδη
          διαλέξει. Ο ίδιος ο άξονας αφαιρείται μέσα στο `criterionOptionTallies`.
        */}
        <PrimaryFilterBar
          filters={filters}
          order={order}
          listings={withinScope}
          visibleCount={visible.length}
          viewport={viewport}
          className="mt-2"
        />

        <StayFilterFields filters={filters} className="mt-2" />
        {loading && <p className="mt-1 text-sm text-muted-foreground">{t('search-results:page.loading')}</p>}
        {error && <p role="alert" className="mt-1 text-sm text-destructive">{t('search-results:page.error')}</p>}
      </header>

      {/*
        ΔΥΟ ΔΙΑΤΑΞΕΙΣ ΑΠΟ ΕΝΑ ΔΕΝΤΡΟ — και τα δύο πλαίσια ζωντανά σε **αμφότερες**.

        • **Ευρεία** (`md:`): πλέγμα δύο στηλών, λίστα ‖ χάρτης.
        • **Στενή**: ο χάρτης καταλαμβάνει **ολόκληρο** το κουτί και η λίστα κάθεται
          **από πάνω** ως μη-αποκλειστικό φύλλο (SPEC-777D §26.2).

        🔴 Αυτό που ΕΦΥΓΕ ήταν `grid-cols-1 … lg:grid-cols-[…]`, και το ελάττωμα δεν ήταν
        ότι «δεν ρωτούσε»: ρωτούσε με CSS και **απαντούσε λάθος**. Στο στενό στοίβαζε δύο
        σειρές μέσα σε `overflow-hidden`, δηλαδή λίστα και χάρτης **μοιράζονταν το ύψος**
        και κανένα δεν ήταν χρήσιμο — η **τρίτη** κακή επιλογή, δίπλα στην εναλλαγή που το
        §26.1 απορρίπτει ονομαστικά. Έφυγε επίσης το `lg` (1024), που ήταν **δεύτερος**
        αριθμός δίπλα στο `MOBILE_BREAKPOINT` (768): το κατώφλι είναι πλέον **ένα**.

        ⚠️ Η λίστα μένει **πρώτη στη ροή ανάγνωσης** — είναι το μέσο που το 65%
        χρησιμοποιεί πραγματικά (§25.3). Γι' αυτό το φύλλο ζητά σκαλί τοπικής στρώσης
        (`z-10`): στο στενό είναι **δεύτερο** στο βάψιμο ενώ είναι **πρώτο** στην ανάγνωση,
        και η σειρά του DOM μόνη της θα το έθαβε κάτω από τον χάρτη.
      */}
      <div className="relative min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-[minmax(20rem,26rem)_1fr]">
        <ResultsSheet viewport={viewport}>
          <ResultsList
            mapped={listView.mapped}
            unmapped={listView.unmapped}
            focus={focus}
            onHover={peek}
            filterQuery={filterQuery}
            undeclaredLabelsFor={undeclaredLabelsFor}
          />
        </ResultsSheet>

        {/*
          `isolate`: ο χάρτης είναι **ξένος** κώδικας (Geo-Canvas/MapLibre) με δικά του
          εσωτερικά επίπεδα. Ένα δικό του στρώμα δεν επιτρέπεται να αναρριχηθεί πάνω από
          το φύλλο — και ο **περιορισμός** είναι το ανώτερο εργαλείο έναντι του δαμάσματος
          με αριθμό (CHECK 3.50): δεν χρειάζεται να ξέρουμε τι γράφει η βιβλιοθήκη, ούτε
          μετά από αναβάθμισή της.
        */}
        <section
          aria-label={t('search-results:map.label')}
          className="absolute inset-0 isolate md:static"
        >
          {/*
            **Ο ΑΜΦΙΔΡΟΜΟΣ ΔΕΣΜΟΣ, ΟΛΟΚΛΗΡΟΣ** (Α3) — τέσσερα σύρματα, όχι δύο:
            hover στη λίστα → `peek` · hover στον χάρτη → `peek` · κλικ στον χάρτη →
            `select` · κλικ στο κενό ή `Escape` → `clear`.
          */}
          <ResultsMap
            listings={mapped}
            focus={focus}
            filterQuery={filterQuery}
            onPeek={peek}
            onSelect={select}
            onClear={clear}
            onAreaChange={onAreaChange}
            /*
              🔴 **Η ΠΕΡΙΟΧΗ ΚΑΝΕΙ ΔΥΟ ΔΟΥΛΕΙΕΣ** — δες `ResultsMapProps.searchArea`:
              (α) σπάει την ανάδραση *(ο χάρτης δεν ξανακαδράρει στα αποτελέσματα, άρα
              δεν πηδά κάτω από τα δάχτυλα του ανθρώπου)*· (β) **καδράρει εκεί**, ώστε
              ένας κοινοποιημένος σύνδεσμος να **δείχνει** την περιοχή που φιλτράρει.

              ⚠️ **Μόνο ορθογώνιο**: το `near` μπορεί να είναι και **κύκλος** *(από
              κείμενο που έγραψε ο επισκέπτης)*, και εκείνον τον καδράρει ήδη ο
              υπάρχων μηχανισμός των δεδομένων. Το `null` εδώ σημαίνει ρητά *«καμία
              ορθογώνια περιοχή»*, όχι «καμία ερώτηση».
            */
            searchArea={filters.near !== null && isBoundingBox(filters.near) ? filters.near : null}
          />

          {/*
            ⚠️ **ΑΔΕΛΦΟΣ ΤΟΥ ΧΑΡΤΗ, ΠΟΤΕ ΠΑΙΔΙ ΤΟΥ.** Ο `ResultsMap` αποδίδει τον
            `InteractiveMap` του Geo-Canvas, που διαχειρίζεται **ο ίδιος** το δέντρο
            του· ένα χειριστήριο χωμένο μέσα του θα ζούσε στο έλεος ξένου κώδικα. Εδώ
            κάθεται πάνω από τον χάρτη μέσα στο **ίδιο** `isolate`, άρα η στρώση του
            είναι τοπική και δεν ανταγωνίζεται καμία καθολική κλίμακα (CHECK 3.50).
          */}
          <MapAreaControl
            followMap={followMap}
            onFollowMapChange={setFollowMap}
            hasPendingArea={pendingArea !== null}
            onSearchHere={applyPendingArea}
          />
        </section>
      </div>
    </main>
  );
}
