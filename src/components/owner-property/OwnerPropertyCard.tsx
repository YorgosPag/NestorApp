'use client';

/**
 * @fileoverview **Μία αγγελία στον κατάλογο του ιδιοκτήτη** — και **αν φτάνει στον χάρτη**.
 * @related ADR-777 §7 (Α5 · Α14 · Α22) · types/owner-property.ts · public-listing-projection
 * @module components/owner-property/OwnerPropertyCard
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΚΑΡΤΑ ΔΕΝ ΞΑΝΑΚΡΙΝΕΙ ΤΙΠΟΤΑ — ΡΩΤΑΕΙ ΤΟΥΣ ΙΔΙΟΥΣ ΚΡΙΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το *«είναι στον δημόσιο χάρτη;»* το απαντά **αποκλειστικά** η σύνθεση
 * `projectableFromOwnerProperty` → {@link isPubliclyListed} — η **ίδια** διαδρομή που
 * εκτελεί ο γραφέας στον διακομιστή. Ένα `offers.length > 0 && lifecycle === 'listed'`
 * γραμμένο εδώ θα ήταν **δεύτερος κριτής**: η οθόνη θα έλεγε «είναι στον χάρτη» ενώ ο
 * γραφέας θα είχε σβήσει την προβολή, και ο άνθρωπος **δεν θα είχε κανέναν τρόπο να
 * το μάθει**. Είναι το ίδιο μάθημα με τη φρεσκάδα της `DemandCard`.
 *
 * 🔑 **Και γι' αυτό δεν χρειάζεται ανάγνωση του `public_listings`**: το κριτήριο είναι
 * **καθαρή συνάρτηση** πάνω σε δεδομένα που ήδη έχουμε. Μια δεύτερη ανάγνωση ανά κάρτα
 * θα ήταν N ερωτήματα για πληροφορία που είναι **υπολογίσιμη** — και η **Α0** δεσμεύει
 * «μοντέλο για την τελική κλίμακα».
 *
 * ⚠️ **Η θέση αναφέρεται ΠΑΝΤΑ, ακόμη κι όταν λείπει** (Α5 §4.1: *ποτέ σιωπηλή
 * εξαφάνιση*). Ο κάτοχος που δεν δήλωσε θέση οφείλει να βλέπει **γιατί** το ακίνητό
 * του δεν είναι στον χάρτη — και να μπορεί να το διορθώσει με ένα κλικ (§4.3: *«το
 * γέμισμα της θέσης είναι το δόλωμα, ποτέ το φράγμα»*).
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { nowISO } from '@/lib/date-local';
import {
  ownerListingVisibility,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import { listingPriceReductionOf } from '@/services/listings/public-listing-projection';
import type { ListingStatsState } from '@/hooks/owner-property/useOwnerPortfolioStats';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { ownerPropertyOfferKinds, type OwnerProperty } from '@/types/owner-property';

import { OwnerPropertyCardCover } from './OwnerPropertyCardCover';
import { StatsRowPending } from './owner-property-stats-pending';

/**
 * 📊 ADR-777 §8.72 — **ΟΡΙΟ ΚΛΕΙΣΤΟΤΗΤΑΣ** (CHECK 3.34 Κ2): οι αριθμοί φτάνουν **μόνο** στον πελάτη (fetch
 * μετά το mount), άρα τα κείμενά τους δεν ανήκουν στο route slice. Όσο φορτώνει, χώρος στο ίδιο ύψος.
 * ⚠️ **Όχι `ssr: false`** (ADR-744 §14.3): το SSR αποδίδει το σκελετό χωρίς κείμενο — τίποτα δεν κρύβεται από το 3.51.
 */
const OwnerPropertyStatsRow = dynamic(
  () => import('./OwnerPropertyStatsRow').then((mod) => mod.OwnerPropertyStatsRow),
  { loading: StatsRowPending },
);

const NS = 'property-market';
const K = `${NS}:offer`;

export function OwnerPropertyCard({
  property,
  priority = false,
  stats,
}: {
  property: OwnerProperty;
  /**
   * 📊 ADR-777 §8.72 — τα στατιστικά **αυτής** της αγγελίας, από το ΕΝΑ fetch της σελίδας
   * (`useOwnerPortfolioStats` + `listingStatsStateOf`). Υποχρεωτικό: η κάρτα **δεν** φέρνει
   * δεδομένα μόνη της — N κάρτες δεν γίνονται ποτέ N κλήσεις.
   */
  stats: ListingStatsState;
  /** Μόνο η **πρώτη** κάρτα της λίστας φορτώνει τη μικρογραφία της με υψηλή προτεραιότητα. */
  priority?: boolean;
}): React.ReactElement {
  const { t } = useTranslation([NS, 'properties-enums']);

  // 🔴 Ο **ίδιος** κριτής με τον διακομιστή. Δες την επικεφαλίδα του αρχείου.
  // ⚠️ **Μία ανάγνωση ρολογιού ανά απόδοση** (§8.33): η λήξη της εντολής κρίνεται με
  // την ίδια στιγμή για κάθε κάρτα της λίστας.
  const at = nowISO();
  const visibility = ownerListingVisibility(property, at);
  // 📊 §8.72 — μετρικές **μόνο** για αγγελία στην αγορά. Η μείωση ρωτά τον ΙΔΙΟ κριτή με την
  //    προβολή, άρα ο κάτοχος βλέπει ακριβώς το «↓ 8%» που βλέπει ο αγοραστής.
  const onMarket = visibility === 'published';
  const priceReduction = onMarket ? listingPriceReductionOf(projectableFromOwnerProperty(property, at)) : null;
  const kinds = ownerPropertyOfferKinds(property);

  return (
    <article className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 sm:flex-row">
      {/*
        🖼️ ADR-777 §8.70 — **ό,τι βλέπει ο κόσμος**, ή η δηλωμένη απουσία του. Στήλη αριστερά
        από `sm`, πάνω από το κείμενο σε κινητό (πρότυπο Idealista «Tus anuncios»).
      */}
      <OwnerPropertyCardCover property={property} priority={priority} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{property.title}</h2>
          <span className="text-sm text-muted-foreground">
            {t(`${K}.lifecycle.${property.lifecycle}`)}
          </span>
        </header>

        <p className="text-sm text-foreground">
          {/*
            🔴 **ΤΟ ΣΚΕΛΟΣ ΤΟΥ «ΔΕΝ ΞΕΡΩ», ΚΑΙ ΕΙΝΑΙ Η ΟΘΟΝΗ ΠΟΥ ΤΟ ΔΕΙΧΝΕΙ** (ADR-842
            §7.6.12 / §8 #11). Έγραφε `isCanonicalPropertyType(...) ? t(...) : property.type`
            — δηλαδή για μη κανονική τιμή **τύπωνε την ωμή αποθηκευμένη συμβολοσειρά** στην
            οθόνη του ανθρώπου (`'Διαμέρισμα 2Δ'`, `'Οικόπεδο'`). Πλέον ο τύπος **δεν
            επιτρέπει** τέτοια τιμή: το σύνορο την κανονικοποίησε ή έδωσε `null`.

            🔑 **Και το `null` ΕΜΦΑΝΙΖΕΤΑΙ, δεν κρύβεται.** Είναι η οθόνη του **κατόχου** —
            ο μόνος που μπορεί να διορθώσει το είδος. Η δημόσια προβολή κάνει το αντίθετο
            και **δεν δημοσιεύεται** (`isPubliclyListed`): δύο ακροατήρια, δύο σωστές
            απαντήσεις στην ίδια κατάσταση.
          */}
          {property.type === null
            ? t(`${K}.card.typeUnknown`)
            : t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[property.type]}`)}
          {property.areaSqm !== null && ` · ${t(`${K}.card.area`, { area: property.areaSqm })}`}
          {property.floor !== null && ` · ${t(`${K}.card.floor`, { floor: property.floor })}`}
          {property.bedrooms !== null &&
            ` · ${t(`${K}.card.bedrooms`, { count: property.bedrooms })}`}
        </p>

        {kinds.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {kinds.map((kind) => t(`${K}.offerKind.${kind}`)).join(' · ')}
          </p>
        )}

        {/*
          ⚠️ Η θέση **δεν σιωπά ποτέ** (Α5 §4.1). Και τα δύο μηνύματα είναι ουδέτερα:
          το «χωρίς δηλωμένη θέση» δεν είναι επίπληξη — είναι **η κατάσταση**, με τη
          θεραπεία ένα κλικ μακριά.
        */}
        {property.place.kind === 'declared' ? (
          <p className="text-sm text-muted-foreground">{property.place.label}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t(`${K}.card.noPlace`)}</p>
        )}

        {/*
          🔴 **ΤΡΙΑ ΣΚΕΛΗ, ΟΧΙ ΔΥΟ.** Εδώ ζούσε ένα τριαδικό `onMap ? published :
          withdrawn` — δηλαδή η οθόνη έλεγε «*είναι στον δημόσιο χάρτη*» **με βεβαιότητα**
          κάθε φορά που η αγγελία **δικαιούνταν** να είναι, ακόμη κι όταν ο γραφέας της
          προβολής είχε αποτύχει. Το κλειδί `publish.failed` **υπήρχε ήδη γραμμένο και
          στις δύο γλώσσες** — και **κανείς δεν το ζητούσε ποτέ**.
        */}
        <p className="text-sm text-foreground">{t(`${K}.publish.${visibility}`)}</p>
        {onMarket && (
          <OwnerPropertyStatsRow stats={stats} listedAt={property.listedAt} priceReduction={priceReduction} />
        )}
        {/*
          🔑 **ADR-864 — ο ΛΟΓΟΣ, όταν ο λόγος είναι επιλογή του κατόχου.** Το «δεν είναι στον
          δημόσιο χάρτη» είναι αληθινό και για την κλειστή διάθεση· χωρίς αυτή τη γραμμή ο
          άνθρωπος δεν ξεχωρίζει «το επέλεξα» από «κάτι χάλασε». Ίδιος κατάλογος ετικετών με
          τη διεπαφή επιλογής και το ίχνος.
        */}
        {property.marketingAudience !== 'public' && (
          <p className="text-sm text-muted-foreground">
            {t(`properties-enums:marketingAudience.${property.marketingAudience}`)}
          </p>
        )}

        <nav>
          <Link
            href={offerDetailHref(property.id)}
            className="inline-block rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground"
          >
            {t(`${K}.list.open`)}
          </Link>
        </nav>
      </div>
    </article>
  );
}
