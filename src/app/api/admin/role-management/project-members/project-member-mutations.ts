/**
 * @fileoverview Οι τρεις μεταλλάξεις μέλους έργου: ανάθεση / ενημέρωση / αφαίρεση
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (N.7.1 · N.18)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `route.ts` είχε φτάσει τις 386 γραμμές έναντι ορίου 300 για API route, και
 * **μέσα** στο ίδιο αρχείο το `jscpd` μετρούσε κλώνο 10 γραμμών: οι κλάδοι
 * `update` και `remove` έγραφαν **αυτολεξεί** την ίδια τριάδα «βρες το μέλος →
 * αν λείπει γύρνα 404 → διάβασε την προηγούμενη κατάσταση».
 *
 * Και τα δύο ευρήματα έχουν την **ίδια** αιτία και την ίδια θεραπεία: η τριάδα
 * ζει τώρα μία φορά στο {@link loadExistingMember}. Δεν είναι «συμπίεση για να
 * περάσει ο έλεγχος» — ο κλώνος ήταν το σημείο όπου οι δύο κλάδοι μπορούσαν να
 * αποκλίνουν σιωπηλά (π.χ. ο ένας να αλλάξει το μήνυμα ή τον κωδικό και ο άλλος
 * όχι), κάτι που έχει ήδη συμβεί αλλού σε αυτό το repo (ADR-742 §7septies).
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { FieldValue } from '@/lib/firebaseAdmin';
import { generateMemberId } from '@/services/enterprise-id.service';
import type { ProjectMemberDoc, PostBody } from './types';

/** Η συλλογή μελών ενός έργου, ήδη περιορισμένη στον μισθωτή του καλούντος. */
type MembersCollection = FirebaseFirestore.CollectionReference;
type MemberSnapshot = FirebaseFirestore.QueryDocumentSnapshot;

const NOT_A_MEMBER_MESSAGE = 'User is not a member of this project';

/** Βρίσκει το έγγραφο μέλους από το πεδίο `uid` — `null` όταν δεν υπάρχει. */
async function findMemberByUid(
  membersCol: MembersCollection,
  uid: string,
): Promise<MemberSnapshot | null> {
  const snap = await membersCol.where('uid', '==', uid).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

/**
 * Η κοινή τριάδα των `update`/`remove`: έγγραφο + προηγούμενη κατάσταση, ή **η
 * απάντηση 404** έτοιμη για επιστροφή. Ένα σχήμα άρνησης για δύο κλάδους —
 * κανένας τους δεν μπορεί πια να αποκλίνει από τον άλλο.
 */
async function loadExistingMember(
  membersCol: MembersCollection,
  uid: string,
): Promise<{ doc: MemberSnapshot; prev: ProjectMemberDoc } | { missing: NextResponse }> {
  const doc = await findMemberByUid(membersCol, uid);

  if (!doc) {
    return {
      missing: NextResponse.json(
        { success: false, error: NOT_A_MEMBER_MESSAGE },
        { status: 404 },
      ),
    };
  }

  return { doc, prev: doc.data() as ProjectMemberDoc };
}

export interface MutationContext {
  membersCol: MembersCollection;
  ctx: AuthContext;
  validated: PostBody;
}

/** `assign` — προσθήκη νέου μέλους· 409 αν είναι ήδη μέλος. */
export async function assignMember({
  membersCol,
  ctx,
  validated,
}: MutationContext): Promise<NextResponse> {
  const { projectId, uid, roleId, permissionSetIds, reason } = validated;

  if (!roleId) {
    return NextResponse.json(
      { success: false, error: 'roleId is required for assign action' },
      { status: 400 },
    );
  }

  if (await findMemberByUid(membersCol, uid)) {
    return NextResponse.json(
      { success: false, error: 'User is already a member of this project' },
      { status: 409 },
    );
  }

  // Enterprise ID: setDoc() + generateMemberId() (ADR-017)
  // 🔑 ΤΟ ΚΛΕΙΔΙ ΕΙΝΑΙ `mbr_…` ΚΑΙ ΤΟ `uid` ΕΙΝΑΙ **ΠΕΔΙΟ** (N.6 · ADR-787 §5.1) —
  //    γι' αυτό ο ΕΝΑΣ αναγνώστης (`lib/auth/project-member-read.ts`) ρωτά
  //    `where('uid','==',…)`, την **ίδια** ερώτηση με το `findMemberByUid` εδώ.
  //    ⛔ ΜΗΝ αλλάξεις το κλειδί σε `uid`: θα έσπαγε τον N.6 και το ADR-787.
  const memberId = generateMemberId();
  await membersCol.doc(memberId).set({
    uid,
    companyId: ctx.companyId,
    projectId,
    roleId,
    permissionSetIds: permissionSetIds ?? [],
    effectivePermissions: [],
    addedAt: FieldValue.serverTimestamp(),
    addedBy: ctx.uid,
    // ⚠️ **Conditional spread**: το Firestore **απορρίπτει** `undefined`, και ένα
    //    πεδίο γραμμένο κενό θα σήμαινε «δηλώθηκε χωρίς τιμή» αντί «δεν δηλώθηκε»
    //    — δύο απουσίες που ο θεματοφύλακας οφείλει να ξεχωρίζει (ADR-862 Φ0 Β7).
    ...(validated.taskTeamId === undefined ? {} : { taskTeamId: validated.taskTeamId }),
    ...(validated.cdeAudience === undefined ? {} : { cdeAudience: validated.cdeAudience }),
  });

  await logAuditEvent(ctx, 'member_added', uid, 'user', {
    newValue: {
      type: 'project_member',
      value: { projectId, roleId, permissionSetIds: permissionSetIds ?? [], memberId },
    },
    metadata: { reason },
  });

  return NextResponse.json({
    success: true,
    data: { action: 'assign', projectId, uid, memberId },
  });
}

/** `update` — αλλαγή ρόλου ή/και συνόλων δικαιωμάτων υπάρχοντος μέλους. */
export async function updateMember({
  membersCol,
  ctx,
  validated,
}: MutationContext): Promise<NextResponse> {
  const { projectId, uid, roleId, permissionSetIds, reason } = validated;

  const existing = await loadExistingMember(membersCol, uid);
  if ('missing' in existing) return existing.missing;

  const { doc, prev } = existing;

  const updates: Record<string, unknown> = {};
  if (roleId !== undefined) updates.roleId = roleId;
  if (permissionSetIds !== undefined) updates.permissionSetIds = permissionSetIds;
  // 🔑 Η **μετακίνηση ομάδας** είναι πράξη εξουσιοδότησης, άρα περνά από την ίδια
  //    πόρτα με τον ρόλο — και καταγράφεται στο **ίδιο** ίχνος, με `reason`.
  if (validated.taskTeamId !== undefined) updates.taskTeamId = validated.taskTeamId;
  if (validated.cdeAudience !== undefined) updates.cdeAudience = validated.cdeAudience;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  await doc.ref.update(updates);

  await logAuditEvent(ctx, 'member_updated', uid, 'user', {
    previousValue: {
      type: 'project_member',
      value: { projectId, roleId: prev.roleId, permissionSetIds: prev.permissionSetIds },
    },
    newValue: {
      type: 'project_member',
      value: { projectId, ...updates },
    },
    metadata: { reason },
  });

  return NextResponse.json({ success: true, data: { action: 'update', projectId, uid } });
}

/** `remove` — διαγραφή του εγγράφου μέλους. */
export async function removeMember({
  membersCol,
  ctx,
  validated,
}: MutationContext): Promise<NextResponse> {
  const { projectId, uid, reason } = validated;

  const existing = await loadExistingMember(membersCol, uid);
  if ('missing' in existing) return existing.missing;

  const { doc, prev } = existing;
  await doc.ref.delete();

  await logAuditEvent(ctx, 'member_removed', uid, 'user', {
    previousValue: {
      type: 'project_member',
      value: { projectId, roleId: prev.roleId, permissionSetIds: prev.permissionSetIds },
    },
    metadata: { reason },
  });

  return NextResponse.json({ success: true, data: { action: 'remove', projectId, uid } });
}
