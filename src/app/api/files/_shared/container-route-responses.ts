/**
 * Οι απαντήσεις των διαδρομών **δοχείου** ενός αρχείου — ΜΙΑ φορά (ADR-862 Φ0 · N.18).
 *
 * `cde` · `versions` · `versions/promote` έγραφαν τις ίδιες δύο απαντήσεις και την ίδια φόρτωση
 * χειρόγραφα (CHECK 3.28: κλώνοι μέσα στο ίδιο commit). Εδώ ζουν μία φορά.
 *
 * ⚠️ Οι διαδρομές **bytes** (`download`) κρατούν δικό τους σώμα 503 (χωρίς `success`) — άλλο
 * συμβόλαιο σύρματος με άλλους καταναλωτές· ενοποίηση θα ήταν αλλαγή API, όχι αποδιπλασιασμός.
 *
 * @module app/api/files/_shared/container-route-responses
 */

import { NextResponse } from 'next/server';

import type { AuthContext } from '@/lib/auth';
import type { OwnedDoc } from '@/lib/auth/owned-doc-loader';

import { fileResource } from './file-ownership';

/**
 * Το **ένα** «δεν βρέθηκε» (ADR-742 §7.1) — **μηδέν ορίσματα**: γνήσια απουσία και ξένος
 * μισθωτής δεν διαφοροποιούνται, άρα η διαδρομή δεν γίνεται μαντείο ύπαρξης.
 */
export const fileNotFoundResponse = (): NextResponse =>
  NextResponse.json({ error: fileResource.notFoundMessage }, { status: 404 });

/**
 * Η **αυθεντία δεν απάντησε** — 503, ποτέ «δεν επιτρέπεσαι». *Άγνωστο ≠ κενό* (N.12): ένα
 * 403/404 εδώ θα έστελνε τον μηχανικό να ζητήσει δικαιώματα που **έχει**.
 */
export const authorityUnavailableResponse = (): NextResponse =>
  NextResponse.json({ success: false, error: 'authority-unavailable' }, { status: 503 });

/** Το τμήμα διαδρομής `[fileId]` όπως το δίνει το Next. */
export type FileSegment = { params: Promise<{ fileId: string }> };

/** Ο PEP της διαδρομής: φόρτωσε → υπάρχει; → δικό μου; με το **ένα** 404. */
export function loadOwnedFile(fileId: string, ctx: AuthContext, action: string) {
  return fileResource.load({ docId: fileId, caller: ctx, action, refusal: fileNotFoundResponse });
}

/**
 * **Η αρχή κάθε διαδρομής δοχείου**: `fileId` από τη διεύθυνση (αλλιώς 400) + PEP (αλλιώς 404).
 * Επιστρέφει **ή** την άρνηση **ή** το φορτωμένο έγγραφο — ποτέ και τα δύο.
 */
export async function resolveOwnedFile(
  segment: FileSegment | undefined,
  ctx: AuthContext,
  action: string,
): Promise<{ readonly refusal: NextResponse } | { readonly refusal: null; readonly fileId: string; readonly doc: OwnedDoc }> {
  const fileId = (await segment?.params)?.fileId;
  if (!fileId) return { refusal: NextResponse.json({ error: 'Missing fileId' }, { status: 400 }) };
  const owned = await loadOwnedFile(fileId, ctx, action);
  return owned.refusal ? { refusal: owned.refusal } : { refusal: null, fileId, doc: owned.doc };
}
