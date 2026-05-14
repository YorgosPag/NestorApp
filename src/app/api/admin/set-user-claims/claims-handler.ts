import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, isValidGlobalRole, isValidPermission, PREDEFINED_ROLES, GLOBAL_ROLES, logClaimsUpdated, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, GlobalRole, PermissionId } from '@/lib/auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
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
    } catch (fsError) {
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
      .collection(SUBCOLLECTIONS.COMPANY_MEMBERS).doc(uid);
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

    const rolePermissions = PREDEFINED_ROLES[globalRole]?.permissions ?? [];
    const mergedPermissions = new Set<PermissionId>([...rolePermissions, ...(Array.isArray(permissions) ? permissions : [])]);
    if (globalRole === 'super_admin' || globalRole === 'company_admin') mergedPermissions.add('admin_access');
    const finalPermissions = Array.from(mergedPermissions).filter(isValidPermission);

    const newClaims = { companyId, globalRole, mfaEnrolled: false, permissions: finalPermissions };

    try {
      await getAdminAuth().setCustomUserClaims(uid, newClaims);
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
