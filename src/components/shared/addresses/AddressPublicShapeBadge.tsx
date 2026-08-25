'use client';

/**
 * **ΤΙ ΔΙΝΕΙ ΑΥΤΗ Η ΔΙΕΥΘΥΝΣΗ ΣΤΟΝ ΔΗΜΟΣΙΟ ΧΑΡΤΗ** — η συνέπεια, όχι το δεδομένο.
 *
 * @related ADR-777 Α5 §4.3 · lib/listings/listing-map-shape.ts · lib/geocoding/address-position.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — μετρημένο 2026-08-25
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο επαγγελματίας συμπληρώνει διεύθυνση στην καρτέλα Τοποθεσιών και **δεν μαθαίνει
 * ποτέ** τι κάνει αυτό στον δημόσιο χάρτη. Το `geocodingMetadata` — που **είναι** η
 * απάντηση — είχε **12 αναγνώστες και 0 γραφείς**, και η σειρά badges του
 * `SharedAddressActionCard` ήταν **δομικά νεκρή**: `grep -rn "hasCoordinates=" src/`
 * → **0 σημεία κλήσης** σε ολόκληρη την εφαρμογή.
 *
 * ⇒ Τρία component εμπλουτισμού χτισμένα, τεκμηριωμένα, και **ποτέ αποδοθέντα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **Revit** (`Manage ▸ Project Location`) και το **ArchiCAD** (`Project Location`)
 * δείχνουν **γεωγραφικό πλάτος/μήκος** — έναν αριθμό. Δεν λένε ποτέ αν τον βρήκε ο
 * γεωκωδικοποιητής στην πόρτα ή αν είναι το κέντρο της πόλης, ούτε τι συνέπεια έχει.
 * Οι δικτυακές πύλες ακινήτων δείχνουν **την ίδια πινέζα** και για τα δύο.
 *
 * Εδώ ο επαγγελματίας βλέπει **τι θα δει ο επισκέπτης**: «Ακριβής διεύθυνση» ή «Μόνο
 * πόλη — όχι διεύθυνση», με το **γιατί** από κάτω. Η ακρίβεια παύει να είναι
 * μεταδεδομένο και γίνεται **ανάδραση**.
 *
 * ⚠️ **ΜΙΑ μετάφραση θέσης→σχήματος, και ΜΙΑ λίστα ονομάτων.** Το σχήμα το λύνει το
 * `listingMapShape` (η μοναδική μετάφραση, CHECK 3.41) και τα ονόματα έρχονται από τα
 * **υπάρχοντα** κλειδιά `search-results:map.shape.*`. Δεύτερο λεξιλόγιο εδώ θα ήταν
 * ακριβώς το σχήμα του ADR-749: δύο ονόματα για το ίδιο πράγμα, που μια μέρα διαφωνούν.
 *
 * 🔶 **Δηλωμένο όριο, γραμμένο αντί να υπονοείται:** δείχνει τι δίνει **αυτή η
 * διεύθυνση**, όχι τι θα δείξει τελικά η αγγελία. Όταν ένα έργο έχει πολλές
 * διευθύνσεις, νικά η **ισχυρότερη** πηγή (`outranksForLocation`) — και το να το
 * υπονοούσαμε εδώ θα ήταν ισχυρισμός που η κάρτα δεν μπορεί να στηρίξει.
 */

import React from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { listingMapShape, type ListingMapShape } from '@/lib/listings/listing-map-shape';
import { addressToPositionCandidate } from '@/services/listings/public-listing-projection';
import type { AddressGeocodingMetadata } from '@/lib/geocoding/address-position';

export interface AddressPublicShapeBadgeProps {
  readonly coordinates?: { readonly lat?: number | null; readonly lng?: number | null } | null;
  readonly geocodingMetadata?: AddressGeocodingMetadata | null;
  readonly className?: string;
}

/**
 * Πόσο «καλό» είναι το σχήμα — οδηγεί **μόνο** τον χρωματικό τόνο.
 *
 * ⚠️ **ΟΧΙ `text-primary`**: στο προεπιλεγμένο (σκοτεινό) θέμα λύνεται ταυτόσημα με το
 * `--card` ⇒ **1,00:1 = αόρατο** (CHECK 3.38). Χρησιμοποιούνται σημασιολογικοί ρόλοι.
 *
 * 🔑 **Το χρώμα δεν είναι το μόνο κανάλι** (WCAG 1.4.1 · CHECK 3.41): το **εικονίδιο**
 * και το **κείμενο** λένε την ίδια πληροφορία, οπότε η κάρτα παραμένει αναγνώσιμη
 * χωρίς αντίληψη χρώματος.
 */
const TONE_OF_SHAPE: Readonly<Record<ListingMapShape, string>> = {
  outline: 'text-[hsl(var(--text-success))]',
  pin: 'text-[hsl(var(--text-success))]',
  'pin-with-ring': 'text-[hsl(var(--text-warning))]',
  'shaded-circle': 'text-[hsl(var(--text-warning))]',
  'shaded-city': 'text-[hsl(var(--text-warning))]',
  none: 'text-muted-foreground',
};

/** Το κλειδί ονόματος κάθε σχήματος — **δείκτης** στο υπάρχον λεξιλόγιο, όχι αντίγραφο. */
const NAME_KEY: Readonly<Record<ListingMapShape, string>> = {
  outline: 'search-results:map.shape.outline',
  pin: 'search-results:map.shape.pin',
  'pin-with-ring': 'search-results:map.shape.pinWithRing',
  'shaded-circle': 'search-results:map.shape.shadedCircle',
  'shaded-city': 'search-results:map.shape.shadedCity',
  none: 'search-results:map.shape.none',
};

/** Το «γιατί». Το `none` δεν έχει επεξήγηση σχήματος — έχει **θεραπεία**, και τη λέει ο γονιός. */
const MEANING_KEY: Readonly<Record<ListingMapShape, string | null>> = {
  outline: 'search-results:detail.position.meaning.outline',
  pin: 'search-results:detail.position.meaning.pin',
  'pin-with-ring': 'search-results:detail.position.meaning.pinWithRing',
  'shaded-circle': 'search-results:detail.position.meaning.shadedCircle',
  'shaded-city': 'search-results:detail.position.meaning.shadedCity',
  none: null,
};

export function AddressPublicShapeBadge({
  coordinates,
  geocodingMetadata,
  className,
}: AddressPublicShapeBadgeProps) {
  const { t } = useTranslation(['addresses', 'search-results']);

  // 🔑 **Η ΙΔΙΑ αλυσίδα που τρέχει ο διακομιστής**, όχι μια δεύτερη εκτίμηση: αν αυτές
  // οι δύο αποκλίνουν, η κάρτα υπόσχεται σχήμα που ο χάρτης δεν ζωγραφίζει.
  const candidate = addressToPositionCandidate(
    { coordinates: coordinates ?? null, geocodingMetadata: geocodingMetadata ?? null },
    new Date(0).toISOString(),
  );
  const shape: ListingMapShape = candidate ? listingMapShape(candidate) : 'none';
  const meaningKey = MEANING_KEY[shape];

  return (
    <div className={cn('flex items-start gap-1.5', className)}>
      {shape === 'none' ? (
        <MapPinOff className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : (
        <MapPin className={cn('mt-0.5 size-3.5 shrink-0', TONE_OF_SHAPE[shape])} aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">
          <span className="text-muted-foreground">{t('addresses:publicMap.label')}</span>{' '}
          <span className={TONE_OF_SHAPE[shape]}>{t(NAME_KEY[shape])}</span>
        </p>
        {meaningKey ? (
          <p className="text-xs leading-snug text-muted-foreground">{t(meaningKey)}</p>
        ) : (
          <p className="text-xs leading-snug text-muted-foreground">{t('addresses:publicMap.noneHint')}</p>
        )}
      </div>
    </div>
  );
}
