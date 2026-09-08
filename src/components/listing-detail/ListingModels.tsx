'use client';

/**
 * @fileoverview **ΤΑ ΜΟΝΤΕΛΑ ΤΗΣ ΑΓΓΕΛΙΑΣ** — δίπλα στην κάτοψη, ποτέ μέσα της (ADR-845 Φ4.3).
 * @related ADR-845 §7.6 · ADR-841 §7 (Α12 · Α17) · ADR-842 Α7 · lib/listings/listing-material
 * @module components/listing-detail/ListingModels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΑΔΕΛΦΟ ΠΡΟΗΓΟΥΜΕΝΟ: ΟΙ ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ ΤΟΥ `ListingFloorplans` ΙΣΧΥΟΥΝ ΑΥΤΟΥΣΙΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ίδιο πρόβλημα λύθηκε **μία γενιά νωρίτερα** για την κάτοψη. Δεν ξαναποφασίζεται:
 *
 * 1. **Ξεχωριστό φύλλο, ποτέ δεύτερο `map` μέσα στο `ListingGallery`** — *«η δομή της
 *    οθόνης καθρεφτίζει τη δομή του σχήματος»*, και το σχήμα τα χώρισε *(`models[]`)*.
 * 2. **Καμία αρίθμηση** — *«ένα μοντέλο δεν είναι θέση σε σειρά»*. Κανένα *«2 από 3»*.
 * 3. **Καμία ονομασμένη απουσία** — η φωτογραφία είναι **υποχρεωτική** *(λέει «δεν
 *    υπάρχει»)*, το μοντέλο **προαιρετικό** ⇒ **σιωπά**. Μια πρόταση *«δεν υπάρχει
 *    μοντέλο»* θα κατηγορούσε τον κάτοχο για πεδίο που κανείς δεν του ζήτησε.
 *
 * ⛔ **ΚΑΙ ΜΙΑ ΑΠΟΦΑΣΗ ΠΟΥ **ΔΕΝ** ΑΝΤΙΓΡΑΦΕΤΑΙ: ΚΑΝΕΝΑ `srcset`/`sizes`/`width`/`height`.**
 * Το `ListingFloorplan` είναι raster με πλάτη· το `ListingModel` **ρητά δεν είναι**
 * `ListingImage` *(ADR-845 §10 — «υποχρεωτικά `width`/`height` + `srcset` = **ψέμα
 * σχήματος** πάνω σε GLB»)*. Ένα GLB δεν έχει «πλάτος».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΚΑΙ ΕΝΑ ΠΡΑΓΜΑ ΠΟΥ ΟΙ ΜΕΓΑΛΟΙ ΔΕΝ ΚΑΝΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η γραμμή προέλευσης κάτω από κάθε μοντέλο. Η Zillow δείχνει τρισδιάστατη περιήγηση χωρίς
 * να λέει **ποιος** την έφτιαξε ούτε αν δείχνει το κτίριο **όπως χτίστηκε** ή **όπως
 * προτάθηκε** — δες `LISTING_MODEL_PROVENANCE_KEYS` για το πλήρες επιχείρημα.
 *
 * ⚠️ **Και είναι ΤΑΥΤΟΧΡΟΝΑ ο μηχανισμός προσβασιμότητας**: μετρημένο ότι το **VoiceOver σε
 * iOS αγνοεί τελείως το `canvas`**, άρα το `alt` του `<model-viewer>` **δεν φτάνει ποτέ**
 * σε αυτούς τους χρήστες. Αυτό το `<p>` είναι **αληθινό κείμενο δίπλα στον καμβά** — το
 * διαβάζει κάθε αναγνώστης οθόνης, σε κάθε συσκευή.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import { LISTING_MODEL_PROVENANCE_KEYS } from '@/lib/listings/listing-material';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import type { PublicListing } from '@/types/public-listing';

import { ListingModelStage } from './ListingModelStage';

export function ListingModels({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['listing-detail']);

  // 🔴 **Ο ΚΡΙΤΗΣ ΤΟΥ ADR-842 Α7, ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΗΜΕΝΟΣ — ΟΧΙ ΞΑΝΑΓΡΑΜΜΕΝΟΣ.** Ο ίδιος που
  //    φυλάει τις κατόψεις: μοντέλο που **μάντεψε μηχανή** και **δεν ενέκρινε άνθρωπος** δεν
  //    φτάνει στον αγοραστή ως γεγονός. Σήμερα κανένα δεν είναι `inferred` — αλλά η μέρα που
  //    θα υπάρξει δεν θα έρθει με υπενθύμιση.
  const shown = listing.models.filter(isPubliclyPresentable);

  if (shown.length === 0) return null;

  const heading = t('listing-detail:model.heading', { count: shown.length });

  return (
    <section aria-label={heading} className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-foreground">{heading}</h2>

      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {shown.map((model) => (
          <li key={model.value.url} className="flex flex-col gap-1">
            <ListingModelStage src={model.value.url} alt={t(model.value.altKey)} />
            {/*
              ⚠️ Το κλειδί έρχεται από `Record<AttributeProvenance, …>` και **όχι** από
              τριαδικό: μια σταθερά εδώ θα έλεγε «Δηλωμένο» σε **μετρημένο** μοντέλο την
              ημέρα που ο ιδιώτης ανεβάσει το δικό του (Φ4β).
            */}
            <p className="text-xs text-muted-foreground">
              {t(LISTING_MODEL_PROVENANCE_KEYS[model.provenance])}
            </p>
          </li>
        ))}
      </ul>

      {/*
        🔴 **`modelNote`, ΠΟΤΕ `sourceNote`** — το μάθημα του Α17 αυτούσιο: το δεύτερο λέει
        *«οι ΦΩΤΟΓΡΑΦΙΕΣ είναι υλικό του κατόχου»* και τυπωνόταν **κάτω από κάτοψη**.
      */}
      <p className="text-xs text-muted-foreground">
        {t(LISTING_MATERIAL_KEYS[listing.authorship].modelNote)}
      </p>
    </section>
  );
}
