import 'server-only';

/**
 * **Η κανονική διεύθυνση μιας δημόσιας σελίδας χώρου** (ADR-787 §5.3 ζ · ADR-841 §7 Α22): το I/O γύρω από την καθαρή κρίση.
 *
 * Το ψευδώνυμο που κρατά ή διαβάζει η σελίδα είναι ισχυρισμός: το 308 αποθηκεύεται από τον φυλλομετρητή, άρα η αυθεντία
 * ρωτιέται πρώτα. Ρωτιέται μόνο για διεύθυνση-ταυτότητα με γνωστό ψευδώνυμο. Βλάβη ⇒ καμία ανακατεύθυνση.
 *
 * @module lib/workspace/published-canonical-segment
 */

import { canonicalShowcaseSegment } from '@/lib/agency/showcase-canonical-segment';
import { resolveAlias, type AliasResolution } from './alias-registry';

type FoundAlias = Extract<AliasResolution, { readonly outcome: 'found' }>;

export async function publishedCanonicalSegment(requested: FoundAlias, publishedAlias: string | null): Promise<string | null> {
  const publishedAliasResolution =
    requested.form === 'identity' && publishedAlias !== null ? await resolveAlias(publishedAlias).catch(() => null) : null;
  return canonicalShowcaseSegment({ requested, publishedAlias, publishedAliasResolution });
}
