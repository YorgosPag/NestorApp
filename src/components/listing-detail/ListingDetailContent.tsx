'use client';

/**
 * **Η ΟΘΟΝΗ 3** — ένα ακίνητο, ολόκληρη η αλήθεια που έχουμε γι' αυτό (ADR-777 Α3).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΑΛΛΑΞΕ ΤΟΝ ΣΧΕΔΙΑΣΜΟ ΤΗΣ — μετρημένο πριν γραφτεί γραμμή
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **Α3** περιγράφει την οθόνη 3 ως *«τα **υπόλοιπα** πεδία»*. Το κλειστό σχήμα
 * {@link PublicListing} έχει **12** πεδία και η κάρτα της οθόνης 2 δείχνει ήδη **8**.
 * ⇒ **Δεν υπάρχουν «υπόλοιπα πεδία».**
 *
 * Άρα η οθόνη 3 **δεν** είναι πλουσιότερη κάρτα. Είναι η βαθμίδα της **Α7** όπου τα
 * **ίδια** δεδομένα αποκτούν **προέλευση και όρια**:
 *
 * | Η κάρτα λέει | Η σελίδα λέει επιπλέον |
 * |---|---|
 * | δύο αριθμοί τιμής | **τι είναι** ο καθένας (ζητούμενη · τελική · ενοίκιο) — Α21 |
 * | εμβαδόν/όροφος/ύπνοδ. **όταν υπάρχουν** | **και όταν λείπουν**, με κλειστή λογιστική |
 * | (καθόλου) το είδος | το **5ο βασικό πεδίο** του §25.6 |
 * | σχήμα στον χάρτη | **τι σημαίνει** το σχήμα, και **από πού** ξέρουμε τη θέση |
 * | — | **τι δεν δημοσιεύουμε ακόμη**, ονομαστικά |
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΣΕΛΙΔΑ, ΠΟΤΕ ΦΥΛΛΟ — ΚΑΙ ΣΤΟ ΚΙΝΗΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **Α3** το γράφει ρητά στη γραμμή της οθόνης 3 (*«σελίδα — **ποτέ φύλλο**»*), και
 * η **§26.3** απαγορεύει *«κανένα φύλλο πάνω σε φύλλο»*. Η διάταξη είναι **μία
 * στήλη** που πλαταίνει σε δύο στο desktop: το κινητό δεν είναι υποβαθμισμένη εκδοχή,
 * είναι **η βασική** — *«οι περισσότεροι μπαίνουν από κινητό»*.
 *
 * 🔑 **Ο σύνδεσμος επιστροφής κουβαλά τα φίλτρα** που είχε ο επισκέπτης. Χωρίς αυτό,
 * η επιστροφή από **κοινοποιημένο** σύνδεσμο — όπου δεν υπάρχει «πίσω» — θα έδειχνε
 * άλλη λίστα από αυτήν που άφησε (Α3: **75%** των αποτυχιών ήταν ακριβώς εδώ).
 */

import dynamic from 'next/dynamic';
import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';
import { useUrlQuery } from '@/hooks/useUrlQuery';
import { useListingViewBeacon } from '@/hooks/listings/useListingViewBeacon';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ ΟΘΟΝΗΣ 3.
//
// 🔴 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ `page.tsx`, ΟΠΩΣ ΣΤΟ /test-harness/listing-shapes.**
// Εκείνη η σελίδα είναι `'use client'`· **αυτή** είναι Server Component (`async`,
// `await params`). Τα Server και τα Client Components ζουν σε **ΞΕΧΩΡΙΣΤΟΥΣ
// γράφους module**: μια εγγραφή από το `page.tsx` θα έγραφε στο **δικό του**
// στιγμιότυπο i18next, ΟΧΙ σε αυτό που βλέπει το client δέντρο κατά το SSR.
// Θα ήταν πράσινη κλήση που **δεν κάνει τίποτα** — το χειρότερο είδος διόρθωσης.
// Το σύνορο πελάτη είναι **αυτό** το αρχείο, άρα εδώ ζει η εγγραφή.
//
// Ο χάρτης (`GeoCoordinateDisplay` ← `ResultsMap` ← `ListingPositionSection`)
// ζητά το lazy `geo-canvas`, που στον server δεν φτάνει ΠΟΤΕ.
import routeSlice from '@/i18n/generated/routes/listing__id.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePublicListing } from '@/services/realtime/hooks/usePublicListings';
import {
  parseListingFilters,
  serializeListingFilters,
} from '@/lib/listings/listing-filters';
import { searchResultsHref } from '@/lib/listings/listing-routes';
import { formatDateTime } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { PublicListing } from '@/types/public-listing';
import { ListingMarketContextPending } from './ListingMarketContextPending';
import { ListingPriceBlock } from './ListingPriceBlock';
import { ListingAttributeList } from './ListingAttributeList';
import { ListingPositionSection } from './ListingPositionSection';
import { ListingLegality } from './ListingLegality';
import { ListingOpenSubjects } from './ListingOpenSubjects';
import { ListingMediaViewer } from './media/ListingMediaViewer';
import { ListingStay } from './ListingStay';
import { ListingExchangeTerm } from './ListingExchangeTerm';
import { ListingAuthorshipLine } from '@/components/listings/ListingAuthorshipLine';
import { SectionFrame } from '@/components/ui/section-frame';
import { ListingDetailActions } from './ListingDetailActions';
import { ListingSectionAnchor, ListingSectionNav } from './ListingSectionNav';

// ADR-889 Φ2 — ΟΡΙΟ: το `market-contracts` ΔΕΝ μπαίνει στο route slice της αγγελίας (CHECK 3.34). Η ενότητα
// φέρνει έτσι κι αλλιώς τα δεδομένα της ασύγχρονα, άρα δεν χάνει τίποτα από το πρώτο καρέ.
const ListingMarketContext = dynamic(() => import('./ListingMarketContext').then((m) => m.ListingMarketContext), {
  ssr: false,
  loading: ListingMarketContextPending,
});

// ⚠️ Εμβέλεια MODULE, όχι render και όχι effect: τρέχει **πριν** αποδοθεί
// οτιδήποτε, στον server και στον client, χωρίς κύκλο ζωής React να το καθυστερεί.
registerRouteSlice(routeSlice);

interface ListingDetailContentProps {
  /** Η ταυτότητα από τη διεύθυνση. **Ίδια με το `propertyId`** (σχέση 1:1). */
  readonly id: string;
}

/**
 * Μήνυμα που καταλαμβάνει τη σελίδα — για τις **δύο** καταστάσεις που δεν έχουν
 * περιεχόμενο να δείξουν, και που **δεν είναι η ίδια**: η μία δεν πρόκειται να
 * αλλάξει, η άλλη μπορεί.
 */
function DetailNotice({
  titleKey,
  bodyKey,
  backHref,
}: {
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly backHref: WorkspaceHref;
}) {
  const { t } = useTranslation(['search-results']);

  return (
    // `flex-1` αντί για `min-h-screen` — το ύψος το κατέχει το `(light)/layout.tsx`.
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold text-foreground">{t(titleKey)}</h1>
      <p className="text-base text-muted-foreground">{t(bodyKey)}</p>
      <nav className="mt-2">
        <Link
          href={backHref}
          className="inline-block rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
        >
          {t('search-results:detail.back')}
        </Link>
      </nav>
    </main>
  );
}

export function ListingDetailContent({ id }: ListingDetailContentProps) {
  const { t } = useTranslation(['search-results']);
  const urlQuery = useUrlQuery();
  const lookup = usePublicListing(id);
  // 📊 ADR-777 §8.72 — μία προβολή, μόνο όταν η αγγελία ΥΠΑΡΧΕΙ και η σελίδα ΦΑΙΝΕΤΑΙ.
  useListingViewBeacon('listing' in lookup ? lookup.listing.id : null);

  /**
   * Τα φίλτρα **κανονικοποιημένα**, όχι η ωμή διεύθυνση: ό,τι δεν αναγνωρίζει το
   * `parseListingFilters` δεν έχει λόγο να ταξιδέψει πίσω στην οθόνη 2.
   *
   * 🔴 **Ζωντανά, με `useUrlQuery` — όχι `useSearchParams`** (ADR-777 §8.60.21.7): η σελίδα αλλάζει τη
   * διεύθυνση με `replaceState` (άτομα · νύχτες · κατοικίδια), και το `useSearchParams` **δεν** το
   * βλέπει στον dev (μετρημένο — δες `useUrlQuery.ts`). Ο σύνδεσμος επιστροφής θα έφερνε τον
   * επισκέπτη πίσω στην **παλιά** ερώτηση.
   */
  const backHref = React.useMemo(
    () => searchResultsHref(serializeListingFilters(parseListingFilters(new URLSearchParams(urlQuery))).toString()),
    [urlQuery],
  );

  if (lookup.state === 'loading') {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">{t('search-results:detail.loading')}</p>
      </main>
    );
  }

  // 🔴 Οι δύο αστοχίες **δεν** συγχωνεύονται: «δεν δημοσιεύεται» δεν θεραπεύεται με
  // ξαναδοκιμή, «δεν απάντησε» θεραπεύεται μόνο με αυτήν.
  if (lookup.state === 'absent') {
    return (
      <DetailNotice
        titleKey="search-results:detail.absent.title"
        bodyKey="search-results:detail.absent.body"
        backHref={backHref}
      />
    );
  }

  if (lookup.state === 'error') {
    return (
      <DetailNotice
        titleKey="search-results:detail.error.title"
        bodyKey="search-results:detail.error.body"
        backHref={backHref}
      />
    );
  }

  return <ListingDetailBody listing={lookup.listing} backHref={backHref} />;
}

/**
 * Η σελίδα όταν **υπάρχει** αγγελία.
 *
 * ⚠️ Ξεχωριστή από τον ενορχηστρωτή **επίτηδες**: εκείνος απαντά *«σε ποια κατάσταση
 * είμαστε;»*, αυτή *«πώς μοιάζει ένα ακίνητο;»*. Δύο ερωτήματα σε μία συνάρτηση
 * σημαίνει ότι κάθε αλλαγή διάταξης ξαναδιαβάζει λογική καταστάσεων — και το όριο των
 * **40 γραμμών** (N.7.1) υπάρχει ακριβώς για να μη συμβαίνει αυτό.
 */
function ListingDetailBody({
  listing,
  backHref,
}: {
  readonly listing: PublicListing;
  readonly backHref: WorkspaceHref;
}) {
  const { t } = useTranslation(['search-results']);

  return (
    <main className="mx-auto w-full max-w-7xl">
      {/*
        ⚠️ ΤΟ `p-4 sm:p-6` ΕΦΥΓΕ (ADR-797 ΦΑΣΗ Β): τον διάδρομο τον δίνει πλέον το
        `ShellSurface` του `(light)/layout.tsx`, ρευστά και από το πραγματικό πλάτος
        της επιφάνειας αντί για δύο σκαλοπάτια σε breakpoint.

        🔶 ΤΟ `max-w-7xl` ΕΙΝΑΙ ΔΗΛΩΜΕΝΟ ΟΡΙΟ (ήταν `max-w-5xl` ως το ADR-907 Φ2β-2 — «πλατύτερη, μία κύλιση», ο
        ανασχεδιασμός της Zillow το 2023). Δεν είναι **μέτρο** γραμμής: είναι πλάτος **ΔΙΑΤΑΞΗΣ** — η σελίδα είναι
        δύο στήλες (`lg:grid-cols-[minmax(0,1fr)_22rem]`). Η κύρια στήλη μετρήθηκε 912px στα 1440px και η πρόζα
        της κρατιέται στο ταβάνι του ρόλου `wide` από το `SECTION_PROSE_MEASURE` (χωρίς αυτό: 109 χαρακτήρες). Ένας
        ρόλος `measure` στη ρίζα θα ήταν κατηγοριακό λάθος, και ο γεννήτορας θα τον αρνιόταν. Το ερώτημα «ποιος κατέχει το πλάτος
        ΔΙΑΤΑΞΗΣ;» είναι **τρίτο** και μένει ανοιχτό (ADR-797 §4.2) — μετρημένο:
        17 ρίζες σε 143, δηλαδή 11,9%, με ratchet να το παρακολουθεί.
      */}
      <nav className="mb-4">
        <Link
          href={backHref}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          {t('search-results:detail.back')}
        </Link>
      </nav>

      {/* Ο τίτλος είναι κείμενο του κατόχου — **όχι** κλειδί i18n (σχήμα προβολής). */}
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{listing.title}</h1>

      {/*
        🔴 **Η ΥΠΟΓΡΑΦΗ — ΕΔΩ, ΚΑΙ Η ΘΕΣΗ ΕΙΝΑΙ Η ΑΠΟΦΑΣΗ** (ADR-841 Α13.3, κλείνει το Ο-9).

        **Νομικό, όχι αισθητικό**: το **ΔΕΕ C-146/16** *(Α1.5)* ζητά την ταυτότητα του
        εμπόρου *«απλά και γρήγορα»*. Μέχρι σήμερα η **κάρτα** το έλεγε και **αυτή** η
        σελίδα — εκεί που παίρνεται η απόφαση — **όχι**: ασυμμετρία ακριβώς ανάποδα από
        το σωστό.

        ⛔ **ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟ `aside`**, όσο κι αν εκεί «ταιριάζει» οπτικά:
        στο **κινητό** — που η Α3 ονομάζει **βασική** εκδοχή, όχι υποβαθμισμένη — η
        διάταξη είναι **μία στήλη** και το `aside` πέφτει **κάτω από γκαλερί + χάρτη**.
        Δηλαδή «μετά από δύο οθόνες κύλισης», που είναι ο ορισμός του **όχι γρήγορα**.

        🏆 **Ο δεύτερος λόγος, και είναι δικός μας**: αυτή η σελίδα είναι η **μόνη** που
        ονομάζει τα **κενά** της *(«Δεν έχει δηλωθεί» · «τι δεν δημοσιεύουμε ακόμη»)*.
        Μετρημένο στη βιβλιογραφία *(J. Business Research 04/2026, Α13.4)*: μπροστά σε
        αραιή αγγελία ο επισκέπτης έχει αμφισημία **και για την πρόθεση πίσω από ό,τι
        λείπει** — και η αμφισημία είναι **ισχυρότερη** για τους πιο αξιόπιστους γραφείς.
        **«Δεν έχει δηλωθεί» χωρίς να ξέρεις ποιος δεν δήλωσε είναι κατηγορία χωρίς
        κατηγορούμενο** ⇒ η προέλευση **προηγείται** των κενών, δεν τα ακολουθεί.

        ⚠️ **ΚΑΝΕΝΑΣ διακόπτης `showAuthorship` εδώ, και δεν θα αποκτήσει**: στην κάρτα ο
        διακόπτης υπάρχει μόνο για τη **βιτρίνα** *(Α6)*, όπου την ταυτότητα την
        αναλαμβάνει η **κεφαλίδα της σελίδας**. Εδώ κανένα άλλο ορατό στοιχείο δεν την
        αναλαμβάνει.
      */}
      <ListingAuthorshipLine listing={listing} className="mt-1 text-sm text-muted-foreground" />

      {/* ADR-907 Φ2β-1 — μία κύλιση με μπάρα ενοτήτων (Zillow · Idealista), όχι κρυμμένες καρτέλες για τα στοιχεία. */}
      <ListingSectionNav />

      {/*
        ΜΙΑ στήλη που πλαταίνει σε δύο — το κινητό είναι η **βασική** εκδοχή (Α3),
        όχι υποβαθμισμένη· και **ποτέ φύλλο**, σε καμία διάσταση οθόνης.

        🔑 **ΕΝΑ DOM, ΚΑΙ Η ΣΕΙΡΑ ΤΟΥ ΕΙΝΑΙ Η ΣΕΙΡΑ ΤΟΥ ΚΙΝΗΤΟΥ** (ADR-907 Φ2β-1): μέσα → τιμή + επαφή → όλα τα
        υπόλοιπα. Μετρημένο πριν: σε 390px η τιμή έπεφτε ~1.086px κάτω, μετά τα μέσα **και** τον χάρτη. Στο `lg` η
        σύνοψη τοποθετείται από το **πλέγμα** στη δεξιά στήλη και κολλά — καμία διπλή απόδοση, καμία CSS `order`
        (η σειρά εστίασης μένει η οπτική σειρά, WCAG 2.4.3).
      */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ListingSectionAnchor section="media" className="min-w-0">
          {/*
            🗂️ **ΕΝΑΣ ΠΡΟΒΟΛΕΑΣ ΜΕ ΚΑΡΤΕΛΕΣ, ΟΧΙ ΤΕΣΣΕΡΑ ΦΥΛΛΑ ΣΤΗ ΣΤΟΙΒΑ** — το ίδιο κέλυφος με τα «Διαθέσιμα Ακίνητα»
            του χώρου (`MediaViewerShell`), με δημόσια δεδομένα. Η σειρά των καρτελών κρατά την **αύξουσα αφαίρεση**
            *(ADR-845 Φ4.3)*: φωτογραφία *(τι είναι)* → κάτοψη *(πώς είναι μοιρασμένο)* → μοντέλο *(πώς στέκει στον
            χώρο)* → περιήγηση 360° *(ADR-884 Κ3β)*.

            🔑 **Οι κανόνες των φύλλων ΔΕΝ άλλαξαν, άλλαξε μόνο η θέση τους**: οι κατόψεις και τα μοντέλα μένουν σε
            **δικό τους** φύλλο *(ADR-841 §7 Α17.2 — δίπλα, ποτέ μέσα στη συλλογή)*, και ό,τι είναι προαιρετικό
            **σιωπά** όταν λείπει: η καρτέλα του απλώς δεν υπάρχει. Μόνο η απουσία φωτογραφίας ονομάζεται.
          */}
          <ListingMediaViewer listing={listing} />
        </ListingSectionAnchor>

        <ListingSectionAnchor
          as="aside"
          section="price"
          className="flex flex-col gap-4 lg:sticky lg:top-16 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          <ListingPriceBlock listing={listing} />
          {/* Επαφή + αποθήκευση: μία ετυμηγορία κατόχου για τις δύο (ADR-777 §8.74.7). */}
          <ListingDetailActions listingId={listing.id} />
          <ListingOffers listing={listing} />
        </ListingSectionAnchor>

        <ListingSections listing={listing} />
      </div>

      {/*
        Κανόνας 18 — **πότε** ανακατασκευάστηκε αυτή η προβολή. Δεν είναι λεπτομέρεια
        μηχανικού: η σελίδα διαβάζει μια **προβολή**, όχι το ίδιο το ακίνητο, και ο
        επισκέπτης δικαιούται να ξέρει πόσο παλιά είναι η αλήθεια που του δείχνουμε.
      */}
      <footer className="mt-6 text-xs text-muted-foreground">
        {t('search-results:detail.provenance.projectedAt', {
          value: formatDateTime(listing.projectedAt),
        })}
      </footer>
    </main>
  );
}

/**
 * Οι ενότητες **κάτω** από τα μέσα, στην κύρια στήλη — καθεμιά στόχος της μπάρας (ADR-907 Φ2β-1).
 *
 * 🔑 Στοιχεία και τιμές περιοχής ζούσαν στη στήλη των 22rem· εδώ παίρνουν το πλάτος που χρειάζονται. Η σειρά:
 * **τι είναι** (στοιχεία) → **πού είναι** (θέση, και ο χρόνος μετά τον τόπο) → **τι αξίζει εκεί** (συμβόλαια) →
 * **τι ισχύει νομικά**, και στο τέλος ό,τι δεν δημοσιεύουμε ακόμη.
 */
/**
 * 🔶 **Η στήλη πλάτυνε, η πρόζα όχι** (ADR-907 Φ2β-2). Μετρημένο στα 1440px με `max-w-7xl`: η κύρια στήλη είναι 912px
 * και οι παράγραφοι των νομικών έφταναν **109 χαρακτήρες** ανά γραμμή. Το πλάτος το θέλουν οι φωτογραφίες, ο χάρτης και
 * οι πίνακες — το κείμενο κρατά το ταβάνι του ρόλου `wide` του κελύφους, από το **ίδιο** token (ποτέ δεύτερος αριθμός).
 */
const SECTION_PROSE_MEASURE =
  '[&_p]:max-w-[calc(var(--spacing-layout-measure-wide)*1ch)] [&_li]:max-w-[calc(var(--spacing-layout-measure-wide)*1ch)]';

function ListingSections({ listing }: { readonly listing: PublicListing }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-4 lg:col-start-1', SECTION_PROSE_MEASURE)}>
      <ListingSectionAnchor section="details">
        <ListingAttributeList listing={listing} />
      </ListingSectionAnchor>

      <ListingSectionAnchor section="location" className="flex flex-col gap-4">
        <ListingPositionSection listing={listing} />
        {/*
          ADR-835 §21 — **ο ΧΡΟΝΟΣ μετά τον ΤΟΠΟ** (η σειρά «τόπος → χρόνος» του §4.6). Δύο μήνες δίπλα-δίπλα
          θέλουν πλάτος. Αποδίδει **τίποτα** για ό,τι δεν είναι βραχυχρόνια διάθεση.
        */}
        <ListingStay listing={listing} />
      </ListingSectionAnchor>

      {/* ADR-889 Φ2 — τιμές συμβολαίων της περιοχής. Μένει `dynamic(ssr: false)`: εκτός route slice (CHECK 3.34). */}
      <ListingSectionAnchor section="market">
        <ListingMarketContext listingId={listing.id} />
      </ListingSectionAnchor>

      <ListingSectionAnchor section="legal" className="flex flex-col gap-4">
        {/* Α17 (ADR-838) — η νομιμότητα είναι πλέον ΔΕΔΟΜΕΝΟ, όχι δηλωμένο κενό. */}
        <ListingLegality listing={listing} />
        <ListingOpenSubjects />
      </ListingSectionAnchor>
    </div>
  );
}

/** Οι **διαθέσεις** (Α20) — ποτέ το lossy `commercialStatus`, αλλιώς η αντιπαροχή σιωπά. */
function ListingOffers({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['search-results']);

  return (
    <SectionFrame headingId="listing-offers-heading" title={t('search-results:detail.offers.heading')} headingLevel="h2" titleSize="eyebrow">
      <ul className="mt-2 flex flex-wrap gap-1">
        {listing.offerKinds.map((kind) => (
          <li
            key={kind}
            className="rounded bg-secondary px-2 py-1 text-sm text-secondary-foreground"
          >
            {t(`search-results:listing.offer.${kind}`)}
          </li>
        ))}
      </ul>
      {/* ADR-777 §8.60.17 — ο όρος της αντιπαροχής, δίπλα στη διάθεσή του. */}
      <ListingExchangeTerm exchange={listing.exchange} />
    </SectionFrame>
  );
}
