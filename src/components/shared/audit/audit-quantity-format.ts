/**
 * ADR-852 **Φ2** — Η ΤΙΜΗ: από `749.9999999999927` σε **«0,750 m»**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΑΠΑΝΤΑ — ΚΑΙ ΤΟ ΜΟΝΟ
 *
 *   ✅ *«αυτός ο αποθηκευμένος αριθμός, **πώς γράφεται** για άνθρωπο;»*
 *   ⛔ **ΟΧΙ** *«τι ποσότητα είναι;»* → το λέει ο περιγραφέας (`@/constants/quantity-specs`)
 *   ⛔ **ΟΧΙ** *«πώς μετατρέπω mm σε μέτρα;»* → το ξέρει το `formatLengthForDisplay`
 *
 * Αυτό εδώ είναι **σύνορο**, όχι μηχανή: ρωτά τον περιγραφέα τι είναι ο αριθμός και
 * παραδίδει τη δουλειά στον **υπάρχοντα** formatter του ADR-462. Καμία δεύτερη μηχανή
 * μορφοποίησης, κανένα δεύτερο `toFixed`.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 **ΓΙΑΤΙ ΕΙΝΑΙ ΔΙΚΟ ΤΟΥ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΓΡΑΜΜΕΣ ΜΕΣΑ ΣΤΟΝ RENDERER**
 *
 * Είναι ο **μοναδικός** καταναλωτής του `dxf-viewer` σε ολόκληρη την επιφάνεια audit,
 * δηλαδή το μοναδικό σημείο που δηλώνεται στο `.dxf-viewer-public-api.json`
 * (CHECK 3.62). Μαζεμένο σε ένα ονομασμένο αρχείο, η δημόσια επιφάνεια που ζητάμε
 * είναι **ορατή με μια ματιά** και μπορεί να συρρικνωθεί· σκορπισμένο σε έναν renderer
 * 380 γραμμών, θα ήταν μια εισαγωγή που κανείς δεν ξαναβρίσκει.
 *
 * Και είναι **καθαρή συνάρτηση**: η άγκυρα της Φ7 τη δοκιμάζει χωρίς React, χωρίς DOM,
 * χωρίς i18next.
 *
 * @module components/shared/audit/audit-quantity-format
 * @see docs/centralized-systems/reference/adrs/ADR-852-audit-field-descriptor-vocabulary.md — §3.1, §4
 * @see docs/centralized-systems/reference/adrs/ADR-462-canonical-mm.md — η αποθήκευση μένει canonical mm
 */

import type { QuantitySpec } from '@/constants/quantity-specs';
import { formatLengthForDisplay } from '@/subapps/dxf-viewer/config/display-length-format';

/**
 * Ο αποθηκευμένος αριθμός → κείμενο για άνθρωπο, **αν** ο περιγραφέας λέει ότι είναι
 * μέγεθος του κτιρίου. `undefined` σε κάθε άλλη περίπτωση ⇒ ο καλών συνεχίζει
 * **ακριβώς** όπως σήμερα.
 *
 * ⚠️ **ΜΟΝΟ το `'model-length'` μετατρέπεται**, και η ασυμμετρία είναι σχεδιασμός — η
 * ίδια που ορίζει το `RibbonQuantityKind` (ADR-677 §7.2). Ένα `count` περασμένο από
 * μετατροπή θα έκανε τις «16 βαθμίδες» **«0,016 m»**· ένα αδήλωτο πεδίο μένει **ορατά
 * ωμό**, που είναι διόρθωση μιας γραμμής αντί για σιωπηλή αλλοίωση ιστορικού.
 *
 * 🔴 **ΤΟ ΠΡΟΣΗΜΟ ΤΟ ΚΡΑΤΑΜΕ ΕΜΕΙΣ, ΚΑΙ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΟ.** Το `formatLengthForDisplay`
 * εφαρμόζει `Math.abs` **εκ σχεδιασμού** (τα μήκη είναι μη αρνητικά). Όμως εδώ δεν
 * περνούν μόνο μήκη: περνούν **μετατοπίσεις** — `baseOffset`, `topOffset`,
 * `offsetFromStorey` — που είναι ειλικρινά αρνητικές. Χωρίς αυτές τις δύο γραμμές, ένα
 * `-200` θα εμφανιζόταν **«0,200 m»**: όχι απλώς λάθος, αλλά λάθος με **πρόσωπο
 * σωστού**, σε αρχείο που υποτίθεται ότι καταγράφει τι συνέβη. Δεν είναι δεύτερη
 * υλοποίηση μορφοποίησης — το πρόσημο **δεν** είναι μορφοποίηση.
 */
export function formatQuantityValue(
  quantity: QuantitySpec | undefined,
  value: string | number | boolean | null,
): string | undefined {
  if (quantity !== 'model-length') return undefined;
  if (value === null || value === '' || typeof value === 'boolean') return undefined;

  const mm = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(mm)) return undefined;

  const text = formatLengthForDisplay(Math.abs(mm));
  return mm < 0 ? `-${text}` : text;
}
