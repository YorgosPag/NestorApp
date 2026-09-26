import 'server-only';

/**
 * @fileoverview `/tour-captures` — **«Οι λήψεις μου»**: τα ακίνητα όπου ο φωτογράφος έχει άδεια λήψης (ADR-884 Φ0.5 · Κ3α).
 * @related `server/spatial-tour/tour-capture-list.ts` (`listMyTourCaptureGrants`) · `MyTourCapturesContent`
 * @module app/(me)/tour-captures/page
 *
 * 🔑 **Εκτός χώρου εργασίας** (`(me)`): ο φωτογράφος δεν είναι μέλος κανενός γραφείου (Φ0.5) — οι άδειές του ζουν σε
 * περιηγήσεις **διαφορετικών** κατόχων, και τις βρίσκει ο διακομιστής με το **δικό του** uid, ποτέ με id από τη διεύθυνση.
 * Ανώνυμος ⇒ σύνδεση με επιστροφή **εδώ** (ο σύνδεσμος «Οι λήψεις μου» της αποδοχής καταλήγει σωστά).
 */

import { redirect } from 'next/navigation';

import { MyTourCapturesContent } from '@/components/spatial-tour/MyTourCapturesContent';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { loginHref } from '@/lib/routes/return-path';
import { myTourCapturesHref } from '@/lib/spatial-tour/tour-routes';
import { readPageIdentity } from '@/server/auth/page-identity';
import { listMyTourCaptureGrants } from '@/server/spatial-tour/tour-capture-list';

export const dynamic = 'force-dynamic';

export default async function MyTourCapturesPage(): Promise<React.ReactElement> {
  const identity = await readPageIdentity();
  if (!identity.ok) redirect(loginHref(myTourCapturesHref()));
  const grants = await listMyTourCaptureGrants(getAdminFirestore(), identity.ctx.uid);
  return <MyTourCapturesContent grants={grants} />;
}
