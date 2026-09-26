/**
 * =============================================================================
 * ΣΥΝΕΧΙΖΟΜΕΝΟ ΑΝΕΒΑΣΜΑ ΑΠΟ ΤΟΝ ΦΥΛΛΟΜΕΤΡΗΤΗ — τα bytes, κατευθείαν στη συνεδρία του GCS (ADR-884 Φ0.8 · Κ3α)
 * =============================================================================
 *
 * Ο πελάτης του `lib/storage/resumable-upload-session.ts`: ο διακομιστής **άνοιξε** τη συνεδρία αφού έκρινε· εδώ
 * απλώς στέλνονται τα bytes — και **ξαναβρίσκεται η θέση** μετά από διακοπή.
 *
 * 🔑 Το πρωτόκολλο (Google Cloud «resumable uploads»):
 * - τμήματα με `PUT` + `Content-Range: bytes a-b/N` — κάθε τμήμα **πολλαπλάσιο 256 KiB** (εκτός του τελευταίου)·
 * - `308` + `Range: bytes=0-k` ⇒ ο διακομιστής έχει ως το `k`· `200`/`201` ⇒ ολοκληρώθηκε·
 * - μετά από σφάλμα δικτύου: `PUT` **χωρίς σώμα** με `Content-Range: bytes *\/N` ⇒ «πού έμεινα;» — ποτέ από την αρχή.
 *
 * 🏆 Γιατί έτσι και όχι ένα `PUT`: σε εργοτάξιο με κινητό δίκτυο, 40 MB σε ένα αίτημα **δεν** τελειώνουν ποτέ· εδώ μια
 * διακοπή κοστίζει το πολύ **ένα** τμήμα.
 *
 * ⛔ Το URI της συνεδρίας είναι **κλειδί εγγραφής** — δεν καταγράφεται, δεν αποθηκεύεται.
 * **Layering**: leaf — μόνο `fetch` (εγχύσιμο για tests), κανένα React.
 */

/** 8 MiB — πολλαπλάσιο των 256 KiB που απαιτεί το GCS, αρκετά μικρό ώστε μια διακοπή να κοστίζει λίγο. */
export const RESUMABLE_CHUNK_BYTES = 8 * 1024 * 1024;

/** Πόσες διαδοχικές αποτυχίες δικτύου αντέχει ένα ανέβασμα πριν τα παρατήσει. */
const MAX_CONSECUTIVE_FAILURES = 6;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

export interface ResumableTransfer {
  readonly sessionUri: string;
  readonly body: Blob;
  /** 0..1 — μετά από κάθε τμήμα που επιβεβαίωσε ο διακομιστής. */
  onProgress?(fraction: number): void;
  /** Η διακοπή δικτύου — η οθόνη λέει «θα συνεχιστεί», όχι «απέτυχε». */
  onInterrupted?(): void;
  readonly signal?: AbortSignal;
  /** Εγχύσιμα για tests. */
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
}

export type ResumableTransferOutcome = 'completed' | 'aborted' | 'failed';

/** `Range: bytes=0-k` ⇒ `k + 1` bytes στον διακομιστή· απόν ⇒ 0. */
export function committedBytesOf(rangeHeader: string | null): number {
  const match = rangeHeader === null ? null : /bytes=0-(\d+)/.exec(rangeHeader);
  return match ? Number(match[1]) + 1 : 0;
}

type StepResult = { readonly kind: 'offset'; readonly offset: number } | { readonly kind: 'done' };

/** Μία απόκριση του GCS → πού βρισκόμαστε. Ό,τι άλλο (4xx/5xx) ⇒ εξαίρεση: ο βρόχος αποφασίζει αν ξαναδοκιμάσει. */
function stepOf(response: Response): StepResult {
  if (response.status === 200 || response.status === 201) return { kind: 'done' };
  if (response.status === 308) return { kind: 'offset', offset: committedBytesOf(response.headers.get('Range')) };
  throw new Error(`resumable upload responded ${response.status}`);
}

/** «Πού έμεινα;» — `PUT` χωρίς σώμα. */
async function queryOffset(t: ResumableTransfer, doFetch: typeof fetch): Promise<StepResult> {
  const total = t.body.size;
  return stepOf(await doFetch(t.sessionUri, { method: 'PUT', headers: { 'Content-Range': `bytes */${total}` }, signal: t.signal }));
}

async function sendChunk(t: ResumableTransfer, doFetch: typeof fetch, offset: number): Promise<StepResult> {
  const total = t.body.size;
  const end = Math.min(offset + RESUMABLE_CHUNK_BYTES, total) - 1;
  const response = await doFetch(t.sessionUri, {
    method: 'PUT',
    headers: { 'Content-Range': `bytes ${offset}-${end}/${total}` },
    body: t.body.slice(offset, end + 1),
    signal: t.signal,
  });
  return stepOf(response);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * **Στείλε όλα τα bytes στη συνεδρία.** Μετά από αποτυχία ξαναρωτά τη θέση και συνεχίζει, με εκθετική αναμονή.
 * `aborted` ⇒ ο άνθρωπος ακύρωσε· `failed` ⇒ ούτε μετά από {@link MAX_CONSECUTIVE_FAILURES} προσπάθειες.
 */
export async function transferResumable(t: ResumableTransfer): Promise<ResumableTransferOutcome> {
  const doFetch = t.fetchImpl ?? fetch;
  const sleep = t.sleep ?? defaultSleep;
  let offset = 0;
  let failures = 0;
  let resync = false;
  while (offset < t.body.size) {
    if (t.signal?.aborted) return 'aborted';
    try {
      const step = resync ? await queryOffset(t, doFetch) : await sendChunk(t, doFetch, offset);
      if (step.kind === 'done') break;
      offset = step.offset;
      resync = false;
      failures = 0;
      t.onProgress?.(offset / t.body.size);
    } catch {
      if (t.signal?.aborted) return 'aborted';
      failures += 1;
      if (failures > MAX_CONSECUTIVE_FAILURES) return 'failed';
      t.onInterrupted?.();
      resync = true;
      await sleep(Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS));
    }
  }
  t.onProgress?.(1);
  return 'completed';
}
