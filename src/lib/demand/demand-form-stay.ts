/**
 * @fileoverview **ΟΙ ΟΡΟΙ ΔΙΑΜΟΝΗΣ ΣΤΗ ΦΟΡΜΑ ΤΗΣ ΖΗΤΗΣΗΣ** — και οι δύο κατευθύνσεις, σε ένα σημείο.
 * @related ADR-777 §8.60.19 · demand-form-values.ts · demand-form-load.ts · types/property-demand.ts
 * @module lib/demand/demand-form-stay
 *
 * 🔑 **Φόρμα → κλάδος ΚΑΙ κλάδος → φόρμα ζουν μαζί**, επίτηδες: η μετάφραση των κενών πεδίων (κενό =
 * «δεν θέτω όρο», ποτέ `0`) γράφεται **μία** φορά, και ο γύρος (αποθήκευση → επεξεργασία) δεν μπορεί
 * να αποκλίνει χωρίς να το δει η άγκυρα.
 *
 * ⚠️ Τα πεδία **μένουν συμπληρωμένα** κι όταν η Διαμονή αποεπιλεγεί (Α14 §17.2)· στο **έγγραφο**
 * ταξιδεύουν μόνο με επιλεγμένη Διαμονή (`seeksFrom`).
 *
 * **Layering**: leaf — zod + καθαρές συναρτήσεις. Καμία εξάρτηση από React.
 */

import { z } from 'zod';

import { optionalNumberSchema } from '@/lib/forms/form-primitives';
import {
  isShortStaySeek,
  shortStaySeek,
  type DemandAmountRange,
  type DemandNightsRange,
  type PropertyDemand,
  type ShortStayDemandSeek,
  type StayParty,
} from '@/types/property-demand';

/** Εύρος νυχτών «από/έως» — κενό = χωρίς όριο. */
export const stayNightsFormSchema = z.object({ min: optionalNumberSchema, max: optionalNumberSchema });

/** Η παρέα ως τρία πεδία — **όλα** κενά = καμία παρέα (όχι «μηδέν άτομα»). */
export const stayPartyFormSchema = z.object({
  adults: optionalNumberSchema,
  children: optionalNumberSchema,
  infants: optionalNumberSchema,
});

type StayPartyForm = z.output<typeof stayPartyFormSchema>;

/** Η κενή μορφή των όρων διαμονής στη φόρμα. */
export const EMPTY_STAY_NIGHTS_FORM: DemandNightsRange = { min: null, max: null };
export const EMPTY_STAY_PARTY_FORM: StayPartyForm = { adults: null, children: null, infants: null };

/**
 * **Τρία πεδία → παρέα.**
 *
 * ⚠️ Παιδιά ή βρέφη **χωρίς** ενήλικα γίνονται `adults: 0` — **όχι** σιωπηλό `1`: το αναλλοίωτο
 * `stay-party-invalid` λέει στον άνθρωπο «χρειάζεται ενήλικας» αντί να του επινοήσουμε έναν.
 */
function stayPartyFrom(form: StayPartyForm): StayParty | null {
  const { adults, children, infants } = form;
  if (adults === null && children === null && infants === null) return null;
  return { adults: adults ?? 0, children: children ?? 0, infants: infants ?? 0 };
}

/** **Φόρμα → κλάδος διαμονής** — τιμή, νύχτες, παρέα. */
export function shortStaySeekFrom(
  price: DemandAmountRange,
  nights: DemandNightsRange,
  party: StayPartyForm,
): ShortStayDemandSeek {
  return shortStaySeek(price, { min: nights.min, max: nights.max }, stayPartyFrom(party));
}

/** **Ζήτηση → πεδία φόρμας** — κενά όταν δεν ζητείται διαμονή ή δεν τέθηκαν όροι. */
export function stayTermsFormOf(demand: PropertyDemand): {
  stayNights: DemandNightsRange;
  stayParty: StayPartyForm;
} {
  const stay = demand.seeks.find(isShortStaySeek);
  if (stay === undefined) return { stayNights: EMPTY_STAY_NIGHTS_FORM, stayParty: EMPTY_STAY_PARTY_FORM };
  return {
    stayNights: { ...stay.nights },
    stayParty: stay.party === null ? EMPTY_STAY_PARTY_FORM : { ...stay.party },
  };
}
