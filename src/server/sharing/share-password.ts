import 'server-only';

/**
 * =============================================================================
 * SHARE PASSWORD — ο κωδικός συνδέσμου κοινοποίησης, μόνο στον διακομιστή (ADR-884 Φ0.12)
 * =============================================================================
 *
 * 🔴 **Πριν το Κ4**: SHA-256 **χωρίς salt**, υπολογισμένο **στον browser** και συγκρινόμενο
 * στον browser, με τον hash να διαβάζεται ανώνυμα από τη συλλογή. Δηλαδή ο «κωδικός»
 * ήταν πίνακας αναζήτησης για οποιονδήποτε: ένα ανώνυμο `list` + ένα rainbow table.
 *
 * **Πρότυπο (OWASP Password Storage Cheat Sheet)**: Argon2id, ή scrypt όταν το Argon2id
 * δεν είναι διαθέσιμο. Η Node 20 που τρέχουμε **δεν** έχει `crypto.argon2` (μετρήθηκε),
 * και ένα εγγενές πακέτο θα έφερνε native build στο Netcup ⇒ **scrypt N=2^16, r=8, p=2**
 * (64 MiB — μία από τις ρυθμίσεις του OWASP), ενσωματωμένο στο `node:crypto`.
 *
 * 🏆 **Αυτοπεριγραφική μορφή**: `scrypt$1$<N>,<r>,<p>$<salt>$<hash>`. Οι παράμετροι
 * ταξιδεύουν **με** τον hash, οπότε:
 *   - αλλαγή παραμέτρων ή αλγορίθμου (Argon2id όταν έρθει Node 24) **δεν** ακυρώνει
 *     κανέναν υπάρχοντα κωδικό — ο παλιός επαληθεύεται με **τις δικές του** παραμέτρους·
 *   - `needsRehash` ⇒ ο καλών ξαναγράφει τον hash **στην πρώτη σωστή είσοδο**
 *     (rehash-on-verify). Έτσι και οι παλιοί SHA-256 αναβαθμίζονται **χωρίς** επαναφορά
 *     κωδικών — ο άνθρωπος δεν μαθαίνει ποτέ ότι άλλαξε κάτι.
 *
 * @module server/sharing/share-password
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'crypto';

import { sha256HexOfText } from '@/lib/hash/sha256';
import { equalsInConstantTime } from '@/lib/tokens/signed-token';

// =============================================================================
// ΠΑΡΑΜΕΤΡΟΙ
// =============================================================================

const ALGORITHM = 'scrypt';
const FORMAT_VERSION = '1';
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/** OWASP: N=2^16 (64 MiB), r=8, p=2. */
const CURRENT_PARAMS = { N: 65536, r: 8, p: 2 } as const;

/** Αποδεκτό εύρος όταν ΔΙΑΒΑΖΟΥΜΕ — ένας πλαστογραφημένος hash δεν μας βάζει να κάψουμε 4 GiB. */
const MAX_ACCEPTED_N = 1 << 17;
const MAX_ACCEPTED_R = 16;
const MAX_ACCEPTED_P = 4;

/** Ο παλιός hash: 64 δεκαεξαδικά = SHA-256 χωρίς salt (πριν το Κ4). */
const LEGACY_SHA256_SHAPE = /^[0-9a-f]{64}$/;

interface ScryptParams {
  readonly N: number;
  readonly r: number;
  readonly p: number;
}

// =============================================================================
// ΠΥΡΗΝΑΣ
// =============================================================================

/**
 * Το `maxmem` της Node είναι 32 MiB εξ ορισμού — **μικρότερο** από τα 64 MiB που ζητάμε,
 * οπότε χωρίς ρητό όριο το scrypt **πετά**. Διπλάσιο της ανάγκης, για περιθώριο.
 */
function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const options: ScryptOptions = {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 256 * params.N * params.r,
  };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_BYTES, options, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/** Νέος hash στη σημερινή μορφή. */
export async function hashSharePassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, CURRENT_PARAMS);
  const { N, r, p } = CURRENT_PARAMS;
  return [ALGORITHM, FORMAT_VERSION, `${N},${r},${p}`, salt.toString('base64url'), key.toString('base64url')].join('$');
}

// =============================================================================
// ΕΠΑΛΗΘΕΥΣΗ
// =============================================================================

export interface SharePasswordVerdict {
  readonly ok: boolean;
  /** Ο hash είναι παλαιότερης μορφής/παραμέτρων — ξαναγράψ' τον αφού `ok`. */
  readonly needsRehash: boolean;
}

interface ParsedScryptHash {
  readonly params: ScryptParams;
  readonly salt: Buffer;
  readonly key: Buffer;
}

function parseScryptHash(stored: string): ParsedScryptHash | null {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== ALGORITHM || parts[1] !== FORMAT_VERSION) return null;
  const [N, r, p] = (parts[2] ?? '').split(',').map(Number);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N < 2 || N > MAX_ACCEPTED_N || r < 1 || r > MAX_ACCEPTED_R || p < 1 || p > MAX_ACCEPTED_P) return null;
  const salt = Buffer.from(parts[3] ?? '', 'base64url');
  const key = Buffer.from(parts[4] ?? '', 'base64url');
  if (salt.length === 0 || key.length !== KEY_BYTES) return null;
  return { params: { N, r, p }, salt, key };
}

function isCurrent(params: ScryptParams): boolean {
  return params.N === CURRENT_PARAMS.N && params.r === CURRENT_PARAMS.r && params.p === CURRENT_PARAMS.p;
}

/**
 * Επαληθεύει κωδικό απέναντι σε αποθηκευμένο hash **οποιασδήποτε** γενιάς.
 *
 * Άγνωστη μορφή ⇒ `ok: false` (ποτέ «πέρνα»): ένας hash που δεν καταλαβαίνουμε δεν
 * μπορεί να επιβεβαιώσει τίποτα.
 */
export async function verifySharePassword(password: string, stored: string): Promise<SharePasswordVerdict> {
  if (LEGACY_SHA256_SHAPE.test(stored)) {
    const candidate = await sha256HexOfText(password);
    const ok = equalsInConstantTime(candidate, stored);
    return { ok, needsRehash: ok };
  }

  const parsed = parseScryptHash(stored);
  if (parsed === null) return { ok: false, needsRehash: false };

  const candidate = await derive(password, parsed.salt, parsed.params);
  const ok = candidate.length === parsed.key.length && timingSafeEqual(candidate, parsed.key);
  return { ok, needsRehash: ok && !isCurrent(parsed.params) };
}
