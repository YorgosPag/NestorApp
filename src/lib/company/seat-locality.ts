/**
 * @fileoverview **Η ΠΟΛΗ ΤΗΣ ΕΔΡΑΣ: ΑΛΛΟΣ ΤΟΠΟΣ, Ή Ο ΙΔΙΟΣ ΔΗΛΩΜΕΝΟΣ ΕΥΡΥΤΕΡΑ;** (ADR-948 §8.7.5 · ADR-332 §D36)
 * @module lib/company/seat-locality
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 2026-11-23 (ARIES Α.Ε., `643c02ee`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | | Επαφή | ΓΕΜΗ |
 * |---|---|---|
 * | Οδός | ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ | ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ |
 * | Τ.Κ. | 57013 | 57013 |
 * | Πόλη | Ωραιόκαστρον | **ΘΕΣΣΑΛΟΝΙΚΗ** |
 * | Δήμος | Δήμος Ωραιοκάστρου | **ΩΡΑΙΟΚΑΣΤΡΟΥ / ΘΕΣΣΑΛΟΝΙΚΗΣ** |
 *
 * Η πόλη κρινόταν μόνη της, γραφή προς γραφή ⇒ «διαφέρει» ⇒ ολόκληρη η έδρα «άλλη διεύθυνση» ⇒ η «Διόρθωση
 * έδρας» έγραφε «ΘΕΣΣΑΛΟΝΙΚΗ», άδειαζε την ιεραρχία του Ωραιοκάστρου (§D35) και το autofill έδενε **Δήμο
 * Θεσσαλονίκης** — λάθος δήμος, από μητρώο που **το ίδιο** έλεγε Ωραιόκαστρο στο διπλανό του πεδίο.
 *
 * 🔑 **Η πόλη ενός μητρώου δεν είναι πάντα οικισμός.** Το ΓΕΜΗ γράφει συχνά τον νομό στη θέση της πόλης. Είναι
 * η ίδια αρχή με το `broader` του γεωκωδικοποιητή (ADR-332 D28: «το δηλώσατε ευρύτερα», όχι «λάθος») και με
 * τα «αποδεκτά ονόματα πόλης ανά Τ.Κ.» των ταχυδρομικών μητρώων: μια ευρύτερη ονομασία **δεν** είναι άλλη διεύθυνση.
 *
 * Δύο τεκμήρια, καθένα αρκεί — και κανένα δεν είναι μαντεψιά, γιατί και τα δύο είναι **δηλωμένα** δεδομένα:
 * - **(Α) το ίδιο το μητρώο** τοποθετεί την έδρα σε περιοχή που ονομάζει η πόλη της επαφής
 *   («Ωραιόκαστρον» ⇄ δήμος «ΩΡΑΙΟΚΑΣΤΡΟΥ»).
 * - **(Β) η αποδεδειγμένη ιεραρχία της επαφής** περιέχει την πόλη του μητρώου ως ευρύτερη περιοχή
 *   («ΘΕΣΣΑΛΟΝΙΚΗ» ⇄ «Περιφερειακή Ενότητα Θεσσαλονίκης») — καλύπτει και το χωριό που δεν είναι έδρα δήμου.
 *
 * ⚠️ Κρίνει **μόνο την πόλη**. Άλλη οδός ή άλλος Τ.Κ. μένουν «διαφέρει» από τη δική τους κρίση — μια εταιρεία
 * που μετακόμισε από το Ωραιόκαστρο στο κέντρο της Θεσσαλονίκης **δεν** περνά από εδώ ως «ίδια διεύθυνση».
 * ⚠️ Ταύτιση ονομάτων = `samePlaceName` (ζεύγη πτώσεων, ίδιο πλήθος λέξεων) — ποτέ «περιέχει».
 *
 * **Layering**: καθαρή — καμία εισαγωγή I/O.
 */

import { present } from '@/lib/comparison/field-judgment';
import { sameAddressFieldValue } from '@/lib/geocoding/field-match';
import type { RegistrySeat } from '@/types/company-registry';
import { projectAddressVocabulary } from '@/utils/address/administrative-hierarchy';
import { samePlaceName } from '@/utils/address/place-name';

/**
 * Τα επίπεδα της ιεραρχίας που είναι **ευρύτερα από τον οικισμό** και μπορεί να γραφτούν στη θέση «πόλη» ενός
 * μητρώου. Ονόματα του λεξιλογίου `addressInfo` (ADR-772) — ο πίνακας τα μεταφράζει από κάθε δοχείο.
 * Αποκεντρωμένη Διοίκηση και Μεγάλη Γεωγραφική Ενότητα μένουν έξω: κανένα μητρώο δεν τις γράφει ως πόλη.
 */
const WIDER_AREA_LEVELS = ['community', 'municipalUnit', 'municipality', 'regionalUnit', 'region'] as const;

/**
 * Οι **ευρύτερες περιοχές** της έδρας μιας επαφής, από την αποθηκευμένη διοικητική ιεραρχία της — `[]` όταν η
 * έδρα δεν έχει ιεραρχία. Κοινή για τη φόρμα και το αποθηκευμένο έγγραφο: και τα δύο κρατούν `CompanyAddress`.
 */
export function seatWiderAreasOf(companyAddress: Readonly<Record<string, unknown>>): readonly string[] {
  const names = projectAddressVocabulary(companyAddress, 'companyAddress', 'addressInfo', {
    includePostal: false,
    clearedIdsAsNull: false,
  });
  return WIDER_AREA_LEVELS.map((level) => present(names[level])).filter((name): name is string => name !== null);
}

/**
 * Οι περιοχές όπου **το ίδιο το μητρώο** τοποθετεί την έδρα — τα μέρη της ετικέτας δήμου του.
 *
 * ⚠️ Η μορφή «ΩΡΑΙΟΚΑΣΤΡΟΥ / ΘΕΣΣΑΛΟΝΙΚΗΣ» είναι μετρημένη σε **μία** ζωντανή εγγραφή· υπάρχει και σκέτο
 * «ΘΕΣΣΑΛΟΝΙΚΗΣ». Γι' αυτό **δεν** αποδίδεται νόημα σε θέση («πρώτο = δήμος, δεύτερο = νομός»): κάθε μέρος είναι
 * απλώς «περιοχή που το μητρώο αποδίδει στην έδρα».
 */
export function registrySeatAreas(seat: RegistrySeat): readonly string[] {
  const label = present(seat.municipality?.label);
  if (label === null) return [];
  return label.split('/').map(present).filter((area): area is string => area !== null);
}

/** Ό,τι χρειάζεται η κρίση της πόλης πέρα από τις δύο τιμές — τα δύο τεκμήρια. */
export interface SeatCityEvidence {
  /** (Α) Περιοχές που το μητρώο αποδίδει στην έδρα ({@link registrySeatAreas}). */
  readonly registryAreas: readonly string[];
  /** (Β) Ευρύτερες περιοχές της έδρας της επαφής ({@link seatWiderAreasOf}). */
  readonly contactWiderAreas: readonly string[];
}

/** **ΙΔΙΑ ΠΟΛΗ;** — ίδια γραφή/τόπος, ή ο ίδιος τόπος δηλωμένος ευρύτερα από τη μία πλευρά. */
export function sameSeatCity(contactCity: string, registryCity: string, evidence: SeatCityEvidence): boolean {
  if (sameAddressFieldValue('city', contactCity, registryCity)) return true;
  if (evidence.registryAreas.some((area) => samePlaceName(contactCity, area))) return true;
  return evidence.contactWiderAreas.some((area) => samePlaceName(registryCity, area));
}
