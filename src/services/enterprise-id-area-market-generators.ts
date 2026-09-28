/**
 * ENTERPRISE ID GENERATION — Η ΣΥΝΟΨΗ ΑΓΟΡΑΣ ΑΝΑ ΠΕΡΙΟΧΗ (ADR-890 §5.2)
 *
 * Composition model — abstract base chain, not a mixin:
 *
 *   SpatialTourIdGenerators      (ADR-884 Φ0.7 — χωρική περιήγηση)
 *     ↑ extends
 *   AreaMarketIdGenerators       (this file — σύνοψη ζητούμενων τιμών ανά περιοχή)
 *     ↑ extends
 *   CompositeKeyIdGenerators     (composite keys + pure readers)
 *
 * 🔑 **Ξεχωριστό αρχείο, όχι προσθήκη στο `listing-stats-generators`**: εκείνο μετρά προβολές **μιας**
 * αγγελίας. Εδώ μετρώνται **τιμές μιας περιοχής** — άλλη ερώτηση, άλλος ιδιοκτήτης (ADR-890).
 *
 * 🔴 **ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΑ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ Ο ΣΚΟΠΟΣ**: ένα έγγραφο ανά (περιοχή, ημέρα) και ένα σημάδι ανά
 * ημέρα. Η επανεκτέλεση της νυχτερινής εργασίας ξαναγράφει τα **ίδια** έγγραφα (idempotent), και η σελίδα
 * βρίσκει το έγγραφο με `doc(id)`, χωρίς ερώτημα.
 *
 * ⚠️ **Διαχωριστής σπόρου `@`**: η ταυτότητα περιοχής ΠΕΡΙΕΧΕΙ `:` (`municipality:0701`), άρα το `:` θα
 * ήταν αμφίσημο. Ούτε η ταυτότητα (`^[a-z_]+:[0-9]+$`) ούτε η ημέρα `YYYY-MM-DD` περιέχουν `@`.
 *
 * @module services/enterprise-id-area-market-generators
 * @version 1.0.0
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { SpatialTourIdGenerators } from './enterprise-id-spatial-tour-generators';

const P = ENTERPRISE_ID_PREFIXES;

export abstract class AreaMarketIdGenerators extends SpatialTourIdGenerators {
  /** Η σύνοψη **μιας** περιοχής για **μία** ημέρα αγοράς. */
  generateDeterministicAreaMarketSnapshotId(areaId: string, day: string): string {
    return this.mintDeterministicV4Id(P.AREA_MARKET_SNAPSHOT, `${areaId}@${day}`);
  }

  /** Το σημάδι ολοκλήρωσης της νυχτερινής εκτέλεσης **μιας** ημέρας. */
  generateDeterministicAreaMarketRunId(day: string): string {
    return this.mintDeterministicV4Id(P.AREA_MARKET_RUN, day);
  }

  /** Η μηνιαία σειρά ζητούμενων **μιας** περιοχής (ADR-890 §13) — μία για πάντα. */
  generateDeterministicAreaMarketSeriesId(areaId: string): string {
    return this.mintDeterministicV4Id(P.AREA_MARKET_SERIES, areaId);
  }
}
