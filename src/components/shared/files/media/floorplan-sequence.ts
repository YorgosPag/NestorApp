/**
 * ADR-912 §12.17 — **‹ 1 / 2 › της γκαλερί κατόψεων = η ΙΔΙΑ σειρά με τον θεατή αρχείων** (`FileSequence`, §12.16).
 *
 * Η γκαλερί ξέρει ήδη τη σειρά της (ο πίνακας `floorplanFiles` είναι αυτό που δείχνει), άρα δεν διαβάζει DOM όπως το
 * `useFileSequence`: δίνει το **ίδιο σχήμα**, ώστε να αποδοθεί από το ΕΝΑ `FileSequenceNav` (πλήκτρα ←/→ με
 * `shouldGlobalShortcutYield`, `aria-disabled` στα άκρα, ονόματα για αναγνώστη οθόνης).
 *
 * 🔑 **Άκρα: σταματά** (`clamp`), όπως κάθε θεατής του repo (Drive · Photos). Η γκαλερί έκανε ως τώρα κύκλο.
 * 🔑 **Ένα μόνο αρχείο ⇒ `null`** — καμία πλοήγηση προς το πουθενά (§12.16 «χωρίς βέλη όταν είναι μόνο του»).
 */

import { indexWithin } from '@/lib/array-utils';
import type { FileRecord } from '@/types/file-record';
import type { FileSequence } from '@/components/file-manager/hooks/useFileSequence';

export function floorplanSequenceOf(
  files: readonly FileRecord[],
  index: number,
  select: (index: number) => void,
): FileSequence | null {
  const total = files.length;
  if (total <= 1) return null;
  return {
    index,
    total,
    previous: files[index - 1] ?? null,
    next: files[index + 1] ?? null,
    step: (direction) => {
      const target = indexWithin(index + direction, total, 'clamp');
      if (target !== index) select(target);
    },
  };
}
