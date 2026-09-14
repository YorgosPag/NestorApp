/**
 * `/pro/<ψευδώνυμο>` — **η δημόσια βιτρίνα ενός γραφείου** (ADR-827 §9.6 #2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΣΕΛΙΔΑ ΕΙΝΑΙ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ, ΕΝΩ Η ΑΝΑΓΝΩΣΗ ΤΗΣ ΒΙΤΡΙΝΑΣ ΤΟΥ ΠΕΛΑΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι δύο αναγνώσεις του §9.6 #2 έχουν **αντίθετες** απαιτήσεις, και γι' αυτό ζουν σε
 * διαφορετικές πλευρές:
 *
 * | Ανάγνωση | Πού | Γιατί εκεί |
 * |---|---|---|
 * | ψευδώνυμο → `companyId` | **διακομιστής** | το `workspace_aliases` είναι `read: false` για τον πελάτη — απογραφή γραφείων (Ε-5 §4 #1). Η αναζήτηση είναι **σημειακή, κατά κλειδί**, ποτέ σάρωση |
 * | `companyId` → βιτρίνα | **πελάτης**, ζωντανά | `read: if true` (§9.4)· και **πρέπει** να είναι ζωντανή, ώστε η ανάκληση ικανότητας (Π2) να σβήσει τη σελίδα **την ίδια στιγμή** |
 *
 * ⚠️ **Ο `companyId` φεύγει στον πελάτη, και αυτό ΔΕΝ είναι διαρροή**: είναι το κλειδί
 * ενός εγγράφου που ο κανόνας κάνει **δημόσια αναγνώσιμο** — και είναι ήδη ορατό σε
 * κάθε κάρτα του καταλόγου.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΕΚΒΑΣΕΙΣ, ΚΑΙ Η ΤΡΙΤΗ **ΔΕΝ** ΓΙΝΕΤΑΙ 404
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - `found` → η ταυτότητα ταξιδεύει· ο πελάτης κρίνει αν δημοσιεύεται.
 * - `not-found` → `companyId = null` ⇒ **ίδια οθόνη** με «δεν δημοσίευσε». Δες την
 *   κεφαλίδα του {@link AgencyProfileContent}: αν τα ξεχωρίζαμε, η σελίδα θα ήταν
 *   μαντείο *«υπάρχει τέτοιο γραφείο;»*.
 * - `unknown` → **ρίχνει**. ⛔ **ΠΟΤΕ 404 εδώ**: το *«δεν μπόρεσα να ρωτήσω»* που
 *   φοράει τη στολή του *«δεν υπάρχει»* στέλνει τον άνθρωπο μακριά από γραφείο που
 *   **υπάρχει** (N.12 · Ε-5 §4 #3). Ίδιο ιδίωμα με το `o/[workspace]/layout.tsx`.
 *
 * ⚠️ **Το `params` είναι `Promise` (Next 15)** — συγχρονισμένο `params.alias` θα
 * μεταγλωττιζόταν και θα έσπαγε **στην εκτέλεση**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΑ ΔΟΜΗΜΕΝΑ ΔΕΔΟΜΕΝΑ ΕΙΝΑΙ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ (ADR-841 §7 Α21.17)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το JSON-LD πρέπει να βρίσκεται στο HTML που **στέλνεται** — πολλοί ανιχνευτές δεν εκτελούν
 * JavaScript. Διαβάζεται με τον **υπάρχοντα** `lookupAgencyProfile` (φρουρός `readShowcase`,
 * συγκάλυψη, CHECK 3.74) — **όχι** δεύτερος αναγνώστης. Η παλιά δήλωση *«θα απαιτούσε δεύτερο
 * αναγνώστη»* δεν ισχύει πια: ο αναγνώστης υπήρχε ήδη, για το reveal.
 *
 * ⚠️ **Προαιρετικό, ποτέ φράγμα**: βλάβη ή αδημοσίευτη βιτρίνα ⇒ **κανένα** script, και η σελίδα
 * αποδίδεται κανονικά (η ζωντανή ανάγνωση του πελάτη μένει η αλήθεια της οθόνης).
 *
 * ⚠️ **Καμία `generateMetadata`** ακόμη — δηλωμένο κενό, το **ίδιο** με το `/listing/[id]`
 * (ADR-777 §8.11)· ο τίτλος/περιγραφή ανήκουν σε δική τους απόφαση.
 *
 * @module app/(light)/pro/[alias]/page
 */

import { AgencyProfileContent } from '@/components/mandate/AgencyProfileContent';
import { agencyProfileRoute } from '@/components/mandate/agency-directory-route';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { showcaseStructuredData } from '@/lib/agency/showcase-structured-data';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { publicUrl } from '@/lib/http/public-origin';
import { acceptsMandate } from '@/lib/professional/showcase-acts';
import type { JsonLdValue } from '@/lib/seo/json-ld';
import { resolveAlias } from '@/lib/workspace/alias-registry';
import { createModuleLogger } from '@/lib/telemetry';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';

const logger = createModuleLogger('pro-alias-structured-data');

/** **Βιτρίνα → JSON-LD**, ή `null` όταν δεν υπάρχει τι να πει (ή δεν ξέρουμε ποιοι είμαστε). */
async function structuredDataFor(companyId: string): Promise<JsonLdValue | null> {
  try {
    const lookup = await lookupAgencyProfile(getAdminFirestore(), companyId);
    if (lookup.outcome !== 'found') return null;
    const profileUrl = publicUrl(agencyProfileRoute(lookup.showcase.alias));
    if (profileUrl === null) return null;
    return showcaseStructuredData(lookup.showcase, {
      profileUrl,
      canHoldMandate: acceptsMandate(lookup.showcase.credentials),
    });
  } catch (error) {
    logger.warn('Τα δομημένα δεδομένα παραλείφθηκαν — η σελίδα αποδίδεται κανονικά', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

interface AgencyProfilePageProps {
  readonly params: Promise<{ readonly alias: string }>;
}

export default async function AgencyProfilePage({ params }: AgencyProfilePageProps) {
  const { alias } = await params;

  const resolution = await resolveAlias(alias);

  if (resolution.outcome === 'unknown') {
    // ⛔ Δες την κεφαλίδα: **503, ποτέ 404**.
    throw new Error('AGENCY_ALIAS_LOOKUP_UNAVAILABLE');
  }

  const companyId = resolution.outcome === 'found' ? resolution.companyId : null;
  const structuredData = companyId === null ? null : await structuredDataFor(companyId);

  return (
    <>
      {structuredData === null ? null : <JsonLdScript data={structuredData} />}
      <AgencyProfileContent companyId={companyId} alias={alias} />
    </>
  );
}
