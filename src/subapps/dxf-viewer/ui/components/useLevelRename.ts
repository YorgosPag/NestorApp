'use client';

/**
 * useLevelRename — η επιτόπια μετονομασία ενός επιπέδου στη λίστα του `LevelPanel` (ADR-914 §2.9).
 *
 * Τρεις έξοδοι, όπως σε κάθε πεδίο μετονομασίας της εφαρμογής (`handleInlineRenameKey`):
 * **Enter** = κράτα · **Escape** = πέτα · **απώλεια εστίασης** = κράτα.
 *
 * Το «κράτα» γράφει **μόνο όταν το όνομα άλλαξε**. Πριν, κάθε απώλεια εστίασης έστελνε `PATCH`
 * με το ίδιο όνομα — και μια εστίαση που χανόταν πριν ο άνθρωπος πληκτρολογήσει «ολοκλήρωνε» τη
 * μετονομασία με το παλιό όνομα. Η ολοκλήρωση είναι **ιδεμποτική**: Enter και μετά η απώλεια
 * εστίασης του πεδίου που φεύγει δεν γράφουν δύο φορές.
 *
 * @module subapps/dxf-viewer/ui/components/useLevelRename
 */

import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import { handleInlineRenameKey } from '@/lib/ui/inline-rename-keyboard';

interface RenameTarget {
  readonly id: string;
  readonly name: string;
}

interface UseLevelRenameParams {
  readonly renameLevel: (levelId: string, name: string) => Promise<void> | void;
  /** Ο άνθρωπος άφησε το όνομα κενό — το παλιό όνομα μένει, και του το λέμε. */
  readonly onEmptyName: () => void;
}

export interface LevelRename {
  readonly editingLevelId: string | null;
  readonly editingName: string;
  readonly setEditingName: (name: string) => void;
  readonly startEditing: (level: RenameTarget) => void;
  readonly commit: () => void;
  readonly cancel: () => void;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function useLevelRename({ renameLevel, onEmptyName }: UseLevelRenameParams): LevelRename {
  const [target, setTarget] = useState<RenameTarget | null>(null);
  const [editingName, setEditingName] = useState('');
  // Η ανοιχτή συνεδρία, διαβασμένη τη στιγμή του γεγονότος: το `blur` του πεδίου που φεύγει
  // φτάνει ΜΕΤΑ το Enter/Escape και δεν πρέπει να βρει τίποτα να ολοκληρώσει.
  const sessionRef = useRef<RenameTarget | null>(null);

  const close = useCallback(() => {
    sessionRef.current = null;
    setTarget(null);
    setEditingName('');
  }, []);

  const startEditing = useCallback((level: RenameTarget) => {
    sessionRef.current = { id: level.id, name: level.name };
    setTarget(sessionRef.current);
    setEditingName(level.name);
  }, []);

  const commit = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const name = editingName.trim();
    close();
    if (!name) {
      onEmptyName();
      return;
    }
    if (name !== session.name) void renameLevel(session.id, name);
  }, [editingName, close, onEmptyName, renameLevel]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) =>
      handleInlineRenameKey(event, { onConfirm: commit, onCancel: close }),
    [commit, close],
  );

  return {
    editingLevelId: target?.id ?? null,
    editingName,
    setEditingName,
    startEditing,
    commit,
    cancel: close,
    onKeyDown,
  };
}
