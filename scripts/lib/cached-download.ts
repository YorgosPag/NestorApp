/**
 * @fileoverview **Η ΜΙΑ ΛΗΨΗ ΠΗΓΗΣ ΤΩΝ ΓΕΝΝΗΤΟΡΩΝ** — μία φορά, σε cache εκτός git, με την προέλευση δίπλα.
 * @related ADR-891 Φ2 · ADR-889 (`market-transactions/mama-download.ts`) · ADR-883 (`admin-boundaries/admin-boundary-source.ts`)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΞΗΧΘΗ (N.0.2 — ADR-891 Φ2)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο γεννήτορας των ορίων (ADR-883) και ο γεννήτορας των τιμών (ADR-889) έγραφαν ο καθένας το ίδιο
 * ιδίωμα: «κατέβασε **μία** φορά, κράτα στο `node_modules/.cache`, ξανακατέβασε μόνο αν ζητηθεί».
 * Ο τρίτος (ο χάρτης φόντου, ADR-891) θα ήταν τρίτο αντίγραφο — και ο πρώτος που **εκτελεί** αυτό
 * που κατεβάζει. Ζει λοιπόν **εδώ**, μία φορά, με τρεις εγγυήσεις που τα αντίγραφα δεν είχαν όλες:
 *
 * 1. **Η προέλευση ταξιδεύει με το αρχείο** — `<αρχείο>.meta.json` με `Last-Modified` + sha256.
 *    Αρχείο χωρίς μεταδεδομένα **ξανακατεβαίνει**: χωρίς προέλευση δεν ξέρουμε **ποια** έκδοση είναι.
 * 2. **Καρφωμένο αποτύπωμα** (`expectedSha256`) — για ό,τι θα **εκτελεστεί**. Ασυμφωνία ⇒ σφάλμα
 *    και **κανένα** αρχείο στον δίσκο. Αλλαγή του καρφώματος ⇒ η παλιά cache δεν γίνεται δεκτή.
 * 3. **Ατομική εγγραφή** — ροή προς `<αρχείο>.part`, hash εν κινήσει, μετονομασία **μετά** τον έλεγχο.
 *    Μια διακοπή στη μέση δεν αφήνει ποτέ μισό αρχείο που μοιάζει ολόκληρο.
 */

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';

const USER_AGENT = 'Mozilla/5.0 (NestorApp data generator)';

export interface CachedSourceMeta {
  readonly url: string;
  /** Ο διακομιστής το δίνει· `null` αν δεν το έδωσε. */
  readonly lastModified: string | null;
  readonly bytes: number;
  readonly sha256: string;
}

export interface CachedSource {
  readonly path: string;
  readonly meta: CachedSourceMeta;
}

export interface CachedSourceRequest {
  readonly url: string;
  /** Πού ζει το αρχείο — **πάντα** κάτω από `node_modules/.cache` (εκτός git). */
  readonly path: string;
  /** Όνομα στην κονσόλα (`↓ <label> … 12.3 MB`). */
  readonly label: string;
  /** Αγνόησε την cache και κατέβασε ξανά. */
  readonly refresh?: boolean;
  /** Καρφωμένο αποτύπωμα — **υποχρεωτικό** για ό,τι εκτελείται. */
  readonly expectedSha256?: string;
}

function metaPathOf(path: string): string {
  return `${path}.meta.json`;
}

/** Η cache γίνεται δεκτή μόνο με μεταδεδομένα — και, αν υπάρχει κάρφωμα, μόνο αν συμφωνεί. */
function readUsableCache(request: CachedSourceRequest): CachedSourceMeta | null {
  const metaPath = metaPathOf(request.path);
  if (request.refresh || !existsSync(request.path) || !existsSync(metaPath)) return null;
  const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as CachedSourceMeta;
  if (request.expectedSha256 !== undefined && meta.sha256 !== request.expectedSha256) return null;
  return meta;
}

async function download(request: CachedSourceRequest): Promise<CachedSourceMeta> {
  process.stdout.write(`  ↓ ${request.label} … `);
  const response = await fetch(request.url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok || response.body === null) {
    throw new Error(`${request.label}: HTTP ${response.status} από ${request.url}`);
  }

  const hash = createHash('sha256');
  let bytes = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      callback(null, chunk);
    },
  });

  const partPath = `${request.path}.part`;
  // Το `fetch` δίνει ReadableStream του DOM· το Node το δέχεται αυτούσιο, μόνο ο τύπος διαφέρει.
  const body = response.body as NodeWebReadableStream<Uint8Array>;
  await pipeline(Readable.fromWeb(body), meter, createWriteStream(partPath));

  const sha256 = hash.digest('hex');
  if (request.expectedSha256 !== undefined && sha256 !== request.expectedSha256) {
    rmSync(partPath, { force: true });
    throw new Error(`${request.label}: sha256 ${sha256} ≠ καρφωμένο ${request.expectedSha256} — ΔΕΝ γίνεται δεκτό`);
  }

  renameSync(partPath, request.path);
  const meta: CachedSourceMeta = { url: request.url, lastModified: response.headers.get('last-modified'), bytes, sha256 };
  writeFileSync(metaPathOf(request.path), `${JSON.stringify(meta, null, 2)}\n`);
  process.stdout.write(`${(bytes / 1e6).toFixed(1)} MB\n`);
  return meta;
}

/** Ό,τι λέει ο διακομιστής για την πηγή **χωρίς** να τη στείλει — ο φθηνός έλεγχος «άλλαξε;» (ADR-889 §11). */
export interface SourceProbe {
  readonly url: string;
  readonly status: number;
  readonly lastModified: string | null;
  /** `Content-Length`· `null` αν δεν δόθηκε. */
  readonly bytes: number | null;
}

/**
 * Η πηγή **απάντησε**, αλλά όχι με το αρχείο (4xx ή απρόσμενο status). Κρατά το `status` **δομημένο**, όχι μόνο μέσα στο
 * κείμενο: ο καλών ξεχωρίζει έτσι έναν **δηλωμένο** περιορισμό πρόσβασης (π.χ. γεωφραγή 403, ADR-889 §11.11) από
 * οποιαδήποτε άλλη αποτυχία, που μένει κόκκινη.
 */
export class SourceHttpError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SourceHttpError';
  }
}

/**
 * Ένας **δηλωμένος, μετρημένος** περιορισμός πρόσβασης σε πηγή (δηλώνεται δίπλα στο URL της). Δεν είναι εξαίρεση για
 * να σωπάσει ένα κόκκινο: αναγνωρίζεται **μόνο** με το ακριβές `status`, και η αυτόματη ανανέωση αναφέρει πότε η πηγή
 * απαντά κανονικά (τότε η δήλωση είναι μπαγιάτικη). Το κόκκινο «τα δεδομένα πάλιωσαν» το δίνει η φρεσκάδα (ADR-889 §11.11).
 */
export interface SourceAccessRestriction {
  readonly kind: 'geo';
  /** Από πού απαντά η πηγή (ISO 3166-1). */
  readonly allowedRegion: string;
  /** Η απάντηση εκτός περιοχής — **μόνο** αυτή αναγνωρίζεται ως ο περιορισμός. */
  readonly status: number;
  /** Πότε μετρήθηκε και από πού. */
  readonly evidence: string;
  readonly adr: string;
}

const PROBE_ATTEMPTS = 3;
const PROBE_BACKOFF_MS = 2_000;

/**
 * ⚠️ **`Accept-Encoding: identity`** — μετρημένο 2026-09-28: με την προεπιλογή του `fetch` (gzip) ο gsis.gr απαντά
 * στο `HEAD` με `Content-Length: 20` (ένα κενό gzip), όχι το μέγεθος του αρχείου ⇒ «άλλαξε» σε ΚΑΘΕ έλεγχο. Και αν
 * ο διακομιστής κωδικοποιήσει παρ' όλα αυτά, το μήκος **δεν** είναι το μέγεθος του αρχείου ⇒ `null`.
 */
async function probeOnce(url: string): Promise<SourceProbe> {
  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'identity' },
  });
  const length = response.headers.get('content-length');
  const encoded = response.headers.get('content-encoding') !== null;
  return {
    url,
    status: response.status,
    lastModified: response.headers.get('last-modified'),
    bytes: length === null || encoded ? null : Number(length),
  };
}

/**
 * `HEAD` με επαναλήψεις. **Απάντηση** του διακομιστή (και 404) επιστρέφεται ως έχει — την κρίνει ο καλών·
 * **σφάλμα δικτύου** ή 5xx επαναλαμβάνεται και, στο τέλος, **πετά**: «πηγή κάτω» είναι κόκκινο, ποτέ «καμία αλλαγή».
 */
export async function probeSource(url: string, attempts = PROBE_ATTEMPTS, backoffMs = PROBE_BACKOFF_MS): Promise<SourceProbe> {
  let failure = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const probe = await probeOnce(url);
      if (probe.status < 500) return probe;
      failure = `HTTP ${probe.status}`;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
  }
  throw new Error(`${url}: η πηγή δεν απάντησε μετά από ${attempts} προσπάθειες (${failure})`);
}

/** sha256 αρχείου **με ροή** — για εξόδους εκατοντάδων MB, που δεν χωρούν ολόκληρες στη μνήμη. */
export async function fileSha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/** Το αρχείο από την cache, αλλιώς (ή με `refresh`, ή με άλλο κάρφωμα) από την πηγή. */
export async function loadCachedSource(request: CachedSourceRequest): Promise<CachedSource> {
  mkdirSync(dirname(request.path), { recursive: true });
  const cached = readUsableCache(request);
  return { path: request.path, meta: cached ?? (await download(request)) };
}
