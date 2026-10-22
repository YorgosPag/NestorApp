/**
 * @fileoverview **Τα εμβαδά του ακινήτου όπως γράφονται** — το ΕΝΑ «μετρήθηκε;» και η ΜΙΑ ισότητα του μπλοκ (ADR-777 §8.97).
 * @related lib/properties/property-display-area.ts (ποιο εμβαδόν δείχνουμε) · lib/properties/level-areas.ts (ανά επίπεδο) ·
 *   features/property-details/components/property-fields-form-mapper.ts (ο γραφέας) · services/property/property-form-sync.ts
 * @module lib/properties/property-areas
 *
 * 🔑 **`0` = «δεν μετρήθηκε», ποτέ «0 τ.μ.»** (§8.96.5 Ε5) — και στις δύο κατευθύνσεις: η φόρμα διαβάζει το απόν ως `0`
 *    (`property-form-sync`), ο γραφέας γράφει το `0` ως απόν. Η ισότητα κανονικοποιεί **και τις δύο** πλευρές με τον ίδιο
 *    κανόνα ⇒ ένα αποθηκευμένο `terrace: 0` και η απουσία του είναι το ΙΔΙΟ γεγονός, και ο κύκλος ανάγνωση → εγγραφή κλείνει.
 * 🔴 **Μετρημένο** (2026-10-21, ADR-915 §37.6, ζωντανά): ακίνητο με `terrace: 0` ⇒ **κάθε** «Αποθήκευση» έβγαζε «Εμβαδά»
 *    στον διάλογο επιπτώσεων — και με «Συνέχεια» θα έσβηνε το πεδίο. Ιδίωμα §8.93/§8.94: το μπλοκ γράφεται **μόνο όταν
 *    άλλαξε** (Figma · Google Docs: μια αποθήκευση χωρίς αλλαγή δεν γεννά ίχνος).
 */

import { isPlainRecord } from '@/lib/type-guards';
import type { Property } from '@/types/property-viewer';

/** Τα προαιρετικά εμβαδά — το μικτό (`gross`) είναι το μόνο υποχρεωτικό του μπλοκ. */
export const OPTIONAL_AREA_KEYS = ['net', 'balcony', 'terrace', 'garden'] as const;
export type OptionalAreaKey = (typeof OPTIONAL_AREA_KEYS)[number];

const AREA_KEYS = ['gross', ...OPTIONAL_AREA_KEYS] as const;

export type PropertyAreas = NonNullable<Property['areas']>;

/** Οι τιμές της φόρμας: αριθμός για κάθε εμβαδόν, `0` όταν δεν συμπληρώθηκε. */
export type AreasFormValues = Readonly<Record<(typeof AREA_KEYS)[number], number>>;

/**
 * **Μετρήθηκε;** — μόνο θετικός πεπερασμένος αριθμός. Ανεκτικό σε ωμό έγγραφο Firestore (`unknown`): συμβολοσειρά,
 * αρνητικό ή `Infinity` δεν περνούν ποτέ ως εμβαδόν.
 */
export function measuredAreaOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Το μπλοκ που γράφεται: το μικτό πάντα (ως έχει), τα υπόλοιπα **μόνο** όταν μετρήθηκαν. */
export function writtenAreasOf(values: AreasFormValues): PropertyAreas {
  const areas: PropertyAreas = { gross: values.gross };
  for (const key of OPTIONAL_AREA_KEYS) {
    const measured = measuredAreaOrNull(values[key]);
    if (measured !== null) areas[key] = measured;
  }
  return areas;
}

/** Ίδια εμβαδά; Σύγκριση των **μετρημένων** τιμών ανά κλειδί — `0`, απουσία και άκυρη τιμή είναι το ίδιο «δεν μετρήθηκε». */
export function sameAreas(a: unknown, b: unknown): boolean {
  const left = isPlainRecord(a) ? a : {};
  const right = isPlainRecord(b) ? b : {};
  return AREA_KEYS.every((key) => measuredAreaOrNull(left[key]) === measuredAreaOrNull(right[key]));
}
