/**
 * @fileoverview **Η ΠΥΛΗ ΘΕΑΣΗΣ** — ποιος βλέπει μια περιήγηση, και με ποια βάση (ADR-884 Κ3β · Φ0.4 · Φ0.12 · Φ0.13).
 * @related `server/spatial-tour/tour-view-session.ts` (ο μόνος καλών) · `tour-authority.ts` (οι κριτές που τροφοδοτούν)
 * @module lib/spatial-tour/tour-view-policy
 *
 * 🔑 **Καθαρή, χωρίς I/O και ρολόι**: ο καλών έχει ήδη ρωτήσει τους **υπάρχοντες** κριτές (`mayManageTour` ·
 * `tourAccessStanding` · ενεργός σύνδεσμος) και φέρνει τις απαντήσεις. Εδώ ζει **μόνο** ο πίνακας — ώστε να
 * δοκιμάζεται ολόκληρος, καρτεσιανά.
 *
 * 📋 **Ο πίνακας** (πρότυπο Google Drive / Figma: η ορατότητα **προσθέτει** κοινό, δεν αφαιρεί ανθρώπους):
 * | κύκλος ζωής | υπεύθυνος | ρητή άδεια (σύνδεσμος · εγκεκριμένο αίτημα) | ορατότητα `public` |
 * |---|---|---|---|
 * | `withdrawn` | ✅ | ❌ — απόσυρση = κανείς έξω από το γραφείο | ❌ |
 * | `draft`     | ✅ | ✅ — ο μεσίτης δείχνει σε πελάτη πριν δημοσιεύσει | ❌ |
 * | `published` | ✅ | ✅ | ✅ μόνο αν `visibility === 'public'` |
 *
 * 🔑 **Οι ρητές άδειες επιζούν αλλαγής ορατότητας**: από `link-only` σε `on-request` ο παραλήπτης ενός συνδέσμου
 * **δεν** χάνει πρόσβαση — την κόβει μόνο ρητή ανάκληση (ή λήξη). Αλλιώς μια αλλαγή ρύθμισης θα ανακαλούσε
 * σιωπηλά δεκάδες ανθρώπους που ο μεσίτης επέλεξε ονομαστικά.
 */

import type { SpatialTourLifecycle, SpatialTourVisibility, TourAccessStanding, TourViewBasis } from '@/constants/spatial-tour-vocabulary';

/** Ό,τι έμαθε ο καλών από τους κριτές — **κανένα** έγγραφο, μόνο απαντήσεις. */
export interface TourViewFacts {
  readonly lifecycle: SpatialTourLifecycle;
  readonly visibility: SpatialTourVisibility;
  /** Ο δράστης διαχειρίζεται τη ρίζα **και** η περιήγηση είναι του τωρινού κατόχου. */
  readonly isManager: boolean;
  /** `null` ⇒ ανώνυμος (κανένας λογαριασμός να ρωτηθεί). */
  readonly viewerUid: string | null;
  /** Η θέση του αιτήματος θέασης του δράστη — `'none'` όταν δεν ζήτησε ποτέ. */
  readonly requestStanding: TourAccessStanding | 'none';
  /** Το αναγνωριστικό του αιτήματος (`tacr_…`) όταν υπάρχει. */
  readonly requestId: string | null;
  /** Ενεργός προσωπικός σύνδεσμος **αυτής** της περιήγησης που άνοιξε ο browser — `null` όταν κανένας. */
  readonly linkShareId: string | null;
}

/** Οι αρνήσεις της πύλης — κάθε μία στέλνει τον άνθρωπο σε **άλλη** ενέργεια. */
export type TourViewRefusal =
  /** Ανώνυμος μπροστά σε περιήγηση που θέλει λογαριασμό (αίτημα) — «συνδεθείτε». */
  | 'sign-in-required'
  /** Καμία βάση — «ζητήστε πρόσβαση» (αν επιτρέπεται) ή τίποτα να δείτε. */
  | 'not-viewable';

export type TourViewVerdict =
  | { readonly kind: 'granted'; readonly basis: TourViewBasis; readonly basisId: string }
  | { readonly kind: 'refused'; readonly reason: TourViewRefusal };

const PUBLIC_BASIS_ID = 'public';

function explicitGrant(facts: TourViewFacts): TourViewVerdict | null {
  if (facts.linkShareId !== null) return { kind: 'granted', basis: 'link', basisId: facts.linkShareId };
  if (facts.requestStanding === 'active' && facts.requestId !== null) {
    return { kind: 'granted', basis: 'request', basisId: facts.requestId };
  }
  return null;
}

/** **Η κρίση.** Σειρά = προτεραιότητα: υπεύθυνος → σύνδεσμος → αίτημα → δημόσιο. */
export function judgeTourView(facts: TourViewFacts): TourViewVerdict {
  if (facts.isManager && facts.viewerUid !== null) {
    return { kind: 'granted', basis: 'manager', basisId: facts.viewerUid };
  }
  if (facts.lifecycle === 'withdrawn') return { kind: 'refused', reason: 'not-viewable' };

  const explicit = explicitGrant(facts);
  if (explicit !== null) return explicit;

  if (facts.lifecycle !== 'published') return { kind: 'refused', reason: 'not-viewable' };
  if (facts.visibility === 'public') return { kind: 'granted', basis: 'public', basisId: PUBLIC_BASIS_ID };
  if (facts.visibility === 'on-request' && facts.viewerUid === null) {
    return { kind: 'refused', reason: 'sign-in-required' };
  }
  return { kind: 'refused', reason: 'not-viewable' };
}

/**
 * **Φαίνεται η περιήγηση στη δημόσια αγγελία;** — δημοσιευμένη, όχι `link-only` (αόρατη ex definitione, Δ3),
 * **και** με κάτι να δείξει (τουλάχιστον ένα έτοιμο tileset). Χωρίς σημαία: η κάρτα εμφανίζεται μόνη της όταν
 * ο ψήστης της Φ2 παραδώσει το πρώτο tileset.
 */
export function isTourListed(tour: {
  readonly lifecycle: SpatialTourLifecycle;
  readonly visibility: SpatialTourVisibility;
}, hasReadyTileset: boolean): boolean {
  return tour.lifecycle === 'published' && tour.visibility !== 'link-only' && hasReadyTileset;
}
