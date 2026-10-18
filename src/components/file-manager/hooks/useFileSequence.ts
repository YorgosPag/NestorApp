'use client';

/**
 * ADR-912 §12.16 — **«Προηγούμενο / επόμενο αρχείο» στον θεατή**, με τη σειρά της λίστας όπως τη βλέπει ο άνθρωπος.
 *
 * Η σειρά διαβάζεται από την **αποδοσμένη** λίστα (`lib/files/file-sequence`) και ξαναδιαβάζεται όποτε αλλάξει το DOM της
 * (αναζήτηση · ομάδα που άνοιξε · αλλαγή προβολής · νέο αρχείο). Οι γείτονες προφορτώνονται (`file-preview-preload`).
 * Ο ξενιστής δίνει **πού** είναι η λίστα, **ποια** αρχεία ξέρει και **πώς** επιλέγεται ένα — τίποτα άλλο.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  FILE_SEQUENCE_ATTR,
  fileSequenceStopOf,
  readFileSequence,
  sameFileSequence,
} from '@/lib/files/file-sequence';
import type { FileRecord } from '@/types/file-record';

import { preloadFilePreview } from '../file-preview-preload';

export interface FileSequence {
  /** 0-based θέση του τρέχοντος αρχείου. */
  readonly index: number;
  readonly total: number;
  readonly previous: FileRecord | null;
  readonly next: FileRecord | null;
  /** Ένα βήμα· στα άκρα δεν κάνει τίποτα. */
  readonly step: (direction: -1 | 1) => void;
}

export interface FileSequenceSource {
  /** Το στοιχείο που περιέχει τη λίστα· `null` ώσπου να προσαρτηθεί. */
  readonly root: HTMLElement | null;
  /** Τα αρχεία που ξέρει ο ξενιστής — από εδώ γίνονται οι ταυτότητες της λίστας εγγραφές. */
  readonly files: readonly FileRecord[];
  readonly current: FileRecord | null;
  readonly onSelect: (file: FileRecord) => void;
}

/** Οι ταυτότητες της λίστας με τη σειρά της οθόνης· νέος πίνακας μόνο όταν αλλάξει πράγματι η σειρά. */
function useRenderedSequence(root: HTMLElement | null): readonly string[] {
  const [ids, setIds] = useState<readonly string[]>([]);
  useLayoutEffect(() => {
    if (!root) {
      setIds([]);
      return undefined;
    }
    const sync = () => {
      const next = readFileSequence(root);
      setIds((prev) => (sameFileSequence(prev, next) ? prev : next));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: [FILE_SEQUENCE_ATTR] });
    return () => observer.disconnect();
  }, [root]);
  return ids;
}

/** Οι γείτονες του τρέχοντος, έτοιμοι πριν πατηθούν — πρώτα το επόμενο (η συνηθισμένη κατεύθυνση). */
function usePreloadNeighbours(previous: FileRecord | null, next: FileRecord | null): void {
  useEffect(() => {
    if (next) preloadFilePreview(next);
    if (previous) preloadFilePreview(previous);
  }, [previous, next]);
}

export function useFileSequence({ root, files, current, onSelect }: FileSequenceSource): FileSequence | null {
  const ids = useRenderedSequence(root);
  const byId = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const currentId = current?.id ?? null;
  const stop = useMemo(() => (currentId ? fileSequenceStopOf(ids, currentId) : null), [ids, currentId]);
  const previous = (stop?.previousId && byId.get(stop.previousId)) || null;
  const next = (stop?.nextId && byId.get(stop.nextId)) || null;
  usePreloadNeighbours(previous, next);

  // Ο επιλογέας του ξενιστή αλλάζει ταυτότητα σε κάθε render· το βήμα διαβάζει τον τρέχοντα τη στιγμή του πατήματος.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  return useMemo(() => {
    if (!stop) return null;
    const step = (direction: -1 | 1) => {
      const target = direction < 0 ? previous : next;
      if (target) onSelectRef.current(target);
    };
    return { index: stop.index, total: stop.total, previous, next, step };
  }, [stop, previous, next]);
}
