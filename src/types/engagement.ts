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

import type { DossierShareDays } from '@/config/engagement-policy';
import type { PropertyDossierFileTab } from '@/config/upload-entry-points/entries-property-dossier';
import type { ChapteredRegistryId, RegistryAuthorityId } from '@/constants/professional-registries';
import type { ScopedGrant } from '@/lib/auth/scoped-grant';
import type { CdeAudience } from '@/types/container-access';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import type { WorkspaceRef } from '@/types/workspace-membership';

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
 * Ο ρόλος του επαγγελματία σε **ανάθεση έκδοσης εγγράφου** (ADR-915 §27 · ADR-862 §5.3.10).
 *
 * 🔑 **ΕΝΑΣ ρόλος, όχι ένας ανά άδεια**: το *«ποια άδεια χρειάζεται»* το απαντά ήδη το
 *    `config/document-validity/document-issuers.ts` (είδος εγγράφου → προσόν → άδεια → αρχή). Ένας ρόλος
 *    `energy_inspector` εδώ θα ήταν **δεύτερη** αλήθεια για την ίδια ερώτηση· ο ηλεκτρολόγος (ΥΔΕ) θα χρειαζόταν
 *    τρίτη.
 */
export const ISSUANCE_ENGAGEMENT_ROLES = ['document_issuer'] as const;
export type IssuanceEngagementRole = (typeof ISSUANCE_ENGAGEMENT_ROLES)[number];

/**
 * ADR-916 Φ-Ε1 — ο ρόλος του νομικού επαγγελματία στον **φάκελο ιδιώτη**. Ένας ζωντανός ανά ρόλο.
 * 🔑 Χωριστό λεξιλόγιο από τη μεταβίβαση: «δικηγόρος πωλητή/αγοραστή» δεν έχει νόημα χωρίς πράξη· εδώ ο
 *    δικηγόρος είναι **του κατόχου**. Η μεταβίβαση ιδιώτη (ADR-901 Φ5) φέρνει τους δικούς της ρόλους.
 */
export const DOSSIER_ENGAGEMENT_ROLES = ['owner_lawyer', 'notary'] as const;
export type DossierEngagementRole = (typeof DOSSIER_ENGAGEMENT_ROLES)[number];

/** Φρουρός για τιμή **από έξω** (σώμα αιτήματος) — δίπλα στο λεξιλόγιο. */
export function isDossierEngagementRole(value: unknown): value is DossierEngagementRole {
  return typeof value === 'string' && (DOSSIER_ENGAGEMENT_ROLES as readonly string[]).includes(value);
}

/** Κάθε ρόλος συμμετοχής, όποιου είδους υπόθεσης. */
export type EngagementRole = LegalProfessionalRole | IssuanceEngagementRole | DossierEngagementRole;

/**
 * Τα εύρη μιας συμμετοχής — κρίνονται **μόνο** από το `evaluateScopedGrant` (ADR-884 Φ0.5).
 * ⚠️ Λίστα **περιοχών**, ποτέ λίστα αρχείων (ADR-787 Α5).
 */
export const ENGAGEMENT_SCOPES = ['conveyance:case:view', 'issuance:assignment:collaborate', 'dossier:files:view'] as const;
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
 * **Σε τι** δίνει πρόσβαση η συμμετοχή — κλειστή ένωση (ADR-862 §5.3.10).
 * - `conveyance_case`   — υπόθεση μεταβίβασης (ADR-901 Φ2)
 * - `document_issuance` — ανάθεση έκδοσης εγγράφου, π.χ. ΠΕΑ (ADR-915 §27)
 * - `property_dossier`  — ο φάκελος ακινήτου **ιδιώτη** (ADR-916 Φ-Ε1 · ADR-866 Φ3): οικοδεσπότης = ο κάτοχος του
 *                         φακέλου, η συμμετοχή ζει **κάτω** από τον φάκελο (`property_dossiers/{pdos}/engagements`)
 *
 * ⚠️ Το πεδίο-κλειδί **διαφέρει** ανά είδος και το λύνει **μόνο** το `lib/auth/engagement-subject.ts`.
 *    Τα αποθηκευμένα έγγραφα μεταβίβασης κρατούν το `caseId` τους — καμία μετανάστευση.
 */
export const ENGAGEMENT_SUBJECT_KINDS = ['conveyance_case', 'document_issuance', 'property_dossier'] as const;
export type EngagementSubjectKind = (typeof ENGAGEMENT_SUBJECT_KINDS)[number];

export interface ConveyanceEngagementSubject {
  readonly kind: 'conveyance_case';
  readonly caseId: string;
}
export interface IssuanceEngagementSubject {
  readonly kind: 'document_issuance';
  /** Το ντετερμινιστικό id της ανάθεσης (`issuanceAssignmentIdOf`, `document_issuance_assignments`). */
  readonly assignmentId: string;
}
export interface DossierEngagementSubject {
  readonly kind: 'property_dossier';
  /** Ο φάκελος (`pdos_*`) — **και** η διαδρομή του εγγράφου (`property_dossiers/{dossierId}/engagements`). */
  readonly dossierId: string;
}
export type EngagementSubject = ConveyanceEngagementSubject | IssuanceEngagementSubject | DossierEngagementSubject;

/**
 * 🔑 **Οι τρεις συσχετίσεις ανά είδος — ΟΛΙΚΟΙ πίνακες.** Τρίτο είδος υπόθεσης **δεν χτίζει** μέχρι να
 * απαντήσει: ποιο εύρος ανοίγει, ποιοι ρόλοι επιτρέπονται, ποιο πρότυπο CDE. Ο γραφέας **παράγει** εύρος
 * και πρότυπο από εδώ· το σχήμα **απορρίπτει** έγγραφο που τα αναμιγνύει.
 */
export const SCOPE_OF_SUBJECT = {
  conveyance_case: 'conveyance:case:view',
  document_issuance: 'issuance:assignment:collaborate',
  property_dossier: 'dossier:files:view',
} as const satisfies Readonly<Record<EngagementSubjectKind, EngagementScope>>;

export const ROLES_OF_SUBJECT = {
  conveyance_case: LEGAL_ENGAGEMENT_ROLES,
  document_issuance: ISSUANCE_ENGAGEMENT_ROLES,
  property_dossier: DOSSIER_ENGAGEMENT_ROLES,
} as const satisfies Readonly<Record<EngagementSubjectKind, readonly EngagementRole[]>>;

export const TEMPLATE_OF_SUBJECT = {
  conveyance_case: 'legal',
  document_issuance: 'issuer',
  property_dossier: 'legal',
} as const satisfies Readonly<Record<EngagementSubjectKind, CdeAudience>>;

/**
 * ADR-916 Φ-Ε1 — η πράξη που γέννησε συμμετοχή στον **φάκελο ιδιώτη**: η πρόσκληση του κατόχου. **Χωρίς** `contactId`:
 * ο ιδιώτης δεν έχει βιβλίο επαφών· η ταυτότητα του επαγγελματία είναι ο λογαριασμός του (`uid`) + η δήλωσή του.
 */
export interface DossierEngagementOrigin {
  readonly kind: 'owner_invitation';
  readonly invitationId: string;
}

/**
 * ADR-916 Φ-Ε1 — **ποια αρχεία του φακέλου φτάνουν** στον επαγγελματία: καρτέλες (κληρονομικότητα φακέλου, όπως
 * Drive/Box) **μείον** ρητές εξαιρέσεις ανά αρχείο (που εκείνοι δεν έχουν). ⚠️ Λίστα **περιοχών** + εξαιρέσεις —
 * ποτέ λίστα επιτρεπόμενων αρχείων (ADR-787 Α5): ό,τι νέο μπαίνει σε επιτρεπόμενη καρτέλα φτάνει, αμέσως.
 * Η κρίση **παράγεται** σε κάθε ανάγνωση (`lib/property-dossier/dossier-share-reach.ts`).
 */
export interface DossierShareReach {
  readonly tabs: readonly PropertyDossierFileTab[];
  readonly excludedFileIds: readonly string[];
}

/** Η πράξη που **γέννησε** τη συμμετοχή σε υπόθεση **γραφείου** (ADR-862 §5.3.1 `originActRef`). */
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

/** ADR-916 Φ-Ε1 — το ίδιο ερώτημα για τους ρόλους του φακέλου ιδιώτη. */
export const DOSSIER_ROLE_REGISTRY_AUTHORITY = {
  owner_lawyer: 'bar-association',
  notary: 'notary-association',
} as const satisfies Readonly<Record<DossierEngagementRole, ChapteredRegistryId>>;

/**
 * **Δηλωμένη** επαγγελματική ιδιότητα (ADR-901 Ε-4) — στιγμιότυπο **ανά υπόθεση**, όπως τη δήλωσε ο ίδιος
 * στην αποδοχή. 🔑 `assurance: 'declared'` — ποτέ «επαληθευμένο»: τα μέρη τη βλέπουν ως «(δηλωμένο)» μέχρι
 * τη φάση επαλήθευσης μητρώου.
 */
export interface DeclaredCredential {
  /**
   * Η αρχή του μητρώου. ADR-862 §5.3.10: **κάθε** αρχή (όχι μόνο με παραρτήματα) — ο ενεργειακός επιθεωρητής
   * δηλώνει αριθμό του **ενός** εθνικού μητρώου ΥΠΕΝ (`national`, χωρίς σύλλογο).
   */
  readonly authority: RegistryAuthorityId;
  readonly number: string;
  /**
   * Σύλλογος (δικηγόροι) ή περιφέρεια (συμβολαιογράφοι) — ελεύθερο κείμενο, όπως στις persona.
   * Σε **εθνική** αρχή (`REGISTRY_AUTHORITY_SCOPE` = `national`) είναι **πάντα** `null` — το επιβάλλει το σχήμα.
   */
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
interface EngagementCore extends ScopedGrant<EngagementScope> {
  readonly id: string;
  /** Ο καλεσμένος — πεδίο για το «Κοινόχρηστα μαζί μου» (collection-group). */
  readonly uid: string;
  /** Το email με το οποίο βρέθηκε ο λογαριασμός — ίχνος, **όχι** κλειδί. */
  readonly email: string;
  /** ΠΑΡΑΓΕΤΑΙ από το είδος της υπόθεσης (`TEMPLATE_OF_SUBJECT`) — ποτέ από τον καλούντα. */
  readonly template: CdeAudience;
  readonly scopes: readonly EngagementScope[];
  readonly state: EngagementState;
  /** ΠΑΡΑΓΕΤΑΙ (`config/engagement-policy.ts`) — ποτέ πληκτρολογημένο (ADR-862 §5.3.3). */
  readonly expiresAt: string;
  readonly consents: readonly EngagementConsent[];
  /** ADR-901 Ε-4 — απόν ⇒ καμία δήλωση (π.χ. πρόταση σε υπάρχοντα λογαριασμό, πριν από τη Φ3). */
  readonly declaredCredential?: DeclaredCredential;
  /**
   * ADR-901 §15 (Γ1) — **για λογαριασμό ποιου χώρου** ανέλαβε: το γραφείο του ή, προσωρινά, ο προσωπικός του χώρος.
   * Γράφεται **μία φορά, στην αποδοχή**, μόνο από τον ΕΝΑ γραφέα. Απόν όσο η συμμετοχή είναι `offered`.
   *
   * ⛔ **Εμφωλευμένο, ποτέ επίπεδο `companyId`**: η συμμετοχή ζει στον χώρο του **οικοδεσπότη** — ένα επίπεδο
   *    `companyId` θα διαβαζόταν από κάθε πύλη μισθωτή (3.10 · 3.35) ως «ο μισθωτής του εγγράφου».
   * ⛔ **Ο κριτής πρόσβασης ΔΕΝ το διαβάζει** (`decideEngagement` = `uid`): απαντά «πού φαίνεται», ποτέ «ποιος βλέπει».
   * ⚠️ **ΜΗΝ το διαβάσεις απευθείας**: η απουσία έχει **μία** ερμηνεία, στο `actingWorkspaceOf` (άγκυρα Α48).
   */
  readonly actingFor?: WorkspaceRef;
  readonly offeredBy: string;
  readonly offeredAt: string;
  readonly respondedAt: string | null;
  readonly revokedAt?: string;
  readonly revokedBy: string | null;
  readonly closedAt: string | null;
  readonly updatedAt: string;
}

/**
 * Συμμετοχή σε υπόθεση **γραφείου** — ζει στο `companies/{hostCompanyId}/projects/{projectId}/engagements`.
 * ADR-916 Φ-Ε1: τα πεδία του οικοδεσπότη-γραφείου **δεν** είναι πια στον κοινό πυρήνα — ο φάκελος ιδιώτη δεν τα έχει.
 */
interface ProjectHostedEngagement extends EngagementCore {
  /** Ο χώρος **του έργου** — ποτέ του καλεσμένου (ADR-862 §2.3, Κ-3). Και πεδίο για collection-group. */
  readonly hostCompanyId: string;
  readonly projectId: string;
  readonly origin: EngagementOrigin;
}

/** Συμμετοχή σε υπόθεση μεταβίβασης (ADR-901) — δικηγόρος πωλητή/αγοραστή ή συμβολαιογράφος. */
export interface ConveyanceEngagement extends ProjectHostedEngagement {
  readonly role: LegalProfessionalRole;
  readonly subject: ConveyanceEngagementSubject;
}

/** Συμμετοχή σε ανάθεση έκδοσης εγγράφου (ADR-915 §27 · ADR-862 §5.3.10). */
export interface IssuanceEngagement extends ProjectHostedEngagement {
  readonly role: IssuanceEngagementRole;
  readonly subject: IssuanceEngagementSubject;
}

/**
 * ADR-916 Φ-Ε1 — συμμετοχή στον **φάκελο ιδιώτη**. Ο οικοδεσπότης **δεν αποθηκεύεται**: είναι ο **σημερινός**
 * κάτοχος του φακέλου (`property_dossiers/{dossierId}.userId`), ώστε η πρόσβαση να ακολουθεί την αλλαγή χεριών.
 */
export interface DossierEngagement extends EngagementCore {
  readonly role: DossierEngagementRole;
  readonly subject: DossierEngagementSubject;
  readonly origin: DossierEngagementOrigin;
  readonly reach: DossierShareReach;
  /** Η διάρκεια που **διάλεξε** ο κάτοχος από το κλειστό μενού πολιτικής — η λήξη **παράγεται** από αυτήν. */
  readonly shareDays: DossierShareDays;
}

/** Οι συμμετοχές που ζουν σε έργο γραφείου. */
export type ProjectEngagement = ConveyanceEngagement | IssuanceEngagement;

/**
 * Το έγγραφο συμμετοχής — **διακριτή ένωση** στο `subject.kind`: ρόλος και υπόθεση πάνε **μαζί**, ώστε ένας
 * «συμβολαιογράφος σε ανάθεση ΠΕΑ» να μην μπορεί καν να γραφτεί.
 */
export type Engagement = ProjectEngagement | DossierEngagement;

/** Η συμμετοχή ενός **συγκεκριμένου** είδους υπόθεσης — για τα ολικά μητρώα ανά είδος (`{[K in EngagementSubjectKind]}`). */
export type EngagementOfKind<K extends EngagementSubjectKind> = Extract<Engagement, { readonly subject: { readonly kind: K } }>;

/** Στενεύει στη μεταβίβαση — ο ΕΝΑΣ φρουρός, στο σύνορο όπου διαβάζεται ο δίσκος (ποτέ `as`). */
export function isConveyanceEngagement(engagement: Engagement): engagement is ConveyanceEngagement {
  return engagement.subject.kind === 'conveyance_case';
}

/** Στενεύει στην ανάθεση έκδοσης. */
export function isIssuanceEngagement(engagement: Engagement): engagement is IssuanceEngagement {
  return engagement.subject.kind === 'document_issuance';
}

/** ADR-916 Φ-Ε1 — στενεύει στον φάκελο ιδιώτη. */
export function isDossierEngagement(engagement: Engagement): engagement is DossierEngagement {
  return engagement.subject.kind === 'property_dossier';
}

/** Στενεύει στις συμμετοχές που ζουν σε έργο γραφείου (έχουν `hostCompanyId` · `projectId`). */
export function isProjectEngagement(engagement: Engagement): engagement is ProjectEngagement {
  return engagement.subject.kind !== 'property_dossier';
}

/** Η διεύθυνση ενός εγγράφου συμμετοχής **έργου** — **τρεις** άξονες, κανένας από τον πελάτη. */
export interface EngagementKey {
  readonly hostCompanyId: string;
  readonly projectId: string;
  readonly engagementId: string;
}

/** ADR-916 Φ-Ε1 — η διεύθυνση συμμετοχής στον φάκελο ιδιώτη: ο φάκελος **είναι** η διαδρομή. */
export interface DossierEngagementKey {
  readonly dossierId: string;
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
