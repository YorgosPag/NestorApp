'use client';

/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΠΡΟΣ ΤΙΣ ΠΟΡΤΕΣ ΤΟΥ ΦΑΚΕΛΟΥ** — γέννηση · μεταβολή, μία διατύπωση αστοχίας.
 * @related ADR-866 Φ1.2 · §2.9.1 Α4 · app/api/property-dossiers/** · services/owner-property/owner-property.service.ts
 * @module services/property-dossier/property-dossier.service
 *
 * 🔑 **Κάτοπτρο του `owner-property.service.ts`**: ο πελάτης **μόνο** ζητά — δεν γράφει ποτέ στη Firestore
 * (ο κανόνας λέει `write: false`), και **διαβάζει** ζωντανά μέσω `useMyPropertyDossiers` (καμία `GET`).
 *
 * ⚠️ **Χωριστό αρχείο από τον γραφέα διακομιστή** (`property-dossier-write.service.ts`, `server-only`) — ίδια
 * διάταξη με την αγγελία: ο φάκελος `services/property-dossier` κρατά **και** τις δύο πλευρές της πόρτας.
 */

import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import {
  isPropertyDossierInvariant,
  type PropertyDossier,
  type PropertyDossierDraft,
  type PropertyDossierInvariant,
  type PropertyDossierLifecycle,
} from '@/types/property-dossier';

const logger = createModuleLogger('property-dossier.service');

/** Η ρίζα των πορτών — γραμμένη **μία** φορά. */
const API_BASE = '/api/property-dossiers';

/** Η έκβαση στον πελάτη — **κλειστό** σύνολο· η οθόνη απαντά κάθε μέλος ρητά. */
export type PropertyDossierRequestResult =
  | { readonly kind: 'saved'; readonly dossier: PropertyDossier }
  /** Κωδικοί invariants — κλειδιά i18n στην οθόνη (N.11), **ποτέ** μήνυμα διακομιστή. */
  | { readonly kind: 'invalid'; readonly violations: readonly PropertyDossierInvariant[] }
  | { readonly kind: 'failed' };

interface DossierResponse {
  readonly dossier: PropertyDossier;
}

/**
 * **Η μία μετάφραση αστοχίας.** 422 με γνωστούς κωδικούς ⇒ `invalid`· οτιδήποτε άλλο (404 · 500 · δίκτυο) ⇒ `failed`.
 *
 * ⚠️ Κενή λίστα γνωστών κωδικών ⇒ `failed`, **όχι** «άκυρο χωρίς λόγους»: θα ζωγράφιζε λευκό πλαίσιο σφάλματος
 * (ίδιο μάθημα με το `violationsOf` της αγγελίας).
 */
function failureOf(what: string, dossierId: string, cause: unknown): PropertyDossierRequestResult {
  const body = apiErrorBodyOf(cause);
  const violations = Array.isArray(body?.violations) ? body.violations.filter(isPropertyDossierInvariant) : [];
  if (violations.length > 0) return { kind: 'invalid', violations };

  logger.error(what, { data: { dossierId }, error: cause instanceof Error ? cause.message : String(cause) });
  return { kind: 'failed' };
}

/**
 * **Νέα ταυτότητα φακέλου** — την προ-γεννά ο πελάτης (Ε-Φ1.1-4, Drive `files.generateIds`).
 *
 * 🔑 Η οθόνη τη γεννά **μία** φορά ανά άνοιγμα διαλόγου: το διπλό κλικ και η επανάληψη δικτύου στέλνουν την
 * **ίδια** ταυτότητα, και η πόρτα απαντά τον **υπάρχοντα** φάκελο (200) — ποτέ δεύτερο.
 */
export function newPropertyDossierId(): string {
  return enterpriseIdService.generatePropertyDossierId();
}

/** **Νέος φάκελος** (`POST`). */
export async function createPropertyDossierRequest(
  dossierId: string,
  draft: PropertyDossierDraft,
): Promise<PropertyDossierRequestResult> {
  try {
    const { dossier } = await apiClient.post<DossierResponse>(API_BASE, { id: dossierId, ...draft });
    return { kind: 'saved', dossier };
  } catch (cause) {
    return failureOf('Ο φάκελος δεν δημιουργήθηκε', dossierId, cause);
  }
}

/** Η **μία** κλήση μεταβολής — τα δύο σχήματα σώματος τα ορίζει η πόρτα (`propertyDossierPatchRequestSchema`). */
async function patchDossier(
  what: string,
  dossierId: string,
  body: { readonly lifecycle: PropertyDossierLifecycle } | PropertyDossierDraft,
): Promise<PropertyDossierRequestResult> {
  try {
    const { dossier } = await apiClient.patch<DossierResponse>(
      `${API_BASE}/${encodeURIComponent(dossierId)}`,
      body,
    );
    return { kind: 'saved', dossier };
  } catch (cause) {
    return failureOf(what, dossierId, cause);
  }
}

/** **Μετονομασία / διόρθωση είδους.** */
export function updatePropertyDossierDetails(
  dossierId: string,
  draft: PropertyDossierDraft,
): Promise<PropertyDossierRequestResult> {
  return patchDossier('Ο φάκελος δεν μετονομάστηκε', dossierId, { label: draft.label, type: draft.type });
}

/** **Αρχειοθέτηση / επαναφορά** — καμία διαγραφή (Ε-Φ1.1-2). */
export function setPropertyDossierLifecycle(
  dossierId: string,
  lifecycle: PropertyDossierLifecycle,
): Promise<PropertyDossierRequestResult> {
  return patchDossier('Η κατάσταση του φακέλου δεν άλλαξε', dossierId, { lifecycle });
}
