/**
 * @fileoverview **Έκβαση γραφέα φακέλου → HTTP** — μία μετάφραση για **όλες** τις πόρτες του φακέλου.
 * @related ADR-866 Φ1.1 · Φ1.2 (§2.9.1 Α3) · services/property-dossier/property-dossier-write.service.ts
 * @module app/api/property-dossiers/_shared/respond
 *
 * 🔑 **Γιατί χωριστό αρχείο**: η γέννηση (`POST`) και η μεταβολή (`PATCH`) απαντούν το **ίδιο** κλειστό σύνολο
 * (`PropertyDossierWriteResult`). Δύο αντίγραφα του `switch` θα απέκλιναν στην πρώτη νέα έκβαση — και θα τα
 * έπιανε το `jscpd:diff` (N.18) ως δίδυμα. Ίδιο σχήμα με το `api/owner-properties/_shared/respond.ts`.
 *
 * | Έκβαση | Γέννηση | Μεταβολή | Γιατί |
 * |---|---|---|---|
 * | `saved` (νέα εγγραφή) | **201** | **200** | η γέννηση δημιουργεί πόρο· η μεταβολή όχι |
 * | `saved` + `replayed` | **200** | **200** | ιδεμπότητο — ο **υπάρχων** φάκελος, καμία εγγραφή |
 * | `invalid` | **422** `INVALID_DOSSIER` + κωδικοί | ίδιο | κωδικοί = κλειδιά i18n στην οθόνη (N.11) |
 * | `absent` | **404** | **404** | ποτέ 403/409: θα **επιβεβαίωνε** ότι υπάρχει ξένος φάκελος |
 * | `failed` | **500** | **500** | ο άνθρωπος δεν έχει τι να διορθώσει |
 */

import { NextResponse } from 'next/server';

import type { PropertyDossierWriteResult } from '@/services/property-dossier/property-dossier-write.service';
import type { PropertyDossier, PropertyDossierInvariant } from '@/types/property-dossier';

export type PropertyDossierResponse =
  | { readonly dossier: PropertyDossier }
  | { readonly error: string; readonly violations?: readonly PropertyDossierInvariant[] };

/** Ποια πράξη απαντιέται — αλλάζει **μόνο** τον κωδικό επιτυχίας (201 μόνο για νέο πόρο). */
export type PropertyDossierDoor = 'birth' | 'change';

/** Η απάντηση «δεν υπάρχει εδώ» — **μία**, και για ταυτότητα που δεν περνά καν το μητρώο. */
export function dossierNotFound(): NextResponse<PropertyDossierResponse> {
  return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
}

/** Έκβαση γραφέα → HTTP. Κάθε μέλος ρητά, **χωρίς** `default`: νέο μέλος δεν μεταγλωττίζεται αναπάντητο. */
export function respondToDossierWrite(
  result: PropertyDossierWriteResult,
  door: PropertyDossierDoor,
): NextResponse<PropertyDossierResponse> {
  switch (result.kind) {
    case 'saved': {
      const created = door === 'birth' && !result.replayed;
      return NextResponse.json({ dossier: result.dossier }, { status: created ? 201 : 200 });
    }
    case 'invalid':
      return NextResponse.json({ error: 'INVALID_DOSSIER', violations: result.violations }, { status: 422 });
    case 'absent':
      return dossierNotFound();
    case 'failed':
      return NextResponse.json({ error: 'WRITE_FAILED' }, { status: 500 });
  }
}
