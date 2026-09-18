'use client';

/**
 * **Τα κατοικίδια στη σελίδα της αγγελίας** — πολιτική · όριο · χρέωση · σκύλοι βοήθειας.
 * @related ADR-777 §8.60.21 · types/property-offers.ts (`StayPetPolicy`) · lib/offers/stay-pet-policy.ts
 *
 * 🏆 **Τρία πράγματα που οι μεγάλοι δεν λένε μαζί**: η απάντηση με **τρεις** τιμές (Booking), το
 * όριο και η χρέωση **με τον τρόπο της** (Airbnb) — και **πάντα** η γραμμή του σκύλου βοήθειας,
 * ακόμη και κάτω από «όχι», γιατί εκεί ακριβώς ο επισκέπτης με σκύλο βοήθειας θα σταματούσε.
 *
 * ⚠️ **Χωρίς δήλωση λέει «δεν έχει δηλωθεί», όχι τίποτα και όχι «όχι»** (schema.org
 * `petsAllowed`: άγνωστο). Η σιωπή θα διαβαζόταν ως απαγόρευση.
 */

import type { TFunction } from 'i18next';
import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { PetAcceptance, PetFeeBasis, StayPetPolicy } from '@/types/property-offers';

/**
 * Τα κλειδιά **γραμμένα ολόκληρα** — ποτέ συναρμολογημένα από τιμή (CHECK 3.13/3.34: ένα
 * δυναμικό `t()` είναι αόρατο στον έλεγχο προσβασιμότητας κλειδιών και στον shell slice).
 * `Record` πάνω στα κλειστά σύνολα ⇒ νέα τιμή λεξιλογίου δεν μεταγλωττίζεται χωρίς κλειδί.
 */
const ACCEPTS_KEYS: Readonly<Record<Exclude<PetAcceptance, 'no'>, { readonly bare: string; readonly upTo: string }>> = {
  yes: { bare: 'short-stay:pets.yes', upTo: 'short-stay:pets.yesUpTo' },
  onRequest: { bare: 'short-stay:pets.onRequest', upTo: 'short-stay:pets.onRequestUpTo' },
};

const FEE_KEYS: Readonly<Record<PetFeeBasis, string>> = {
  stay: 'short-stay:pets.fee.stay',
  night: 'short-stay:pets.fee.night',
  pet: 'short-stay:pets.fee.pet',
  petNight: 'short-stay:pets.fee.petNight',
};

/** Η γραμμή της πολιτικής — με το όριο μέσα στην ίδια φράση όταν δηλώθηκε. */
function policyLine(t: TFunction, pets: StayPetPolicy | null): string {
  if (pets === null) return t('short-stay:pets.undeclared');
  if (pets.accepts === 'no') return t('short-stay:pets.no');
  const keys = ACCEPTS_KEYS[pets.accepts];
  return pets.maxPets === null ? t(keys.bare) : t(keys.upTo, { count: pets.maxPets });
}

/** Η γραμμή της χρέωσης — μόνο όταν γίνονται δεκτά. `fee: null` = **ρητά** «χωρίς χρέωση». */
function feeLine(t: TFunction, pets: StayPetPolicy | null): string | null {
  if (pets === null || pets.accepts === 'no') return null;
  if (pets.fee === null) return t('short-stay:pets.feeFree');
  return t(FEE_KEYS[pets.fee.per], { amount: formatCurrency(pets.fee.amount) });
}

export function ListingStayPets({
  pets,
}: {
  readonly pets: StayPetPolicy | null;
}): React.ReactElement {
  const { t } = useTranslation(['short-stay']);
  const fee = feeLine(t, pets);

  return (
    <ul aria-label={t('short-stay:pets.heading')} className="flex flex-col gap-1 text-sm text-foreground">
      <li>{policyLine(t, pets)}</li>
      {fee !== null && <li>{fee}</li>}
      <li className="text-muted-foreground">{t('short-stay:pets.assistance')}</li>
    </ul>
  );
}
