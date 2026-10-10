/**
 * @fileoverview **ΤΙ ΚΑΤΟΨΗ ΟΡΟΦΟΥ ΔΕΧΕΤΑΙ ΜΙΑ ΑΓΓΕΛΙΑ** — το πλήθος και ο τελευταίος έλεγχος των μονάδων (ADR-907 §11.5).
 * @related ./floor-plate-outline (`readFloorPlateOutline`) · ./floor-plate-state · lib/listings/listing-video-policy (το ίδιο ιδίωμα)
 * @module lib/listings/floor-plate/floor-plate-publication
 *
 * 🔑 **Γιατί δεύτερος έλεγχος, αφού η επιμέλεια παράγει ήδη σωστές μονάδες**: ο τύπος `FloorPlateUnit` δεν μπορεί να πει
 * «ζυγός αριθμός κλασμάτων στο [0,1]» ούτε «ακριβώς μία μονάδα είναι αυτή της αγγελίας». Το `public_listings` διαβάζεται
 * από οποιονδήποτε, και ο μόνος φρουρός του είναι ό,τι τρέχει **πριν** από τη γραφή — άρα η ερώτηση γίνεται ξανά στο
 * σύνορο, με την **ίδια** ανάγνωση που θα κάνει ο επισκέπτης.
 *
 * ⚠️ **Καθαρό module** — κανένα React, καμία I/O.
 */

import type { FloorPlateUnit } from '@/types/public-listing';

import { readFloorPlateOutline } from './floor-plate-outline';
import { FLOOR_PLATE_SELF_STATE, isFloorPlateState } from './floor-plate-state';

/**
 * **Μία** κάτοψη ορόφου ανά αγγελία — μια μονάδα βρίσκεται σε έναν όροφο.
 *
 * ⚠️ **Εκτός** του `PUBLISHED_MEDIA_LIMIT`: εκείνο μετρά τα αρχεία που **διάλεξε** ο άνθρωπος για το ακίνητο· η κάτοψη
 * ορόφου δεν είναι αρχείο του ακινήτου, έρχεται από τη δήλωση του **ορόφου** και δεν τρώει θέση φωτογραφίας.
 */
export const LISTING_FLOOR_PLATE_MAX_COUNT = 1;

/**
 * **Το ταβάνι μονάδων μιας κάτοψης ορόφου** (ADR-907 §11.7) — πάνω από αυτό ο όροφος **αρνείται**, δεν κόβεται: μισός
 * όροφος στο κοινό θα έδειχνε κενά εκεί όπου υπάρχουν μονάδες.
 *
 * 🔑 Το έγγραφο ταξιδεύει ολόκληρο στο HTML. Μετρημένο στα δεδομένα δοκιμής: 3 μονάδες, 4–6 κορυφές ⇒ ~90 bytes η
 * καθεμία· στο ταβάνι, με τυπικά περιγράμματα, ~6 KB. ⚠️ Όροφος στάθμευσης με περισσότερες θέσεις **δεν** έχει μετρηθεί
 * — το όριο είναι δηλωμένο πάνω σε τρεις πραγματικές μονάδες, όχι σε πραγματικό υπόγειο.
 */
export const FLOOR_PLATE_MAX_UNITS = 64;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/** Μία μονάδα όπως θα τη διαβάσει ο επισκέπτης: αναγνώσιμο περίγραμμα, γνωστή κατάσταση, σύνδεσμος μόνο αν έχει τιμή. */
function isPublishableUnit(unit: unknown): unit is FloorPlateUnit {
  if (!isRecord(unit)) return false;
  if (readFloorPlateOutline(unit.outline) === null || !isFloorPlateState(unit.state)) return false;
  return unit.listingId === undefined || (typeof unit.listingId === 'string' && unit.listingId.length > 0);
}

/**
 * **Μπορούν αυτές οι μονάδες να βγουν στο κοινό ως ΜΙΑ κάτοψη ορόφου;**
 *
 * 🔑 **Όλες ή καμία**: μία άκυρη μονάδα αρνείται ολόκληρο τον όροφο. Κάτοψη που δείχνει «όλες τις μονάδες εκτός από
 * μία» λέει στον αγοραστή ότι εκεί δεν υπάρχει τίποτα.
 *
 * 🔑 **Ακριβώς μία `self`**: χωρίς αυτήν ο επισκέπτης δεν ξέρει ποιο σχήμα είναι το ακίνητο που κοιτά· με δύο, η
 * αγγελία ισχυρίζεται ότι είναι δύο μονάδες.
 */
export function isPublishableFloorPlateUnits(units: unknown): units is readonly FloorPlateUnit[] {
  if (!Array.isArray(units) || !units.every(isPublishableUnit)) return false;
  return units.filter((unit) => unit.state === FLOOR_PLATE_SELF_STATE).length === 1;
}
