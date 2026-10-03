/**
 * =============================================================================
 * ΣΥΜΜΕΤΟΧΗ ΣΕ ΥΠΟΘΕΣΗ — ο ΕΝΑΣ μηχανισμός πρόσβασης ξένου χρήστη (ADR-862 §5.3 · Φ1)
 * =============================================================================
 *
 * `companies/{hostCompanyId}/projects/{projectId}/engagements/{eng_…}`
 *
 * Ο εξωτερικός (δικηγόρος · συμβολαιογράφος · αργότερα μελετητής/συνεργείο) **δεν** γίνεται μέλος
 * του χώρου: αποκτά πρόσβαση σε **ΜΙΑ** υπόθεση, για **όσο** διαρκεί, και **μόνο** αφού την αποδεχτεί.
 *
 * 🔑 **Γιατί κλειδί `eng_…` και ΟΧΙ `uid`** (απόκλιση από το αρχικό ADR-862 §5.3.1, μετρημένη 2026-10-02):
 *    ο ίδιος συμβολαιογράφος κάνει **όλα** τα διαμερίσματα ενός νεόδμητου έργου — πολλές υποθέσεις στο
 *    ίδιο έργο. Κλειδί `uid` = μία συμμετοχή ανά έργο ⇒ η δεύτερη υπόθεση θα **έσβηνε** ή θα **κληρονομούσε**
 *    την πρώτη. Η μοναδικότητα `(uid, subject)` εγγυάται από τη **συναλλαγή** του ενός γραφέα
 *    (`lib/auth/engagement-write.ts`) — το σχήμα του `project-member-write.ts` (N.6).
 *
 * 🔑 **Γιατί `offered` πριν το `active`** — πρότυπο Microsoft Entra B2B (`PendingAcceptance → Accepted`):
 *    πρόσβαση **μόνο** μετά από ρητή αποδοχή. Το Procore δίνει πρόσβαση με την προσθήκη· εδώ ένας
 *    δικηγόρος που **δεν ανέλαβε** δεν βλέπει τίποτα — η ανάθεση νομικής ευθύνης θέλει «ναι».
 *
 * @module types/engagement
 * @see lib/auth/engagement-judge.ts — ο κριτής (καθαρός)
 * @see lib/auth/engagement-write.ts — ο ΕΝΑΣ γραφέας
 */

import type { ChapteredRegistryId } from '@/constants/professional-registries';
import type { ScopedGrant } from '@/lib/auth/scoped-grant';
import type { CdeAudience } from '@/types/container-access';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

// =============================================================================
// ΛΕΞΙΛΟΓΙΑ — κλειστά σύνολα, ως δεδομένα (έλεγχος σε χρόνο εκτέλεσης)
// =============================================================================

/**
 * Ο κύκλος ζωής (AIP-216 — output-only: τον γράφει **μόνο** ο γραφέας).
 *
 * ```
 * offered ──accept──► active ──► revoked | expired | completed
 *    ├──decline──► declined
 *    ├──withdraw─► withdrawn
 *    └──(λήξη)───► expired
 * ```
 * ⛔ **Καμία διαγραφή, ποτέ** (ADR-787 Ε-2 §4): η ιστορία της πρόσβασης είναι ίχνος.
 */
export const ENGAGEMENT_STATES = [
  'offered',
  'active',
  'declined',
  'withdrawn',
  'revoked',
  'expired',
  'completed',
] as const;
export type EngagementState = (typeof ENGAGEMENT_STATES)[number];

/** Οι **ζωντανές** καταστάσεις — η μοναδικότητα `(uid, subject)` ισχύει ΜΟΝΟ γι' αυτές. */
export const LIVE_ENGAGEMENT_STATES: readonly EngagementState[] = ['offered', 'active'] as const;

/** Οι ρόλοι νομικών επαγγελματιών — **το ίδιο** λεξιλόγιο με το `ProfessionalsCard` (SSoT). */
export const LEGAL_ENGAGEMENT_ROLES = ['seller_lawyer', 'buyer_lawyer', 'notary'] as const satisfies readonly LegalProfessionalRole[];

/** Φρουρός για τιμή **από έξω** (τμήμα URL · σώμα) — ο ΕΝΑΣ, δίπλα στο λεξιλόγιο. */
export function isLegalEngagementRole(value: unknown): value is LegalProfessionalRole {
  return typeof value === 'string' && (LEGAL_ENGAGEMENT_ROLES as readonly string[]).includes(value);
}

/**
 * Τα εύρη μιας συμμετοχής — κρίνονται **μόνο** από το `evaluateScopedGrant` (ADR-884 Φ0.5).
 * ⚠️ Λίστα **περιοχών**, ποτέ λίστα αρχείων (ADR-787 Α5).
 */
export const ENGAGEMENT_SCOPES = ['conveyance:case:view'] as const;
export type EngagementScope = (typeof ENGAGEMENT_SCOPES)[number];

/** Η πλευρά της συναλλαγής — ποιανού τα έγγραφα ανοίγει η συναίνεση (ADR-901 §5.2). */
export const ENGAGEMENT_SIDES = ['seller', 'buyer'] as const;
export type EngagementSide = (typeof ENGAGEMENT_SIDES)[number];

/**
 * **Από πού ήρθε η συναίνεση** — ονομασμένη πηγή, ποτέ σιωπηρή.
 * - `own_side`  — ο οικοδεσπότης ορίζει επαγγελματία της **δικής** του πλευράς (πωλητής-εργολάβος).
 * - `host_attested` — ο οικοδεσπότης **δηλώνει** τη συναίνεση της **άλλης** πλευράς (αγοραστής χωρίς
 *   λογαριασμό) — πρότυπο Qualia/dotloop: ο κάτοχος του φακέλου καλεί όλα τα μέρη· εδώ **με ίχνος**.
 * - `in_app` — η πλευρά συναίνεσε η ίδια μέσα στην εφαρμογή (ADR-901 Φ5 — ιδιώτης με λογαριασμό).
 */
export const CONSENT_SOURCES = ['own_side', 'host_attested', 'in_app'] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

/** Η βάση μιας δηλωμένης συναίνεσης — **τι** δείχνει ότι η άλλη πλευρά συμφώνησε. */
export const CONSENT_BASES = ['own_side', 'preliminary_contract', 'written_instruction', 'verbal_instruction'] as const;
export type ConsentBasis = (typeof CONSENT_BASES)[number];

// =============================================================================
// ΤΟ ΕΓΓΡΑΦΟ
// =============================================================================

/**
 * **Σε τι** δίνει πρόσβαση η συμμετοχή — κλειστή ένωση. Σήμερα μόνο η υπόθεση μεταβίβασης
 * (ADR-901 Φ2)· η υπόθεση-έργο (μελετητής/συνεργείο) μπαίνει ως δεύτερη τιμή στην ADR-862 Φ2.
 */
export interface ConveyanceEngagementSubject {
  readonly kind: 'conveyance_case';
  readonly caseId: string;
}
export type EngagementSubject = ConveyanceEngagementSubject;

/** Η πράξη που **γέννησε** τη συμμετοχή (ADR-862 §5.3.1 `originActRef`). */
export interface EngagementOrigin {
  readonly kind: 'professional_appointment';
  /** Η επαφή του επαγγελματία στο `ProfessionalsCard` — η ταυτότητα **στο βιβλίο** του οικοδεσπότη. */
  readonly contactId: string;
  /** ADR-901 Φ3 — η πρόσκληση με email που **εξαργυρώθηκε** (`einv_…`)· απόν ⇒ πρόταση σε υπάρχοντα λογαριασμό. */
  readonly invitationId?: string;
}

/**
 * **Ποιο μητρώο** ρωτά κάθε ρόλος (ADR-798 λεξιλόγιο · ADR-901 Ε-4) — ο άνθρωπος **δεν** διαλέγει μητρώο,
 * δηλώνει μόνο αριθμό και σύλλογο/περιφέρεια.
 */
export const ROLE_REGISTRY_AUTHORITY = {
  seller_lawyer: 'bar-association',
  buyer_lawyer: 'bar-association',
  notary: 'notary-association',
} as const satisfies Readonly<Record<LegalProfessionalRole, ChapteredRegistryId>>;

/**
 * **Δηλωμένη** επαγγελματική ιδιότητα (ADR-901 Ε-4) — στιγμιότυπο **ανά υπόθεση**, όπως τη δήλωσε ο ίδιος
 * στην αποδοχή. 🔑 `assurance: 'declared'` — ποτέ «επαληθευμένο»: τα μέρη τη βλέπουν ως «(δηλωμένο)» μέχρι
 * τη φάση επαλήθευσης μητρώου.
 */
export interface DeclaredCredential {
  readonly authority: ChapteredRegistryId;
  readonly number: string;
  /** Σύλλογος (δικηγόροι) ή περιφέρεια (συμβολαιογράφοι) — ελεύθερο κείμενο, όπως στις persona. */
  readonly chapter: string | null;
  readonly assurance: 'declared';
  readonly declaredAt: string;
}

/** Μία συναίνεση — αμετάβλητη, με όνομα και ώρα. */
export interface EngagementConsent {
  readonly side: EngagementSide;
  readonly source: ConsentSource;
  readonly basis: ConsentBasis;
  /** Ο άνθρωπος που **δήλωσε** τη συναίνεση (οικοδεσπότης) ή που **συναίνεσε** (`in_app`). */
  readonly attestedBy: string;
  readonly attestedAt: string;
}

/**
 * Το έγγραφο συμμετοχής. Επεκτείνει το `ScopedGrant` ώστε λήξη/ανάκληση/εύρος να τα κρίνει
 * **ο ίδιος** κριτής με κάθε άλλη περιορισμένη άδεια της πλατφόρμας.
 *
 * ⚠️ **`revokedAt` ΑΠΟΝ, όχι `null`**, όσο δεν ανακλήθηκε: για το `evaluateScopedGrant` κάθε
 *    παρούσα τιμή σημαίνει «ανακλήθηκε».
 */
export interface Engagement extends ScopedGrant<EngagementScope> {
  readonly id: string;
  /** Ο χώρος **του έργου** — ποτέ του καλεσμένου (ADR-862 §2.3, Κ-3). Και πεδίο για collection-group. */
  readonly hostCompanyId: string;
  readonly projectId: string;
  /** Ο καλεσμένος — πεδίο για το «Κοινόχρηστα μαζί μου» (collection-group). */
  readonly uid: string;
  /** Το email με το οποίο βρέθηκε ο λογαριασμός — ίχνος, **όχι** κλειδί. */
  readonly email: string;
  readonly template: CdeAudience;
  readonly role: LegalProfessionalRole;
  readonly subject: EngagementSubject;
  readonly scopes: readonly EngagementScope[];
  readonly state: EngagementState;
  /** ΠΑΡΑΓΕΤΑΙ (`config/engagement-policy.ts`) — ποτέ πληκτρολογημένο (ADR-862 §5.3.3). */
  readonly expiresAt: string;
  readonly origin: EngagementOrigin;
  readonly consents: readonly EngagementConsent[];
  /** ADR-901 Ε-4 — απόν ⇒ καμία δήλωση (π.χ. πρόταση σε υπάρχοντα λογαριασμό, πριν από τη Φ3). */
  readonly declaredCredential?: DeclaredCredential;
  readonly offeredBy: string;
  readonly offeredAt: string;
  readonly respondedAt: string | null;
  readonly revokedAt?: string;
  readonly revokedBy: string | null;
  readonly closedAt: string | null;
  readonly updatedAt: string;
}

/** Η διεύθυνση ενός εγγράφου συμμετοχής — **τρεις** άξονες, κανένας από τον πελάτη. */
export interface EngagementKey {
  readonly hostCompanyId: string;
  readonly projectId: string;
  readonly engagementId: string;
}

// =============================================================================
// Η ΕΤΥΜΗΓΟΡΙΑ
// =============================================================================

/**
 * **«Συμμετέχει αυτός ο άνθρωπος, τώρα, σε ΑΥΤΗ την υπόθεση, για ΑΥΤΟ το εύρος;»**
 *
 * Ονομασμένη, **ποτέ** boolean — κάθε άρνηση έχει άλλη θεραπεία για τον άνθρωπο (ADR-862 Α3/Α4:
 * `revoked` ≠ `expired`, το ελάττωμα του παλιού `PropertyGrant`).
 */
export const ENGAGEMENT_VERDICTS = [
  'engaged',
  'offered',
  'declined',
  'withdrawn',
  'revoked',
  'expired',
  'unreadable-expiry',
  'completed',
  'scope-missing',
  'not-engaged',
] as const;
export type EngagementVerdict = (typeof ENGAGEMENT_VERDICTS)[number];

/** Στενεύει `unknown → EngagementVerdict` — για ό,τι έρχεται **από το δίκτυο** (σώμα 403). */
export function isEngagementVerdict(value: unknown): value is EngagementVerdict {
  return typeof value === 'string' && (ENGAGEMENT_VERDICTS as readonly string[]).includes(value);
}

export interface EngagementDecision {
  readonly verdict: EngagementVerdict;
  /** Η συμμετοχή που κρίθηκε — `null` όταν δεν υπάρχει. */
  readonly engagement: Engagement | null;
}
