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
 * - `unknown` → **ρίχνει** μέσω του SSoT `throwBackendUnavailable` (5xx + `digest`).
 *   ⛔ **ΠΟΤΕ 404 εδώ**: το *«δεν μπόρεσα να ρωτήσω»* που φοράει τη στολή του *«δεν
 *   υπάρχει»* στέλνει τον άνθρωπο μακριά από γραφείο που **υπάρχει** (N.12 · Ε-5 §4 #3).
 *   ⛔ **ΚΑΙ ΠΟΤΕ 200 με οθόνη σφάλματος**: για δημόσια σελίδα η Google το μετρά soft
 *   404 (δες `lib/errors/backend-unavailable.ts`). Ίδιο ιδίωμα με το `o/[workspace]/layout.tsx`.
 *
 * ⚠️ **Το `params` είναι `Promise` (Next 15)** — συγχρονισμένο `params.alias` θα
 * μεταγλωττιζόταν και θα έσπαγε **στην εκτέλεση**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΜΙΑ ΚΑΝΟΝΙΚΗ ΔΙΕΥΘΥΝΣΗ — `/pro/comp_<uuid>` ⇒ 308 ⇒ `/pro/<ψευδώνυμο>` (ADR-841 §7 Α22)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κάρτα αγγελίας συνδέει **κατά ταυτότητα** (Α1.6: κανένα τρίτο αντίγραφο ψευδωνύμου).
 * Όταν η βιτρίνα είναι δημοσιευμένη **και** η αυθεντία επιβεβαιώνει ότι το ψευδώνυμό της
 * ανήκει στο **ίδιο** γραφείο, ο διακομιστής στέλνει στο ανθρώπινο όνομα — ADR-787 §5.3 ζ.
 * Η κρίση ζει στο {@link canonicalShowcaseSegment} (καθαρή, ελεγμένη)· εδώ μόνο I/O.
 *
 * 🔒 **Και δεν ανοίγει μαντείο**: αδημοσίευτη βιτρίνα ⇒ **καμία** ανακατεύθυνση ⇒ ίδια
 * οθόνη με «δεν υπάρχει», όπως πριν. Το ψευδώνυμο αποκαλύπτεται **μόνο** για ό,τι το ίδιο
 * το γραφείο δημοσίευσε.
 *
 * ⛔ **Το `permanentRedirect` ΕΚΤΟΣ κάθε `try`**: πετά `NEXT_REDIRECT`, και ένα `catch`
 * γύρω του θα το κατάπινε σιωπηλά — η σελίδα θα αποδιδόταν στη μη κανονική διεύθυνση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΑ ΔΟΜΗΜΕΝΑ ΔΕΔΟΜΕΝΑ ΕΙΝΑΙ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ (ADR-841 §7 Α21.17)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το JSON-LD πρέπει να βρίσκεται στο HTML που **στέλνεται** — πολλοί ανιχνευτές δεν εκτελούν
 * JavaScript. Διαβάζεται με τον **υπάρχοντα** `lookupAgencyProfile` (φρουρός `readShowcase`,
 * συγκάλυψη, CHECK 3.74) — **όχι** δεύτερος αναγνώστης· και από τη Α22 η **ίδια** ανάγνωση
 * τροφοδοτεί και την κρίση της κανονικής διεύθυνσης.
 *
 * ⚠️ **Προαιρετικό, ποτέ φράγμα**: βλάβη ή αδημοσίευτη βιτρίνα ⇒ **κανένα** script, και η σελίδα
 * αποδίδεται κανονικά (η ζωντανή ανάγνωση του πελάτη μένει η αλήθεια της οθόνης).
 *
 * ⚠️ **Καμία `generateMetadata`** ακόμη — δηλωμένο κενό, το **ίδιο** με το `/listing/[id]`
 * (ADR-777 §8.11)· ο τίτλος/περιγραφή ανήκουν σε δική τους απόφαση.
 *
 * @module app/(light)/pro/[alias]/page
 */

import { permanentRedirect } from 'next/navigation';

import { AgencyProfileContent } from '@/components/mandate/AgencyProfileContent';
import { agencyProfileRoute } from '@/components/mandate/agency-directory-route';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { canonicalShowcaseSegment } from '@/lib/agency/showcase-canonical-segment';
import { throwBackendUnavailable } from '@/lib/errors/backend-unavailable';
import { showcaseStructuredData } from '@/lib/agency/showcase-structured-data';
import { athensClockAt } from '@/lib/calendar/weekly-hours';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { publicUrl } from '@/lib/http/public-origin';
import { acceptsMandate } from '@/lib/professional/showcase-acts';
import type { JsonLdValue } from '@/lib/seo/json-ld';
import { resolveAlias, type AliasResolution } from '@/lib/workspace/alias-registry';
import { createModuleLogger } from '@/lib/telemetry';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';
import type { PublicShowcaseLookup } from '@/types/agency-profile';

const logger = createModuleLogger('pro-alias-page');

type FoundAlias = Extract<AliasResolution, { readonly outcome: 'found' }>;

/** **Η μία ανάγνωση της βιτρίνας** στον διακομιστή — βλάβη ⇒ `unavailable`, ποτέ εξαίρεση. */
async function readShowcaseOf(companyId: string): Promise<PublicShowcaseLookup> {
  try {
    return await lookupAgencyProfile(getAdminFirestore(), companyId);
  } catch (error) {
    logger.warn('Η βιτρίνα δεν διαβάστηκε στον διακομιστή — η σελίδα αποδίδεται κανονικά', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unavailable' };
  }
}

/** **Βιτρίνα → JSON-LD**, ή `null` όταν δεν υπάρχει τι να πει (ή δεν ξέρουμε ποιοι είμαστε). */
function structuredDataFor(lookup: PublicShowcaseLookup): JsonLdValue | null {
  if (lookup.outcome !== 'found') return null;
  try {
    const profileUrl = publicUrl(agencyProfileRoute(lookup.showcase.alias));
    if (profileUrl === null) return null;
    return showcaseStructuredData(lookup.showcase, {
      profileUrl,
      canHoldMandate: acceptsMandate(lookup.showcase.credentials),
      todayKey: athensClockAt(new Date()).dateKey,
    });
  } catch (error) {
    logger.warn('Τα δομημένα δεδομένα παραλείφθηκαν — η σελίδα αποδίδεται κανονικά', {
      companyId: lookup.showcase.companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * **Πού πρέπει να ζει αυτή η σελίδα;** — I/O μόνο όταν χρειάζεται: η αυθεντία ρωτιέται
 * **μόνο** για διεύθυνση-ταυτότητα με δημοσιευμένο ψευδώνυμο.
 */
async function canonicalSegmentFor(
  requested: FoundAlias,
  lookup: PublicShowcaseLookup,
): Promise<string | null> {
  const publishedAlias = lookup.outcome === 'found' ? lookup.showcase.alias : null;
  const publishedAliasResolution =
    requested.form === 'identity' && publishedAlias !== null
      ? await resolveAlias(publishedAlias).catch(() => null)
      : null;
  return canonicalShowcaseSegment({ requested, publishedAlias, publishedAliasResolution });
}

interface AgencyProfilePageProps {
  readonly params: Promise<{ readonly alias: string }>;
}

export default async function AgencyProfilePage({ params }: AgencyProfilePageProps) {
  const { alias } = await params;

  const resolution = await resolveAlias(alias);

  if (resolution.outcome === 'unknown') {
    // ⛔ Δες την κεφαλίδα: **5xx, ποτέ 404** — με digest που ξέρουν boundary και χρησμός.
    throwBackendUnavailable('agency-alias-lookup');
  }

  if (resolution.outcome === 'not-found') {
    return <AgencyProfileContent companyId={null} alias={alias} />;
  }

  const lookup = await readShowcaseOf(resolution.companyId);

  // ⛔ ΕΚΤΟΣ `try` — δες την κεφαλίδα. Η σύγκριση με το `alias` φυλά από βρόχο.
  const canonical = await canonicalSegmentFor(resolution, lookup);
  if (canonical !== null && canonical !== alias) {
    permanentRedirect(agencyProfileRoute(canonical));
  }

  const structuredData = structuredDataFor(lookup);

  return (
    <>
      {structuredData === null ? null : <JsonLdScript data={structuredData} />}
      <AgencyProfileContent companyId={resolution.companyId} alias={alias} />
    </>
  );
}
