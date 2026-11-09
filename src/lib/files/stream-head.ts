/**
 * =============================================================================
 * ΤΑ ΠΡΩΤΑ BYTES ΜΙΑΣ ΡΟΗΣ, ΧΩΡΙΣ ΝΑ ΧΑΘΟΥΝ (ADR-934 §5.2.2 Μ-β3)
 * =============================================================================
 *
 * Η κρίση περιεχομένου (`content-signature`) θέλει τα πρώτα bytes **πριν** αποφασιστεί αν αξίζει να κατέβει το υπόλοιπο:
 * σελίδα HTML ή λάθος είδος απορρίπτεται χωρίς να περάσουν τα επόμενα 500 MiB. Το {@link peekStreamHead} διαβάζει όσα
 * κομμάτια χρειάζονται για τα πρώτα `byteCount` bytes και δίνει **ξανά ολόκληρη** τη ροή — τα ίδια κομμάτια πρώτα, μετά
 * τα υπόλοιπα — ώστε ο επόμενος (αποθήκευση · sha256) να μετρήσει **όλα** τα bytes, όχι από το σημείο που σταμάτησε η κρίση.
 *
 * 🔑 **Ακύρωση προς τα πίσω**: `cancel()` της νέας ροής ακυρώνει την αρχική ⇒ η σύνδεση με τον τρίτο κλείνει (το συμβόλαιο
 *   του `fetchGuardedStream`: «ο καλών διαβάζει ή ακυρώνει»).
 * ⛔ **ΚΑΘΑΡΟ** — μόνο Web Streams· ίδια συμπεριφορά σε browser και server.
 *
 * @module lib/files/stream-head
 */

export interface StreamHead {
  /** Τα πρώτα bytes — λιγότερα από `byteCount` μόνο αν η ροή τελείωσε νωρίτερα. */
  readonly head: Uint8Array;
  /** **Ολόκληρη** η ροή, από το byte 0. Ο καλών οφείλει να τη διαβάσει ή να την ακυρώσει. */
  readonly stream: ReadableStream<Uint8Array>;
}

function concat(chunks: readonly Uint8Array[], limit: number): Uint8Array {
  const total = Math.min(limit, chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= total) break;
    const part = chunk.subarray(0, total - offset);
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Η ροή που ξαναδίνει πρώτα τα ήδη διαβασμένα κομμάτια και μετά συνεχίζει από τον ίδιο αναγνώστη. */
function replay(buffered: readonly Uint8Array[], reader: ReadableStreamDefaultReader<Uint8Array>, done: boolean): ReadableStream<Uint8Array> {
  const pending = [...buffered];
  let finished = done;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = pending.shift();
      if (next !== undefined) {
        controller.enqueue(next);
        return;
      }
      if (finished) {
        controller.close();
        return;
      }
      const result = await reader.read();
      if (result.done) {
        finished = true;
        controller.close();
        return;
      }
      controller.enqueue(result.value);
    },
    async cancel(reason) {
      pending.length = 0;
      if (!finished) await reader.cancel(reason);
    },
  });
}

/**
 * **Διάβασε τα πρώτα `byteCount` bytes** και πάρε πίσω ολόκληρη τη ροή. Σφάλμα της πηγής κατά την προανάγνωση ⇒ πετά (η
 * σύνδεση έχει ήδη κοπεί από την ίδια την πηγή).
 */
export async function peekStreamHead(source: ReadableStream<Uint8Array>, byteCount: number): Promise<StreamHead> {
  const reader = source.getReader();
  const buffered: Uint8Array[] = [];
  let collected = 0;
  let done = false;
  while (collected < byteCount) {
    const result = await reader.read();
    if (result.done) {
      done = true;
      break;
    }
    buffered.push(result.value);
    collected += result.value.length;
  }
  return { head: concat(buffered, byteCount), stream: replay(buffered, reader, done) };
}
