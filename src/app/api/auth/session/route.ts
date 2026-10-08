/**
 * =============================================================================
 * AUTH SESSION COOKIE ENDPOINT
 * =============================================================================
 *
 * Creates/clears Firebase Auth session cookie for server-side admin pages.
 * Required for production access to Server Components that rely on __session.
 *
 * POST  /api/auth/session   -> sets __session cookie
 * DELETE /api/auth/session  -> clears __session cookie
 *
 * @module api/auth/session
 * @enterprise Security Policy: SESSION_POLICY + SESSION_COOKIE_CONFIG (SSoT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';
import { SESSION_COOKIE_CONFIG, getSessionCookieDurationMs } from '@/lib/auth/security-policy';
import { SIGN_IN_REVOKED_ERROR_CODE } from '@/lib/auth/session-issue-wire';
import { judgeIdToken, type IdTokenVerdict } from '@/lib/auth/token-credentials';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { ensureCompanyDocument } from '@/services/company-document.service';
import { readIdTokenBody } from '@/server/auth/id-token-body';
import { ensureIdentityRecord } from '@/server/auth/identity-record';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AuthSession');

// ============================================================================
// TYPES
// ============================================================================

interface SessionResponse {
  success: boolean;
  message: string;
  error?: string;
  /** Μόνο στην ανακλημένη σύνδεση — η λέξη του σύρματος (`lib/auth/session-issue-wire`). */
  code?: typeof SIGN_IN_REVOKED_ERROR_CODE;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  const environment = getCurrentRuntimeEnvironment();
  const isProduction = environment === 'production';
  const durationMs = getSessionCookieDurationMs();
  const maxAgeSeconds = Math.floor(durationMs / 1000);

  return {
    httpOnly: SESSION_COOKIE_CONFIG.HTTP_ONLY,
    secure: isProduction,
    sameSite: SESSION_COOKIE_CONFIG.SAME_SITE,
    path: SESSION_COOKIE_CONFIG.PATH,
    maxAge: maxAgeSeconds,
  };
}

function buildClearCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  const environment = getCurrentRuntimeEnvironment();
  const isProduction = environment === 'production';

  return {
    httpOnly: SESSION_COOKIE_CONFIG.HTTP_ONLY,
    secure: isProduction,
    sameSite: SESSION_COOKIE_CONFIG.SAME_SITE,
    path: SESSION_COOKIE_CONFIG.PATH,
    maxAge: 0,
  };
}

/**
 * **Το «όχι» του κριτή, στη γλώσσα του HTTP** — κανένα cookie σε καμία από τις τρεις (ADR-908 §3.5).
 *
 * | ετυμηγορία | απάντηση | τι κάνει ο πελάτης |
 * |---|---|---|
 * | `invalid` | 401 | ξαναδοκιμάζει στην επόμενη ανανέωση token |
 * | `revoked` | 401 + `code` | **τελειώνει** τη σύνδεση (`endSignIn`) — το token του δεν θα γίνει ποτέ δεκτό |
 * | `unavailable` | 503 | τίποτα οριστικό: «δεν ξέρω» ≠ «δεν είσαι» (N.12) |
 */
function refusal(outcome: Exclude<IdTokenVerdict['outcome'], 'valid'>): NextResponse<SessionResponse> {
  if (outcome === 'unavailable') {
    return NextResponse.json(
      { success: false, message: 'Session could not be verified', error: 'Sign-in state unavailable' },
      { status: 503 },
    );
  }
  if (outcome === 'revoked') {
    return NextResponse.json(
      { success: false, message: 'Sign-in revoked', error: 'This sign-in was revoked', code: SIGN_IN_REVOKED_ERROR_CODE },
      { status: 401 },
    );
  }
  return NextResponse.json(
    { success: false, message: 'Failed to create session cookie', error: 'Invalid ID token' },
    { status: 401 },
  );
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
const postHandler = async (request: NextRequest): Promise<NextResponse<SessionResponse>> => {
  try {
    const idToken = await readIdTokenBody(request);
    if (idToken === null) {
      return NextResponse.json(
        { success: false, message: 'Invalid request', error: 'idToken is required and must be a string' },
        { status: 400 },
      );
    }

    // 🔴 ADR-908 §3.5 — Η ΕΚΔΟΣΗ ΡΩΤΑ ΤΟΝ ΙΔΙΟ ΚΡΙΤΗ ΜΕ ΤΗΝ ΑΝΑΓΝΩΣΗ, ΚΑΙ ΤΟΝ ΡΩΤΑ **ΠΡΩΤΑ**.
    //
    // Ως τις 2026-10-08 εδώ έτρεχαν **παράλληλα** το `createSessionCookie` και ένα ωμό
    // `adminAuth.verifyIdToken`: ανακλημένη σύνδεση **έπαιρνε** cookie, και το απέρριπτε
    // ο πρώτος αναγνώστης (`verifySessionCookie` → `unlessRevoked`). Μετρημένο: το
    // `__session` ξαναστηνόταν 0,25 s μετά την αποσύνδεση.
    //
    // ⛔ **ΜΗΝ τα ξαναβάλεις σε `Promise.all`**: ο κριτής απαντά **πριν** ζητηθεί cookie.
    //    Η παράλληλη γραφή εξαρτιόταν από το ποιος θα θυμηθεί να πετάξει το αποτέλεσμα.
    const verdict = await judgeIdToken(idToken);
    if (verdict.outcome !== 'valid') return refusal(verdict.outcome);
    const decodedToken = verdict.decoded;

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: getSessionCookieDurationMs(),
    });

    // Proactive workspace bootstrap — fire-and-forget (ADR-316)
    // Creates companies/{companyId} at login time, before any action fires.
    // Eliminates the audit-system race condition for company doc creation.
    const uid = decodedToken.uid;
    const companyId = decodedToken.companyId as string | undefined;
    if (companyId && uid) {
      ensureCompanyDocument(companyId, undefined, uid).catch((err: unknown) => {
        logger.warn('[Session] Workspace bootstrap failed (non-blocking)', {
          uid,
          companyId,
          error: getErrorMessage(err),
        });
      });
    } else if (uid) {
      // ADR-853 Φ1: αυθεντικοποιημένος άνθρωπος ΧΩΡΙΣ χώρο → universal login
      // chokepoint. Γράφει **μόνο ταυτότητα** — κανένα αίτημα, καμία ειδοποίηση.
      //
      // 🔴 Μέχρι τις 2026-09-11 εδώ άνοιγε **αίτημα ένταξης** προς τη ΣΤΑΘΕΡΗ
      //    εταιρεία (`getCompanyId()`) και ειδοποιούσε τους διαχειριστές της —
      //    δηλαδή κάθε νέος άνθρωπος αποδιδόταν σε γραφείο που **κανείς δεν
      //    επέλεξε** (ADR-853 §1). Η ένταξη σε ξένο χώρο ξεκινά πλέον **από τον
      //    χώρο**, με πρόσκληση (ADR-853 Α1)· ο ιδιωτικός χώρος υπάρχει ούτως ή
      //    άλλως (ADR-787 Ε-3 §2), άρα ο άνθρωπος δεν περιμένει κανέναν.
      //
      // Fire-and-forget: δεν μπλοκάρει το session cookie.
      ensureIdentityRecord({
        uid,
        email: (decodedToken.email as string | undefined) ?? '',
        displayName: (decodedToken.name as string | undefined) ?? null,
        authProvider: decodedToken.firebase?.sign_in_provider ?? null,
      }).catch((err: unknown) => {
        logger.warn('[Session] Identity record write failed (non-blocking)', {
          uid,
          error: getErrorMessage(err),
        });
      });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Session cookie created',
    });

    response.cookies.set(
      SESSION_COOKIE_CONFIG.NAME,
      sessionCookie,
      buildSessionCookieOptions()
    );

    return response;
  } catch (error) {
    // ⚠️ **500, ΟΧΙ 401** (ADR-908 §3.5): εδώ φτάνει μόνο ό,τι **χάλασε** — το «όχι» του
    //    κριτή έχει ήδη απαντηθεί παραπάνω. Ένα 401 θα έλεγε στον πελάτη «η ταυτότητά
    //    σου δεν ισχύει» για αστοχία δική μας (ίδιο σκεπτικό με το `api-denial.ts`).
    logger.error('[Session] Session cookie could not be issued', { error: getErrorMessage(error) });
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create session cookie',
        error: 'Session cookie could not be issued',
      },
      { status: 500 }
    );
  }
};

export const POST = withSensitiveRateLimit(postHandler);

/**
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
const deleteHandler = async (): Promise<NextResponse<SessionResponse>> => {
  const response = NextResponse.json({
    success: true,
    message: 'Session cookie cleared',
  });

  response.cookies.set(
    SESSION_COOKIE_CONFIG.NAME,
    '',
    buildClearCookieOptions()
  );

  return response;
};

export const DELETE = withSensitiveRateLimit(deleteHandler);
