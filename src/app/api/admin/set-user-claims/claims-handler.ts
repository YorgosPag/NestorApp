import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
// ⚠️ Το `PREDEFINED_ROLES` **έφυγε** από εδώ (ADR-813 Φάση Β): ο κατάλογος των
//    ρόλων δεν έχει καμία δουλειά σε αυτή τη διαδρομή — τον διαβάζουν οι δύο
//    κριτές. Επαναφορά του εδώ σημαίνει ότι κάποιος ξαναγράφει την αντιγραφή.
import { withAuth, isValidGlobalRole, isValidPermission, GLOBAL_ROLES, logClaimsUpdated, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, GlobalRole, PermissionId } from '@/lib/auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { setClaimsWithMirror } from '@/lib/auth/set-claims-with-mirror';
import { composeClaimPayload, checkClaimFits } from '@/lib/auth/claim-payload';
import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

import type { SetUserClaimsRequest, SetUserClaimsResponse } from './types';

const logger = createModuleLogger('SET_USER_CLAIMS');

async function resolveFirebaseUser(
  uid: string,
  email: string
): Promise<{
  user: { email?: string; displayName?: string | null; customClaims?: Record<string, unknown> } | null;
  previousClaims: Record<string, unknown>;
  authLookupFailed: boolean;
  errorResponse?: NextResponse<SetUserClaimsResponse>;
}> {
  try {
    const authUser = await getAdminAuth().getUser(uid);
    logger.info('User found in Firebase Auth', { targetUid: uid, targetEmail: authUser.email });
    if (authUser.email !== email) {
      logger.warn('Email mismatch', { providedEmail: email, actualEmail: authUser.email });
    }
    return { user: authUser, previousClaims: authUser.customClaims || {}, authLookupFailed: false };
  } catch (authError) {
    const authErrorMsg = getErrorMessage(authError);
    logger.warn('Auth.getUser() failed — falling back to Firestore', { targetUid: uid, error: authErrorMsg });

    try {
      const userDoc = await getAdminFirestore().collection(COLLECTIONS.USERS).doc(uid).get();
      if (!userDoc.exists) {
        return {
          user: null, previousClaims: {}, authLookupFailed: true,
          errorResponse: NextResponse.json(
            { success: false, message: 'User not found', error: `UID ${uid} not found in Auth or Firestore` },
            { status: 404 }
          ),
        };
      }
      const fsData = userDoc.data();
      logger.info('User verified via Firestore fallback', { targetUid: uid });
      return { user: { email: fsData?.email as string | undefined }, previousClaims: {}, authLookupFailed: true };
    } catch (_fsError) {
      return {
        user: null, previousClaims: {}, authLookupFailed: true,
        errorResponse: NextResponse.json(
          { success: false, message: 'User not found in Firebase Auth', error: authErrorMsg },
          { status: 404 }
        ),
      };
    }
  }
}

async function syncFirestoreRecords(
  uid: string,
  companyId: string,
  globalRole: GlobalRole,
  finalPermissions: PermissionId[],
  firebaseUser: { email?: string; displayName?: string | null } | null,
  email: string,
  callerUid: string,
  callerEmail: string | null
): Promise<boolean> {
  let firestoreSuccess = true;

  try {
    const userRef = getAdminFirestore().collection(COLLECTIONS.USERS).doc(uid);
    const userDoc = await userRef.get();
    // ⚠️ **ΤΟ ΕΓΓΡΑΦΟ ΓΡΑΦΕΙ ΟΤΙ ΑΚΡΙΒΩΣ ΚΑΙ ΤΟ CLAIM — ΠΟΤΕ ΤΑ «ΠΛΗΡΗ»**
    //    (ADR-813 Φάση Β). Είναι **καθρέφτης** (ADR-360), όχι δεύτερη αυθεντία:
    //    αν εδώ έμπαιναν τα 54 του καταλόγου ενώ το claim κρατά τα extras, τότε
    //    όποιος διάβαζε το έγγραφο θα έβγαζε **άλλη** απάντηση από τον κριτή.
    //
    // 🔴 Δεν είναι υποθετικό: η προηγούμενη συνεδρία συμπέρανε από **αυτό** το
    //    έγγραφο ότι ο `pagonis.oe` έχει `admin_access`, ενώ το claim του **δεν
    //    το είχε** (ADR-813 §2, «τρεις πηγές, τρεις απαντήσεις»). Ένα σχήμα που
    //    έχει ήδη παραπλανήσει άνθρωπο δεν το ξαναγράφουμε.
    //
    // ⚠️ Τα **effective** δικαιώματα δεν αποθηκεύονται πουθενά, επίτηδες:
    //    παράγονται από το `globalRole` (που είναι εδώ) μέσω του καταλόγου.
    const userData = {
      email: firebaseUser?.email || email,
      displayName: firebaseUser?.displayName ?? null,
      companyId, globalRole, permissions: finalPermissions,
      status: 'active', updatedAt: AdminFieldValue.serverTimestamp(),
    };
    if (userDoc.exists) {
      await userRef.update(userData);
      logger.info('Updated user document', { targetUid: uid });
    } else {
      await userRef.set({ ...userData, createdAt: AdminFieldValue.serverTimestamp() });
      logger.info('Created user document', { targetUid: uid });
    }
  } catch (error) {
    logger.error('Failed to update user document', { targetUid: uid, error: getErrorMessage(error) });
    firestoreSuccess = false;
  }

  try {
    const memberRef = getAdminFirestore()
      .collection(COLLECTIONS.COMPANIES).doc(companyId)
      .collection(SUBCOLLECTIONS.WORKSPACE_MEMBERS).doc(uid);
    await memberRef.set({
      uid, globalRole, status: 'active',
      joinedAt: AdminFieldValue.serverTimestamp(),
      addedBy: callerUid, updatedAt: AdminFieldValue.serverTimestamp(),
      permissionSetIds: [],
    }, { merge: true });
    logger.info('Created/updated company member record', { targetUid: uid, companyId });

    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.COMPANY, entityId: companyId, entityName: null,
      action: 'updated', changes: [{ field: 'members', oldValue: null, newValue: uid }],
      performedBy: callerUid, performedByName: callerEmail, companyId,
    }).catch((err) => logger.warn('EntityAudit failed (non-blocking)', { error: getErrorMessage(err) }));
  } catch (error) {
    logger.warn('Failed to update company member record (non-blocking)', { targetUid: uid, error: getErrorMessage(error) });
  }

  return firestoreSuccess;
}

export async function handleSetUserClaims(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<SetUserClaimsResponse>> {
  const startTime = Date.now();
  logger.info('Request received', { callerEmail: ctx.email, callerRole: ctx.globalRole, callerCompanyId: ctx.companyId });

  try {
    const body: SetUserClaimsRequest = await request.json();
    const { uid, companyId, globalRole, email, permissions } = body;

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ success: false, message: 'Invalid uid', error: 'uid is required and must be a string' }, { status: 400 });
    }
    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json({ success: false, message: 'Invalid companyId', error: 'companyId is required and must be a string' }, { status: 400 });
    }
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, message: 'Invalid email', error: 'email is required and must be a string' }, { status: 400 });
    }
    if (!isValidGlobalRole(globalRole)) {
      return NextResponse.json({ success: false, message: 'Invalid globalRole', error: `globalRole must be one of: ${GLOBAL_ROLES.join(', ')}` }, { status: 400 });
    }
    if (permissions && (!Array.isArray(permissions) || permissions.some((p) => !isValidPermission(p)))) {
      return NextResponse.json({ success: false, message: 'Invalid permissions', error: 'permissions must be a valid PermissionId array' }, { status: 400 });
    }

    if (ctx.globalRole === 'company_admin' && companyId !== ctx.companyId) {
      logger.warn('TENANT ISOLATION VIOLATION', { callerEmail: ctx.email, callerCompanyId: ctx.companyId, targetCompanyId: companyId });
      return NextResponse.json({ success: false, message: 'Forbidden', error: 'company_admin can only manage users within their own company' }, { status: 403 });
    }

    logger.info('Setting claims', { targetUid: uid, targetEmail: email, targetCompanyId: companyId, targetGlobalRole: globalRole });

    const { user: firebaseUser, previousClaims, authLookupFailed, errorResponse } = await resolveFirebaseUser(uid, email);
    if (errorResponse) return errorResponse;

    // =========================================================================
    // ΤΟ CLAIM ΚΟΥΒΑΛΑ ΤΑΥΤΟΤΗΤΑ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ ΤΟΥ ΚΑΤΑΛΟΓΟΥ (ADR-813 Φάση Β)
    // =========================================================================
    //
    // 🔴 **ΗΤΑΝ ΔΟΜΙΚΑ ΑΔΥΝΑΤΟ ΝΑ ΦΤΙΑΞΕΙ ΔΥΟ ΡΟΛΟΥΣ.** Η παλιά γραφή ήταν
    //    `rolePermissions ∪ extras ∪ {admin_access}` ⇒ το claim κουβαλούσε
    //    **ολόκληρο** τον κατάλογο του ρόλου. Μετρημένο (2026-08-26, AST πάνω
    //    στο `role-catalogue.ts`, με το `claimsUpdatedAt` του γραφέα μέσα):
    //
    //      company_admin    54 perms → **1.585 bytes**  ⛔
    //      project_manager  42 perms → **1.302 bytes**  ⛔
    //      engineer         25 perms →      855 bytes   ok
    //
    //    Το **hard limit της Firebase είναι 1.000 bytes** («The custom claims
    //    payload must not exceed 1000 bytes») ⇒ `auth/claims-too-large` ⇒ η
    //    διαδρομή που υπάρχει για να **δίνει** τον ρόλο ήταν η μόνη που **δεν
    //    μπορούσε** να τον δώσει. ⚠️ Το ADR-813 §7 είχε μετρήσει **μόνο** το
    //    `company_admin`· ο `project_manager` έλειπε από τη μέτρηση.
    //
    // 🔑 **ΚΑΙ Η ΑΝΤΙΓΡΑΦΗ ΗΤΑΝ ΚΑΘΑΡΟΣ ΠΛΕΟΝΑΣΜΟΣ — ΤΟ ΠΑΡΑΓΟΥΝ ΚΑΙ ΟΙ ΔΥΟ
    //    ΚΡΙΤΕΣ, ΗΔΗ**: `authority.ts` βήμα (6) `roleGrants()` και
    //    `permissions.ts` Check 5 `getRolePermissions(ctx.globalRole)`. Ό,τι
    //    έδινε ο ρόλος, το δίνουν **ούτως ή άλλως**. Το claim πλήρωνε bytes για
    //    να ξαναπεί κάτι που ο κατάλογος λέει καλύτερα — και ο κατάλογος είναι
    //    το SSoT: αλλαγή ρόλου εκεί ίσχυε **αμέσως**, ενώ το claim κρατούσε
    //    **παγωμένο** αντίγραφο μέχρι το επόμενο γράψιμο (ADR-749: δύο
    //    απαντήσεις σε ένα ερώτημα, με τη μία να παλιώνει σιωπηλά).
    //
    // ⚠️ **ΤΟ `admin_access` ΜΕΝΕΙ ΡΗΤΑ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΡΟΛΗΨΗ**: μετρημένο ότι
    //    ζει **μέσα** στα 54 του `company_admin`, ενώ ο `super_admin` έχει
    //    `permissions: []` (όλη του η δύναμη είναι το `isBypass`). Το
    //    `filterItemsByPermissions` του sidebar κάνει **ωμό `includes`** στο
    //    claim — δεν ρωτά κριτή, δεν κοιτά ρόλο — και **και οι 8** δηλώσεις του
    //    `smart-navigation-factory.ts` ζητούν ακριβώς αυτό το ένα id. Χωρίς
    //    αυτή τη γραμμή, ο διαχειριστής θα έχανε **ολόκληρο** το μενού.
    //
    // ⚠️ **ΜΗΝ ξαναβάλεις τα role permissions «για ασφάλεια»**: θα ξαναφέρει το
    //    όριο, και ο πελάτης τα **παράγει** ήδη (`useEffectivePermissions`).
    //
    // 🔴 **«ΔΙΝΩ ΡΟΛΟ» ΗΤΑΝ «ΚΛΕΙΔΩΝΩ ΕΞΩ».** Η παλιά γραφή είχε σταθερό
    //    `mfaEnrolled: false`, ενώ ο `roleRequiresMfa()` φυλά με αυτό ακριβώς το
    //    πεδίο τις διοικητικές οθόνες ⇒ κάθε ανάθεση ρόλου **έσβηνε** την
    //    εγγραφή MFA του χρήστη. Το ops script **διατηρούσε** ⇒ ήταν δύο
    //    διαδρομές με δύο συμπεριφορές (ADR-749). Πλέον **μία σύνθεση**, στο
    //    `claim-payload.ts`, που την καλούν όλες.
    const newClaims = composeClaimPayload({
      companyId,
      globalRole,
      explicitPermissions: permissions,
      previousClaims,
    });
    const finalPermissions = newClaims.permissions;

    // =========================================================================
    // ΤΟ ΟΡΙΟ ΜΕΤΡΙΕΤΑΙ **ΠΡΙΝ** ΤΗ ΓΡΑΦΗ (ADR-813 Φάση Β)
    // =========================================================================
    //
    // 🔑 **ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ Η ΑΦΑΙΡΕΣΗ ΤΗΣ ΑΝΤΙΓΡΑΦΗΣ**: το request δέχεται
    //    `permissions?: PermissionId[]` και τα επικυρώνει **ένα-ένα**, χωρίς
    //    **κανένα όριο πλήθους** (γρ. ~145). Χειριστής που στέλνει 54 extras
    //    ξαναφέρνει το **ίδιο** σφάλμα από άλλη πόρτα. Χωρίς αυτόν τον φρουρό
    //    θα είχαμε λύσει το **δείγμα** (ο ρόλος) και αφήσει την **κλάση**.
    //
    // 🏆 Και είναι **σκαλί πάνω από τη Firebase**: εκείνη πετά αδιαφανές
    //    `auth/claims-too-large` χωρίς να πει πόσο, τι, ή γιατί. Εδώ ο χειριστής
    //    μαθαίνει **κατά πόσα bytes** ξεπέρασε και **πόσα** extras έστειλε.
    //
    // ⚠️ **400, όχι 500**: είναι σφάλμα **του αιτήματος** (πάρα πολλά extras),
    //    όχι του διακομιστή — και το μήνυμα λέει τι να αλλάξει ο χειριστής.
    const fit = checkClaimFits(newClaims);
    if (!fit.fits) {
      logger.warn('Claim payload exceeds Firebase limit', {
        targetUid: uid, bytes: fit.bytes, limit: fit.limit, overBy: fit.overBy,
        permissionsCount: finalPermissions.length,
      });
      return NextResponse.json(
        {
          success: false,
          message: 'Claims payload too large',
          error: `Το claim πιάνει ${fit.bytes} bytes και το όριο της Firebase είναι ${fit.limit} (υπέρβαση ${fit.overBy}). Στάλθηκαν ${finalPermissions.length} ρητά permissions — μείωσέ τα· τα δικαιώματα του ρόλου δίνονται ήδη από τον κατάλογο και δεν χρειάζεται να σταλούν.`,
        },
        { status: 400 }
      );
    }

    try {
      await setClaimsWithMirror(uid, newClaims);
      logger.info('Custom claims set successfully', { targetUid: uid, permissionsCount: finalPermissions.length, viaFirestoreFallback: authLookupFailed });

      extractRequestMetadata(request);
      await logClaimsUpdated(ctx, uid, previousClaims, newClaims, `Claims updated by ${ctx.globalRole} ${ctx.email}`)
        .catch((err) => logger.warn('Audit logging failed (non-blocking)', { error: getErrorMessage(err) }));
    } catch (error) {
      logger.error('Failed to set custom claims', { error: getErrorMessage(error) });
      return NextResponse.json({ success: false, message: 'Failed to set custom claims', error: getErrorMessage(error) }, { status: 500 });
    }

    const firestoreSuccess = await syncFirestoreRecords(uid, companyId, globalRole, finalPermissions, firebaseUser, email, ctx.uid, ctx.email ?? null);

    const duration = Date.now() - startTime;
    logger.info('Claims update completed', { durationMs: duration, callerEmail: ctx.email, targetEmail: email, targetCompanyId: companyId, targetGlobalRole: globalRole });

    return NextResponse.json({
      success: true,
      message: 'Custom claims set successfully',
      user: { uid, email: firebaseUser?.email || email, companyId, globalRole, permissions: finalPermissions, customClaimsSet: true, firestoreDocCreated: false },
      warning: !firestoreSuccess ? 'Custom claims set but Firestore sync failed' : undefined,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Unexpected error', { durationMs: duration, error: getErrorMessage(error) });
    return NextResponse.json({ success: false, message: 'Internal server error', error: getErrorMessage(error) }, { status: 500 });
  }
}

export { withAuth };
