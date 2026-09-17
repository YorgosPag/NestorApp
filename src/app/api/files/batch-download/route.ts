/**
 * =============================================================================
 * BATCH DOWNLOAD — Ο ΠΕΛΑΤΗΣ ΛΕΕΙ **ΠΟΙΟ**, Ο ΔΙΑΚΟΜΙΣΤΗΣ ΛΕΕΙ **ΠΟΥ**
 * =============================================================================
 *
 * `POST /api/files/batch-download[?custody=personal]` · σώμα: `{ fileIds: string[] }` → `application/zip`
 *
 * @module api/files/batch-download
 * @enterprise ADR-031 — Canonical File Storage · ADR-862 Φ0 Β8 · ADR-742 §7undecies
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΗΤΑΝ ΜΕΧΡΙ ΤΟ Β8 — ΚΑΙ ΓΙΑΤΙ ΚΑΜΙΑ ΠΥΛΗ ΔΕΝ ΤΟ ΕΔΕΙΞΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η διαδρομή δεχόταν **URLs από το σώμα** και τα κατέβαζε με `fetch()`. Ο μόνος
 * έλεγχος ήταν `url.hostname.includes(d)` πάνω σε χειρόγραφη λίστα domains.
 * Μετρημένο 2026-09-16, **δύο** ελαττώματα στην ίδια γραμμή:
 *
 *   1. **Καμία ιδιοκτησία.** Κανένα `fileId`, καμία ανάγνωση `FileRecord`, κανένας
 *      έλεγχος μισθωτή. Όποιος κρατούσε ένα tokenized URL — και το `getDownloadURL()`
 *      τα κάνει **μόνιμα** — κατέβαζε ό,τι θέλει, για πάντα.
 *   2. 🔴 **Το `includes` είναι υποσυμβολοσειρά.** Το
 *      `https://firebasestorage.googleapis.com.<κακόβουλο>.gr/x` **περνούσε**: ο
 *      διακομιστής γινόταν proxy προς αυθαίρετο host (SSRF). Το OWASP το ονομάζει
 *      ρητά — *«substring checks are bypassable»* — και συνιστά **indirection με
 *      opaque identifier**, που είναι ακριβώς αυτό που κάνει τώρα το `fileIds`.
 *
 * ⚠️ Το δικαίωμα ήταν `photos:photos:upload`, που **δεν είναι διαχειριστικό**: ζει
 * στο `config/jobs-registry.ts:202` ως δικαίωμα **εργοταξίου** ⇒ η διαδρομή ήταν
 * προσιτή σε συνηθισμένο χρήστη πεδίου.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ ΤΙ ΕΙΝΑΙ ΤΩΡΑ — Η ΠΡΑΚΤΙΚΗ ΤΩΝ CDE ΤΗΣ ΑΓΟΡΑΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο πελάτης στέλνει **ids**. Ο διακομιστής, για **κάθε** id χωριστά:
 *   1. `fileResource.load()` — υπάρχει; **δικό μου;** (ADR-742)
 *   2. `containerVisibilityRefusal()` — το **βλέπω** καν; (ADR-862 Φ0 Β5/Β8)
 *   3. `getAdminBucket().file(storagePath).download()` — **ποτέ** `fetch(url)`
 *
 * Το ίδιο σχήμα με το Autodesk Construction Cloud: `item_id` → ο διακομιστής
 * βρίσκει το αντικείμενο. **Καμία τοποθεσία δεν έρχεται από τον πελάτη.**
 *
 * 🔑 **Η ΑΡΝΗΣΗ ΕΙΝΑΙ ΣΙΩΠΗΛΗ ΠΑΡΑΛΕΙΨΗ, ΟΧΙ 403 ΑΝΑ ΑΡΧΕΙΟ**: ένα «δεν
 * επιτρέπεσαι» ανά id θα μετέτρεπε τη διαδρομή σε **μαντείο ύπαρξης** — ο αιτών θα
 * δοκίμαζε ids και θα μάθαινε ποια υπάρχουν. Η απάντηση λέει **πόσα** μπήκαν, ποτέ
 * **ποια** κόπηκαν και γιατί (ADR-742 §7.1).
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ProjectMemberRead } from '@/lib/auth/project-member-read';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { attachmentDisposition } from '@/lib/http/content-disposition';
import { fileCallerUid, withFileCustodyAuth, type FileCustodyCaller } from '../_shared/file-custody-route';
import { loadOwnedFileBytes } from '../_shared/owned-file-bytes';
import { buildZip, uniqueZipNames, type ZipEntry } from './zip-builder';

const logger = createModuleLogger('BatchDownloadRoute');

export const maxDuration = 60;

/** Η **ίδια** ικανότητα με τη μονή λήψη — ονομασμένη μία φορά. */
const DOWNLOAD_CAPABILITY = 'dxf:files:view' as const;

/** Πάνω από αυτό, η συσκευασία δεν τελειώνει μέσα στο `maxDuration`. */
const MAX_FILES_PER_BATCH = 50;

/** Τα ids του σώματος, στενεμένα — ό,τι δεν είναι μη-κενή συμβολοσειρά πέφτει. */
function readFileIds(body: unknown): string[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = (body as { fileIds?: unknown }).fileIds;
  if (!Array.isArray(raw)) return null;

  const ids = raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  return ids.map(id => id.trim());
}

/**
 * **Ένα id → bytes, ή `null`.**
 *
 * ⚠️ Το `null` είναι **μία** απάντηση για **τέσσερις** αιτίες (δεν υπάρχει · ξένος
 * μισθωτής · δεν το βλέπεις · δεν έχει αντικείμενο). Είναι σκόπιμο: ο καλών δεν
 * πρέπει να μπορεί να τις ξεχωρίσει. Ο **λόγος** ζει στο log του διακομιστή.
 */
async function fetchOwnedEntry(
  fileId: string,
  caller: FileCustodyCaller,
  cache: Map<string, ProjectMemberRead>,
): Promise<ZipEntry | null> {
  const result = await loadOwnedFileBytes({
    fileId,
    caller,
    action: 'batch-download',
    capability: DOWNLOAD_CAPABILITY,
    // 🔑 50 αρχεία της ίδιας υπόθεσης ⇒ **μία** ανάγνωση μέλους, όχι 50.
    cache,
  });

  // 🔑 **Η βλάβη αυθεντίας ισοπεδώνεται με την άρνηση — ΕΔΩ, και είναι απόφαση
  //    ΤΗΣ ΔΙΑΔΡΟΜΗΣ.** Ο βοηθός τις κρατά **χωριστές** (η μονή λήψη απαντά 503),
  //    αλλά μέσα σε ZIP δεν υπάρχει «ξαναδοκίμασε ΓΙ' ΑΥΤΟ το αρχείο»: το
  //    αρχείο μένει εκτός επειδή δεν **ξέρουμε** αν επιτρέπεται (N.12).
  return result.outcome === 'bytes'
    ? { filename: result.filename, data: new Uint8Array(result.buffer) }
    : null;
}

async function handleBatchDownload(request: NextRequest, caller: FileCustodyCaller): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const fileIds = readFileIds(body);

  if (fileIds === null || fileIds.length === 0) {
    return NextResponse.json({ error: 'No fileIds provided' }, { status: 400 });
  }
  if (fileIds.length > MAX_FILES_PER_BATCH) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES_PER_BATCH} files per batch` },
      { status: 400 },
    );
  }

  try {
    // ⚠️ **Ανά-αίτημα** cache: ζει όσο το αίτημα και πεθαίνει μαζί του. Μια
    //    μακρόβια cache εδώ θα κρατούσε ιδιότητα μέλους που **άλλαξε**.
    const memberCache = new Map<string, ProjectMemberRead>();

    const settled = await Promise.allSettled(
      fileIds.map(fileId => fetchOwnedEntry(fileId, caller, memberCache)),
    );

    const fetched: ZipEntry[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        if (result.value !== null) fetched.push(result.value);
      } else {
        logger.error('Batch entry failed', { error: getErrorMessage(result.reason) });
      }
    }

    if (fetched.length === 0) {
      return NextResponse.json({ error: 'No downloadable files' }, { status: 404 });
    }

    // Τα ονόματα αποσαφηνίζονται **μετά** το φιλτράρισμα: αλλιώς ένα αρχείο που
    // κόπηκε θα «δέσμευε» το `(2)` και ο άνθρωπος θα έπαιρνε κενό αύξοντα αριθμό.
    const names = uniqueZipNames(fetched.map(entry => entry.filename));
    const zipData = buildZip(fetched.map((entry, index) => ({ ...entry, filename: names[index] })));

    logger.info('Batch download complete', {
      userId: fileCallerUid(caller),
      custody: caller.custody,
      requested: fileIds.length,
      included: fetched.length,
      zipSize: zipData.length,
    });

    return new NextResponse(new Uint8Array(zipData), {
      headers: {
        'Content-Type': 'application/zip',
        // 🏢 RFC 6266 + 5987 — SSoT: `lib/http/content-disposition` (ADR-841 Α21.17).
        'Content-Disposition': attachmentDisposition(`files_${nowISO().slice(0, 10)}.zip`),
        'Content-Length': zipData.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    logger.error('Batch download error', { error });
    return NextResponse.json(
      { error: 'Internal server error', details: getErrorMessage(error, 'Unknown') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  // 🔑 ADR-866 §2.6.9 — `?custody=personal` ⇒ ZIP **προσωπικών** αρχείων· ένα αίτημα = ένα διαμέρισμα.
  const handler = withFileCustodyAuth(
    (req: NextRequest, caller: FileCustodyCaller) => handleBatchDownload(req, caller),
    { permissions: DOWNLOAD_CAPABILITY },
  );

  return handler(request);
}
