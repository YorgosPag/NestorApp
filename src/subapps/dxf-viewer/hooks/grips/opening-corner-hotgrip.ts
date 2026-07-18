/**
 * ADR-513 §opening-width — λαβή παρειάς κουφώματος → click-move-click hot-grip entry SSoT gate.
 *
 * Parity με την ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ ΓΡΑΜΜΗΣ (`line-endpoint-hotgrip.ts`): το πιάσιμο λαβής παρειάς μπαίνει στη
 * ροή «κλικ → ο κέρσορας ακολουθεί με το πλήκτρο ΕΛΕΥΘΕΡΟ → πληκτρολόγησε «Μήκος» / κλικ στον καμβά για
 * commit» (AutoCAD hot-grip), αντί για press-drag — ώστε να είναι κλικαριστό το «Δαχτυλίδι Εντολών».
 * Χρησιμοποιεί το ΙΔΙΟ `wall-hot-grip-fsm` (op `'endpoint-stretch'`, terminal `tracking`) με το άκρο
 * γραμμής — μηδέν νέο FSM/commit path.
 *
 * Pure, DOM-free: αποφασίζει ΜΟΝΟ αν η χειρονομία πληροί τις προϋποθέσεις. ⚠️ Σε ΑΝΤΙΘΕΣΗ με το άκρο
 * γραμμής, ο caller **ΔΕΝ** gate-άρει στη ΔΥΝ (Giorgio 2026-07-18): η προδιαγραφή είναι «κλικ στη λαβή →
 * λάστιχο → πληκτρολόγηση/κλικ», χωρίς διακόπτη· το press-drag εξακολουθεί να δουλεύει (moved-release).
 *
 * Αυστηρό gate: ΜΟΝΟ λαβή παρειάς (`opening-corner-*`) ΚΑΙ **wall-hosted** κούφωμα (self-hosted κρατά
 * το δικό του box-grip flow, ADR-615). Οι λαβές move/rotation/facing κρατούν τους δικούς τους ρόλους.
 *
 * @see ./line-endpoint-hotgrip.ts — ο αδελφός gate (άκρο γραμμής) που mirror-άρεται
 * @see ./wall-hot-grip-fsm.ts — op `'endpoint-stretch'` (terminal `tracking`)
 * @see ../../systems/dynamic-input/opening-width-lock.ts — το length lock που εφαρμόζεται σε ghost+commit
 */

import type { UnifiedGripInfo } from './unified-grip-types';
import { gripKindOf } from '../grip-kinds';
import { isOpeningCornerGripKind } from '../../systems/dynamic-input/opening-width-lock';

/** Ελάχιστη δομική όψη του κουφώματος — κρατά τον gate decoupled + pure. */
interface OpeningCornerHotGripEntity {
  readonly params?: {
    readonly wallId?: string;
    readonly selfHost?: unknown;
  };
}

/**
 * Αποφάσισε αν το πάτημα `grip` (του `entity`) πρέπει να ξεκινήσει το hot-grip της παρειάς. `false`
 * όταν δεν πληροί (ο caller κρατά το press-drag). ΔΕΝ gate-άρεται στη ΔΥΝ (βλ. σχόλιο header).
 */
export function resolveOpeningCornerHotGrip(
  entity: OpeningCornerHotGripEntity | null | undefined,
  grip: UnifiedGripInfo | null | undefined,
): boolean {
  if (!entity || !grip) return false;
  if (grip.source !== 'dxf') return false;
  if (!isOpeningCornerGripKind(gripKindOf(grip, 'opening'))) return false;
  // Wall-hosted μόνο: το self-hosted κούφωμα αλλάζει πλάτος μέσω του box-grip flow (ADR-615).
  return !!entity.params?.wallId && entity.params?.selfHost == null;
}
