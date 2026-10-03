/**
 * @fileoverview **Η ΜΟΝΑΔΑ ΣΤΗ ΦΟΡΜΑ** — θέση + στάθμη + αριθμός μονάδας (ADR-900 §8 #2, 2β.2).
 * @module lib/owner-property/owner-property-unit-form
 *
 * Επίπεδα πεδία οθόνης ⇄ πεδία της δήλωσης, με το πρότυπο του `owner-property-pets-form.ts`: το σχήμα
 * απλώνεται στο `ownerPropertyFormSchema`, οι μεταφράσεις ζουν εδώ.
 *
 * 🔑 **Η στάθμη είναι ΜΙΑ επιλογή** (idealista «Planta» · Spitogatos «Όροφος»): το πεδίο `floorLevel` κρατά
 * το **ένα** κλειδί `αριθμός:είδος` (`floorRefKey`, ADR-903) — «Πυλωτή» και «Ισόγειο» είναι δύο επιλογές
 * με τον ίδιο αριθμό. `''` = δεν απαντήθηκε.
 */

import { z } from 'zod';

import { floorRefKey, parseFloorRefKey } from '@/lib/floor/floor-ref';
import { hostedFloorRef } from '@/lib/floor/hosted-floor';
import { normalizeUnitNumber } from '@/lib/geo/unit-number';
import type { OwnerProperty, OwnerPropertyDraft, OwnerPropertyPlace } from '@/types/owner-property';
import type { OwnerPropertyFormParsed } from './owner-property-form-values';

/** Τα δύο επίπεδα πεδία — απλώνονται στο `ownerPropertyFormSchema`. */
export const unitFormShape = {
  /** Κλειδί στάθμης `αριθμός:είδος`, ή `''`. */
  floorLevel: z.string(),
  /** Ό,τι γράφει ο άνθρωπος· κανονικοποιείται στη μετάφραση προς το προσχέδιο. */
  unitNumber: z.string(),
};

export const EMPTY_UNIT_FORM = { floorLevel: '', unitNumber: '' } as const;

/** Αριθμός ορόφου (π.χ. από το prospect URL) → κλειδί στάθμης· το είδος συνάγεται από τον αριθμό. */
export function floorLevelOf(floor: number | null): string {
  return floor === null ? '' : floorRefKey({ number: floor, kind: null });
}

/**
 * **Φόρμα → πεδία στάθμης/μονάδας της δήλωσης.** Η γη δεν έχει ούτε όροφο ούτε πόρτα (ADR-777 §8.32) — ο
 * κανόνας ζει εδώ, όχι στην οθόνη, όπως για τον όροφο και τα υπνοδωμάτια.
 */
export function unitDraftOf(
  values: Pick<OwnerPropertyFormParsed, 'floorLevel' | 'unitNumber'>,
  land: boolean,
): Pick<OwnerPropertyDraft, 'floor' | 'floorKind' | 'unitNumber'> {
  const level = land ? null : parseFloorRefKey(values.floorLevel);
  // Επώνυμη στάθμη χωρίς αριθμό δεν προσφέρεται από τον επιλογέα· αν φτάσει, δεν δηλώνεται (`floorUnitRule`).
  const floor = level?.number ?? null;
  return {
    floor,
    floorKind: floor === null ? null : level?.kind ?? null,
    unitNumber: land ? null : normalizeUnitNumber(values.unitNumber),
  };
}

/** **Δήλωση → φόρμα** (επεξεργασία). */
export function unitFormOf(property: Pick<OwnerProperty, 'floor' | 'floorKind' | 'unitNumber'>) {
  const ref = hostedFloorRef(property);
  return { floorLevel: ref === null ? '' : floorRefKey(ref), unitNumber: property.unitNumber ?? '' };
}

/**
 * Ο χωρικός άξονας — επίπεδα πεδία → **διακριτή ένωση**.
 *
 * 🔑 **`declared` χωρίς λυμένο σημείο πέφτει σε `declined`**, και **δεν είναι σιωπηλή
 * απώλεια**: το κουμπί υποβολής είναι απενεργοποιημένο όσο η περιοχή δεν έχει λυθεί
 * (δες `ownerPropertyFormBlockers`). Εδώ η επιστροφή είναι απλώς **ολική** —
 * μια συνάρτηση που πετούσε θα μετέτρεπε κατάσταση οθόνης σε εξαίρεση.
 *
 * ⚠️ **Το κείμενο ΑΠΟΘΗΚΕΥΕΤΑΙ εδώ (`label`), σε αντίθεση με τη ζήτηση.** Και ο λόγος
 * είναι ότι το ερώτημα είναι **άλλο**: η ζήτηση λέει *«ψάχνω γύρω από εκεί»* — το
 * κείμενο είναι **αναζήτηση**, και ξαναλυμένο αύριο μπορεί να δώσει άλλο σημείο. Η
 * προσφορά λέει *«το ακίνητό μου **είναι** εκεί»* — το κείμενο είναι **η δήλωση του
 * ανθρώπου** για το δικό του πράγμα, και ο κάτοχος οφείλει να τη βλέπει αυτούσια
 * στην οθόνη του. ⛔ **Δεν ταξιδεύει στη δημόσια προβολή** (κλειστό σχήμα).
 */
export function ownerPlaceFrom(values: OwnerPropertyFormParsed): OwnerPropertyPlace {
  if (values.placeAnswer === 'declared' && values.placePoint !== null) {
    return {
      kind: 'declared',
      point: values.placePoint,
      label: values.placeQuery.trim(),
      accuracy: values.placeAccuracy,
      // ⛔ Ο δεσμός ζει **μόνο** στον κλάδο `declared`: το `declined` δεν μπορεί να
      // τον κουβαλήσει, γιατί το να δείξεις δημόσιο κτίριο **είναι** αποκάλυψη θέσης.
      link: values.placeRef,
    };
  }
  return { kind: 'declined' };
}
