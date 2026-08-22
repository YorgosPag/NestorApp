/**
 * @fileoverview Σχήματα εγγράφων και σώματος αιτήματος «μέλη έργου» (ADR-244 Φ.Β)
 *
 * Εξήχθησαν από το `route.ts` (386 γρ. έναντι ορίου 300 για API route, N.7.1).
 */

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
}
