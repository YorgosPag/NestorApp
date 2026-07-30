/**
 * Authorization codes + PKCE (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΠΡΟΣΤΑΤΕΥΕΙ ΤΟ PKCE ΕΔΩ ΣΥΓΚΕΚΡΙΜΕΝΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο code επιστρέφει στον client μέσω **redirect σε τοπικό port**. Σε ένα
 * μηχάνημα με πολλά προγράμματα, αυτό είναι το πιο εκτεθειμένο σημείο όλης της
 * ροής: όποιος προλάβει να δεσμεύσει το port ή να διαβάσει το URL παίρνει τον
 * code. Το PKCE κάνει τον code **άχρηστο χωρίς τον verifier**, που δεν βγήκε
 * ποτέ από τη μνήμη του νόμιμου client.
 *
 * Γι' αυτό δεν υποστηρίζεται `plain`: εκεί ο verifier ταξιδεύει αυτούσιος στο
 * authorization request, οπότε όποιος βλέπει τον code βλέπει και τον verifier —
 * δηλαδή το μέτρο ακυρώνει τον εαυτό του. Το OAuth 2.1 απαιτεί `S256` όπου
 * είναι τεχνικά δυνατό· για client σε Node/Electron είναι πάντα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΜΙΑΣ ΧΡΗΣΗΣ — ΚΑΙ ΤΙ ΣΗΜΑΙΝΕΙ Η ΔΕΥΤΕΡΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Δεύτερη εξαργύρωση του ίδιου code δεν είναι «λάθος του client». Είναι
 * **σήμα**: ή κάποιος υπέκλεψε τον code, ή τον επαναπαίζει. Το OAuth 2.1 §7.5
 * ζητά τότε ανάκληση **όλων** των tokens που εκδόθηκαν από αυτόν τον code —
 * όχι απλή απόρριψη. Μια σιωπηλή απόρριψη θα άφηνε τον επιτιθέμενο να κρατά
 * λειτουργικό token από την πρώτη, επιτυχή εξαργύρωση.
 *
 * @module lib/oauth/oauth-authorization-code
 * @see ADR-738 §5
 */

import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { createModuleLogger } from '@/lib/telemetry';
import { OAUTH_TTL, type OAuthScope } from './oauth-config';
import { isExpiredDoc } from './oauth-doc-guards';
import { revokeTokenFamily } from './oauth-token-store';

const logger = createModuleLogger('oauth-authorization-code');

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

export interface AuthorizationCodeGrant {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly codeChallenge: string;
  readonly scopes: readonly OAuthScope[];
  readonly uid: string;
  readonly companyId: string;
  readonly globalRole: string;
  /** Canonical resource URI που ζήτησε ο client (RFC 8707). */
  readonly audience: string;
  readonly consentId: string;
}

export type CodeRejection =
  | 'not_found'
  | 'expired'
  | 'already_redeemed'
  | 'client_mismatch'
  | 'redirect_uri_mismatch'
  | 'pkce_failed';

export type CodeRedemption =
  | { readonly ok: true; readonly grant: AuthorizationCodeGrant }
  | { readonly ok: false; readonly rejection: CodeRejection };

export interface CodeRedemptionInput {
  readonly code: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly codeVerifier: string;
}

// ============================================================================
// PKCE
// ============================================================================

/**
 * `S256`: challenge == base64url(SHA-256(verifier)), χωρίς padding.
 *
 * ⚠️ Το padding **έχει σημασία**: το RFC 7636 ορίζει base64url *χωρίς* `=`.
 * Ένας client που στέλνει με padding και ένας server που συγκρίνει ωμά δεν θα
 * ταιριάξουν ποτέ — και το σφάλμα θα έμοιαζε με «λάθος verifier», δηλαδή θα
 * κατηγορούσε τον client για δικό μας bug. Η `base64url` του Node το κάνει ήδη
 * σωστά· καταγράφεται εδώ ώστε να μην «διορθωθεί» ποτέ σε `base64`.
 */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (verifier.length < 43 || verifier.length > 128) return false;
  const computed = createHash('sha256').update(verifier, 'ascii').digest('base64url');
  return computed === challenge;
}

/** Ελέγχει ότι ο challenge είναι συντακτικά base64url μήκους SHA-256. */
export function isWellFormedS256Challenge(challenge: string): boolean {
  return /^[A-Za-z0-9\-_]{43}$/.test(challenge);
}

// ============================================================================
// ΑΠΟΘΗΚΗ
// ============================================================================

function codeDocId(code: string): string {
  const digest = createHash('sha256').update(code, 'utf8').digest('hex');
  return `${ENTERPRISE_ID_PREFIXES.OAUTH_CODE}_${digest}`;
}

/**
 * Εκδίδει authorization code για μια εγκεκριμένη συγκατάθεση.
 *
 * Επιστρέφει το ωμό code **μία φορά**· στη Firestore πάει μόνο το hash του, με
 * την ίδια λογική που τα tokens δεν αποθηκεύονται ωμά.
 */
export async function issueAuthorizationCode(grant: AuthorizationCodeGrant): Promise<string> {
  const code = randomBytes(32).toString('base64url');
  const now = Date.now();

  await getAdminFirestore()
    .collection(COLLECTIONS.OAUTH_CODES)
    .doc(codeDocId(code))
    .set({
      clientId: grant.clientId,
      redirectUri: grant.redirectUri,
      codeChallenge: grant.codeChallenge,
      codeChallengeMethod: 'S256',
      scopes: [...grant.scopes],
      uid: grant.uid,
      companyId: grant.companyId,
      globalRole: grant.globalRole,
      audience: grant.audience,
      consentId: grant.consentId,
      issuedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + OAUTH_TTL.AUTHORIZATION_CODE_MS),
      redeemedAt: null,
      issuedFamilyId: null,
    });

  return code;
}

/**
 * Σημειώνει ποια οικογένεια tokens γεννήθηκε από έναν code.
 *
 * Χωρίς αυτόν τον δεσμό, η ανίχνευση επαναχρησιμοποίησης code θα ήξερε ότι
 * κάτι πήγε στραβά αλλά **όχι τι να ανακαλέσει** — δηλαδή θα ήταν προειδοποίηση
 * χωρίς ενέργεια.
 */
export async function linkCodeToTokenFamily(code: string, familyId: string): Promise<void> {
  await getAdminFirestore()
    .collection(COLLECTIONS.OAUTH_CODES)
    .doc(codeDocId(code))
    .set({ issuedFamilyId: familyId }, { merge: true });
}

// ============================================================================
// ΕΞΑΡΓΥΡΩΣΗ
// ============================================================================

/**
 * Εξαργυρώνει code → grant, με **ατομική** σήμανση χρήσης.
 *
 * ⚠️ Η σήμανση γίνεται μέσα σε `runTransaction`. Χωρίς αυτό, δύο ταυτόχρονα
 * αιτήματα με τον ίδιο code θα διάβαζαν και τα δύο `redeemedAt: null` και θα
 * έπαιρναν και τα δύο tokens — δηλαδή ο κανόνας «μιας χρήσης» θα ίσχυε μόνο
 * όταν κανείς δεν προσπαθεί να τον σπάσει.
 */
export async function redeemAuthorizationCode(
  input: CodeRedemptionInput,
): Promise<CodeRedemption> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.OAUTH_CODES).doc(codeDocId(input.code));

  const outcome = await db.runTransaction<CodeRedemption & { readonly familyId?: string | null }>(
    async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) return { ok: false, rejection: 'not_found' };

      const data = snapshot.data() as FirebaseFirestore.DocumentData;

      if (data.redeemedAt !== null) {
        return {
          ok: false,
          rejection: 'already_redeemed',
          familyId: (data.issuedFamilyId as string | null) ?? null,
        };
      }

      if (isExpiredDoc(data)) return { ok: false, rejection: 'expired' };
      if (data.clientId !== input.clientId) return { ok: false, rejection: 'client_mismatch' };
      if (data.redirectUri !== input.redirectUri) {
        return { ok: false, rejection: 'redirect_uri_mismatch' };
      }
      if (!verifyPkceS256(input.codeVerifier, String(data.codeChallenge))) {
        return { ok: false, rejection: 'pkce_failed' };
      }

      tx.set(ref, { redeemedAt: Timestamp.now() }, { merge: true });

      return {
        ok: true,
        grant: {
          clientId: String(data.clientId),
          redirectUri: String(data.redirectUri),
          codeChallenge: String(data.codeChallenge),
          scopes: (data.scopes as OAuthScope[]) ?? [],
          uid: String(data.uid),
          companyId: String(data.companyId),
          globalRole: String(data.globalRole),
          audience: String(data.audience),
          consentId: String(data.consentId),
        },
      };
    },
  );

  if (!outcome.ok && outcome.rejection === 'already_redeemed') {
    await handleCodeReplay(outcome.familyId ?? null);
    return { ok: false, rejection: 'already_redeemed' };
  }

  return outcome;
}

/** Επανάληψη code ⇒ ανάκληση ό,τι γεννήθηκε από αυτόν (OAuth 2.1 §7.5). */
async function handleCodeReplay(familyId: string | null): Promise<void> {
  if (familyId === null) {
    logger.warn('[OAUTH] Authorization code replayed before any token was issued');
    return;
  }

  const dropped = await revokeTokenFamily(familyId);
  logger.warn('[OAUTH] Authorization code replayed — issued token family revoked', {
    familyId,
    dropped,
  });
}
