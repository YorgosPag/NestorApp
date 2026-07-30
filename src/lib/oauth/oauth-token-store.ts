/**
 * OAuth token store — έκδοση, επικύρωση, ανάκληση (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ OPAQUE TOKENS ΚΑΙ ΟΧΙ JWT
 * ─────────────────────────────────────────────────────────────────────────────
 * Το πρότυπο **δεν** απαιτεί JWT· το RFC 9068 αναφέρεται ως *παράδειγμα*
 * («for example, via the audience claim»). Η απαίτηση είναι να επικυρώνεται το
 * ακροατήριο — όχι η μορφή.
 *
 * Με JWT ο server δεν χρειάζεται αποθήκη για *ανάγνωση*, αλλά χρειάζεται λίστα
 * ανάκλησης για *ακύρωση* — δηλαδή την ίδια αναζήτηση, συν διαχείριση κλειδιών,
 * συν JWKS endpoint, συν rotation. Το πραγματικό ζητούμενο εδώ είναι το
 * αντίθετο: ο Γιώργος πρέπει να κόβει έναν πράκτορα **στη στιγμή**. Άρα opaque
 * token + μία ανάγνωση δίνει το ζητούμενο με λιγότερα κινούμενα μέρη.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΩΜΟ TOKEN ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΟΤΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * Αποθηκεύεται **μόνο** το SHA-256 του μυστικού, και μάλιστα ως το ίδιο το
 * doc id — άρα η αναζήτηση είναι O(1) `get()` χωρίς index και χωρίς σάρωση.
 * Διαρροή αντιγράφου Firestore δίνει hashes, όχι tokens. Το ίδιο σκεπτικό με
 * αποθήκευση κωδικών: η βάση δεν είναι μέρος όπου ζουν διαπιστευτήρια.
 *
 * ⚠️ Το doc id συντίθεται εδώ και **όχι** στο `enterprise-id.service`, παρότι
 * χρησιμοποιεί το πρόθεμά του: το SSoT των id είναι σκόπιμα browser-safe
 * (`cyrb128`, «ΔΕΝ είναι κρυπτογραφικό — μόνο για σταθερή ταυτότητα, όχι
 * security»), ενώ εδώ χρειάζεται πραγματικό SHA-256 από `node:crypto`. Το
 * πρόθεμα έρχεται από το SSoT ώστε το namespace να μένει ενιαίο· η σύνθεση
 * μένει server-only.
 *
 * @module lib/oauth/oauth-token-store
 * @see ADR-738 §5
 */

import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { generateOAuthTokenId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { OAUTH_TTL, type OAuthScope } from './oauth-config';

const logger = createModuleLogger('oauth-token-store');

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

export type OAuthTokenType = 'access' | 'refresh';

/** Ό,τι ένα token κουβαλά — η ταυτότητα *παγώνει* τη στιγμή της έκδοσης. */
export interface OAuthTokenRecord {
  readonly tokenId: string;
  readonly tokenType: OAuthTokenType;
  readonly clientId: string;
  readonly uid: string;
  readonly companyId: string;
  readonly globalRole: string;
  readonly scopes: readonly OAuthScope[];
  /** Canonical URI του resource — RFC 8707. Ελέγχεται σε **κάθε** χρήση. */
  readonly audience: string;
  readonly consentId: string;
  /** Κοινή για access+refresh της ίδιας αλυσίδας — βλ. ανίχνευση επαναχρησιμοποίησης. */
  readonly familyId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly revokedAt: number | null;
}

export type TokenRejection =
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'wrong_type'
  | 'audience_mismatch';

export type TokenLookup =
  | { readonly ok: true; readonly record: OAuthTokenRecord }
  | { readonly ok: false; readonly rejection: TokenRejection };

export interface IssuedTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSeconds: number;
  readonly scopes: readonly OAuthScope[];
  /**
   * Η οικογένεια στην οποία ανήκει το ζεύγος.
   *
   * Επιστρέφεται ώστε ο καλών να τη δέσει με τον authorization code που τη
   * γέννησε. Χωρίς αυτόν τον δεσμό, η ανίχνευση επανάληψης code θα ήξερε ότι
   * κάτι πήγε στραβά αλλά **όχι τι να ανακαλέσει**.
   */
  readonly familyId: string;
}

export interface TokenGrantInput {
  readonly clientId: string;
  readonly uid: string;
  readonly companyId: string;
  readonly globalRole: string;
  readonly scopes: readonly OAuthScope[];
  readonly audience: string;
  readonly consentId: string;
  /** Παραλείπεται στην πρώτη έκδοση· δίνεται σε κάθε ανανέωση. */
  readonly familyId?: string;
}

// ============================================================================
// ΜΥΣΤΙΚΑ
// ============================================================================

/**
 * 256 bits από CSPRNG, σε base64url.
 *
 * Δεν χρησιμοποιείται ο `generateOpaqueToken()` του enterprise-id SSoT (UUID
 * v4 = 122 bits): αυτό εδώ δεν είναι **αναγνωριστικό** αλλά **μυστικό** που
 * φυλάει πρόσβαση σε δεδομένα πελατών, και η σύσταση του NIST για τέτοια είναι
 * ≥128 bits. Το N.6 διέπει τα doc ids — και το doc id **έρχεται** από το SSoT.
 */
function mintSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** Το doc id ενός token = `<πρόθεμα>_<sha256 του μυστικού>`. */
export function tokenDocId(secret: string): string {
  const digest = createHash('sha256').update(secret, 'utf8').digest('hex');
  return `${ENTERPRISE_ID_PREFIXES.OAUTH_TOKEN}_${digest}`;
}

/*
 * ⚠️ Καμία σύγκριση σταθερού χρόνου εδώ — **επίτηδες**. Το μυστικό δεν
 * συγκρίνεται ποτέ με τίποτα: γίνεται hash και το hash **είναι** το κλειδί
 * αναζήτησης. Δεν υπάρχει βρόχος πάνω σε bytes μυστικού, άρα δεν υπάρχει
 * κανάλι χρόνου να κλείσει. Ένα `timingSafeEqual` εδώ θα ήταν ασφάλεια-θέατρο:
 * κώδικας που *φαίνεται* άμυνα ενώ δεν προστατεύει τίποτα, και που μελλοντικά
 * θα δικαιολογούσε την επαναφορά μιας σύγκρισης που δεν πρέπει να υπάρξει.
 */

// ============================================================================
// ΑΝΑΓΝΩΣΗ
// ============================================================================

function toTokenRecord(id: string, data: FirebaseFirestore.DocumentData): OAuthTokenRecord {
  return {
    tokenId: id,
    tokenType: data.tokenType as OAuthTokenType,
    clientId: String(data.clientId),
    uid: String(data.uid),
    companyId: String(data.companyId),
    globalRole: String(data.globalRole),
    scopes: (data.scopes as OAuthScope[]) ?? [],
    audience: String(data.audience),
    consentId: String(data.consentId),
    familyId: String(data.familyId),
    issuedAt: (data.issuedAt as Timestamp)?.toMillis() ?? 0,
    expiresAt: (data.expiresAt as Timestamp)?.toMillis() ?? 0,
    revokedAt: data.revokedAt ? (data.revokedAt as Timestamp).toMillis() : null,
  };
}

/**
 * Ωμό token → εγγραφή, με **όλους** τους ελέγχους.
 *
 * ⚠️ Η σειρά δεν είναι τυχαία: ο έλεγχος ακροατηρίου γίνεται **τελευταίος**,
 * αφού έχει βεβαιωθεί ότι το token υπάρχει και ζει. Έτσι ένα ληγμένο token για
 * λάθος ακροατήριο δεν αποκαλύπτει ποτέ *ποιο* από τα δύο έφταιγε.
 *
 * Το `expectedAudience` είναι **υποχρεωτικό** όρισμα και όχι προαιρετικό: αν
 * ήταν προαιρετικό, μια παράλειψη στο σημείο κλήσης θα περνούσε σιωπηλά και θα
 * καταργούσε τον έλεγχο που το πρότυπο ονομάζει «fundamental OAuth security
 * boundary».
 */
export async function lookupToken(
  secret: string,
  expectedType: OAuthTokenType,
  expectedAudience: string,
): Promise<TokenLookup> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(COLLECTIONS.OAUTH_TOKENS).doc(tokenDocId(secret)).get();

  if (!snapshot.exists) return { ok: false, rejection: 'not_found' };

  const record = toTokenRecord(snapshot.id, snapshot.data() as FirebaseFirestore.DocumentData);

  if (record.tokenType !== expectedType) return { ok: false, rejection: 'wrong_type' };
  if (record.revokedAt !== null) return { ok: false, rejection: 'revoked' };
  if (record.expiresAt <= Date.now()) return { ok: false, rejection: 'expired' };
  if (record.audience !== expectedAudience) return { ok: false, rejection: 'audience_mismatch' };

  return { ok: true, record };
}

// ============================================================================
// ΕΚΔΟΣΗ
// ============================================================================

/**
 * Εκδίδει ζεύγος access + refresh, στην ίδια οικογένεια.
 *
 * Η ταυτότητα (`companyId`, `globalRole`) **παγώνει** εδώ. Δεν διαβάζεται
 * ξανά από τα Firebase claims στη χρήση: ένα token πρέπει να σημαίνει «αυτό
 * που ενέκρινε ο χρήστης τότε», όχι «ό,τι μπορεί ο χρήστης τώρα». Διαφορετικά
 * μια μελλοντική αναβάθμιση ρόλου θα διεύρυνε **αναδρομικά** την εξουσία ενός
 * πράκτορα που ο χρήστης ενέκρινε με λιγότερα δικαιώματα.
 */
export async function issueTokenPair(input: TokenGrantInput): Promise<IssuedTokenPair> {
  const accessSecret = mintSecret();
  const refreshSecret = mintSecret();
  const familyId = input.familyId ?? generateOAuthTokenId();
  const now = Date.now();

  const shared = {
    clientId: input.clientId,
    uid: input.uid,
    companyId: input.companyId,
    globalRole: input.globalRole,
    scopes: [...input.scopes],
    audience: input.audience,
    consentId: input.consentId,
    familyId,
    issuedAt: Timestamp.fromMillis(now),
    revokedAt: null,
  };

  const db = getAdminFirestore();
  const batch = db.batch();
  const collection = db.collection(COLLECTIONS.OAUTH_TOKENS);

  batch.set(collection.doc(tokenDocId(accessSecret)), {
    ...shared,
    tokenType: 'access' satisfies OAuthTokenType,
    expiresAt: Timestamp.fromMillis(now + OAUTH_TTL.ACCESS_TOKEN_MS),
  });
  batch.set(collection.doc(tokenDocId(refreshSecret)), {
    ...shared,
    tokenType: 'refresh' satisfies OAuthTokenType,
    expiresAt: Timestamp.fromMillis(now + OAUTH_TTL.REFRESH_TOKEN_MS),
  });

  await batch.commit();

  return {
    accessToken: accessSecret,
    refreshToken: refreshSecret,
    expiresInSeconds: Math.floor(OAUTH_TTL.ACCESS_TOKEN_MS / 1_000),
    scopes: input.scopes,
    familyId,
  };
}

// ============================================================================
// ΑΝΑΚΛΗΣΗ
// ============================================================================

/** Ανακαλεί ένα συγκεκριμένο token. Idempotent. */
export async function revokeToken(tokenId: string): Promise<void> {
  await getAdminFirestore()
    .collection(COLLECTIONS.OAUTH_TOKENS)
    .doc(tokenId)
    .set({ revokedAt: Timestamp.now() }, { merge: true });
}

/**
 * Ανακαλεί **ολόκληρη** την οικογένεια tokens.
 *
 * Καλείται σε δύο περιπτώσεις: όταν ο χρήστης ανακαλεί συγκατάθεση, και όταν
 * ανιχνευθεί **επαναχρησιμοποίηση** refresh token. Το δεύτερο είναι απαίτηση
 * του OAuth 2.1 για public clients: αν ένα ήδη εξαργυρωμένο refresh εμφανιστεί
 * ξανά, ή το αντίγραφο κλάπηκε ή το δικό μας χάθηκε — και στις δύο περιπτώσεις
 * η μόνη ασφαλής κίνηση είναι να πέσει η αλυσίδα ολόκληρη και να ξαναζητηθεί
 * συγκατάθεση. Ημιμέτρα εδώ αφήνουν τον κλέφτη μέσα.
 */
export async function revokeTokenFamily(familyId: string): Promise<number> {
  return revokeLiveTokensWhere('familyId', familyId);
}

/** Ανακαλεί κάθε token μιας συγκατάθεσης — η πράξη «αποσύνδεση πράκτορα». */
export async function revokeTokensForConsent(consentId: string): Promise<number> {
  return revokeLiveTokensWhere('consentId', consentId);
}

/**
 * Μαζική ανάκληση των **ζωντανών** tokens που ταιριάζουν σε ένα πεδίο ομαδοποίησης.
 *
 * Η οικογένεια και η συγκατάθεση είναι δύο διαφορετικά *ερωτήματα* πάνω στην ίδια
 * πράξη: «σβήσε ό,τι δεν έχει ήδη σβηστεί». Το `revokedAt == null` κρατά το batch
 * idempotent — δεύτερη κλήση δεν ξαναγράφει τίποτα και επιστρέφει 0.
 */
async function revokeLiveTokensWhere(
  field: 'familyId' | 'consentId',
  value: string,
): Promise<number> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.OAUTH_TOKENS)
    .where(field, '==', value)
    .where('revokedAt', '==', null)
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  const revokedAt = Timestamp.now();
  snapshot.docs.forEach((doc) => batch.set(doc.ref, { revokedAt }, { merge: true }));
  await batch.commit();

  return snapshot.size;
}

// ============================================================================
// ΑΝΑΝΕΩΣΗ ΜΕ ΠΕΡΙΣΤΡΟΦΗ
// ============================================================================

export type RefreshOutcome =
  | { readonly ok: true; readonly issued: IssuedTokenPair }
  | { readonly ok: false; readonly rejection: TokenRejection | 'reuse_detected' };

/**
 * Ανταλλάσσει refresh token με νέο ζεύγος, **ανακαλώντας το παλιό**.
 *
 * Αν το προσκομισθέν refresh είναι ήδη ανακλημένο, δεν αρκεί να απορριφθεί:
 * σημαίνει ότι κάποιος κρατά αντίγραφο. Πέφτει **η οικογένεια** (βλ.
 * `revokeTokenFamily`).
 */
export async function rotateRefreshToken(
  secret: string,
  expectedAudience: string,
): Promise<RefreshOutcome> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.OAUTH_TOKENS).doc(tokenDocId(secret));
  const snapshot = await ref.get();

  if (!snapshot.exists) return { ok: false, rejection: 'not_found' };

  const record = toTokenRecord(snapshot.id, snapshot.data() as FirebaseFirestore.DocumentData);
  if (record.tokenType !== 'refresh') return { ok: false, rejection: 'wrong_type' };

  if (record.revokedAt !== null) {
    const dropped = await revokeTokenFamily(record.familyId);
    logger.warn('[OAUTH] Refresh token reuse detected — family revoked', {
      familyId: record.familyId,
      clientId: record.clientId,
      dropped,
    });
    return { ok: false, rejection: 'reuse_detected' };
  }

  if (record.expiresAt <= Date.now()) return { ok: false, rejection: 'expired' };
  if (record.audience !== expectedAudience) return { ok: false, rejection: 'audience_mismatch' };

  await ref.set({ revokedAt: Timestamp.now() }, { merge: true });

  const issued = await issueTokenPair({
    clientId: record.clientId,
    uid: record.uid,
    companyId: record.companyId,
    globalRole: record.globalRole,
    scopes: record.scopes,
    audience: record.audience,
    consentId: record.consentId,
    familyId: record.familyId,
  });

  return { ok: true, issued };
}
