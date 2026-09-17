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

import type { OwnedDoc } from '@/lib/auth/owned-doc-loader';
import {
  containerActorOf,
  personalContainerActorOf,
  type ContainerActor,
} from '@/services/iso19650/container-transitions';

import type { FileCustodyCaller } from './file-custody-route';
import { fileResource, personalFileResource } from './file-ownership';

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

/**
 * **Ο PEP της διαδρομής, ΑΝΑ ΔΙΑΜΕΡΙΣΜΑ** — φόρτωσε → υπάρχει; → **δικό μου;** με το **ένα** 404
 * (ADR-866 2β.3β).
 *
 * | κάτοχος | κριτής | παράκαμψη ρόλου |
 * |---|---|---|
 * | εταιρεία | `fileResource` (μισθωτής) | ναι — super admin, ό,τι ίσχυε πάντα |
 * | άνθρωπος | `personalFileResource` (`userId == uid`) | **καμία** — ο κανόνας τον αποκλείει |
 *
 * 🔑 **Μία** αλυσίδα (`loadOwnedDocOrRefusal`), δύο αποφάσεις — ίδιο σχήμα με το
 * `owned-file-bytes` (2β.3α): το **πρώτο** βήμα διαφέρει ανά κάτοχο, η σειρά είναι **μία**.
 */
function loadCustodyFile(fileId: string, caller: FileCustodyCaller, action: string) {
  return caller.custody === 'company'
    ? fileResource.load({ docId: fileId, caller: caller.ctx, action, refusal: fileNotFoundResponse })
    : personalFileResource.load({ docId: fileId, uid: caller.uid, action, refusal: fileNotFoundResponse });
}

/** Ό,τι χρειάζεται κάθε διαδρομή δοχείου **αφού** κριθεί η ιδιοκτησία — ή η άρνηση, ως τιμή. */
export type ResolvedContainerFile =
  | { readonly refusal: NextResponse }
  | {
      readonly refusal: null;
      readonly fileId: string;
      readonly doc: OwnedDoc;
      /** Ο δράστης **με τον χώρο του** — έτοιμος για τον ΕΝΑ γραφέα και τη στοίβα. */
      readonly actor: ContainerActor;
    };

/**
 * **Η αρχή κάθε διαδρομής δοχείου**: `fileId` από τη διεύθυνση (αλλιώς 400) → PEP του
 * **διαμερίσματος που ζητήθηκε** (αλλιώς 404) → ο δράστης, με τον χώρο του.
 *
 * 🔑 **Ο δράστης γεννιέται ΕΔΩ, από την πόρτα** (ADR-866 §2.6.10 Β3): το διαμέρισμα που έκρινε
 * την ιδιοκτησία είναι **το ίδιο** που θα διαβάσει ο γραφέας. Αν η διαδρομή έφτιαχνε μόνη της
 * δράστη, θα μπορούσε να κρίνει στο ένα διαμέρισμα και να γράψει στο άλλο.
 *
 * ⚠️ Επιστρέφει **ή** την άρνηση **ή** το φορτωμένο έγγραφο — ποτέ και τα δύο.
 */
export async function resolveContainerFile(
  segment: FileSegment | undefined,
  caller: FileCustodyCaller,
  action: string,
): Promise<ResolvedContainerFile> {
  const fileId = (await segment?.params)?.fileId;
  if (!fileId) return { refusal: NextResponse.json({ error: 'Missing fileId' }, { status: 400 }) };
  const owned = await loadCustodyFile(fileId, caller, action);
  if (owned.refusal) return { refusal: owned.refusal };
  const actor =
    caller.custody === 'company' ? containerActorOf(caller.ctx) : personalContainerActorOf(caller.uid);
  return { refusal: null, fileId, doc: owned.doc, actor };
}
