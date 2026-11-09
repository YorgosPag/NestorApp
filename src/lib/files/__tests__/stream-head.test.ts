/**
 * @jest-environment node
 *
 * ADR-934 §5.2.2 Μ-β3 — τα πρώτα bytes μιας ροής χωρίς να χαθούν: η κεφαλή είναι ακριβώς τα πρώτα `byteCount` bytes, ακόμη κι
 * όταν τα κομμάτια δεν «κόβονται» εκεί· η ροή που επιστρέφει δίνει **όλα** τα bytes από το 0· η ακύρωσή της φτάνει στην πηγή.
 */

import { peekStreamHead } from '@/lib/files/stream-head';

function sourceOf(chunks: readonly number[][], onCancel?: (reason: unknown) => void): ReadableStream<Uint8Array> {
  const queue = chunks.map((chunk) => new Uint8Array(chunk));
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = queue.shift();
      if (next === undefined) controller.close();
      else controller.enqueue(next);
    },
    cancel(reason) {
      onCancel?.(reason);
    },
  });
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<number[]> {
  const out: number[] = [];
  const reader = stream.getReader();
  for (let next = await reader.read(); !next.done; next = await reader.read()) out.push(...next.value);
  return out;
}

describe('peekStreamHead', () => {
  it('κεφαλή = ακριβώς τα πρώτα N bytes, όταν το όριο πέφτει ΜΕΣΑ σε κομμάτι', async () => {
    const { head } = await peekStreamHead(sourceOf([[1, 2], [3, 4, 5], [6]]), 4);
    expect([...head]).toEqual([1, 2, 3, 4]);
  });

  it('🔑 η επιστρεφόμενη ροή δίνει ΟΛΑ τα bytes από το 0 — όχι από εκεί που σταμάτησε η κρίση', async () => {
    const { stream } = await peekStreamHead(sourceOf([[1, 2], [3, 4, 5], [6]]), 4);
    expect(await drain(stream)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('ροή μικρότερη από την κεφαλή ⇒ κεφαλή = όλη η ροή, και η ροή κλείνει κανονικά', async () => {
    const { head, stream } = await peekStreamHead(sourceOf([[9, 8]]), 16);
    expect([...head]).toEqual([9, 8]);
    expect(await drain(stream)).toEqual([9, 8]);
  });

  it('κενή ροή ⇒ κενή κεφαλή, κενή ροή', async () => {
    const { head, stream } = await peekStreamHead(sourceOf([]), 8);
    expect(head).toHaveLength(0);
    expect(await drain(stream)).toEqual([]);
  });

  it('🔴 ακύρωση της νέας ροής ⇒ ακυρώνεται η ΠΗΓΗ (κλείνει η σύνδεση με τον τρίτο)', async () => {
    const onCancel = jest.fn();
    const { stream } = await peekStreamHead(sourceOf([[1], [2], [3], [4]], onCancel), 1);
    await stream.cancel('rejected');
    expect(onCancel).toHaveBeenCalledWith('rejected');
  });

  it('σφάλμα της πηγής ΜΕΤΑ την κεφαλή ⇒ φτάνει στον αναγνώστη της νέας ροής', async () => {
    let pulls = 0;
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) controller.enqueue(new Uint8Array([1, 2]));
        else controller.error(new Error('source broke'));
      },
    });
    const { head, stream } = await peekStreamHead(failing, 2);
    expect([...head]).toEqual([1, 2]);
    await expect(drain(stream)).rejects.toThrow('source broke');
  });
});
