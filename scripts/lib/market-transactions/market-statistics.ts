/**
 * @fileoverview **ΣΥΓΚΡΙΣΙΜΟΤΗΤΑ ΚΑΙ ΣΤΑΤΙΣΤΙΚΑ** — ο ένας κανόνας «ποια γραμμή μετρά» και ο ένας τρόπος
 * να τη συνοψίσεις (ADR-889 §5.3, §5.4).
 * @related ADR-889 · ADR-890 §5.3 (το ίδιο κατώφλι για τις αγγελίες) · `mama-vocabulary.ts`
 *
 * 🔑 **Η ΣΥΓΚΡΙΣΙΜΟΤΗΤΑ ΑΠΟΦΑΣΙΖΕΤΑΙ ΜΙΑ ΦΟΡΑ, ΣΤΟΝ ΓΕΝΝΗΤΟΡΑ.** Κάθε γραμμή του αρχείου εξόδου φέρει την
 * απόφαση (`comparable`). Η οθόνη της Φ2 **διαβάζει** τη σημαία και δεν ξαναϋπολογίζει. Έτσι δεν υπάρχει
 * δεύτερο αντίγραφο του κανόνα που θα μπορούσε να αποκλίνει.
 *
 * 🔑 **ΔΙΑΜΕΣΟΣ ΚΑΙ ΤΕΤΑΡΤΗΜΟΡΙΑ, ΠΟΤΕ ΜΕΣΟΣ ΟΡΟΣ.** Η πηγή έχει 3.381 πανομοιότυπες γραμμές το 2025 (§3)
 * που **δεν** αφαιρούνται. Η διάμεσος τις αντέχει· ο μέσος όρος όχι.
 */

import type { MamaRecord } from './mama-source';
import { SEGMENT_METRIC, type MarketSegment } from '../../../src/lib/market/market-segments';
import { FULL_OWNERSHIP } from './mama-vocabulary';

// 🔑 Κατώφλι, ποσοστημόρια και σύνοψη ζουν στο `src/lib/market/market-statistics.ts` (ADR-890 Φ1):
// ο γεννήτορας και η σελίδα περιοχής ρωτούν την ίδια σταθερά. Εκεί ζει και το `quarterOf` (ADR-889 Φ2: το
// ζητά και η γραμμή τάσης της οθόνης).

const FULL_SHARE = 100;

/** Ποσοστό 100% — η πηγή το γράφει ως αριθμό 100 (μετρημένο: ποτέ πάνω από 100). */
function isWhole(share: number | null): boolean {
  return share === FULL_SHARE;
}

/** Η επιφάνεια που μετρά για το τμήμα, ή `null` όπου η τιμή μετριέται ανά μονάδα. */
function measuredArea(record: MamaRecord, segment: MarketSegment): number | null {
  switch (SEGMENT_METRIC[segment]) {
    case 'perSqmBuilding':
      return record.mainArea;
    case 'perSqmPlot':
      return record.plotArea;
    case 'perUnit':
      return null;
  }
}

/** Ολόκληρο το ακίνητο, σε πλήρη κυριότητα; Το οικόπεδο κρίνεται στο δικό του σκέλος (στήλες 15–16). */
function isWholeFullOwnership(record: MamaRecord, segment: MarketSegment): boolean {
  if (SEGMENT_METRIC[segment] === 'perSqmPlot') {
    return record.plotRight === FULL_OWNERSHIP && isWhole(record.plotShare);
  }
  return record.buildingRight === FULL_OWNERSHIP && isWhole(record.buildingShare);
}

/**
 * **Ο κανόνας της συγκρίσιμης γραμμής** (§5.3): πλήρης κυριότητα · ολόκληρο (100%) · καμία ειδική συνθήκη ·
 * τίμημα > 0 · επιφάνεια > 0 όπου μετρά. Επιστρέφει την **τιμή μονάδας** (€/τ.μ. ή € ανά θέση), ή `null`
 * όταν η γραμμή δεν είναι συγκρίσιμη. Μία συνάρτηση, ώστε «συγκρίσιμη» και «τιμή» να μη χωριστούν ποτέ.
 */
export function comparableUnitPrice(record: MamaRecord, segment: MarketSegment | null): number | null {
  if (segment === null || record.special !== null || !(record.price > 0)) return null;
  if (!isWholeFullOwnership(record, segment)) return null;
  if (SEGMENT_METRIC[segment] === 'perUnit') return record.price;

  const area = measuredArea(record, segment);
  return area !== null && area > 0 ? record.price / area : null;
}
