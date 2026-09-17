/**
 * @fileoverview Σχήματα εγγράφων και σώματος αιτήματος «μέλη έργου» (ADR-244 Φ.Β)
 *
 * Εξήχθησαν από το `route.ts` (386 γρ. έναντι ορίου 300 για API route, N.7.1).
 */

import type { CdeAudience } from '@/types/container-access';
import type { ProjectMemberEnrollment } from '@/types/project-member-enrollment';

/**
 * Μέλος **ΕΡΓΟΥ** — `companies/{W}/projects/{P}/members/{mbr_…}`.
 *
 * ⚠️ **Λεγόταν `MemberDoc` μέχρι 2026-08-22, και υπήρχε ΔΕΥΤΕΡΟ `MemberDoc` με
 * ΑΛΛΑ ΠΕΔΙΑ** σε αδελφό αρχείο (`../users/route.ts`), για το μέλος **ΧΩΡΟΥ**.
 * Ίδιο όνομα, δύο έγγραφα, δύο συλλογές — και το Κ-2 θα γεννούσε **τρίτο**
 * (ADR-787 §5.1 γ · ADR-749).
 *
 * ⛔ ΜΗΝ το ξαναπείς `MemberDoc`. Το μέλος **χώρου** λέγεται
 *    `WorkspaceMembership` (`@/types/workspace-membership`) — άλλο ερώτημα,
 *    άλλο έγγραφο, άλλο όνομα.
 */
export interface ProjectMemberDoc {
  uid: string;
  companyId: string;
  projectId: string;
  roleId: string;
  permissionSetIds: string[];
  effectivePermissions: string[];
  addedAt: FirebaseFirestore.Timestamp | null;
  addedBy: string;
  /**
   * 🔑 **Η ΟΜΑΔΑ ΕΡΓΑΣΙΑΣ ΤΟΥ ISO 19650** (ADR-862 Φ0 Β7) — *«ο ρόλος λέει **τι
   * μπορεί**, η ομάδα λέει **τίνος είναι**»*.
   *
   * ⚠️ **ΔΗΛΩΜΕΝΟ ΚΑΙ ΕΔΩ ΕΠΙΤΗΔΕΣ.** Το **ίδιο** έγγραφο έχει **δύο** τύπους
   * (`ProjectMember` στο `lib/auth/types.ts`), που **ήδη** αποκλίνουν
   * (`addedAt: Date` έναντι `Timestamp`, `PermissionId[]` έναντι `string[]`).
   * Πεδίο σε **έναν** από τους δύο θα μεγάλωνε την απόκλιση — και ο γραφέας ζει
   * σε **αυτή** την πλευρά, δηλαδή ο τύπος που δεν το δηλώνει είναι ο τύπος που
   * **ψεύδεται** για ό,τι γράφεται.
   */
  taskTeamId?: string;
  /** Το πρότυπο συμμετοχής του στην υπόθεση (ADR-862 §5.4.1). */
  cdeAudience?: CdeAudience;
  /** Γιατί είναι μέλος (ADR-862 Φ0 Β14) — απούσα = πριν το Β14. */
  enrollment?: ProjectMemberEnrollment;
}

export interface UserProfileDoc {
  email?: string;
  displayName?: string;
  photoURL?: string;
}

export interface PostBody {
  action: 'assign' | 'update' | 'remove';
  projectId: string;
  uid: string;
  roleId?: string;
  permissionSetIds?: string[];
  reason: string;
  /**
   * Η ομάδα εργασίας — **ρητά δηλωμένη από άνθρωπο** (ADR-862 Φ0 Β7).
   *
   * ⛔ **ΠΟΤΕ παραγόμενη από `disciplineCode`/`StudyGroup`**: εκείνα τα γράφει ο
   * AI enricher **με `confidence`**, και *εξουσιοδότηση από AI είναι
   * εξουσιοδότηση που κανείς δεν υπέγραψε*. Δύο στατικοί από **δύο** γραφεία
   * έχουν **ίδιο** κλάδο μελέτης και **διαφορετικό** WIP.
   */
  taskTeamId?: string;
  cdeAudience?: CdeAudience;
}
