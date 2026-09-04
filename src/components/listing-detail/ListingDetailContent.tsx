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

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';
import { useSearchParams } from 'next/navigation';

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
import type { PublicListing } from '@/types/public-listing';
import { ListingPriceBlock } from './ListingPriceBlock';
import { ListingAttributeList } from './ListingAttributeList';
import { ListingPositionSection } from './ListingPositionSection';
import { ListingLegality } from './ListingLegality';
import { ListingOpenSubjects } from './ListingOpenSubjects';
import { ListingGallery } from './ListingGallery';
import { ListingFloorplans } from './ListingFloorplans';
import { ListingAuthorshipLine } from '@/components/listings/ListingAuthorshipLine';
import { FirstContactAction } from '@/components/contact/FirstContactAction';

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
  const searchParams = useSearchParams();
  const lookup = usePublicListing(id);

  /**
   * Τα φίλτρα **κανονικοποιημένα**, όχι η ωμή διεύθυνση: ό,τι δεν αναγνωρίζει το
   * `parseListingFilters` δεν έχει λόγο να ταξιδέψει πίσω στην οθόνη 2.
   */
  const backHref = React.useMemo(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    return searchResultsHref(serializeListingFilters(parseListingFilters(params)).toString());
  }, [searchParams]);

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
    <main className="mx-auto w-full max-w-5xl">
      {/*
        ⚠️ ΤΟ `p-4 sm:p-6` ΕΦΥΓΕ (ADR-797 ΦΑΣΗ Β): τον διάδρομο τον δίνει πλέον το
        `ShellSurface` του `(light)/layout.tsx`, ρευστά και από το πραγματικό πλάτος
        της επιφάνειας αντί για δύο σκαλοπάτια σε breakpoint.

        🔶 ΤΟ `max-w-5xl` ΜΕΝΕΙ, ΚΑΙ ΕΙΝΑΙ ΔΗΛΩΜΕΝΟ ΟΡΙΟ. Δεν είναι **μέτρο**
        γραμμής: είναι πλάτος **ΔΙΑΤΑΞΗΣ** — η σελίδα είναι δύο στήλες
        (`lg:grid-cols-[minmax(0,1fr)_22rem]`) και η στήλη κειμένου μέσα της
        μετρήθηκε ~73 χαρακτήρες, δηλαδή **εντός** του ταβανιού. Ένας ρόλος `measure`
        εδώ θα ήταν κατηγοριακό λάθος (**114ch**, πάνω από τη σύμβαση των 80ch), και
        γι' αυτό ο γεννήτορας θα τον αρνιόταν. Το ερώτημα «ποιος κατέχει το πλάτος
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

      {/*
        ΜΙΑ στήλη που πλαταίνει σε δύο — το κινητό είναι η **βασική** εκδοχή (Α3),
        όχι υποβαθμισμένη· και **ποτέ φύλλο**, σε καμία διάσταση οθόνης.
      */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <ListingGallery listing={listing} />
          {/*
            🔑 **ΔΙΠΛΑ, ΠΟΤΕ ΜΕΣΑ** *(ADR-841 §7 Α17.2)*: η δομή της οθόνης καθρεφτίζει τη
            δομή του σχήματος, που έβαλε τις κατόψεις σε **δικό τους** πεδίο. Και αποδίδει
            **τίποτα** όταν δεν υπάρχει καμία — η κάτοψη είναι προαιρετική, άρα η απουσία
            της δεν ονομάζεται *(αντίθετα από τη συλλογή, που οφείλει να υπάρχει)*.
          */}
          <ListingFloorplans listing={listing} />
          <ListingPositionSection listing={listing} />
        </div>

        <aside className="flex flex-col gap-4">
          <ListingPriceBlock listing={listing} />
          {/* ADR-843 ΠΕ1 — το κουμπί που γράφει (ADR-827 §9.8), αμέσως μετά την τιμή. */}
          <FirstContactAction target={{ kind: 'listing', listingId: listing.id }} />
          <ListingOffers listing={listing} />
          <ListingAttributeList listing={listing} />
          {/* A17 (ADR-838) — i nomimotita einai pleon DEDOMENO, oxi dilomeno keno. */}
          <ListingLegality listing={listing} />
          <ListingOpenSubjects />
        </aside>
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

/** Οι **διαθέσεις** (Α20) — ποτέ το lossy `commercialStatus`, αλλιώς η αντιπαροχή σιωπά. */
function ListingOffers({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['search-results']);

  return (
    <section
      aria-labelledby="listing-offers-heading"
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 id="listing-offers-heading" className="text-sm font-medium text-muted-foreground">
        {t('search-results:detail.offers.heading')}
      </h2>
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
    </section>
  );
}
