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

import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePublicListings, useListingLedger } from '@/services/realtime/hooks/usePublicListings';
import {
  applyListingFilters,
  computeListingCriteriaLedger,
  listingCriteriaMatch,
  parseListingFilters,
  serializeListingFilters,
  stayQueryOf,
} from '@/lib/listings/listing-filters';
import {
  askedCriterionKeys,
  EMPTY_LISTING_CRITERIA,
} from '@/lib/criteria/listing-criteria';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';
import type { PublicListing } from '@/types/public-listing';
import { computeStayLedger } from '@/lib/listings/stay-ledger';
import { stayAvailabilityFor, saleExposureOf } from '@/lib/stay/stay-availability';
import type { StayAvailabilityAnswer } from '@/lib/stay/stay-availability-vocabulary';
import { listingMapShape, isMappedShape } from '@/lib/listings/listing-map-shape';
import { useViewportClass } from '@/hooks/media/useViewportClass';
import { CriteriaLedgerBar } from './CriteriaLedgerBar';
import { ListingLedgerBar } from './ListingLedgerBar';
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
  const { listings, loading, error } = usePublicListings();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const filters = useMemo(
    () => parseListingFilters(new URLSearchParams(searchParams?.toString() ?? '')),
    [searchParams]
  );

  const visible = useMemo(() => applyListingFilters(listings, filters), [listings, filters]);

  /**
   * 🔴 **ΤΟ ΤΡΙΤΟ ΣΥΝΟΛΟ — ΚΑΙ ΧΩΡΙΣ ΑΥΤΟ Η ΛΟΓΙΣΤΙΚΗ ΚΡΙΤΗΡΙΩΝ ΕΙΝΑΙ ΨΕΥΔΗΣ**
   * (ADR-777 §8.51).
   *
   * Ο κατάλογος **αφού** απαντηθούν οι άξονες που ζουν **έξω** από τον χάρτη κριτηρίων
   * *(γεωγραφία · παράθυρο · άτομα)* και **πριν** κριθούν τα ίδια τα κριτήρια.
   *
   * ⚠️ **Η προφανής γραφή ήταν να μετρηθεί το `visible`, και θα ήταν ΔΟΜΙΚΑ ΤΥΦΛΗ**:
   * το `visible` έχει **ήδη πετάξει** τις αποκλεισμένες, άρα το `excluded` θα ήταν
   * **πάντα 0** — μια γραμμή που θα έγραφε *«8 ταιριάζουν · 0 δεν ταιριάζουν»* σε
   * **κάθε** αναζήτηση, για πάντα. Το ίδιο σχήμα με το *«`0` σημαίνει κανείς δεν
   * κοίταξε»* που το repo έχει πληρώσει τέσσερις φορές.
   *
   * ⚠️ **Ούτε ο ωμός `listings` όμως**: τότε το σύνολο θα περιλάμβανε ακίνητα εκτός της
   * περιοχής που διάλεξε ο άνθρωπος, και η γραμμή θα του χρέωνε ως *«δεν ταιριάζουν»*
   * σπίτια που **δεν ζήτησε ποτέ**.
   *
   * 🔑 **Ο ΙΔΙΟΣ φιλτραριστής, άλλη ερώτηση** — `applyListingFilters` με **κενά**
   * κριτήρια. Ένας δεύτερος γεωγραφικός έλεγχος εδώ θα ήταν δεύτερη αλήθεια για το
   * *«είναι μέσα στην ακτίνα;»*, δηλαδή ακριβώς ό,τι αποφεύγει το `listingMapShape`.
   */
  const withinScope = useMemo(
    () => applyListingFilters(listings, { ...filters, criteria: EMPTY_LISTING_CRITERIA }),
    [listings, filters]
  );

  /**
   * **«7 ταιριάζουν · 3 χωρίς δηλωμένα στοιχεία · 4 δεν ταιριάζουν».**
   *
   * 🔑 Το άθροισμα κλείνει στο `withinScope`, και υπάρχει **δεύτερος** έλεγχος που η
   * οθόνη μπορεί να κάνει μόνη της: `visible.length === matching + undeclared`. Είναι
   * η ίδια σχέση με το `ledgersAgree` της διαμονής — δύο διαμερίσεις που **οφείλουν**
   * να συμφωνούν, και φωνάζουν αν όχι.
   */
  const criteriaLedger = useMemo(
    () => computeListingCriteriaLedger(withinScope, filters),
    [withinScope, filters]
  );

  const criteriaAsked = useMemo(
    () => askedCriterionKeys(filters.criteria).length > 0,
    [filters]
  );

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

  const ledger = useListingLedger(visible);

  /**
   * 🔴 **Ο ΧΡΟΝΟΣ — ΚΑΙ ΤΟ ΣΥΝΟΡΟ ΤΟΥ §3.2, ΣΕ ΜΙΑ ΜΕΤΑΒΛΗΤΗ.**
   *
   * Ο κριτής κατάληψης χρειάζεται τις **κρατήσεις**, που είναι **ιδιωτικές**: ο
   * ανώνυμος επισκέπτης δεν επιτρέπεται να τις διαβάσει, και το ADR-835 §4.5
   * απαγορεύει ρητά να ταξιδέψει ημερολόγιο μέσα στο `PublicListing`. Άρα η
   * διαθεσιμότητα απαντιέται **στον διακομιστή**, και φτάνει εδώ ως **απάντηση**.
   *
   * ⚠️ **Ο διακομιστής είναι Φ5** — η συλλογή κρατήσεων δεν υπάρχει ακόμη. Ως τότε
   * το ημερολόγιο κάθε αγγελίας είναι **`undeclared`**, και η μηχανή απαντά
   * ειλικρινά `unknown`: *«κανείς δεν δήλωσε ημερολόγιο»*. Αυτό **δεν** είναι
   * προσωρινό ψέμα — είναι η **αλήθεια** για τα σημερινά δεδομένα, και η γραμμή
   * λογιστικής τη λέει με **αριθμό** αντί να δείξει άδεια λίστα.
   *
   * 🔑 Οι όροι διαμονής (`maxGuests`/`minNights`) και το `not-a-stay` απαντιούνται
   * **ήδη σωστά** από σήμερα: ζουν στο `PublicListing.stay`, όχι στο ημερολόγιο.
   */
  const stayQuery = useMemo(() => stayQueryOf(filters), [filters]);

  const stayLedger = useMemo(() => {
    // 🔴 **ΜΕΤΡΑ ΠΑΝΤΑ ΤΟ ΙΔΙΟ `visible`, ΑΚΟΜΗ ΚΑΙ ΧΩΡΙΣ ΕΡΩΤΗΣΗ.** Ένα κενό σύνολο
    //    εδώ θα έδινε `total: 0` ενώ η πρώτη διαμέριση μετρά **N** — και το
    //    `ledgersAgree` θα φώναζε **σωστά**, για λάθος λόγο. Χωρίς ερώτηση κάθε
    //    αγγελία είναι `unknown` (*«δεν ρωτήσαμε»*), και το άθροισμα κλείνει.
    const answerFor = (listing: (typeof visible)[number]): StayAvailabilityAnswer | undefined =>
      stayQuery === null
        ? undefined
        : stayAvailabilityFor(listing, stayQuery, { kind: 'undeclared' }, saleExposureOf(listing));
    return computeStayLedger(visible, answerFor);
  }, [visible, stayQuery]);

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
        <ListingLedgerBar ledger={ledger} className="mt-1" />
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
          ⚠️ **Τα ΦΙΛΤΡΑ κάτω από τις ΛΟΓΙΣΤΙΚΕΣ, όχι από πάνω.** Ο άνθρωπος διαβάζει
          πρώτα *τι υπάρχει* και μετά *τι μπορεί να ζητήσει* — και όταν πατήσει κάτι, η
          απάντηση είναι **ήδη μπροστά στα μάτια του**, όχι κάτω από τα χειριστήρια.

          🔑 **Παίρνει το `withinScope`, ΟΧΙ τον ωμό κατάλογο**: τα πλήθη ανά επιλογή
          οφείλουν να σέβονται την **περιοχή** και τις **ημερομηνίες** που έχει ήδη
          διαλέξει. Ο ίδιος ο άξονας αφαιρείται μέσα στο `criterionOptionTallies`.
        */}
        <PrimaryFilterBar
          filters={filters}
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
            mapped={mapped}
            unmapped={unmapped}
            highlightedId={highlightedId}
            onHover={setHighlightedId}
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
          <ResultsMap listings={mapped} highlightedId={highlightedId} onSelect={setHighlightedId} />
        </section>
      </div>
    </main>
  );
}
