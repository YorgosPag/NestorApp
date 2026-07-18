/**
 * ADR-513 §opening-width — «Δαχτυλίδι Εντολών» διάταξη για την ΕΠΕΚΤΑΣΗ ΠΛΑΤΟΥΣ κουφώματος
 * (λαβή παρειάς `opening-corner-*`): **ΜΟΝΟ Μήκος** (1 πεδίο = όλος ο δίσκος).
 *
 * Design decision — length-only (AutoCAD direct-distance-entry): η **διεύθυνση είναι ήδη
 * κλειδωμένη** στον άξονα του τοίχου (η παρειά κινείται μόνο κατά μήκος του), οπότε το πεδίο
 * «Γωνία» είναι περιττό — πληκτρολογείς ΜΟΝΟ την απόσταση μετακίνησης. Ίδιο idiom με την ΚΑΘΕΤΗ
 * ΓΡΑΜΜΗ (`PERPENDICULAR_LINE_RING_CONFIG`) και το `ROTATION_RING_CONFIG` (1 πεδίο → 1 φέτα).
 *
 * **ΜΟΝΑΔΑ = η display μονάδα του χρήστη** (ADR-677 Φάση 2, G1). Χρησιμοποιεί τον ΚΟΙΝΟ
 * `lengthRingField` — τον ίδιο που έχουν τοίχος/γραμμή — άρα το πλάτος κουφώματος ερμηνεύεται
 * σε ό,τι δείχνει ο επιλογέας του status bar, όπως κάθε άλλο πληκτρολογούμενο μήκος.
 *
 * ⚠️ Αυτό ΑΝΤΙΚΑΤΕΣΤΗΣΕ ένα βραχύβιο mm-native πεδίο (`openingWidthMmField`, 2026-07-18), που
 * ερμηνεύε την τιμή πάντα σε mm επειδή το ribbon combobox «Πλάτος» δείχνει 700/800/900… mm. Δύο
 * πεδία στο ΙΔΙΟ `DynamicInputLockStore.length` slot ερμήνευαν πλήκτρα σε ΔΙΑΦΟΡΕΤΙΚΗ μονάδα
 * ανάλογα με το ενεργό εργαλείο — ασυνέπεια που ο Giorgio αποφάσισε ρητά να καταργηθεί υπέρ
 * ΕΝΟΣ project unit παντού (ADR-677 §6 απόφαση #2/#3). Το mm-native πεδίο ήταν επίσης
 * structural clone του `lengthRingField` — η διαγραφή του αφαιρεί και το διπλότυπο (N.18).
 *
 * FULL SSoT — μηδέν νέο store, μηδέν bespoke πεδίο: κοινό `DynamicInputLockStore` ΚΑΙ κοινός
 * builder με τοίχο/γραμμή. Το lock εφαρμόζεται σε ghost ΚΑΙ commit → typed length preview ≡ commit.
 *
 * @see ./ring-config.ts — `lengthRingField` (ο κοινός builder) + RingConfig/RingFieldDef contract
 * @see ./opening-width-lock.ts — preview≡commit lock geometry (διαβάζει το locked length σε scene units)
 */

import { DynamicInputLockStore } from './DynamicInputLockStore';
import { lengthRingField, type RingConfig } from './ring-config';

/** Διάταξη δαχτυλιδιού πλάτους κουφώματος: 1 αριθμητικό πεδίο «Μήκος» = όλος ο δίσκος (μία φέτα). */
export const OPENING_WIDTH_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.ring.openingWidthLabel',
  fields: [lengthRingField('tools.ring.length')],
  subscribe: DynamicInputLockStore.subscribe,
};
