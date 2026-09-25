import 'server-only';

/**
 * @fileoverview **Ο ΣΥΝΔΕΣΜΟΣ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ** — γέννηση και ανάγνωση, για **κάθε** είδος.
 * @related ADR-853 §7.4 · §20 · ADR-884 Φ0.5 · lib/tokens/signed-token (η κρυπτογραφία)
 * @module server/invitations/invitation-token
 *
 * 🔑 **Διάταξη `[id, nonce, expiresAtMs, ...locator]`.** Το είδος χώρου δεν έχει locator, άρα τα bytes του
 * συνδέσμου του είναι **ταυτόσημα** με πριν την εξαγωγή του πυρήνα — κανένας σύνδεσμος στα εισερχόμενα
 * κάποιου δεν «πέθανε» από τη μεταφορά. Ο locator λέει στον διακομιστή **πού** ζει το έγγραφο όταν δεν
 * αρκεί το id (π.χ. υποσυλλογή κάτω από περιήγηση)· είναι **υπογεγραμμένος**, άρα δεν πλαστογραφείται.
 *
 * ⚠️ **ΧΙΛΙΟΣΤΑ, ΠΟΤΕ ISO** (§7.4): το ISO κουβαλά `:`, τον χαρακτήρα που χωρίζει τα πεδία — το ελάττωμα που
 * κρατούσε κάθε σύνδεσμο προμηθευτή νεκρό από την πρώτη μέρα.
 * ⚠️ **Δικό του μυστικό ανά είδος**: η υπογραφή δεν ξέρει σε ποια πύλη ανήκει· με κοινό μυστικό, σύνδεσμος
 * ενός είδους θα περνούσε για άλλο.
 */

import { sha256HexOfText } from '@/lib/hash/sha256';
import {
  decodeSignedToken,
  encodeSignedToken,
  newTokenNonce,
  requireTokenSecret,
} from '@/lib/tokens/signed-token';

import { invitationRefusalOfToken } from './invitation-guards';

/** GitHub 7 · Autodesk 7 · Auth0 default 7 (ADR-853 §5) — η **προεπιλεγμένη** ζωή μιας πρόσκλησης. */
const INVITATION_LIFETIME_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Η στιγμή λήξης μιας πρόσκλησης που εκδίδεται **τώρα** — σε χιλιοστά. */
export function defaultInvitationExpiryMs(nowValue: string): number {
  return Date.parse(nowValue) + INVITATION_LIFETIME_DAYS * DAY_MS;
}

/** Το τριπλό του πυρήνα — πριν από κάθε locator. */
const CORE_FIELD_COUNT = 3;

interface MintedInvitationToken {
  /** Ωμό **μόνο** στην απάντηση και στο email — στη βάση ζει μόνο το {@link nonceHash}. */
  readonly token: string;
  readonly nonceHash: string;
}

/** **Νέος σύνδεσμος** — πετά αν λείπει το μυστικό (ο εκδότης απαντά 500, δεν στέλνει άκυρο email). */
export async function mintInvitationToken(
  secretEnv: string,
  input: { readonly id: string; readonly expiresAtMs: number; readonly locator: readonly string[] },
): Promise<MintedInvitationToken> {
  const secret = requireTokenSecret(secretEnv);
  const nonce = newTokenNonce();
  const token = encodeSignedToken(secret, [input.id, nonce, String(input.expiresAtMs), ...input.locator]);
  return { token, nonceHash: await sha256HexOfText(nonce) };
}

type InvitationTokenReading =
  | {
      readonly kind: 'read';
      readonly invitationId: string;
      readonly nonceHash: string;
      readonly locator: readonly string[];
    }
  | { readonly kind: 'refused'; readonly reason: 'link-invalid' | 'link-foreign' | 'expired' }
  /** ⚠️ Λείπει **δικό μας** μυστικό — δεν λέγεται στον άνθρωπο ως «πλαστός σύνδεσμος». */
  | { readonly kind: 'secret-missing' };

/**
 * **Διάβασε έναν σύνδεσμο** — υπογραφή, σχήμα, **πρώτος** έλεγχος λήξης (Τ2). Καμία ανάγνωση βάσης: πλαστός
 * σύνδεσμος δεν μας κοστίζει ούτε ένα αίτημα Firestore (ADR-327 §11).
 */
export async function readInvitationToken(
  secretEnv: string,
  token: string,
  locatorCount: number,
  nowValue: string,
): Promise<InvitationTokenReading> {
  let secret: string;
  try {
    secret = requireTokenSecret(secretEnv);
  } catch {
    return { kind: 'secret-missing' };
  }

  const expected = CORE_FIELD_COUNT + locatorCount;
  const verdict = decodeSignedToken(secret, token, expected);
  if (!verdict.ok) return { kind: 'refused', reason: invitationRefusalOfToken(verdict.reason) };
  if (verdict.fields.length !== expected) return { kind: 'refused', reason: 'link-invalid' };

  const [invitationId, nonce, expiresAtMs, ...locator] = verdict.fields as [string, string, string, ...string[]];
  const expiryMs = Number(expiresAtMs);
  if (!Number.isFinite(expiryMs)) return { kind: 'refused', reason: 'link-invalid' };
  if (expiryMs <= Date.parse(nowValue)) return { kind: 'refused', reason: 'expired' };

  return { kind: 'read', invitationId, nonceHash: await sha256HexOfText(nonce), locator };
}
