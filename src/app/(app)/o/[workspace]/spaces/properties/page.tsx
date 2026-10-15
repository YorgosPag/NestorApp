/**
 * 🔀 `/o/[workspace]/spaces/properties` — **ΔΕΝ ΕΙΝΑΙ ΠΙΑ ΣΕΛΙΔΑ** (ADR-840 Σ3, Α1).
 *
 * Ο χώρος εργασίας έχει **μία** οθόνη ακινήτων: `/o/[workspace]/properties` (πλέγμα · λίστα · κάτοψη στο `?view=`).
 * Αυτή η διαδρομή μένει **μόνιμα** ως ανακατεύθυνση — όχι «προσωρινά»: σελιδοδείκτες, email, ειδοποιήσεις και
 * ιστορικό δεν διορθώνονται αναδρομικά (ADR-840 §6: παράλληλη διαδρομή χωρίς ημερομηνία λήξης **είναι** η μόνιμη
 * κατάσταση).
 *
 * 🔑 **Μεταφράζει, δεν αλλάζει απλώς διαδρομή** (`legacySpacesPropertiesQuery`): `?propertyId=` → `?selected=`,
 *    καμία όψη → `view=list`, τα υπόλοιπα αυτούσια — και το `#…` το προσθέτει ο πελάτης (`ArrivalRedirect`).
 * ⚠️ **ΟΧΙ γυμνό `redirect()`**: κάτω από το `(app)/loading.tsx` το streaming έχει ήδη ξεκινήσει ⇒ η απάντηση είναι 200
 *    και την ανακατεύθυνση την εκτελεί ο πελάτης **χωρίς** fragment (μετρημένο, ADR-840 §7.7). Για τον ίδιο λόγο ένα
 *    `permanentRedirect()` (308) εδώ **δεν** θα έβγαινε 308. «Μόνιμη» είναι η **απόφαση** — η διαδρομή δεν ξαναγίνεται
 *    σελίδα — όχι ο κωδικός HTTP.
 * ⚠️ Ο προορισμός **δεν** εξαρτάται από ταυτότητα (ίδιος χώρος, ίδιο ερώτημα) — γι' αυτό δεν χρειάζεται το
 *    `workspaceDestinationFor` του διχτυού.
 */

import { ArrivalRedirect } from '@/lib/workspace/ArrivalRedirect';
import type { ArrivalSearchParams } from '@/lib/workspace/arrival-address';
import { workspacePath } from '@/lib/workspace/workspace-path';
import { PROPERTIES_SCREEN_PATH, legacySpacesPropertiesQuery } from '@/lib/properties/legacy-spaces-address';

interface SpacesPropertiesRedirectProps {
  readonly params: Promise<{ workspace: string }>;
  readonly searchParams: Promise<ArrivalSearchParams>;
}

export default async function SpacesPropertiesRedirect({ params, searchParams }: SpacesPropertiesRedirectProps) {
  const { workspace } = await params;
  const query = legacySpacesPropertiesQuery(await searchParams);
  return <ArrivalRedirect to={`${workspacePath(workspace, PROPERTIES_SCREEN_PATH)}${query}`} />;
}
