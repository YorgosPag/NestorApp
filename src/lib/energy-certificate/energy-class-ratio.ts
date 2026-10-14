/**
 * @fileoverview **Η ενεργειακή κλάση από τον λόγο Τ = EP / RR** — ο πίνακας 1.3 της ΤΟΤΕΕ 20701-1/2017
 * (ΦΕΚ Β΄ 4003/17.11.2017, σελ. 48617–48618), διαβασμένος από το ίδιο το ΦΕΚ (ADR-777 §8.96).
 * @related `./pea-text.ts` (από πού έρχονται EP και RR) · `constants/energy-classes.ts` (η κλίμακα)
 * @module lib/energy-certificate/energy-class-ratio
 *
 * 🔑 **Γιατί υπολογισμός και όχι ανάγνωση**: στο ΠΕΑ του buildingcert.gr η κλάση είναι **εικόνα**, όχι κείμενο. Ο
 * ΚΕΝΑΚ όμως την **ορίζει** από τον λόγο της πρωτογενούς ενέργειας του κτηρίου (EP) προς εκείνη του κτηρίου αναφοράς
 * (RR) — και τα δύο τυπώνονται ως κείμενο. Ο ορισμός είναι πιο ισχυρός από κάθε OCR.
 *
 * ⚠️ **Η στρογγύλευση μπορεί να κρύψει την κλάση**: το ΠΕΑ τυπώνει EP και RR με **ένα** δεκαδικό, ενώ το λογισμικό
 * του ΤΕΕ κατατάσσει με τις ακριβείς τιμές. Αν το διάστημα [EP±0,05]/[RR∓0,05] καβαλά όριο, οι τυπωμένοι αριθμοί
 * **δεν αρκούν** ⇒ `ambiguous` με τις υποψήφιες κλάσεις, και αποφασίζει ο άνθρωπος κοιτώντας το PDF. Ποτέ σιωπηλή
 * επιλογή.
 *
 * 🔑 **Ακέραια αριθμητική**: τα όρια συγκρίνονται σε εκατοστά (`100·EP ≤ b·RR`), ώστε το `0,33·RR` να μη χάνει την
 * ισότητα σε κινητή υποδιαστολή — το όριο είναι **κλειστό από πάνω** (Τ ≤ 0,33 ⇒ Α+).
 */

import { ENERGY_CLASSES, type EnergyClass } from '@/constants/energy-classes';

/**
 * Πίνακας 1.3: το **άνω** όριο του Τ για κάθε κλάση, σε εκατοστά (`33` = 0,33), με τη σειρά της κλίμακας. Η τελευταία
 * κλάση (Η) δεν έχει άνω όριο. Κάτω όριο κάθε κλάσης = άνω όριο της προηγούμενης, **ανοιχτό**.
 */
export const ENERGY_CLASS_RATIO_UPPER_BOUNDS: Readonly<Record<EnergyClass, number | null>> = {
  'A+': 33,
  A: 50,
  'B+': 75,
  B: 100,
  C: 141,
  D: 182,
  E: 227,
  F: 273,
  G: null,
};

/** Η αναφορά του πίνακα — τυπώνεται δίπλα σε κάθε υπολογισμένη κλάση. */
export const ENERGY_CLASS_RATIO_SOURCE = 'ΤΟΤΕΕ 20701-1/2017, πίν. 1.3 (ΦΕΚ Β΄ 4003/17.11.2017)';

export type EnergyClassFromRatio =
  | { readonly kind: 'exact'; readonly class: EnergyClass; readonly ratio: number }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly EnergyClass[]; readonly ratio: number }
  | { readonly kind: 'invalid' };

/** Η κλάση για Τ = `num / den` (θετικοί ακέραιοι της ίδιας μονάδας) — ακέραιες συγκρίσεις μόνο. */
function classOfIntegerRatio(num: number, den: number): EnergyClass {
  for (const energyClass of ENERGY_CLASSES) {
    const upper = ENERGY_CLASS_RATIO_UPPER_BOUNDS[energyClass];
    if (upper === null || 100 * num <= upper * den) return energyClass;
  }
  return ENERGY_CLASSES[ENERGY_CLASSES.length - 1];
}

/** Αριθμός με το πολύ ένα δεκαδικό → ακέραιος σε εκατοστά (`79.3` → `7930`), ή `null`. */
function hundredthsOf(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const tenths = Math.round(value * 10);
  return Math.abs(value * 10 - tenths) < 1e-6 ? tenths * 10 : null;
}

/** Οι κλάσεις από `from` έως `to` στην κλίμακα (συμπεριλαμβανομένων). */
function classesBetween(from: EnergyClass, to: EnergyClass): readonly EnergyClass[] {
  return ENERGY_CLASSES.slice(ENERGY_CLASSES.indexOf(from), ENERGY_CLASSES.indexOf(to) + 1);
}

/**
 * Η κλάση από την πρωτογενή του επιθεωρούμενου (`primaryEnergy`, EP) και του κτηρίου αναφοράς (`referenceEnergy`,
 * RR), όπως τις τυπώνει το ΠΕΑ (kWh/m²·έτος, ένα δεκαδικό). Άκυρη είσοδος ⇒ `invalid`, ποτέ εικασία.
 */
export function energyClassOfRatio(primaryEnergy: number, referenceEnergy: number): EnergyClassFromRatio {
  const ep = hundredthsOf(primaryEnergy);
  const rr = hundredthsOf(referenceEnergy);
  // RR ≤ 0,05 ⇒ το διάστημα στρογγύλευσης περιέχει το μηδέν· ο λόγος δεν ορίζεται.
  if (ep === null || rr === null || rr <= 5) return { kind: 'invalid' };

  const ratio = ep / rr;
  const best = classOfIntegerRatio(Math.max(ep - 5, 0), rr + 5);
  const worst = classOfIntegerRatio(ep + 5, rr - 5);
  if (best === worst) return { kind: 'exact', class: best, ratio };
  return { kind: 'ambiguous', candidates: classesBetween(best, worst), ratio };
}
