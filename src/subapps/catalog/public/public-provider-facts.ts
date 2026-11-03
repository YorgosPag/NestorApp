/**
 * **Το προφίλ του παρόχου όπως φτάνει στη δημόσια σελίδα** (ADR-923 §22 Υ8): λογότυπο, ιστοσελίδα και περιοχή εξυπηρέτησης.
 *
 * 🔑 **Μία δήλωση, δύο επιφάνειες.** Τα στοιχεία τα γράφει ο χώρος στο `agency_profiles` (ADR-841 · ADR-846). Δεύτερη δήλωση
 *    περιοχής για τον προμηθευτή θα ήταν δεύτερη αλήθεια για το ίδιο γεγονός. Χωρίς δημοσιευμένη βιτρίνα επαγγελματία η σελίδα
 *    προμηθευτή απλώς δεν τα δείχνει.
 * 🔒 **Μόνο λογότυπο.** Το `/pro` είναι κλειστό στις μηχανές, ενώ το `/suppliers` είναι ανοιχτό (Ε2). Το πορτρέτο είναι πρόσωπο, και
 *    η δημοσίευσή του στο `/pro` δεν είναι συναίνεση για ευρετήριο. Για τον ίδιο λόγο δεν φτάνουν εδώ οδοί και έδρα.
 * 🔒 **Το κέντρο της ακτίνας δεν φεύγει.** Μπορεί να είναι η κατοικία. Από την ακτίνα μένει μόνο ο αριθμός χιλιομέτρων.
 *
 * **Layering**: καθαρή, καμία ανάγνωση.
 * @module subapps/catalog/public/public-provider-facts
 */

import { coverageOutlineAreaKm2 } from '@/lib/agency/coverage-outline';
import { isNationwide, isOutlineCoverage, isRadiusCoverage, type DeclaredCoverage } from '@/types/agency-coverage';
import type { PublicShowcase } from '@/types/agency-profile';
import type { ListingImage } from '@/types/public-listing';

export type PublicServiceArea =
  | { readonly kind: 'nationwide' }
  | { readonly kind: 'areas'; readonly names: readonly string[] }
  | { readonly kind: 'radius'; readonly radiusKm: number }
  | { readonly kind: 'outline'; readonly km2: number };

export interface PublicProviderFacts {
  readonly logo: ListingImage | null;
  readonly website: string | null;
  readonly area: PublicServiceArea | null;
}

export const NO_PROVIDER_FACTS: PublicProviderFacts = { logo: null, website: null, area: null };

/** Το όνομα μιας διοικητικής ταυτότητας, από την ιεραρχία. Τα ονόματα δεν αποθηκεύονται δίπλα στα ids (ADR-846). */
export type AdminNameOf = (adminId: string) => string | undefined;

function declaredAreaOf(coverage: DeclaredCoverage, nameOf: AdminNameOf): PublicServiceArea | null {
  if (isNationwide(coverage)) return { kind: 'nationwide' };
  if (isRadiusCoverage(coverage)) return { kind: 'radius', radiusKm: coverage.circle.radiusKm };
  if (isOutlineCoverage(coverage)) return { kind: 'outline', km2: coverageOutlineAreaKm2(coverage.outline) };
  const names = coverage.adminIds.flatMap((adminId) => nameOf(adminId) ?? []);
  return names.length === 0 ? null : { kind: 'areas', names };
}

export function publicProviderFactsOf(showcase: Pick<PublicShowcase, 'mark' | 'website' | 'coverage'>, nameOf: AdminNameOf): PublicProviderFacts {
  return {
    logo: showcase.mark?.kind === 'logo' ? showcase.mark.image : null,
    website: showcase.website,
    area: showcase.coverage === null ? null : declaredAreaOf(showcase.coverage, nameOf),
  };
}
