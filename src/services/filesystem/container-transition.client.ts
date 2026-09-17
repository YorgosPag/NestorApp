/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΤΩΝ ΠΡΑΞΕΩΝ ΤΟΥ ΔΟΧΕΙΟΥ** — ο πρώτος καταναλωτής του `POST /api/files/{id}/cde`.
 * @related app/api/files/[fileId]/cde/route.ts · services/iso19650/container-transitions.ts
 * @module services/filesystem/container-transition.client
 *
 * 🔑 **Γιατί υπάρχει** (ADR-862 Φ0 Β10): η αντικατάσταση αρχείου έγραφε `cdeState` από τον browser. Ο κανόνας
 * `cdeCustodyUnchanged()` (Β4) το απαγορεύει σωστά — η κατάσταση είναι **έξοδος διακομιστή** — και η εγγραφή
 * απορριπτόταν **ολόκληρη και σιωπηλά**. Εδώ ο πελάτης **ζητά**· ο ΕΝΑΣ γραφέας κρίνει και γράφει.
 *
 * ⚠️ **Η άρνηση φτάνει ΜΕ ΟΝΟΜΑ**: ο κωδικός περνά από κλειστό σύνολο και γίνεται κλειδί i18n στην οθόνη (N.11)·
 * ό,τι δεν αναγνωρίζεται λέγεται `failed`, ποτέ ωμό κλειδί (ίδιο δόγμα με το `lib/http/response-refusal`).
 */

import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import { FILE_CUSTODY_PARAM } from '@/lib/files/file-custody';
import type { CustodyKind } from '@/lib/workspace/custody-scope';
import type { ContainerRefusalReason } from '@/services/iso19650/container-transition-policy';
import { isSupersessionDoneKind } from '@/services/iso19650/container-transition-vocabulary';

const logger = createModuleLogger('container-transition.client');

/**
 * Οι λόγοι άρνησης που η οθόνη **ξέρει να πει**.
 * ⚠️ `satisfies` ⇒ λόγος που **δεν** υπάρχει στον διακομιστή δεν μεταγλωττίζεται.
 */
export const SUPERSEDE_REFUSALS = [
  'not-capable',
  'unreadable',
  'wrong-phase',
  'successor-missing',
  'predecessor-not-active',
  'successor-not-found',
  'successor-not-ready',
  'identity-absent',
  'identity-mismatch',
  'successor-not-newer',
  'not-successor-author',
] as const satisfies readonly ContainerRefusalReason[];

export type SupersedeRefusal = (typeof SUPERSEDE_REFUSALS)[number];

/** Η έκβαση της αντικατάστασης — **ονομασμένη**, ποτέ `boolean`, ποτέ σιωπή. */
export type SupersedeOutcome =
  /** Αποδείχθηκε και γράφτηκε: το παλιό είναι `SUPERSEDED` + αρχειοθετημένο. */
  | { readonly kind: 'superseded' }
  /** Είχε ήδη γίνει / ίδιο αρχείο — ιδεμποτησία, όχι αποτυχία. */
  | { readonly kind: 'noop' }
  /** Ο διακομιστής **αρνήθηκε** με όνομα. */
  | { readonly kind: 'refused'; readonly why: SupersedeRefusal }
  /** Βλάβη (δίκτυο · 5xx · άγνωστος κωδικός) — ξαναδοκίμασε. */
  | { readonly kind: 'failed' };

interface TransitionResponseBody {
  readonly kind?: unknown;
}

const urlOf = (fileId: string): string => `/api/files/${encodeURIComponent(fileId)}/cde`;

function refusedOf(cause: unknown): SupersedeRefusal | null {
  const refused = apiErrorBodyOf(cause)?.refused;
  return SUPERSEDE_REFUSALS.find((reason) => reason === refused) ?? null;
}

/**
 * **Το `previousFileId` αντικαταστάθηκε από το `supersededByFileId`** — ζήτα το από τον ΕΝΑ γραφέα.
 *
 * 🔑 Ο διακομιστής **αποδεικνύει** τη διαδοχή (ίδιο δοχείο · ίδιος μισθωτής · έτοιμος και νεότερος διάδοχος ·
 * δικός σου) μέσα στην ίδια συναλλαγή που γράφει. Ο πελάτης δεν αποφασίζει τίποτα.
 */
export async function requestSupersession(
  previousFileId: string,
  supersededByFileId: string,
  custody: CustodyKind,
): Promise<SupersedeOutcome> {
  try {
    const body = await apiClient.post<TransitionResponseBody>(
      urlOf(previousFileId),
      { act: 'supersede', supersededByFileId },
      // 🗂️ ADR-866 — **μόνο το είδος** στο σύρμα· ο κάτοχος έρχεται από την ταυτότητα του
      //    διακομιστή. Υποχρεωτικό στον τύπο: προεπιλογή θα σήμαινε «μάντεψε εταιρεία».
      { params: { [FILE_CUSTODY_PARAM]: custody } },
    );
    // ADR-862 §5.3.7 — και η διαδοχή **χωρίς** φάση (δοχείο εκτός έργου) είναι επιτυχία.
    return isSupersessionDoneKind(body.kind) ? { kind: 'superseded' } : { kind: 'noop' };
  } catch (cause) {
    const why = refusedOf(cause);
    if (why !== null) return { kind: 'refused', why };
    logger.warn('Η αντικατάσταση αρχείου απέτυχε', { previousFileId, supersededByFileId, custody });
    return { kind: 'failed' };
  }
}
