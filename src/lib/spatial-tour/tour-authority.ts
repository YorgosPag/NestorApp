/**
 * @fileoverview **ΠΟΙΟΣ ΚΑΝΕΙ ΤΙ ΣΕ ΜΙΑ ΧΩΡΙΚΗ ΠΕΡΙΗΓΗΣΗ** — διανομέας, όχι κριτής.
 * @related ADR-884 Φ0.1 · Φ0.3 · Φ0.5 · Φ0.13 · CHECK 3.56 · CHECK 3.68
 * @module lib/spatial-tour/tour-authority
 *
 * 🔴 **ΚΑΜΙΑ ΝΕΑ ΑΡΧΗ ΕΞΟΥΣΙΟΔΟΤΗΣΗΣ** (Φ0.3). Κάθε απάντηση εδώ **ρωτά** έναν από τους υπάρχοντες κριτές:
 *
 * | Ερώτηση | Κριτής |
 * |---|---|
 * | αγγελία ιδιώτη/μεσίτη — «διαχειρίζεσαι;» | `mayPerform(p, actor, 'manageTour')` (CHECK 3.56) |
 * | αγγελία εταιρείας — «ίδιος μισθωτής;» | `isPayloadOwnedByCompany` (ADR-742) |
 * | αγγελία εταιρείας — «έχεις το δικαίωμα;» | `decideCapability('listings:listings:publish')` (CHECK 3.68) |
 * | φωτογράφος / θεατής — «ισχύει η άδεια;» | `evaluateScopedGrant` (ο **ένας** έλεγχος λήξης) |
 *
 * 🔑 **Ονομασμένες ετυμηγορίες, ποτέ boolean**: «δεν είναι δικός σου χώρος» και «δεν έχεις το δικαίωμα» έχουν
 * **άλλη** θεραπεία για τον άνθρωπο (ζήτα πρόσβαση στον χώρο · ζήτα ρόλο από τον διαχειριστή).
 *
 * 🔑 **Ο κάτοχος της περιήγησης ΠΑΡΑΓΕΤΑΙ** από τη ρίζα (`tourCustodyOf`) — δεν επιλέγεται, δεν αποθηκεύεται
 * ανεξάρτητα, άρα δεν μπορεί να αποκλίνει από τον κάτοχο της αγγελίας.
 *
 * **Layering**: καθαρές συναρτήσεις — κανένα Firestore SDK. Ο διακομιστής φορτώνει τη ρίζα και ρωτά εδώ.
 */

import type { PlaceSource } from '@/constants/place-sources';
import type { TourAccessStanding, TourGrantScope } from '@/constants/spatial-tour-vocabulary';
import { decideCapability } from '@/lib/auth/authority';
import { evaluateScopedGrant, type ScopedGrant, type ScopedGrantVerdict } from '@/lib/auth/scoped-grant';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { custodyOf, custodyWorkspace, type ListingActor } from '@/lib/owner-property/listing-custody';
import { mayPerform } from '@/lib/owner-property/listing-permissions';
import { companyPropertyHolder } from '@/lib/places/place-detail-route';
import { custodyScopeOf, type CustodyScope } from '@/lib/workspace/custody-scope';
import { isGranted, type CapabilitySubject } from '@/types/capability-authority';
import type { OwnerProperty } from '@/types/owner-property';
import type { TourAccessRequest, TourCaptureGrant } from '@/types/spatial-tour';
import { orgWorkspace } from '@/types/workspace-membership';

// =============================================================================
// 1. ΟΙ ΕΙΣΟΔΟΙ
// =============================================================================

/**
 * Η ρίζα της περιήγησης, **φορτωμένη** — μόνο τα πεδία που κρίνουν. Το είδος είναι το `PlaceSource` (Φ0.1).
 */
export type TourSubjectRecord =
  | { readonly kind: 'owner-property'; readonly property: Pick<OwnerProperty, 'authorUserId' | 'authorCompanyId'> }
  | { readonly kind: 'company-property'; readonly property: { readonly companyId?: unknown } };

/**
 * Ο δράστης, με **δύο** όψεις: η όψη χώρου (`ListingActor`, από `listingActorOf`) για τις αγγελίες
 * ιδιώτη/μεσίτη, και η όψη ρόλου (`CapabilitySubject`) για τον κριτή δικαιωμάτων.
 */
export interface TourActor {
  readonly listing: ListingActor;
  readonly capability: CapabilitySubject;
}

export type TourManageVerdict = 'granted' | 'denied-custody' | 'denied-tenant' | 'denied-capability';

/** Ποιο δικαίωμα ρόλου διαχειρίζεται περιήγηση εταιρικής αγγελίας — η **δημοσίευση** της αγγελίας (Φ0.3). */
const COMPANY_TOUR_CAPABILITY = 'listings:listings:publish' as const;

// =============================================================================
// 2. Ο ΚΑΤΟΧΟΣ — παράγεται
// =============================================================================

/**
 * **Σε ποιο διαμέρισμα ζει η περιήγηση.** `null` = εταιρική ρίζα **χωρίς** μισθωτή — βλάβη, όχι «προσωπική».
 */
export function tourCustodyOf(record: TourSubjectRecord): CustodyScope | null {
  if (record.kind === 'owner-property') return custodyScopeOf(custodyWorkspace(custodyOf(record.property)));
  // Ο **ίδιος** κάτοχος με τους σαρωτές ζήτησης (ADR-849 §6δ) — ένα κριτήριο «έχει εταιρεία;», όχι δεύτερο.
  const companyId = companyPropertyHolder(record.property);
  return companyId === null ? null : custodyScopeOf(orgWorkspace(companyId));
}

// =============================================================================
// 3. ΔΙΑΧΕΙΡΙΣΗ — διανομή ανά είδος ρίζας
// =============================================================================

function mayManageCompanyTour(property: { readonly companyId?: unknown }, actor: TourActor): TourManageVerdict {
  const decision = decideCapability({ subject: actor.capability, action: COMPANY_TOUR_CAPABILITY });
  // ⚠️ Η παράκαμψη πλατφόρμας την κρίνει ο κριτής ρόλων — ποτέ λίστα ρόλων εδώ (CHECK 3.68).
  const bypass = decision.verdict === 'granted-by-bypass';
  const actorCompanyId = actor.listing.companyId ?? '';
  const holderId = companyPropertyHolder(property);
  if (!bypass && (holderId === null || !isPayloadOwnedByCompany({ companyId: holderId }, actorCompanyId))) {
    return 'denied-tenant';
  }
  return isGranted(decision.verdict) ? 'granted' : 'denied-capability';
}

const MANAGE_BY_KIND: {
  readonly [K in PlaceSource]: (record: Extract<TourSubjectRecord, { kind: K }>, actor: TourActor) => TourManageVerdict;
} = {
  'owner-property': (record, actor) =>
    mayPerform(record.property, actor.listing, 'manageTour') ? 'granted' : 'denied-custody',
  'company-property': (record, actor) => mayManageCompanyTour(record.property, actor),
};

/**
 * **Διαχειρίζεται αυτός αυτή την περιήγηση;** — γράφος, ορατότητα, δημοσίευση, έγκριση αιτημάτων θέασης,
 * πρόσκληση φωτογράφου (Φ0.3). Ο φωτογράφος **δεν** περνά από εδώ (`mayUploadTourCapture`).
 */
export function mayManageTour(record: TourSubjectRecord, actor: TourActor): TourManageVerdict {
  return record.kind === 'owner-property'
    ? MANAGE_BY_KIND['owner-property'](record, actor)
    : MANAGE_BY_KIND['company-property'](record, actor);
}

// =============================================================================
// 4. ΠΕΡΙΟΡΙΣΜΕΝΕΣ ΑΔΕΙΕΣ — ο ΕΝΑΣ κριτής
// =============================================================================

export type TourUploadVerdict =
  | 'granted-as-manager'
  | 'granted-by-capture-grant'
  | 'no-capture-grant'
  | Exclude<ScopedGrantVerdict, 'granted'>;

/**
 * **Μπορεί να ανεβάσει λήψη;** — ο υπεύθυνος **ή** ο φωτογράφος με ενεργή άδεια (Φ0.5). Η άρνηση λέει
 * **γιατί** (έληξε · ανακλήθηκε · δεν υπάρχει άδεια), ώστε ο φωτογράφος να ξέρει αν ζητήσει νέα πρόσκληση.
 *
 * @param grant η άδεια **αυτού** του δράστη (`tour_capture_grants/{uid}`), ή `null` αν δεν υπάρχει.
 */
export function mayUploadTourCapture(
  record: TourSubjectRecord,
  actor: TourActor,
  grant: TourCaptureGrant | null,
  nowMs: number,
): TourUploadVerdict {
  if (mayManageTour(record, actor) === 'granted') return 'granted-as-manager';
  if (grant === null || grant.granteeUid !== actor.listing.uid) return 'no-capture-grant';
  const verdict = evaluateScopedGrant(grant, 'tour:capture:upload', nowMs);
  return verdict === 'granted' ? 'granted-by-capture-grant' : verdict;
}

/** Το εύρος που δίνει ένα εγκεκριμένο αίτημα θέασης — σταθερό, άρα **δεν** αποθηκεύεται στο έγγραφο. */
const VIEW_SCOPES = ['tour:view'] as const;

/** Η θέση μιας **άδειας** — το υποσύνολο του λεξιλογίου που παράγει ο κριτής αδειών (όχι οι αποφάσεις ανθρώπου). */
export type TourGrantStanding = Extract<TourAccessStanding, 'active' | 'revoked' | 'expired' | 'unreadable'>;

const STANDING_OF_GRANT: Readonly<Record<ScopedGrantVerdict, TourGrantStanding>> = {
  granted: 'active',
  revoked: 'revoked',
  expired: 'expired',
  'unreadable-expiry': 'unreadable',
  // Αδύνατο με σταθερό εύρος — αλλά αν ποτέ συμβεί, είναι άρνηση, όχι «ενεργό».
  'scope-missing': 'unreadable',
};

/**
 * **Πού βρίσκεται μια άδεια πάνω σε περιήγηση ΤΩΡΑ;** — η ετυμηγορία του **ενός** κριτή αδειών, στο λεξιλόγιο
 * της οθόνης (`active · revoked · expired · unreadable`). Κοινή για θέαση **και** λήψη.
 */
export function tourGrantStanding(
  grant: Pick<ScopedGrant<TourGrantScope>, 'scopes' | 'expiresAt' | 'revokedAt'>,
  scope: TourGrantScope,
  nowMs: number,
): TourGrantStanding {
  return STANDING_OF_GRANT[evaluateScopedGrant(grant, scope, nowMs)];
}

/**
 * **Πού βρίσκεται αυτό το αίτημα θέασης ΤΩΡΑ;** — οι αποφάσεις ανθρώπου αυτούσιες· για το `approved`, ό,τι
 * λέει ο κριτής αδειών. Το `expired` **δεν** γράφεται ποτέ: παράγεται, άρα δεν αργεί ποτέ.
 */
export function tourAccessStanding(request: TourAccessRequest, nowMs: number): TourAccessStanding {
  if (request.state !== 'approved') return request.state;
  return tourGrantStanding({ scopes: VIEW_SCOPES, expiresAt: request.expiresAt, revokedAt: request.revokedAt }, 'tour:view', nowMs);
}
