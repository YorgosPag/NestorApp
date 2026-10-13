/**
 * @fileoverview **Τα κλειδιά i18n των κοινοχρήστων** (ADR-777 §8.93) — πλήρη, με namespace, ένα ανά τιμή του καταλόγου.
 * @related `./common-charges.ts` (ο κατάλογος) · `i18n/locales/{el,en}/properties-enums.json` (`commonCharges.*`)
 * @module lib/common-charges/common-charges-keys
 *
 * 🔑 **Πίνακας, όχι template** (ίδιο ιδίωμα με το `PRICE_ROLE_KEY`): ένα `t(\`…inclusion.${x}\`)` θα ήταν δυναμικό
 * κλειδί που ο γεννήτορας του slice δεν λύνει. `Record<CommonChargeInclusion, …>` ⇒ νέα παροχή στον κατάλογο δεν
 * μεταγλωττίζεται χωρίς λέξη.
 *
 * 📦 **Ζουν στο `properties-enums`, όχι σε δικό τους namespace — και ο λόγος είναι ΜΕΤΡΗΜΕΝΟΣ** (2026-10-13): ένα
 * `common-charges` πρόσθεσε **δύο νέες αναμονές λήψης** (Buildings · PropertiesManagement) και ο χάρτης των τεμπέλικων
 * διαδρομών κοκκίνισε (ADR-744 §27, «μόνο συρρικνώνεται»). Το `properties-enums` το φορτώνουν **ήδη** και οι τρεις
 * επιφάνειες (φόρμα ακινήτου · «Βελτίωσε την αγγελία σου» · δημόσια αγγελία), και ο κατάλογος **είναι** λεξιλόγιο.
 */

import type { CommonChargeInclusion } from './common-charges';

export const COMMON_CHARGE_INCLUSION_KEY: Readonly<Record<CommonChargeInclusion, string>> = {
  heating: 'properties-enums:commonCharges.inclusion.heating',
  water: 'properties-enums:commonCharges.inclusion.water',
  elevator: 'properties-enums:commonCharges.inclusion.elevator',
  cleaning: 'properties-enums:commonCharges.inclusion.cleaning',
  commonElectricity: 'properties-enums:commonCharges.inclusion.commonElectricity',
  garden: 'properties-enums:commonCharges.inclusion.garden',
  concierge: 'properties-enums:commonCharges.inclusion.concierge',
  pool: 'properties-enums:commonCharges.inclusion.pool',
};
