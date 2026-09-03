'use client';

/**
 * @fileoverview **ΟΙ ΚΑΤΟΨΕΙΣ ΤΗΣ ΑΓΓΕΛΙΑΣ** — δίπλα στη συλλογή, ποτέ μέσα της (ADR-841 §7 Α17).
 * @related ADR-841 §7 (Α17.2 · Α17.3) · §9 Ο-20 · lib/listings/listing-material
 * @module components/listing-detail/ListingFloorplans
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΦΥΛΛΟ ΚΑΙ ΟΧΙ ΑΛΛΟ ΕΝΑ `map` ΜΕΣΑ ΣΤΟ `ListingGallery`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **δομή της οθόνης καθρεφτίζει τη δομή του σχήματος**, και το σχήμα έβαλε τις
 * κατόψεις **δίπλα** στη συλλογή για τρεις λόγους *(δες `PublicListing.floorplans`)*.
 * Ένα δεύτερο `map` μέσα στο `ListingGallery` θα ξανάδενε τα δύο πράγματα στην απόδοση
 * αφού το σχήμα τα χώρισε — και το πρώτο που θα ξανα-εμφανιζόταν θα ήταν το `{index}`
 * `{total}`, δηλαδή **ακριβώς** το Ο-18 με άλλο πρόσωπο.
 *
 * ⚠️ **ΚΑΜΙΑ ΑΡΙΘΜΗΣΗ ΕΔΩ, ΕΠΙΤΗΔΕΣ.** Το `alt` μιας κάτοψης λέει *τι είναι* και *τίνος
 * είναι* — όχι *«3 από 8»*. Μια κάτοψη δεν είναι θέση σε σειρά.
 *
 * ⛔ **ΚΑΙ ΚΑΜΙΑ ΟΝΟΜΑΣΜΕΝΗ ΑΠΟΥΣΙΑ.** Το `ListingGallery` λέει ρητά *«δεν υπάρχει
 * φωτογραφία»* γιατί μια αγγελία **οφείλει** να έχει· η κάτοψη είναι **προαιρετική**, και
 * μια πρόταση *«δεν υπάρχει κάτοψη»* θα κατηγορούσε τον κάτοχο για πεδίο που κανείς δεν
 * του ζήτησε. Ίδιο επιχείρημα με το `stay: null` του ADR-835 §4.5.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import { LISTING_FLOORPLAN_PROVENANCE_KEYS } from '@/lib/listings/listing-material';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import type { ListingFloorplan, PublicListing } from '@/types/public-listing';

/** Τα `sizes` μιας κάτοψης — δύο σε σειρά σε οθόνη, μία σε κινητό. */
const FLOORPLAN_SIZES = '(min-width: 1024px) 31vw, 100vw';

export function ListingFloorplans({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['search-results']);

  // 🔴 **Ο ΚΡΙΤΗΣ ΤΟΥ ADR-842 Α7, ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΗΜΕΝΟΣ — ΟΧΙ ΞΑΝΑΓΡΑΜΜΕΝΟΣ.**
  //    Κάτοψη που **μάντεψε μοντέλο** και **δεν ενέκρινε άνθρωπος** δεν φτάνει στον
  //    αγοραστή ως γεγονός. Σήμερα καμία δεν είναι `inferred` — αλλά η γραμμή γράφεται
  //    **τώρα**, γιατί η μέρα που θα υπάρξει δεν θα έρθει με υπενθύμιση.
  const shown = listing.floorplans.filter(isPubliclyPresentable);

  if (shown.length === 0) return null;

  return (
    <section
      aria-label={t('search-results:detail.media.floorplanHeading', { count: shown.length })}
      className="flex flex-col gap-2"
    >
      <h2 className="text-sm font-medium text-foreground">
        {t('search-results:detail.media.floorplanHeading', { count: shown.length })}
      </h2>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((floorplan) => (
          <li key={floorplan.value.url} className="flex flex-col gap-1">
            <FloorplanImage floorplan={floorplan} />
            {/*
              🏆 **Η ΓΡΑΜΜΗ ΠΟΥ Η ZILLOW ΔΕΝ ΕΧΕΙ** *(Α17.3)*: εκείνη δείχνει κάτοψη χωρίς
              να λέει αν τη σχεδίασε άνθρωπος ή τη μέτρησε μηχανή. ⚠️ Το κλειδί έρχεται
              από `Record<AttributeProvenance, …>` και **όχι** από τριαδικό: μια σταθερά
              εδώ θα έλεγε «Δηλωμένη» σε **μετρημένη** κάτοψη την ημέρα της Φ4.
            */}
            <p className="text-xs text-muted-foreground">
              {t(LISTING_FLOORPLAN_PROVENANCE_KEYS[floorplan.provenance])}
            </p>
          </li>
        ))}
      </ul>

      {/*
        🔴 **`floorplanNote`, ΠΟΤΕ `sourceNote`** — βρέθηκε **περπατώντας** (Α17): το
        δεύτερο λέει *«οι ΦΩΤΟΓΡΑΦΙΕΣ είναι υλικό του κατόχου»*, και τυπωνόταν **κάτω
        από μια κάτοψη**, **δύο φορές**, σε δύο γραμμές απόσταση από τον εαυτό του.
        Ίδια κλάση με το Ο-18, γεννημένη από τη διόρθωσή του.
      */}
      <p className="text-xs text-muted-foreground">
        {t(LISTING_MATERIAL_KEYS[listing.authorship].floorplanNote)}
      </p>
    </section>
  );
}

/**
 * Μία κάτοψη.
 *
 * ⚠️ **ΠΟΤΕ `priority`**: το στοιχείο **LCP** αυτής της σελίδας είναι η κορυφαία
 * φωτογραφία *(Α2.4)*, και **μόνο μία** εικόνα επιτρέπεται να πάρει
 * `fetchpriority="high"` — πολλές «υψηλής» ακυρώνουν η μία την άλλη. Μια κάτοψη που θα
 * το διεκδικούσε θα **χειροτέρευε** μετρήσιμα τη σελίδα για να εμφανιστεί νωρίτερα κάτι
 * που ο επισκέπτης κοιτάζει **δεύτερο**.
 *
 * ⚠️ **`object-contain` και όχι `object-cover`**: μια φωτογραφία αντέχει κόψιμο, ένα
 * **σχέδιο όχι** — κομμένη κάτοψη χάνει δωμάτια, δηλαδή λέει ψέματα για το ακίνητο.
 */
function FloorplanImage({ floorplan }: { readonly floorplan: ListingFloorplan }) {
  const { t } = useTranslation(['search-results']);
  const image = floorplan.value;

  return (
    /*
      eslint-disable-next-line @next/next/no-img-element -- η πηγή είναι το δημόσιο
      ράφι (content-addressed, εκτός optimizer)· βλ. ADR-777 §8.11 και ADR-841 Α12.
    */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      srcSet={listingImageSrcSet(image)}
      sizes={FLOORPLAN_SIZES}
      width={image.width}
      height={image.height}
      alt={t(image.altKey)}
      loading="lazy"
      decoding="async"
      className="w-full rounded-lg border border-border bg-card object-contain"
    />
  );
}
