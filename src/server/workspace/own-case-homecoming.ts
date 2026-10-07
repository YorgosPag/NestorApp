import 'server-only';

/**
 * **«Η υπόθεσή σου δεν ζει πια εδώ — ζει εκεί»** — ο παλιός σύνδεσμος του πρώην μέλους (ADR-901 §15.16 · δρόμος Α).
 *
 * @module server/workspace/own-case-homecoming
 * @see app/(app)/o/[workspace]/layout.tsx — ο ΜΟΝΟΣ καλών, και **μόνο** αφού ο φρουρός αποφάσισε «404»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο κ. Φώτης ανέλαβε υπόθεση για λογαριασμό του Γραφείου Β και μετά αποχώρησε. Η υπόθεση τον ακολουθεί στον
 * προσωπικό του χώρο (§15.15) — αλλά ο σελιδοδείκτης του και το email που του στάλθηκε **πριν** φύγει γράφουν
 * `/o/grafeio-b/cases/eng_…`. Ο φρουρός του χώρου απαντά (σωστά) «δεν είσαι μέλος» ⇒ **404 για δική του υπόθεση**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΜΑΝΤΕΙΟ ΑΠΑΡΙΘΜΗΣΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η απάντηση εξαρτάται **μόνο** από το «είναι το `eng_…` συμμετοχή **αυτού** του ανθρώπου;» — ποτέ από το αν το
 * γραφείο της διεύθυνσης υπάρχει: `/o/<ανύπαρκτο>/cases/<δικό του eng>` ανακατευθύνει ακριβώς όπως το υπαρκτό, και
 * ξένο/ανύπαρκτο `eng_…` μένει το **ίδιο** 404 σε κάθε γραφείο. Ο άνθρωπος μαθαίνει μόνο πού ζει κάτι **δικό του**.
 *
 * ⛔ **Ο φρουρός δεν χαλαρώνει**: δεν αποδίδεται τίποτα κάτω από το ξένο πρόθεμα· ο άνθρωπος **φεύγει** από αυτό.
 * ⛔ **Δεν κρίνει πρόσβαση**: τη συμμετοχή την κρίνει η σελίδα στο σπίτι (`decideEngagement`, ανά αίτημα) — μια
 *    ανακληθείσα συμμετοχή φτάνει στο σπίτι της και βλέπει εκεί τον **ονομασμένο** λόγο, όχι υπόθεση.
 * ⚠️ **«Δεν μπόρεσα να ρωτήσω» ≠ «δεν είναι δική σου»**: `unknown` ⇒ ο καλών απαντά σφάλμα, ποτέ 404 (N.12).
 */

import { requireAdminFirestore } from '@/lib/api/admin-db';
import { myCaseHref, officeCaseEngagementIdOf } from '@/lib/conveyance/conveyance-routes';
import { addressInWorkspace } from '@/lib/workspace/workspace-address';
import { readRequestPath } from '@/server/lib/request-path';
import { locateOwnCaseHome } from '@/services/conveyance/conveyance-engagement-access.service';

export type CaseHomecoming =
  /** Δική του υπόθεση, σε άλλο σπίτι — η πλήρης διεύθυνσή του. */
  | { readonly outcome: 'moved'; readonly address: string }
  /** Δεν είναι διεύθυνση υπόθεσης · δεν είναι δική του · ή το σπίτι είναι **αυτή** η διεύθυνση (καμία επιστροφή σε κύκλο). */
  | { readonly outcome: 'none' }
  | { readonly outcome: 'unknown' };

const NONE: CaseHomecoming = { outcome: 'none' };

function pathnameOf(requestPath: string): string {
  return requestPath.split(/[?#]/, 1)[0];
}

/** Το σπίτι της υπόθεσης που ονομάζει η διεύθυνση του **τρέχοντος** αιτήματος — για **αυτόν** τον άνθρωπο. */
export async function caseHomecomingForRequest(uid: string): Promise<CaseHomecoming> {
  const requested = await readRequestPath();
  if (requested === null) return NONE;
  const engagementId = officeCaseEngagementIdOf(requested);
  if (engagementId === null) return NONE;

  const located = await locateOwnCaseHome(requireAdminFirestore(), uid, engagementId);
  if (located.outcome === 'unknown') return { outcome: 'unknown' };
  if (located.outcome === 'none') return NONE;

  const address = await addressInWorkspace(located.home, myCaseHref(engagementId, located.home.kind));
  // 🔑 Το σπίτι είναι η ΙΔΙΑ διεύθυνση που μόλις αρνήθηκε ο φρουρός ⇒ ανακατεύθυνση θα ήταν ατέρμονος κύκλος.
  return address === pathnameOf(requested) ? NONE : { outcome: 'moved', address };
}
