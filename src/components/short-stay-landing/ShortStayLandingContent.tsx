'use client';

/**
 * **Η ακτίνα της βραχυχρόνιας μίσθωσης — `/stay`** (ADR-777 §8.82).
 *
 * @related SearchLandingContent (ο κόμβος) · AgencyDirectoryContent (η ακτίνα `/pro`) ·
 *          lib/listings/listing-coverage (η έντιμη κάλυψη)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΟΜΒΟΣ ΚΑΙ ΑΚΤΙΝΕΣ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΓΟΥΣΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 * Η αρχική μένει **κόμβος**: καρτέλες-φίλτρα, **μία** εικόνα (Spitogatos/idealista
 * κρατούν το ίδιο αρχείο σε κάθε καρτέλα). Κατηγορία με **δικό της κοινό** παίρνει
 * **δική της** σελίδα — Airbnb, Zillow/Houzz `/professionals`, Rightmove `/commercial`.
 * Ο επισκέπτης για λίγες μέρες δεν ψάχνει ό,τι ο αγοραστής: άλλη πρόθεση, άλλη σελίδα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΝΤΙΜΗ ΣΕ ΛΙΓΗ ΠΡΟΣΦΟΡΑ — ΚΑΙ Η ΣΥΝΘΗΚΗ ΕΙΝΑΙ ΤΑ ΙΔΙΑ ΤΑ ΔΕΔΟΜΕΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 * Μετρημένο 24/09: **1** αγγελία βραχυχρόνιας. Ο κανόνας §8.10 — *δεν ρωτάμε ό,τι δεν
 * μπορούμε να απαντήσουμε* — ισχύει εδώ **πάνω στο υποσύνολο**, όχι σε όλες τις αγγελίες:
 * 30 πωλήσεις στον χάρτη δεν κάνουν το «πού θες να μείνεις;» απαντήσιμο.
 *   • Η κάλυψη σηκώνει «πού;» ⇒ πεδίο τόπου **μέσα** στον ήρωα.
 *   • Δεν το σηκώνει ⇒ ο ήρωας δείχνει **μόνο** τίτλο· η `CoverageStatement` λέει τους
 *     αριθμούς· η βιτρίνα δείχνει **ό,τι υπάρχει**. Κανένα πεδίο που δίνει μηδέν.
 * Το πεδίο επιστρέφει **μόνο του** μόλις τα δεδομένα το δικαιολογήσουν — χωρίς κώδικα.
 *
 * ⚠️ **ΟΧΙ ΗΜΕΡΟΜΗΝΙΕΣ ΣΤΟΝ ΗΡΩΑ — ΣΗΜΕΡΑ.** Το «πότε;» πάνω σε μία αγγελία δίνει σχεδόν
 *    πάντα μηδέν. Ζουν στην οθόνη 2 (`StayFilterFields`), όπου ο επισκέπτης φτάνει με το
 *    `offerKind=leaseShort` ήδη γραμμένο. Ανοιχτό στο ADR-777 §8.82.
 *
 * 🔑 **ΠΡΩΤΑ Η ΠΡΟΣΦΟΡΑ, ΜΕΤΑ Η ΑΝΑΖΗΤΗΣΗ** (ψυχρή εκκίνηση αγορών δύο πλευρών): ο
 *    ιδιοκτήτης έρχεται και με μηδέν ζήτηση αν το κόστος είναι μικρό· ο επισκέπτης φεύγει
 *    από τρεις αγγελίες. Γι' αυτό οι πόρτες «Ζητώ / Προσφέρω» κάθονται **αμέσως κάτω** από
 *    τον ήρωα, πριν από τη βιτρίνα — όπως στον κόμβο (§8.79, §12.6).
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShellSurface } from '@/core/containers/ShellSurface';
import { usePublicListings } from '@/services/realtime/hooks/usePublicListings';
import { applyListingFilters, serializeListingFilters } from '@/lib/listings/listing-filters';
import { computeListingCoverage, coverageAnswersWhere } from '@/lib/listings/listing-coverage';
import { searchResultsHref } from '@/lib/listings/listing-routes';
import { landingModeFilters } from '@/lib/landing/landing-modes';
import { showcaseLocale } from '@/lib/agency/showcase-filter';
import { LandingHero } from '@/components/shared/landing-hero/LandingHero';
import { LANDING_HERO_IMAGES } from '@/components/shared/landing-hero/landing-hero-images';
import { PlaceSearchBox } from '@/components/search/PlaceSearchBox';
import { LandingDoors } from '@/components/search/LandingDoors';
import { LandingShowcase } from '@/components/search/LandingShowcase';
import { CoverageStatement } from '@/components/search/CoverageStatement';

/**
 * 🔑 **Τα φίλτρα της ακτίνας — ΜΙΑ γραφή, από το SSoT της αρχικής.** Το ίδιο αντικείμενο
 *    κόβει το υποσύνολο εδώ **και** γράφεται στον σύνδεσμο προς την οθόνη 2 — άρα «όσα
 *    μέτρησα» και «όσα θα βρεις» δεν μπορούν να διαφωνήσουν.
 */
const STAY_FILTERS = landingModeFilters('stay');
const STAY_RESULTS_QUERY = serializeListingFilters(STAY_FILTERS).toString();

/** Η ακτίνα δεν ψάχνει πρόσωπα — το πεδίο ειδικότητας δεν αποδίδεται ποτέ εδώ. */
const NO_OCCUPATIONS = [] as const;
const NO_AGENCIES = [] as const;

export function ShortStayLandingContent() {
  const { t, i18n } = useTranslation(['stay-landing']);
  const locale = showcaseLocale(i18n.language);

  // 🔑 **`null` = «χωρίς περιοχή»**, όπως στον κόμβο (§8.65): βιτρίνα, όχι χάρτης.
  const { listings, loading, error } = usePublicListings(null);

  const stays = React.useMemo(() => applyListingFilters(listings, STAY_FILTERS), [listings]);
  const coverage = React.useMemo(() => computeListingCoverage(stays), [stays]);

  // Όσο δεν έχουμε μετρήσει, δεν υποσχόμαστε — ίδιος κανόνας με τον κόμβο.
  const canAskWhere = !loading && error === null && coverageAnswersWhere(coverage);

  return (
    <ShellSurface as="main" measure="wide" className="gap-y-6 [align-content:start]">
      <LandingHero
        image={LANDING_HERO_IMAGES.stay}
        title={t('stay-landing:title')}
        subtitle={t('stay-landing:subtitle')}
      >
        {canAskWhere && (
          <PlaceSearchBox mode="stay" occupations={NO_OCCUPATIONS} locale={locale} />
        )}
      </LandingHero>

      <LandingDoors />

      {/*
        ⚠️ Η βιτρίνα παίρνει **όλες** τις αγγελίες και κόβει μόνη της με `mode="stay"` —
        μέσω του **ίδιου** `landingPanelListings` με την καρτέλα της αρχικής. Ένα δεύτερο
        φίλτρο εδώ θα ήταν δεύτερη απάντηση στο «ποιες είναι βραχυχρόνιες;».
        🖼️ Το LCP είναι ο ήρωας (§8.79) ⇒ `ownsLcp={false}`.
      */}
      <LandingShowcase
        mode="stay"
        listings={listings}
        agencies={NO_AGENCIES}
        loading={loading}
        error={error}
        ownsLcp={false}
      />

      <CoverageStatement coverage={coverage} loading={loading} error={error} />

      <p className="m-0">
        <Link
          href={searchResultsHref(STAY_RESULTS_QUERY)}
          className="inline-block w-fit rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
        >
          {t('stay-landing:browseAll')}
        </Link>
      </p>
    </ShellSurface>
  );
}
