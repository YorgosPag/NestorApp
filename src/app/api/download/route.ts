/**
 * =============================================================================
 * FORCE-DOWNLOAD PROXY — Ο ΠΕΛΑΤΗΣ ΛΕΕΙ **ΠΟΙΟ**, Ο ΔΙΑΚΟΜΙΣΤΗΣ ΛΕΕΙ **ΠΟΥ**
 * =============================================================================
 *
 * `GET /api/download?fileId=…`          ← **προτιμώμενο** (ADR-862 Φ0 Β8)
 * `GET /api/download?url=…&filename=…`  ← κληρονομιά, πλέον **φρουρούμενη**
 *
 * @module api/download
 * @enterprise ADR-252 AR-M3 (SSRF) · ADR-742 §7undecies · ADR-862 Φ0 Β8
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΗΤΑΝ ΜΕΧΡΙ ΤΟ Β8 — ΤΡΙΑ ΕΛΑΤΤΩΜΑΤΑ ΣΤΗΝ ΙΔΙΑ ΔΙΑΔΡΟΜΗ
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. 🔴 **`withAuth(…, {})` — καμία ικανότητα, μόνο ταυτότητα.** Το
 *     `photos:photos:upload` **αφαιρέθηκε επίτηδες** (`0f947a23`, 2026-05-06) γιατί
 *     έκοβε τα PDF προμηθειών. ⚠️ **Έλυσε λάθος πρόβλημα**: μετρήθηκε 2026-09-16 ότι
 *     τα quote PDF **είναι `FileRecord` με id** — ο `QuoteOriginalDocumentPanel`
 *     περνά ήδη `fileId={activeFile.id}`. Το 401 ήταν λάθος **δικαίωμα** σε ρόλο
 *     προμηθειών (το `photos:photos:upload` ζει στο `jobs-registry.ts:202` ως
 *     δικαίωμα **εργοταξίου**), όχι λάθος **μοντέλο**.
 *  2. 🔴 **`hostname.includes(domain)`** ⇒ το
 *     `https://firebasestorage.googleapis.com.<κακόβουλο>.gr/x` **περνούσε**· και το
 *     δεύτερο σκέλος, `endsWith` **χωρίς τελεία**, δεχόταν το `evilfirebasestorage…`.
 *  3. 🔴 **Το docblock έλεγε ψέματα**: *«Firebase Security Rules provide additional
 *     access control»*. **Όχι**: ο διακομιστής κατέβαζε με το **token του URL** — οι
 *     κανόνες δεν βλέπουν **ποτέ** τον καλούντα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ ΤΙ ΕΙΝΑΙ ΤΩΡΑ — INDIRECTION, ΟΠΩΣ ΤΟ ΖΗΤΑ ΤΟ OWASP
 * ─────────────────────────────────────────────────────────────────────────────
 * Το domain allowlist **δεν αρκεί** ως μόνος έλεγχος· η συνιστώμενη λύση είναι
 * **opaque identifier**. Γι' αυτό η διαδρομή απέκτησε **δεύτερη, προτιμώμενη**
 * είσοδο `?fileId=`, που περνά από την **ίδια** αλυσίδα με κάθε άλλη διαδρομή bytes
 * ({@link loadOwnedFileBytes}) — το μοντέλο `item_id → ο διακομιστής βρίσκει το
 * αντικείμενο` του Autodesk Construction Cloud.
 *
 * ⚠️ **Η παλιά είσοδος ΔΕΝ διαγράφηκε, και είναι μετρημένη απόφαση**: ένας καλών
 * **δεν έχει** `fileId` — οι φωτογραφίες **επαφών** (`usePhotoPreviewState`) δεν
 * είναι `FileRecord`. Fail-closed εκεί θα έσπαγε λειτουργία, fail-open θα ήταν
 * θέατρο. ⇒ Απέκτησε **τρεις** φρουρούς που δεν είχε:
 *
 *   `validateFetchUrl`      → HTTPS · allowlist **ακριβούς** ονόματος · όχι creds · όχι IP
 *   `storageObjectFromUrl`  → **ποιο** αντικείμενο, σε **ποιο** bucket
 *   `judgeStorageCustody`   → **ποιανού** είναι αυτή η διαδρομή
 *
 * 🔑 Και κατεβάζει με **Admin SDK**, όχι `fetch(url)`: το token του URL παύει να
 * είναι ο **τρόπος πρόσβασης** και γίνεται απλώς **δείκτης**, που ο διακομιστής
 * κρίνει πριν τον τιμήσει.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: η είσοδος `?url=` φυλάει **μισθωτή**, όχι **δοχείο** — δεν
 * υπάρχει `FileRecord` για να ρωτηθεί ο κριτής του Β5. Ο ratchet είναι να
 * μηδενιστούν οι καλούντες της, όχι να χαλαρώσει αυτή.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { getAdminBucket } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { attachmentDisposition } from '@/lib/http/content-disposition';
// 🔒 Ο ΕΝΑΣ φρουρός SSRF (ADR-252 AR-M3) — η λίστα των επιτρεπτών host ζει ΕΚΕΙ,
//    ποτέ σε αρχείο διαδρομής (ADR-862 Φ0 Β8, ομάδα `Δ` της άγκυρας).
import { validateFetchUrl } from '@/lib/security/path-sanitizer';
import { storageObjectFromUrl } from '@/lib/storage/storage-object-url';
import { isStorageCustodyServable, judgeStorageCustody } from '@/lib/storage/storage-path-custody';
import { fileCallerUid, withFileCustodyAuth, type FileCustodyCaller } from '../files/_shared/file-custody-route';
import { loadOwnedFileBytes } from '../files/_shared/owned-file-bytes';

const logger = createModuleLogger('DownloadRoute');

export const maxDuration = 30;

/** Η **ίδια** ικανότητα με κάθε άλλη διαδρομή bytes — ονομασμένη μία φορά. */
const DOWNLOAD_CAPABILITY = 'dxf:files:view' as const;

/** Ό,τι παραδίδεται, ανεξάρτητα από ποια είσοδο ήρθε. */
interface Deliverable {
  readonly buffer: Buffer;
  readonly contentType: string;
  readonly filename: string;
}

const refuse = (why: string, status: 400 | 403): NextResponse =>
  NextResponse.json({ error: status === 400 ? 'Invalid URL format' : 'Forbidden', why }, { status });

// =============================================================================
// ΕΙΣΟΔΟΣ Α — `?fileId=` (ΠΡΟΤΙΜΩΜΕΝΗ)
// =============================================================================

/**
 * 🔑 **Καμία δική της αλυσίδα**: καλεί τον **ΕΝΑ** βοηθό, όπως το
 * `files/[fileId]/download` και το `files/batch-download`. Τρίτο χειρόγραφο
 * αντίγραφο θα ήταν ο N.18 / CHECK 3.28 **μέσα στο ίδιο commit**.
 */
async function deliverableById(
  fileId: string,
  caller: FileCustodyCaller,
): Promise<Deliverable | NextResponse> {
  const result = await loadOwnedFileBytes({
    fileId,
    caller,
    action: 'download',
    capability: DOWNLOAD_CAPABILITY,
  });

  if (result.outcome === 'unavailable') {
    // *Άγνωστο ≠ κενό* (N.12): η αυθεντία δεν απάντησε ⇒ **ξαναδοκίμασε**.
    return NextResponse.json({ error: 'authority-unavailable' }, { status: 503 });
  }
  if (result.outcome === 'refused') {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  return { buffer: result.buffer, contentType: result.contentType, filename: result.filename };
}

// =============================================================================
// ΕΙΣΟΔΟΣ Β — `?url=` (ΚΛΗΡΟΝΟΜΙΑ, ΦΡΟΥΡΟΥΜΕΝΗ)
// =============================================================================

/**
 * **Τρεις φρουροί, με αυτή τη σειρά** — και κατέβασμα με Admin SDK.
 *
 * ⚠️ Ο έλεγχος **bucket** δεν είναι πλεονασμός: URL με **σωστό** object path αλλά
 * **ξένο** bucket θα περνούσε τον φρουρό διαδρομής (η διαδρομή μοιάζει δική μας)
 * και θα κατέβαζε αντικείμενο που δεν ελέγχουμε.
 */
async function deliverableByUrl(
  rawUrl: string,
  filename: string,
  ctx: AuthContext,
): Promise<Deliverable | NextResponse> {
  // (1) SSRF — ο **ΥΠΑΡΧΩΝ** φρουρός, όχι χειρόγραφη λίστα.
  //
  // 🔑 Δύο αιτίες, δύο κωδικοί: «δεν είναι καν URL» είναι **λάθος του αιτούντος**
  //    (400), «ξένος πάροχος» είναι **άρνηση** (403). Ένας κωδικός για τα δύο θα
  //    έστελνε τον πελάτη να διορθώσει τη μορφή ενός URL που είναι σωστό.
  const validated = validateFetchUrl(rawUrl);
  if (!validated.valid) {
    logger.error('SECURITY: Blocked download URL', { reason: validated.reason });
    const malformed =
      validated.reason === 'empty_url' || validated.reason === 'invalid_url_format';
    return refuse(validated.reason, malformed ? 400 : 403);
  }

  // (2) Ποιο αντικείμενο, και σε ποιο bucket;
  //
  // ⚠️ Από το **κανονικοποιημένο** URL του φρουρού, ποτέ από το ωμό της
  //    παραμέτρου: ο φρουρός επέστρεψε `parsed.toString()`, δηλαδή ό,τι πράγματι
  //    κρίθηκε. Δύο τιμές εδώ θα ήταν ελεύθερες να αποκλίνουν.
  const ref = storageObjectFromUrl(validated.url);
  if (ref.outcome !== 'object') {
    return refuse(ref.why, 403);
  }

  const bucket = getAdminBucket();
  if (ref.bucket !== null && ref.bucket !== bucket.name) {
    logger.error('SECURITY: URL points at a foreign bucket', { bucket: ref.bucket });
    return refuse('foreign-bucket', 403);
  }

  // (3) Ποιανού είναι αυτή η διαδρομή;
  const verdict = judgeStorageCustody(ref.storagePath, ctx);
  if (!isStorageCustodyServable(verdict)) {
    logger.error('SECURITY: storage custody denied', { verdict, uid: ctx.uid });
    return refuse(verdict, 403);
  }

  // 🔑 **Admin SDK, ποτέ `fetch(url)`**: ο διακομιστής διαβάζει το αντικείμενο **που
  //    έκρινε**, με το δικό του διαπιστευτήριο — όχι με το token που του έδωσαν.
  const file = bucket.file(ref.storagePath);
  const [[buffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);

  return {
    buffer,
    contentType: (metadata.contentType as string | undefined) ?? 'application/octet-stream',
    filename,
  };
}

// =============================================================================
// Ο ΧΕΙΡΙΣΤΗΣ
// =============================================================================

function deliver(item: Deliverable): NextResponse {
  return new NextResponse(new Uint8Array(item.buffer), {
    headers: new Headers({
      'Content-Type': item.contentType,
      // 🏢 RFC 6266 + 5987 — SSoT: `lib/http/content-disposition` (ADR-841 Α21.17).
      'Content-Disposition': attachmentDisposition(item.filename),
      'Content-Length': item.buffer.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    }),
  });
}

async function handleDownload(request: NextRequest, caller: FileCustodyCaller): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const fileUrl = searchParams.get('url');
    const filename = searchParams.get('filename');

    // ⚠️ Το `fileId` κρίνεται **πρώτο**: όταν δίνονται και τα δύο, νικά η είσοδος
    //    που ο διακομιστής μπορεί να **επαληθεύσει πλήρως**.
    if (fileId) {
      const item = await deliverableById(fileId, caller);
      if (item instanceof NextResponse) return item;
      logger.info('DOWNLOAD SUCCESS', {
        uid: fileCallerUid(caller),
        custody: caller.custody,
        via: 'fileId',
        size: item.buffer.length,
      });
      return deliver(item);
    }

    // 🔑 ADR-866 §2.6.9 — η κληρονομιά `?url=` μένει **μόνο εταιρική**: τα προσωπικά αρχεία έχουν
    //    όλα `FileRecord`, άρα **πάντα** `fileId`. Καμία νέα είσοδος χωρίς έγγραφο να κριθεί.
    if (!fileUrl || !filename || caller.custody !== 'company') {
      return NextResponse.json(
        { error: 'Missing required parameter: fileId (or url + filename)' },
        { status: 400 },
      );
    }

    const item = await deliverableByUrl(fileUrl, filename, caller.ctx);
    if (item instanceof NextResponse) return item;
    logger.info('DOWNLOAD SUCCESS', { uid: caller.ctx.uid, via: 'url', size: item.buffer.length });
    return deliver(item);
  } catch (error) {
    logger.error('DOWNLOAD API ERROR', { error });
    return NextResponse.json(
      { error: 'Internal server error during download', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const handler = withFileCustodyAuth(
    (req: NextRequest, caller: FileCustodyCaller) => handleDownload(req, caller),
    // 🔑 **Η ικανότητα επέστρεψε — και είναι η ΣΩΣΤΗ αυτή τη φορά.** Το
    //    `photos:photos:upload` ήταν δικαίωμα **εργοταξίου** και γι' αυτό έκοβε τις
    //    προμήθειες· το `dxf:files:view` είναι η ικανότητα **ανάγνωσης αρχείου**, η
    //    ίδια που ζητούν και οι τρεις αδελφικές διαδρομές bytes.
    { permissions: DOWNLOAD_CAPABILITY },
  );

  return handler(request);
}

// =============================================================================
// 🔒 ΟΙ ΜΗ ΥΠΟΣΤΗΡΙΖΟΜΕΝΕΣ ΜΕΘΟΔΟΙ — ΠΡΟΣΤΑΤΕΥΜΕΝΕΣ, ΟΧΙ ΑΝΟΙΧΤΕΣ
// =============================================================================
//
// ⚠️ Δηλώνουν την **ίδια** ικανότητα με το `GET`. Μέχρι το Β8 δήλωναν
// `photos:photos:upload` ενώ το `GET` **τίποτα** — ασυνέπεια μέσα στο ίδιο αρχείο,
// που έκανε τον αναγνώστη να νομίζει ότι η διαδρομή είναι φρουρούμενη.

const methodNotAllowed = withAuth(
  async () => NextResponse.json({ error: 'Method not allowed. Use GET.' }, { status: 405 }),
  { permissions: DOWNLOAD_CAPABILITY },
);

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
