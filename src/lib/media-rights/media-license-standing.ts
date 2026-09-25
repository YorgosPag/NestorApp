/**
 * @fileoverview **ΙΣΧΥΕΙ ΑΚΟΜΗ Η ΑΔΕΙΑ ΑΥΤΟΥ ΤΟΥ ΜΕΣΟΥ;** — η απάντηση που αποσύρει μόνη της.
 * @related ADR-884 Φ0.14 · ADR-866 §5.6.1 Δ1 (αυτόματη απόσυρση — VHT v. Zillow)
 * @module lib/media-rights/media-license-standing
 *
 * 🔑 Η άδεια «όσο ισχύει η εντολή» **δεν** αποθηκεύει ημερομηνία: ρωτά την εντολή. Έτσι μια παράταση
 * εντολής παρατείνει την άδεια **χωρίς** να ξαναγραφτεί κανένα μέσο, και μια λύση την κόβει **χωρίς**
 * να τη θυμηθεί κανείς. Το αν ισχύει η εντολή το κρίνει ο **καλών** (δικός της κριτής, ADR-827) — εδώ
 * περνά ως γεγονός, ώστε η συνάρτηση να μένει καθαρή.
 *
 * ⚠️ **Fail-closed**: ημερομηνία λήξης που δεν διαβάζεται ⇒ `expired`, ποτέ «ισχύει».
 *
 * **Layering**: leaf (μόνο `lib/date-local`).
 */

import { normalizeToMillisOrNull } from '@/lib/date-local';
import type { MediaRights } from '@/types/media-rights';

/** Ονομασμένη ετυμηγορία — η οθόνη λέει διαφορετικά πράγματα για «έληξε» και «έληξε η εντολή» (ADR-866 Δ3). */
export type MediaLicenseStanding = 'active' | 'expired' | 'mandate-ended';

/**
 * @param mandateActive ισχύει **τώρα** η εντολή που αναφέρει η άδεια; Αγνοείται για άλλα είδη διάρκειας.
 */
export function mediaLicenseStanding(
  rights: MediaRights,
  nowMs: number,
  mandateActive: boolean,
): MediaLicenseStanding {
  const { term } = rights.license;
  switch (term.kind) {
    case 'perpetual':
      return 'active';
    case 'mandate':
      return mandateActive ? 'active' : 'mandate-ended';
    case 'date': {
      const untilMs = normalizeToMillisOrNull(term.until);
      return untilMs !== null && untilMs > nowMs ? 'active' : 'expired';
    }
  }
}
