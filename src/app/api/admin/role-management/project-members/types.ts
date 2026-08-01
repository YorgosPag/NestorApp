/**
 * @fileoverview Σχήματα εγγράφων και σώματος αιτήματος «μέλη έργου» (ADR-244 Φ.Β)
 *
 * Εξήχθησαν από το `route.ts` (386 γρ. έναντι ορίου 300 για API route, N.7.1).
 */

export interface MemberDoc {
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
